const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const config = require('../../utils/config');
const database = require('../../utils/database');
const authenticate = require('../../middleware/auth');
const sshTerminal = require('../ssh-terminal');

// All routes require authentication
router.use(authenticate);

// ─── Global Console Status ─────────────────
router.get('/status', (req, res) => {
  try {
    const consoleConfig = sshTerminal.getConsoleConfig();
    res.json({
      success: true,
      enabled: consoleConfig.enabled,
      allowSudo: consoleConfig.allowSudo,
      blockedCommands: consoleConfig.blockedCommands.length,
      blockedPaths: consoleConfig.blockedPaths.length,
      activeSessions: sshTerminal.getSessionCount(),
    });
  } catch (error) {
    logger.error('Error fetching console status:', error);
    res.status(500).json({ success: false, message: 'Failed to get console status' });
  }
});

// ─── Console Config (for frontend) ─────────
router.get('/config', (req, res) => {
  try {
    const consoleConfig = sshTerminal.getConsoleConfig();
    res.json({ success: true, config: consoleConfig });
  } catch (error) {
    logger.error('Error fetching console config:', error);
    res.status(500).json({ success: false, message: 'Failed to get console config' });
  }
});

// ─── Toggle Global Console ─────────────────
router.post('/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    config.set('console.enabled', enabled !== false);
    logger.info(`Console globally ${enabled !== false ? 'enabled' : 'disabled'}`);
    res.json({ success: true, enabled: enabled !== false });
  } catch (error) {
    logger.error('Error toggling console:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle console' });
  }
});

// ─── SSH Public Key ────────────────────────
router.get('/ssh-key', (req, res) => {
  try {
    const publicKey = sshTerminal.getPublicKey();
    res.json({ success: true, publicKey });
  } catch (error) {
    logger.error('Error getting SSH key:', error);
    res.status(500).json({ success: false, message: 'Failed to get SSH key' });
  }
});

// ─── Regenerate SSH Keypair ────────────────
router.post('/ssh-key/regenerate', (req, res) => {
  try {
    const keyPair = sshTerminal.regenerateKeyPair();
    logger.info('SSH keypair regenerated');
    res.json({ success: true, publicKey: keyPair.publicKey });
  } catch (error) {
    logger.error('Error regenerating SSH key:', error);
    res.status(500).json({ success: false, message: 'Failed to regenerate SSH key' });
  }
});

// ─── Validate Command ──────────────────────
router.post('/validate', (req, res) => {
  try {
    const { command } = req.body;
    if (!command) {
      return res.status(400).json({ success: false, message: 'Command is required' });
    }
    const result = sshTerminal.validateCommand(command);
    res.json({ success: true, allowed: result.allowed, reason: result.reason || null });
  } catch (error) {
    logger.error('Error validating command:', error);
    res.status(500).json({ success: false, message: 'Validation failed' });
  }
});

// ─── Active Sessions ───────────────────────
router.get('/sessions', (req, res) => {
  try {
    res.json({ success: true, count: sshTerminal.getSessionCount() });
  } catch (error) {
    logger.error('Error getting sessions:', error);
    res.status(500).json({ success: false, message: 'Failed to get session count' });
  }
});

// ─── Console-enabled Nodes ─────────────────
router.get('/nodes', (req, res) => {
  try {
    const nodes = database.getAllNodes();
    const consoleNodes = nodes.map(node => ({
      id: node.id,
      hostname: node.hostname,
      status: node.status,
      last_seen: node.last_seen,
      console_enabled: node.console_enabled !== 0,
      system_info: node.system_info,
      ip: node.system_info?.network?.[0]?.ip4 || node.system_info?.ip || null,
    }));
    res.json({ success: true, nodes: consoleNodes });
  } catch (error) {
    logger.error('Error fetching console nodes:', error);
    res.status(500).json({ success: false, message: 'Failed to get nodes' });
  }
});

module.exports = router;
