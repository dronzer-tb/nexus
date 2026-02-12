const express = require('express');
const router = express.Router();
const { RateLimiterMemory } = require('rate-limiter-flexible');
const logger = require('../../utils/logger');
const database = require('../../utils/database');
const { comparePassword } = require('../../utils/password');
const { verifyToken, decryptSecret, verifyRecoveryCode } = require('../../utils/totp');
const { createSession, validateSession, destroySession, extractTokenFromRequest } = require('../../utils/session');

/**
 * Authentication Routes with Mandatory 2FA
 * For custom auth system v1.9.5
 */

// Rate limiter for login attempts (5 attempts per 15 minutes)
const loginLimiter = new RateLimiterMemory({
  points: 5,
  duration: 15 * 60, // 15 minutes
  blockDuration: 15 * 60 // Block for 15 minutes after limit
});

// ═══════════════════════════════════════════════════════════════
// POST /api/auth/login - Login with username, password, and 2FA
// ═══════════════════════════════════════════════════════════════

router.post('/login', async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;

  try {
    // Rate limiting check
    try {
      await loginLimiter.consume(ipAddress);
    } catch (rateLimitError) {
      logger.warn(`Login rate limit exceeded for IP: ${ipAddress}`);
      return res.status(429).json({
        success: false,
        error: 'Too many login attempts. Please try again in 15 minutes.'
      });
    }

    const { username, password, totpCode, recoveryCode } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    if (!totpCode && !recoveryCode) {
      return res.status(400).json({
        success: false,
        error: '2FA code is required (TOTP code or recovery code)'
      });
    }

    // Get user by username
    const user = database.getUserByUsername(username);

    if (!user) {
      logger.warn(`Failed login attempt for non-existent user: ${username}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    // Verify password
    const passwordValid = await comparePassword(password, user.password);

    if (!passwordValid) {
      logger.warn(`Failed login attempt for user ${username}: Invalid password`);
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    // Check if 2FA is enabled (it should be mandatory after onboarding)
    if (!user.totp_enabled || !user.totp_secret) {
      logger.error(`User ${username} doesn't have 2FA enabled - this should not happen after onboarding`);
      return res.status(403).json({
        success: false,
        error: '2FA is not enabled for this account. Please contact administrator.'
      });
    }

    // Decrypt TOTP secret
    const totpSecret = decryptSecret(user.totp_secret);

    let valid2FA = false;

    // Verify TOTP code or recovery code
    if (totpCode) {
      valid2FA = verifyToken(totpCode, totpSecret);
      
      if (!valid2FA) {
        logger.warn(`Failed login attempt for user ${username}: Invalid TOTP code`);
        return res.status(401).json({
          success: false,
          error: 'Invalid 2FA code'
        });
      }
    } else if (recoveryCode) {
      // Verify recovery code
      const recoveryCodes = user.recovery_codes ? JSON.parse(user.recovery_codes) : [];
      const verification = verifyRecoveryCode(recoveryCode, recoveryCodes);

      if (!verification.valid) {
        logger.warn(`Failed login attempt for user ${username}: Invalid recovery code`);
        return res.status(401).json({
          success: false,
          error: 'Invalid recovery code'
        });
      }

      // Remove used recovery code
      recoveryCodes.splice(verification.usedIndex, 1);
      database.updateUser(user.id, {
        recoveryCodes: JSON.stringify(recoveryCodes)
      });

      logger.warn(`User ${username} used a recovery code. Remaining: ${recoveryCodes.length}`);
      valid2FA = true;
    }

    if (!valid2FA) {
      return res.status(401).json({
        success: false,
        error: 'Invalid 2FA verification'
      });
    }

    // Create session
    const session = createSession(user.id, {
      ipAddress,
      userAgent: req.headers['user-agent']
    });

    // Update last login
    database.updateUser(user.id, {
      // Add last_login field if needed (would need migration)
    });

    logger.info(`User ${username} logged in successfully from ${ipAddress}`);

    res.json({
      success: true,
      message: 'Login successful',
      token: session.token,
      expiresAt: session.expiresAt,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/auth/logout - Logout and destroy session
// ═══════════════════════════════════════════════════════════════

router.post('/logout', (req, res) => {
  try {
    const token = extractTokenFromRequest(req);

    if (token) {
      destroySession(token);
      logger.info('User logged out successfully');
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/auth/me - Get current user info
// ═══════════════════════════════════════════════════════════════

router.get('/me', (req, res) => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const session = validateSession(token);

    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session'
      });
    }

    // Get user data
    const user = database.getUserById(session.user_id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        totpEnabled: user.totp_enabled === 1,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user info'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/auth/verify-session - Verify if session is valid
// ═══════════════════════════════════════════════════════════════

router.post('/verify-session', (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }

    const session = validateSession(token);

    if (!session) {
      return res.json({
        success: true,
        valid: false,
        message: 'Session is invalid or expired'
      });
    }

    res.json({
      success: true,
      valid: true,
      expiresAt: session.expires_at
    });

  } catch (error) {
    logger.error('Verify session error:', error);
    res.status(500).json({
      success: false,
      error: 'Session verification failed'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/auth/verify-2fa - Verify 2FA code (for console access)
// ═══════════════════════════════════════════════════════════════

router.post('/verify-2fa', async (req, res) => {
  try {
    const token = extractTokenFromRequest(req);
    const { totpCode } = req.body;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    if (!totpCode) {
      return res.status(400).json({
        success: false,
        error: '2FA code is required'
      });
    }

    // Validate session
    const session = validateSession(token);

    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session'
      });
    }

    // Get user
    const user = database.getUserById(session.user_id);

    if (!user || !user.totp_secret) {
      return res.status(403).json({
        success: false,
        error: '2FA is not enabled'
      });
    }

    // Verify TOTP code
    const totpSecret = decryptSecret(user.totp_secret);
    const isValid = verifyToken(totpCode, totpSecret);

    if (!isValid) {
      logger.warn(`Failed 2FA verification for user ${user.username}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid 2FA code'
      });
    }

    logger.info(`2FA verification successful for user ${user.username}`);

    res.json({
      success: true,
      message: '2FA verification successful'
    });

  } catch (error) {
    logger.error('2FA verification error:', error);
    res.status(500).json({
      success: false,
      error: '2FA verification failed'
    });
  }
});

module.exports = router;
