const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const database = require('../../utils/database');
const logger = require('../../utils/logger');
const chalk = require('chalk');

/**
 * Request password reset
 * Generates a 6-digit code and displays it in server console
 * Works for both database users and file-based admin
 */
router.post('/request', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const trimmedUsername = username.trim();
    
    // Check if it's the file-based admin
    const { loadAdmin, saveAdmin } = require('../../utils/setup-admin');
    const fileAdmin = loadAdmin();
    const isFileAdmin = fileAdmin && fileAdmin.username === trimmedUsername;

    // Find user by username - check database users
    const dbUser = database.getUserByUsername(trimmedUsername);

    if (!dbUser && !isFileAdmin) {
      // User doesn't exist
      return res.status(400).json({ 
        error: 'User not found.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Generate 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetTokenExpires = Date.now() + 600000; // 10 minutes

    // Save code based on user type
    if (isFileAdmin) {
      // File-based admin - save to admin file
      fileAdmin.resetToken = resetCode;
      fileAdmin.resetTokenExpires = resetTokenExpires;
      saveAdmin(fileAdmin);
      logger.info(`Password reset code generated for file-based admin: ${fileAdmin.username}`);
    } else if (dbUser) {
      // Database user - save to database
      database.updateUser(dbUser.id, {
        resetToken: resetCode,
        resetTokenExpires
      });
      logger.info(`Password reset code generated for user: ${dbUser.username}`);
    }

    // Display code in console with prominent formatting
    console.log('\n' + '='.repeat(80));
    console.log(chalk.bold.cyan('╔════════════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + chalk.bold.white('                    PASSWORD RESET CODE GENERATED                           ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════════════════════╝'));
    console.log('');
    console.log(chalk.yellow('  Username:      ') + chalk.bold.white(trimmedUsername));
    console.log(chalk.yellow('  Reset Code:    ') + chalk.bold.green.bgBlack(` ${resetCode} `));
    console.log(chalk.yellow('  Valid for:     ') + chalk.white('10 minutes'));
    console.log(chalk.yellow('  Requested at:  ') + chalk.white(new Date().toLocaleString()));
    console.log('');
    console.log(chalk.bold.red('  ⚠️  This code will expire in 10 minutes'));
    console.log(chalk.bold.red('  ⚠️  Code can only be used once'));
    console.log('');
    console.log('='.repeat(80) + '\n');

    res.json({
      success: true,
      message: 'Reset code generated successfully. Check the server console for the code.'
    });
  } catch (error) {
    logger.error('Password reset request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Verify reset code
 * Checks if the code is valid and not expired
 * Works for both database users and file-based admin
 */
router.post('/verify', async (req, res) => {
  try {
    const { username, code } = req.body;

    if (!username || !code) {
      return res.status(400).json({ error: 'Username and code are required' });
    }

    const trimmedUsername = username.trim();
    const trimmedCode = code.trim();

    // Check if it's the file-based admin
    const { loadAdmin } = require('../../utils/setup-admin');
    const fileAdmin = loadAdmin();
    const isFileAdmin = fileAdmin && fileAdmin.username === trimmedUsername;

    let user = null;
    if (isFileAdmin) {
      user = fileAdmin;
    } else {
      user = database.getUserByUsername(trimmedUsername);
    }

    if (!user) {
      return res.status(400).json({ 
        error: 'User not found',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if code matches and hasn't expired
    // Handle both snake_case (DB) and camelCase (file admin)
    const resetToken = user.reset_token || user.resetToken;
    const resetTokenExpires = user.reset_token_expires || user.resetTokenExpires;
    
    if (resetToken !== trimmedCode || !resetTokenExpires || resetTokenExpires < Date.now()) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset code. Codes expire after 10 minutes.',
        code: 'INVALID_CODE'
      });
    }

    res.json({
      success: true,
      username: user.username
    });
  } catch (error) {
    logger.error('Code verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Reset password using code
 * Changes the password and invalidates the code
 * Works for both database users and file-based admin
 */
router.post('/reset', async (req, res) => {
  try {
    const { username, code, newPassword } = req.body;

    if (!username || !code || !newPassword) {
      return res.status(400).json({ error: 'Username, code, and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const trimmedUsername = username.trim();
    const trimmedCode = code.trim();

    // Check if it's the file-based admin
    const { loadAdmin, saveAdmin } = require('../../utils/setup-admin');
    const fileAdmin = loadAdmin();
    const isFileAdmin = fileAdmin && fileAdmin.username === trimmedUsername;

    let user = null;
    if (isFileAdmin) {
      user = fileAdmin;
    } else {
      user = database.getUserByUsername(trimmedUsername);
    }

    if (!user) {
      return res.status(400).json({ 
        error: 'User not found',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verify code and expiration
    // Handle both snake_case (DB) and camelCase (file admin)
    const resetToken = user.reset_token || user.resetToken;
    const resetTokenExpires = user.reset_token_expires || user.resetTokenExpires;
    
    if (resetToken !== trimmedCode || !resetTokenExpires || resetTokenExpires < Date.now()) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset code. Codes expire after 10 minutes.',
        code: 'INVALID_CODE'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset code based on user type
    if (isFileAdmin) {
      // File-based admin - update admin file
      fileAdmin.password = hashedPassword;
      fileAdmin.resetToken = null;
      fileAdmin.resetTokenExpires = null;
      fileAdmin.mustChangePassword = false;
      saveAdmin(fileAdmin);
      logger.info(`Password reset successful for file-based admin: ${fileAdmin.username}`);
    } else {
      // Database user - update database
      database.updateUser(user.id, {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
        mustChangePassword: false
      });
      logger.info(`Password reset successful for user: ${user.username}`);
    }

    res.json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.'
    });
  } catch (error) {
    logger.error('Password reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
