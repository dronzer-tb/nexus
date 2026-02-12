const express = require('express');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const database = require('../../utils/database');
const authMiddleware = require('../../middleware/auth');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * Generate 2FA setup (TOTP secret + QR code)
 * This is called when a user wants to enable 2FA
 */
router.post('/setup', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = database.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `Nexus (${user.username})`,
      issuer: 'Nexus Monitoring',
      length: 32
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store the secret temporarily (not enabled yet until verified)
    database.updateUser(userId, {
      totpSecret: secret.base32,
      totpEnabled: false
    });

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      otpauthUrl: secret.otpauth_url,
      recommendation: 'For maximum security, we recommend using Proton Pass Authenticator. It offers encrypted cloud backup and cross-device sync.'
    });
  } catch (error) {
    logger.error('2FA setup error:', error);
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

/**
 * Verify and enable 2FA
 * User must provide a valid TOTP code to activate 2FA
 */
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'TOTP token required' });
    }

    const user = database.getUserById(userId);
    if (!user || !user.totp_secret) {
      return res.status(400).json({ error: '2FA not set up' });
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps before/after for clock drift
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid TOTP code' });
    }

    // Generate recovery codes
    const recoveryCodes = generateRecoveryCodes(8);
    const hashedRecoveryCodes = recoveryCodes.map(code => hashRecoveryCode(code));

    // Enable 2FA
    database.updateUser(userId, {
      totpEnabled: true,
      recoveryCodes: JSON.stringify(hashedRecoveryCodes)
    });

    logger.info(`2FA enabled for user: ${user.username}`);

    res.json({
      success: true,
      message: '2FA enabled successfully',
      recoveryCodes: recoveryCodes // Only shown once!
    });
  } catch (error) {
    logger.error('2FA verification error:', error);
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

/**
 * Disable 2FA (requires current TOTP or recovery code)
 */
router.post('/disable', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { token, recoveryCode } = req.body;

    const user = database.getUserById(userId);
    if (!user || !user.totp_enabled) {
      return res.status(400).json({ error: '2FA not enabled' });
    }

    let verified = false;

    // Try TOTP token first
    if (token) {
      verified = speakeasy.totp.verify({
        secret: user.totp_secret,
        encoding: 'base32',
        token: token,
        window: 2
      });
    }

    // Try recovery code if TOTP failed
    if (!verified && recoveryCode && user.recovery_codes) {
      const codes = JSON.parse(user.recovery_codes);
      const hashedInput = hashRecoveryCode(recoveryCode);
      verified = codes.includes(hashedInput);
    }

    if (!verified) {
      return res.status(400).json({ error: 'Invalid TOTP code or recovery code' });
    }

    // Disable 2FA
    database.updateUser(userId, {
      totpSecret: null,
      totpEnabled: false,
      recoveryCodes: null
    });

    logger.info(`2FA disabled for user: ${user.username}`);

    res.json({
      success: true,
      message: '2FA disabled successfully'
    });
  } catch (error) {
    logger.error('2FA disable error:', error);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

/**
 * Get 2FA status for current user
 */
router.get('/status', authMiddleware, (req, res) => {
  try {
    const userId = req.user.userId;
    const user = database.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      enabled: !!user.totp_enabled,
      hasRecoveryCodes: !!(user.recovery_codes)
    });
  } catch (error) {
    logger.error('2FA status error:', error);
    res.status(500).json({ error: 'Failed to get 2FA status' });
  }
});

/**
 * Regenerate recovery codes (requires TOTP verification)
 */
router.post('/regenerate-codes', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'TOTP token required' });
    }

    const user = database.getUserById(userId);
    if (!user || !user.totp_enabled) {
      return res.status(400).json({ error: '2FA not enabled' });
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid TOTP code' });
    }

    // Generate new recovery codes
    const recoveryCodes = generateRecoveryCodes(8);
    const hashedRecoveryCodes = recoveryCodes.map(code => hashRecoveryCode(code));

    database.updateUser(userId, {
      recoveryCodes: JSON.stringify(hashedRecoveryCodes)
    });

    logger.info(`Recovery codes regenerated for user: ${user.username}`);

    res.json({
      success: true,
      recoveryCodes: recoveryCodes
    });
  } catch (error) {
    logger.error('Recovery code regeneration error:', error);
    res.status(500).json({ error: 'Failed to regenerate recovery codes' });
  }
});

// Helper functions
function generateRecoveryCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric codes
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
}

module.exports = router;
