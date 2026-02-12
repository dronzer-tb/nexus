const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
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

    // Execute the uninstall script automatically
    const uninstallScriptPath = path.join(__dirname, '../../../uninstall.sh');
    
    if (!fs.existsSync(uninstallScriptPath)) {
      return res.status(500).json({ 
        error: 'Uninstall script not found. Please run manually: bash uninstall.sh' 
      });
    }

    // Send response before starting uninstall
    res.json({
      success: true,
      message: 'Uninstallation process starting. The server will shut down and all data will be removed.',
      shutdownIn: 5
    });

    // Give client time to receive response, then execute uninstall script
    setTimeout(() => {
      logger.warn('Executing uninstall script...');
      
      // Make script executable
      try {
        fs.chmodSync(uninstallScriptPath, 0o755);
      } catch (err) {
        logger.error('Failed to make uninstall script executable:', err);
      }

      // Execute uninstall script with auto-confirm flags
      // We'll need to modify uninstall.sh to accept --auto-confirm flag
      const uninstallProcess = spawn('bash', [uninstallScriptPath, '--auto-confirm'], {
        detached: true,
        stdio: 'ignore',
        cwd: path.join(__dirname, '../../..')
      });

      uninstallProcess.unref();
      
      // Exit the Node.js process to allow script to complete
      setTimeout(() => {
        process.exit(0);
      }, 2000);
    }, 5000);
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
