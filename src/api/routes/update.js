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
 * Flag all connected nodes for update via metrics response
 */
router.post('/nodes', (req, res) => {
  try {
    const database = require('../../utils/database');
    const updateCommand = updater.getNodeUpdateCommand();

    // Store pending update in settings — nodes will pick it up on next metrics report
    database.setSetting('pending_node_update', JSON.stringify({
      ...updateCommand,
      requestedAt: Date.now(),
      requestedBy: req.user?.username || 'unknown',
      targetVersion: updater.getCurrentVersion(),
    }));

    logger.info(`Node update flagged by ${req.user?.username || 'unknown'}`);
    res.json({
      success: true,
      message: 'Update queued — nodes will update on next check-in',
      command: updateCommand,
    });
  } catch (error) {
    logger.error('Node update push error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to queue node update',
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
