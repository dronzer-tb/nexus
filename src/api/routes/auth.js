const express = require('express');
const router = express.Router();
const { RateLimiterMemory } = require('rate-limiter-flexible');
const logger = require('../../utils/logger');
const database = require('../../utils/database');
const { comparePassword } = require('../../utils/password');
const { verifyToken, decryptSecret, verifyRecoveryCode, generateSecret, generateQRCode, encryptSecret, hashRecoveryCode } = require('../../utils/totp');
const { createSession, validateSession, destroySession, extractTokenFromRequest } = require('../../utils/session');
const { hashPassword } = require('../../utils/password');
const crypto = require('crypto');

/**
 * Authentication Routes with 2FA support
 * For custom auth system v2.2.8
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

    // Check if 2FA is enabled for this user
    if (!user.totp_enabled || !user.totp_secret) {
      // User doesn't have 2FA set up yet — create a temporary session
      // and tell the client to set up 2FA
      const session = createSession(user.id, {
        ipAddress,
        userAgent: req.headers['user-agent']
      });

      logger.info(`User ${username} logged in (no 2FA) — needs 2FA setup`);

      return res.json({
        success: true,
        message: 'Login successful — 2FA setup required',
        requires2FASetup: true,
        token: session.token,
        expiresAt: session.expiresAt,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    }

    // User has 2FA — require code
    if (!totpCode && !recoveryCode) {
      return res.json({
        success: true,
        requires2FA: true,
        message: 'Please provide your 2FA code'
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
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// GET /api/auth/users - List all users
router.get('/users', async (req, res) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token || !validateSession(token)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const users = database.getAllUsers();

    // sanitized users
    const sanitizedUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      email: u.email,
      totpEnabled: u.totp_enabled === 1,
      createdAt: u.created_at
    }));

    res.json({
      success: true,
      users: sanitizedUsers
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/users - Create new user
router.post('/users', async (req, res) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token || !validateSession(token)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }

    // Check existing
    if (database.getUserByUsername(username)) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }

    const hashedPassword = await hashPassword(password);

    database.createUser({
      username,
      password: hashedPassword,
      role: role || 'viewer',
      mustChangePassword: true
    });

    res.json({
      success: true,
      message: 'User created'
    });
  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/auth/users/:id - Delete a user
router.delete('/users/:id', async (req, res) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const session = validateSession(token);
    if (!session) return res.status(401).json({ success: false, error: 'Invalid session' });

    const { id } = req.params;
    const userId = parseInt(id, 10);

    // Prevent deleting yourself
    if (session.user_id === userId) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }

    const user = database.getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Delete user sessions first
    database.deleteUserSessions(userId);
    // Delete the user
    database.deleteUser(userId);

    logger.info(`User ${user.username} (id: ${userId}) deleted by user id ${session.user_id}`);

    res.json({ success: true, message: `User '${user.username}' deleted` });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/auth/users/:id/reset-password - Reset a user's password (admin)
router.put('/users/:id/reset-password', async (req, res) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const session = validateSession(token);
    if (!session) return res.status(401).json({ success: false, error: 'Invalid session' });

    // Check if requesting user is admin
    const requestingUser = database.getUserById(session.user_id);
    if (!requestingUser || requestingUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can reset passwords' });
    }

    const { id } = req.params;
    const userId = parseInt(id, 10);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    const targetUser = database.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const hashedPassword = await hashPassword(newPassword);
    database.updateUser(userId, { password: hashedPassword, mustChangePassword: true });

    // Destroy all sessions for this user so they have to log in again
    database.deleteUserSessions(userId);

    logger.info(`Password reset for user ${targetUser.username} by admin ${requestingUser.username}`);

    res.json({ success: true, message: `Password reset for '${targetUser.username}'` });
  } catch (error) {
    logger.error('Error resetting password:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/auth/change-password - Change own password
router.put('/change-password', async (req, res) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const session = validateSession(token);
    if (!session) return res.status(401).json({ success: false, error: 'Invalid session' });

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
    }

    const user = database.getUserById(session.user_id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const passwordValid = await comparePassword(currentPassword, user.password);
    if (!passwordValid) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    const hashedPassword = await hashPassword(newPassword);
    database.updateUser(session.user_id, { password: hashedPassword, mustChangePassword: false });

    logger.info(`User ${user.username} changed their password`);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Error changing password:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// API KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// GET /api/auth/api-keys/verify - Verify an API key is valid (used by mobile app)
router.get('/api-keys/verify', (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'API key required' });
    }

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyRecord = database.getApiKeyByHash(keyHash);

    if (!keyRecord) {
      return res.status(401).json({ success: false, error: 'Invalid API key' });
    }

    // Check expiry
    if (keyRecord.expires_at && Date.now() > keyRecord.expires_at) {
      return res.status(401).json({ success: false, error: 'API key has expired' });
    }

    // Update last used
    database.updateApiKeyLastUsed(keyRecord.id);

    res.json({
      success: true,
      message: 'API key is valid',
      name: keyRecord.name,
      permissions: keyRecord.permissions
    });
  } catch (error) {
    logger.error('Error verifying API key:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/auth/encryption-info - Get encryption settings (used by mobile app)
router.get('/encryption-info', (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'API key required' });
    }

    // Validate API key
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyRecord = database.getApiKeyByHash(keyHash);

    if (!keyRecord) {
      return res.status(401).json({ success: false, error: 'Invalid API key' });
    }

    const encryption = require('../../utils/encryption');
    const enabled = encryption.isEnabled();

    res.json({
      success: true,
      encryption: {
        enabled,
        salt: enabled ? encryption.getInstallationSalt() : null,
        algorithm: enabled ? encryption.ALGORITHM : null
      }
    });
  } catch (error) {
    logger.error('Error fetching encryption info:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/auth/api-keys - List API keys
router.get('/api-keys', (req, res) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token || !validateSession(token)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const keys = database.getAllApiKeys();
    res.json({
      success: true,
      keys: keys
    });
  } catch (error) {
    logger.error('Error fetching API keys:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/api-keys - Create API key
router.post('/api-keys', (req, res) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token || !validateSession(token)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { name, permissions, expiresInDays } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Key name required' });
    }

    const apiKey = require('../../utils/auth').generateApiKey();
    const keyHash = require('../../utils/auth').hashApiKey(apiKey);
    const keyId = crypto.randomBytes(8).toString('hex');

    const expiresAt = expiresInDays ? Date.now() + (expiresInDays * 24 * 60 * 60 * 1000) : null;

    database.createApiKey({
      id: keyId,
      name,
      keyHash,
      keyPreview: `${apiKey.substring(0, 8)}...`,
      permissions: permissions || 'read',
      expiresAt
    });

    res.json({
      success: true,
      key: {
        id: keyId,
        name,
        rawKey: apiKey,
        keyPreview: `${apiKey.substring(0, 8)}...`,
        permissions: permissions || 'read'
      },
      message: 'API Key created. Copy it now, you cannot see it again.'
    });
  } catch (error) {
    logger.error('Error creating API key:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/auth/api-keys/:id - Delete API key
router.delete('/api-keys/:id', (req, res) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token || !validateSession(token)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id } = req.params;
    database.deleteApiKey(id);

    res.json({ success: true, message: 'API key deleted' });
  } catch (error) {
    logger.error('Error deleting API key:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 2FA MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// GET /api/auth/2fa/status - Get 2FA status
router.get('/2fa/status', (req, res) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const session = validateSession(token);
    if (!session) return res.status(401).json({ success: false, error: 'Invalid session' });

    const user = database.getUserById(session.user_id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    res.json({
      success: true,
      enabled: user.totp_enabled === 1
    });
  } catch (error) {
    logger.error('Error fetching 2FA status:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/2fa/enable - Begin 2FA setup (generate secret + QR code)
router.post('/2fa/enable', async (req, res) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const session = validateSession(token);
    if (!session) return res.status(401).json({ success: false, error: 'Invalid session' });

    const user = database.getUserById(session.user_id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Generate new TOTP secret
    const secretData = generateSecret(user.username);
    const qrCode = await generateQRCode(secretData.otpauth_url);

    // Temporarily store encrypted secret (not enabled until verified)
    const encryptedSecret = encryptSecret(secretData.base32);
    database.updateUser(session.user_id, {
      totpSecret: encryptedSecret,
      totpEnabled: 0 // Not enabled until verify-setup
    });

    res.json({
      success: true,
      secret: secretData.base32,
      qrCode,
      otpauth_url: secretData.otpauth_url
    });
  } catch (error) {
    logger.error('Error setting up 2FA:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/2fa/verify-setup - Verify TOTP code and complete 2FA setup
router.post('/2fa/verify-setup', (req, res) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const session = validateSession(token);
    if (!session) return res.status(401).json({ success: false, error: 'Invalid session' });

    const user = database.getUserById(session.user_id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const { totpCode } = req.body;
    if (!totpCode) {
      return res.status(400).json({ success: false, error: 'TOTP code is required' });
    }

    // Get stored secret
    if (!user.totp_secret) {
      return res.status(400).json({ success: false, error: 'No TOTP secret found. Please start setup first.' });
    }

    const secret = decryptSecret(user.totp_secret);

    // Verify code
    const isValid = verifyToken(totpCode, secret);
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Invalid TOTP code. Please try again.' });
    }

    // Generate recovery codes
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    const hashedCodes = codes.map(c => hashRecoveryCode(c));

    // Enable 2FA
    database.updateUser(session.user_id, {
      totpEnabled: 1,
      recoveryCodes: JSON.stringify(hashedCodes)
    });

    logger.info(`2FA enabled for user ${user.username}`);

    res.json({
      success: true,
      message: '2FA enabled successfully',
      recoveryCodes: codes
    });
  } catch (error) {
    logger.error('Error verifying 2FA setup:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/2fa/disable - Disable 2FA for the user
router.post('/2fa/disable', (req, res) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const session = validateSession(token);
    if (!session) return res.status(401).json({ success: false, error: 'Invalid session' });

    const user = database.getUserById(session.user_id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Disable 2FA
    database.updateUser(session.user_id, {
      totpEnabled: 0,
      totpSecret: null,
      recoveryCodes: null
    });

    logger.info(`2FA disabled for user ${user.username}`);

    res.json({
      success: true,
      message: '2FA disabled successfully'
    });
  } catch (error) {
    logger.error('Error disabling 2FA:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

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
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'unknown';
  const audit = require('../../utils/audit');

  try {
    const token = extractTokenFromRequest(req);
    const { totpCode, purpose = 'console_access' } = req.body;

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
      logger.warn(`Failed 2FA verification for user ${user.username} (purpose: ${purpose})`);

      // Audit log - failed verification
      audit.log2FAVerification(
        { userId: user.id, username: user.username },
        purpose,
        ipAddress,
        userAgent,
        false,
        'Invalid 2FA code provided'
      );

      return res.status(401).json({
        success: false,
        error: 'Invalid 2FA code'
      });
    }

    logger.info(`2FA verification successful for user ${user.username} (purpose: ${purpose})`);

    // Audit log - successful verification
    audit.log2FAVerification(
      { userId: user.id, username: user.username },
      purpose,
      ipAddress,
      userAgent,
      true,
      '2FA verification successful'
    );

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
