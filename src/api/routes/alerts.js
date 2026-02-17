/**
 * Discord Bot + Alerts API Routes
 * Manage Discord bot settings, test alerts, view active alerts
 */
const express = require('express');
const database = require('../../utils/database');
const discordBot = require('../../utils/discord-bot');
const alerts = require('../../utils/alerts');
const authenticate = require('../../middleware/auth');
const logger = require('../../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get Discord bot status and settings
router.get('/discord/status', (req, res) => {
  try {
    const status = discordBot.getStatus();
    const hasToken = !!database.getSetting('discord_bot_token');

    const responseData = {
      success: true,
      discord: {
        ...status,
        hasToken,
        alertsEnabled: database.getSetting('alerts_enabled') === 'true',
      },
    };

    return res.json(responseData);
  } catch (error) {
    logger.error('Error getting Discord status:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update Discord bot settings
router.post('/discord/settings', async (req, res) => {
  try {
    const { botToken, userId } = req.body;

    if (botToken !== undefined) {
      if (botToken) {
        database.setSetting('discord_bot_token', botToken);
      } else {
        database.setSetting('discord_bot_token', '');
        await discordBot.destroy();
      }
    }

    if (userId !== undefined) {
      database.setSetting('discord_user_id', userId || '');
    }

    // Restart bot if token changed
    if (botToken) {
      const connected = await discordBot.restart();
      return res.json({
        success: true,
        message: connected ? 'Discord bot connected!' : 'Bot token saved but connection failed',
        connected,
      });
    }

    res.json({ success: true, message: 'Discord settings updated' });
  } catch (error) {
    logger.error('Error updating Discord settings:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Test Discord alert
router.post('/discord/test', async (req, res) => {
  try {
    const sent = await discordBot.sendTestMessage();
    res.json({
      success: sent,
      message: sent ? 'Test alert sent! Check your Discord DMs.' : 'Failed to send test alert. Check bot token and user ID.',
    });
  } catch (error) {
    logger.error('Error sending test alert:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get alert thresholds
router.get('/thresholds', (req, res) => {
  try {
    const thresholdsRaw = database.getSetting('alerts_thresholds');
    const alertsEnabled = database.getSetting('alerts_enabled') === 'true';

    let thresholds = { cpu: 80, memory: 85, disk: 90 };
    if (thresholdsRaw) {
      try { thresholds = JSON.parse(thresholdsRaw); } catch {}
    }

    const responseData = {
      success: true,
      alertsEnabled,
      thresholds,
    };

    return res.json(responseData);
  } catch (error) {
    logger.error('Error getting alert thresholds:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update alert thresholds
router.post('/thresholds', (req, res) => {
  try {
    const { enabled, thresholds } = req.body;

    if (enabled !== undefined) {
      database.setSetting('alerts_enabled', enabled ? 'true' : 'false');
    }

    if (thresholds) {
      database.setSetting('alerts_thresholds', JSON.stringify(thresholds));
      alerts.clearAlertStates(); // reset cooldowns when thresholds change
    }

    res.json({ success: true, message: 'Alert settings updated' });
  } catch (error) {
    logger.error('Error updating alert thresholds:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get active alerts
router.get('/active', (req, res) => {
  try {
    const activeAlerts = alerts.getActiveAlerts();

    const responseData = {
      success: true,
      alerts: activeAlerts,
    };

    return res.json(responseData);
  } catch (error) {
    logger.error('Error getting active alerts:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PER-NODE ALERT SETTINGS
// ═══════════════════════════════════════════════════════════════

// Get alert settings for a specific node
router.get('/node/:nodeId', (req, res) => {
  try {
    const { nodeId } = req.params;
    const nodeSettings = database.getNodeAlertSettings(nodeId);

    // Get global defaults for comparison
    const globalThresholdsRaw = database.getSetting('alerts_thresholds');
    let globalThresholds = { cpu: 80, memory: 85, disk: 90 };
    if (globalThresholdsRaw) {
      try { globalThresholds = JSON.parse(globalThresholdsRaw); } catch {}
    }

    if (nodeSettings) {
      return res.json({
        success: true,
        hasCustomSettings: true,
        settings: {
          enabled: !!nodeSettings.enabled,
          thresholds: {
            cpu: nodeSettings.cpu_threshold,
            memory: nodeSettings.memory_threshold,
            disk: nodeSettings.disk_threshold,
          },
          discordUserId: nodeSettings.discord_user_id || '',
        },
        globalDefaults: globalThresholds,
      });
    }

    // No custom settings — return global defaults
    res.json({
      success: true,
      hasCustomSettings: false,
      settings: {
        enabled: true,
        thresholds: globalThresholds,
        discordUserId: '',
      },
      globalDefaults: globalThresholds,
    });
  } catch (error) {
    logger.error('Error getting node alert settings:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Set alert settings for a specific node
router.post('/node/:nodeId', (req, res) => {
  try {
    const { nodeId } = req.params;
    const { enabled, thresholds, discordUserId, useGlobal } = req.body;

    // If useGlobal is true, remove per-node override
    if (useGlobal) {
      database.deleteNodeAlertSettings(nodeId);
      alerts.clearAlertStates();
      return res.json({ success: true, message: 'Node alert settings reset to global defaults' });
    }

    database.setNodeAlertSettings(nodeId, {
      enabled: enabled !== undefined ? enabled : true,
      cpuThreshold: thresholds?.cpu ?? 80,
      memoryThreshold: thresholds?.memory ?? 85,
      diskThreshold: thresholds?.disk ?? 90,
      discordUserId: discordUserId || null,
    });

    alerts.clearAlertStates();

    res.json({ success: true, message: 'Node alert settings saved' });
  } catch (error) {
    logger.error('Error saving node alert settings:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete per-node alert settings (revert to global)
router.delete('/node/:nodeId', (req, res) => {
  try {
    const { nodeId } = req.params;
    database.deleteNodeAlertSettings(nodeId);
    alerts.clearAlertStates();
    res.json({ success: true, message: 'Node alert settings removed, using global defaults' });
  } catch (error) {
    logger.error('Error deleting node alert settings:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get all per-node alert settings
router.get('/nodes/all', (req, res) => {
  try {
    const allSettings = database.getAllNodeAlertSettings();
    res.json({ success: true, settings: allSettings });
  } catch (error) {
    logger.error('Error getting all node alert settings:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
