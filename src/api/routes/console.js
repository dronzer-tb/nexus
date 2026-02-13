const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const config = require('../../utils/config');
const authenticate = require('../../middleware/auth');
const sshTerminal = require('../ssh-terminal');

// Apply authentication
router.use(authenticate);

// Get console security configuration
router.get('/config', (req, res) => {
  try {
    const consoleConfig = {
      allowSudo: config.get('console.allowSudo') || false,
      blockedCommands: config.get('console.blockedCommands') || [],
      blockedPaths: config.get('console.blockedPaths') || [],
    };
    res.json({ success: true, config: consoleConfig });
  } catch (error) {
    logger.error('Error fetching console config:', error);
    res.status(500).json({ success: false, message: 'Failed to get console config' });
  }
});

// Validate a command before execution
router.post('/validate', (req, res) => {
  try {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({ success: false, message: 'Command is required' });
    }

    const result = sshTerminal.validateCommand(command);
    res.json({
      success: true,
      allowed: result.allowed,
      reason: result.reason || null,
    });
  } catch (error) {
    logger.error('Error validating command:', error);
    res.status(500).json({ success: false, message: 'Validation failed' });
  }
});

// Get active terminal sessions count
router.get('/sessions', (req, res) => {
  try {
    res.json({
      success: true,
      count: sshTerminal.getSessionCount(),
    });
  } catch (error) {
    logger.error('Error getting sessions:', error);
    res.status(500).json({ success: false, message: 'Failed to get session count' });
  }
});

module.exports = router;
