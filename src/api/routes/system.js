const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../../middleware/auth');
const database = require('../../utils/database');
const logger = require('../../utils/logger');

/**
 * Uninstall endpoint - requires 2FA verification
 * This prepares the system for uninstallation and schedules shutdown
 */
router.post('/uninstall', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { totpToken, recoveryCode } = req.body;

    // Get user to check 2FA
    let user = null;
    if (userId.toString().startsWith('db_')) {
      const dbId = parseInt(userId.replace('db_', ''));
      user = database.getUserById(dbId);
    }

    // Verify 2FA if user has it enabled
    if (user && user.totp_enabled) {
      let verified = false;

      // Try TOTP token
      if (totpToken && user.totp_secret) {
        verified = speakeasy.totp.verify({
          secret: user.totp_secret,
          encoding: 'base32',
          token: totpToken,
          window: 2
        });
      }

      // Try recovery code
      if (!verified && recoveryCode && user.recovery_codes) {
        const codes = JSON.parse(user.recovery_codes);
        const hashedInput = crypto.createHash('sha256').update(recoveryCode.toUpperCase()).digest('hex');
        const codeIndex = codes.indexOf(hashedInput);
        
        if (codeIndex >= 0) {
          verified = true;
          // Remove used recovery code
          codes.splice(codeIndex, 1);
          database.updateUser(user.id, {
            recoveryCodes: JSON.stringify(codes)
          });
          logger.warn(`Recovery code used for uninstallation by user: ${user.username}`);
        }
      }

      if (!verified) {
        return res.status(401).json({ error: 'Invalid 2FA code' });
      }
    }

    logger.warn(`UNINSTALLATION INITIATED by user: ${req.user.username}`);

    // Schedule server shutdown in 10 seconds
    setTimeout(() => {
      logger.warn('Shutting down server for uninstallation...');
      process.exit(0);
    }, 10000);

    res.json({
      success: true,
      message: 'Uninstallation initiated. Server will shut down in 10 seconds.',
      shutdownIn: 10
    });
  } catch (error) {
    logger.error('Uninstall error:', error);
    res.status(500).json({ error: 'Failed to initiate uninstallation' });
  }
});

/**
 * Download uninstall script
 */
router.get('/uninstall-script', authMiddleware, (req, res) => {
  try {
    const scriptPath = path.join(__dirname, '../../../uninstall.sh');
    
    if (!fs.existsSync(scriptPath)) {
      return res.status(404).json({ error: 'Uninstall script not found' });
    }

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="uninstall.sh"');
    
    const fileStream = fs.createReadStream(scriptPath);
    fileStream.pipe(res);
  } catch (error) {
    logger.error('Download uninstall script error:', error);
    res.status(500).json({ error: 'Failed to download script' });
  }
});

module.exports = router;
