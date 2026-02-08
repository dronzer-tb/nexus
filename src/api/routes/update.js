/**
 * Nexus Update API Routes
 * Dronzer Studios
 */

const express = require('express');
const authenticate = require('../../middleware/auth');
const updater = require('../../utils/updater');
const logger = require('../../utils/logger');

const router = express.Router();

// All update routes require authentication
router.use(authenticate);

/**
 * GET /api/update/check
 * Check for available updates
 */
router.get('/check', async (req, res) => {
  try {
    const result = await updater.checkForUpdate();
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Update check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check for updates',
    });
  }
});

/**
 * GET /api/update/releases
 * Get list of all releases (changelog)
 */
router.get('/releases', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const releases = await updater.getAllReleases(limit);
    res.json({
      success: true,
      currentVersion: updater.getCurrentVersion(),
      releases,
    });
  } catch (error) {
    logger.error('Releases fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch releases',
    });
  }
});

/**
 * POST /api/update/apply
 * Download and apply the latest update
 */
router.post('/apply', async (req, res) => {
  try {
    logger.info(`Update requested by user: ${req.user?.username || 'unknown'}`);

    // Send immediate response that update started
    res.json({
      success: true,
      message: 'Update process started. This may take a few minutes...',
      status: 'downloading',
    });

    // Run update in background (response already sent)
    // We don't await this — client will poll /check to see new version
    updater.downloadAndApply().then(result => {
      if (result.success) {
        logger.info(`Update completed: ${result.previousVersion} → ${result.newVersion}`);
        // Auto-restart to apply the update
        updater.scheduleRestart();
      } else {
        logger.error(`Update failed: ${result.message}`);
      }
    }).catch(err => {
      logger.error('Update process error:', err);
    });

  } catch (error) {
    logger.error('Update apply error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start update',
    });
  }
});

/**
 * POST /api/update/nodes
 * Send update instructions to all connected nodes via Socket.IO
 */
router.post('/nodes', (req, res) => {
  try {
    const io = req.app.get('io');
    if (!io) {
      return res.status(500).json({
        success: false,
        error: 'Socket.IO not available',
      });
    }

    const updateCommand = updater.getNodeUpdateCommand();
    const targetNodeIds = req.body.nodeIds || null; // null = all nodes

    // Emit to agent namespace
    const agentNs = io.of('/agent');
    
    if (targetNodeIds && Array.isArray(targetNodeIds)) {
      // Send to specific nodes
      let sentCount = 0;
      agentNs.sockets.forEach((socket) => {
        if (targetNodeIds.includes(socket.id) || targetNodeIds.includes(socket.handshake?.query?.nodeId)) {
          socket.emit('update:execute', updateCommand);
          sentCount++;
        }
      });
      
      logger.info(`Update command sent to ${sentCount} specific nodes`);
      res.json({
        success: true,
        message: `Update command sent to ${sentCount} node(s)`,
        sentCount,
        command: updateCommand,
      });
    } else {
      // Broadcast to all connected agents
      agentNs.emit('update:execute', updateCommand);
      const connectedCount = agentNs.sockets?.size || 0;
      
      logger.info(`Update command broadcast to ${connectedCount} connected nodes`);
      res.json({
        success: true,
        message: `Update command broadcast to ${connectedCount} connected node(s)`,
        connectedCount,
        command: updateCommand,
      });
    }
  } catch (error) {
    logger.error('Node update push error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send update to nodes',
    });
  }
});

/**
 * GET /api/update/version
 * Quick version endpoint
 */
router.get('/version', (req, res) => {
  res.json({
    success: true,
    version: updater.getCurrentVersion(),
    repo: updater.GITHUB_REPO,
  });
});

module.exports = router;
