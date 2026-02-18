const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const database = require('../../utils/database');
const onboarding = require('../../utils/onboarding');
const { validatePassword, hashPassword } = require('../../utils/password');
const { generateSecret, generateQRCode, verifyToken, generateRecoveryCodes, hashRecoveryCode, encryptSecret } = require('../../utils/totp');

/**
 * Onboarding API Routes
 * Handles first-time setup wizard for Nexus v2.2.8
 */

// ═══════════════════════════════════════════════════════════════
// GET /api/onboarding/status - Check onboarding status
// ═══════════════════════════════════════════════════════════════

router.get('/status', (req, res) => {
  try {
    const status = onboarding.getOnboardingStatus();

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    logger.error('Onboarding status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check onboarding status'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/onboarding/step1 - Create admin account
// ═══════════════════════════════════════════════════════════════

router.post('/step1', async (req, res) => {
  try {
    // Ensure database is initialized
    if (!database.db) {
      return res.status(503).json({
        success: false,
        error: 'Database not initialized. Please restart the server.'
      });
    }

    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Validate username
    if (username.length < 3 || username.length > 32) {
      return res.status(400).json({
        success: false,
        error: 'Username must be between 3 and 32 characters'
      });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({
        success: false,
        error: 'Username can only contain letters, numbers, hyphens, and underscores'
      });
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet requirements',
        details: passwordValidation.errors
      });
    }

    // Check if user already exists
    // Check if user already exists
    const existingUser = database.getUserByUsername(username);
    if (existingUser) {
      // PROACTIVELY HANDLE CONFLICT:
      // If the user being created is 'admin', allow updating the existing record
      // This handles the case where ensureAdminCredentials() created it on startup
      if (username === 'admin') {
        const passwordHash = await hashPassword(password);

        database.updateUser(existingUser.id, {
          password: passwordHash,
          mustChangePassword: 0 // Onboarding sets the real password, so clear this flag
        });

        // Save step progress
        onboarding.saveOnboardingStep(1, {
          username,
          userId: existingUser.id,
          completedAt: Date.now()
        });

        logger.info(`Admin account updated during onboarding: ${username}`);

        return res.json({
          success: true,
          message: 'Admin account updated successfully',
          userId: existingUser.id
        });
      }

      return res.status(409).json({
        success: false,
        error: 'Username already exists'
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user (without 2FA yet - that's step 2)
    const result = database.createUser({
      username,
      password: passwordHash,
      role: 'admin',
      mustChangePassword: 0
    });

    // Save step progress
    onboarding.saveOnboardingStep(1, {
      username,
      userId: result.lastInsertRowid,
      completedAt: Date.now()
    });

    logger.info(`Admin account created during onboarding: ${username}`);

    res.json({
      success: true,
      message: 'Admin account created successfully',
      userId: result.lastInsertRowid
    });
  } catch (error) {
    logger.error('Onboarding step 1 error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create admin account',
      message: error.message || 'Unknown error'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/onboarding/step2 - Setup 2FA
// ═══════════════════════════════════════════════════════════════

router.post('/step2', async (req, res) => {
  try {
    const { action, userId, totpCode } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Get user
    const user = database.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (action === 'generate') {
      // Generate new TOTP secret
      const { secret, otpauth_url } = generateSecret(user.username);

      // Generate QR code
      const qrCodeDataURL = await generateQRCode(otpauth_url);

      // Temporarily store secret (not enabled yet)
      const tempSecret = encryptSecret(secret);
      database.updateUser(userId, {
        totpSecret: tempSecret,
        totpEnabled: 0 // Not enabled until verified
      });

      logger.info(`2FA secret generated for user ${userId} during onboarding`);

      res.json({
        success: true,
        secret,
        qrCode: qrCodeDataURL,
        otpauth_url
      });

    } else if (action === 'verify') {
      // Verify TOTP code and enable 2FA
      if (!totpCode) {
        return res.status(400).json({
          success: false,
          error: 'TOTP code is required'
        });
      }

      // Get stored secret
      const encryptedSecret = user.totp_secret;
      if (!encryptedSecret) {
        return res.status(400).json({
          success: false,
          error: 'No TOTP secret found. Please generate one first.'
        });
      }

      const secret = require('../../utils/totp').decryptSecret(encryptedSecret);

      // Verify code
      const isValid = verifyToken(totpCode, secret);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid TOTP code. Please try again.'
        });
      }

      // Generate recovery codes
      const recoveryCodes = generateRecoveryCodes(10);
      const hashedCodes = recoveryCodes.map(code => hashRecoveryCode(code));

      // Enable 2FA
      database.updateUser(userId, {
        totpEnabled: 1,
        recoveryCodes: JSON.stringify(hashedCodes)
      });

      // Save step progress
      onboarding.saveOnboardingStep(2, {
        userId,
        totpEnabled: true,
        completedAt: Date.now()
      });

      logger.info(`2FA enabled for user ${userId} during onboarding`);

      res.json({
        success: true,
        message: '2FA enabled successfully',
        recoveryCodes // Send to user ONCE - must save them!
      });

    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid action. Use "generate" or "verify"'
      });
    }
  } catch (error) {
    logger.error('Onboarding step 2 error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup 2FA'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/onboarding/step3 - Configure alerts (Discord bot)
// ═══════════════════════════════════════════════════════════════

router.post('/step3', async (req, res) => {
  try {
    const { enabled, botToken, userId, thresholds } = req.body;

    const alertConfig = {
      enabled: enabled || false,
      thresholds: thresholds || {
        cpu: 80,
        memory: 85,
        disk: 90
      }
    };

    // Save to settings
    database.setSetting('alerts_enabled', alertConfig.enabled.toString());
    database.setSetting('alerts_thresholds', JSON.stringify(alertConfig.thresholds));

    // Save Discord bot settings if provided
    if (botToken) {
      database.setSetting('discord_bot_token', botToken);
    }
    if (userId) {
      database.setSetting('discord_user_id', userId);
    }

    // Initialize Discord bot if token provided
    if (botToken && enabled) {
      try {
        const discordBot = require('../../utils/discord-bot');
        await discordBot.restart();
      } catch (botErr) {
        logger.warn('Discord bot init during onboarding failed:', botErr.message);
      }
    }

    // Save step progress
    onboarding.saveOnboardingStep(3, {
      alertsConfigured: true,
      completedAt: Date.now()
    });

    logger.info('Alert configuration saved during onboarding (Discord bot)');

    res.json({
      success: true,
      message: 'Alert configuration saved successfully',
      config: alertConfig
    });
  } catch (error) {
    logger.error('Onboarding step 3 error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save alert configuration'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/onboarding/step4 - Set metrics refresh interval
// ═══════════════════════════════════════════════════════════════

router.post('/step4', (req, res) => {
  try {
    const { interval } = req.body;

    // Validate interval
    const validIntervals = [5, 15, 30, 60];
    const selectedInterval = parseInt(interval);

    if (!validIntervals.includes(selectedInterval)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid interval. Must be 5, 15, 30, or 60 seconds'
      });
    }

    // Save to settings
    database.setSetting('metrics_refresh_interval', selectedInterval.toString());

    // Save step progress
    onboarding.saveOnboardingStep(4, {
      interval: selectedInterval,
      completedAt: Date.now()
    });

    logger.info(`Metrics refresh interval set to ${selectedInterval}s during onboarding`);

    res.json({
      success: true,
      message: 'Metrics refresh interval saved successfully',
      interval: selectedInterval
    });
  } catch (error) {
    logger.error('Onboarding step 4 error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save metrics interval'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/onboarding/complete - Finalize onboarding
// ═══════════════════════════════════════════════════════════════

router.post('/complete', (req, res) => {
  try {
    // Validate all requirements are met
    const validation = onboarding.validateOnboardingRequirements();

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Onboarding requirements not met',
        missing: validation.missing
      });
    }

    // Mark onboarding as complete
    onboarding.completeOnboarding();

    // Clear step data
    onboarding.clearOnboardingSteps();

    logger.info('🎉 Onboarding completed successfully!');

    res.json({
      success: true,
      message: 'Onboarding completed successfully! Welcome to Nexus.',
      version: onboarding.CURRENT_ONBOARDING_VERSION
    });
  } catch (error) {
    logger.error('Onboarding completion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete onboarding'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/onboarding/test-discord - Test Discord bot alert
// ═══════════════════════════════════════════════════════════════

router.post('/test-discord', async (req, res) => {
  try {
    const { botToken, userId } = req.body;

    if (!botToken || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Bot token and Discord user ID are required'
      });
    }

    // Temporarily save settings for the test
    database.setSetting('discord_bot_token', botToken);
    database.setSetting('discord_user_id', userId);

    const discordBot = require('../../utils/discord-bot');

    // Restart bot with new token
    const connected = await discordBot.restart();
    if (!connected) {
      return res.status(400).json({
        success: false,
        error: 'Failed to connect Discord bot. Check the bot token.'
      });
    }

    // Send test message
    const sent = await discordBot.sendTestMessage();

    if (sent) {
      logger.info('Test Discord alert sent during onboarding');
      res.json({
        success: true,
        message: 'Test alert sent! Check your Discord DMs.'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Bot connected but failed to send DM. Make sure the user ID is correct and you share a server with the bot.'
      });
    }
  } catch (error) {
    logger.error('Test Discord error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test alert: ' + error.message
    });
  }
});

module.exports = router;
