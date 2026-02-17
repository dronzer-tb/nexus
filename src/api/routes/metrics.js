const express = require('express');
const database = require('../../utils/database');
const auth = require('../../utils/auth');
const authenticate = require('../../middleware/auth');
const logger = require('../../utils/logger');
const encryption = require('../../utils/encryption');
const alerts = require('../../utils/alerts');

const router = express.Router();

// Receive metrics from nodes
router.post('/', (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const { nodeId, metrics } = req.body;

    if (!apiKey || !nodeId || !metrics) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Verify node exists and API key is valid
    const node = database.getNode(nodeId);
    
    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Node not found. Please register first.'
      });
    }

    if (!auth.verifyApiKey(apiKey, node.api_key_hash)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    // Update node last seen
    database.updateNodeLastSeen(nodeId);
    database.updateNodeStatus(nodeId, 'online');

    // Save metrics
    database.saveMetrics(nodeId, metrics);

    // Check alert thresholds (async, non-blocking)
    alerts.checkMetrics(nodeId, metrics, node.hostname).catch(err => {
      logger.error('Alert check failed:', err.message);
    });

    res.json({
      success: true,
      message: 'Metrics received'
    });
  } catch (error) {
    logger.error('Error saving metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get latest metrics for a node (requires authentication)
router.get('/:nodeId/latest', authenticate, (req, res) => {
  try {
    const { nodeId } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 1000);

    const node = database.getNode(nodeId);
    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Node not found'
      });
    }

    const metrics = database.getLatestMetrics(nodeId, limit);

    const responseData = {
      success: true,
      metrics: metrics
    };

    // Encrypt response for API-key authenticated requests
    const apiKey = req.headers['x-api-key'];
    if (apiKey && encryption.isEnabled()) {
      try {
        return res.json({
          encrypted: true,
          data: encryption.encrypt(responseData, apiKey)
        });
      } catch {
        // Fallback to unencrypted
      }
    }

    res.json(responseData);
  } catch (error) {
    logger.error('Error fetching metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get metrics in time range (requires authentication)
router.get('/:nodeId/range', authenticate, (req, res) => {
  try {
    const { nodeId } = req.params;
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: 'Start and end timestamps required'
      });
    }

    const node = database.getNode(nodeId);
    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Node not found'
      });
    }

    const metrics = database.getMetricsInTimeRange(
      nodeId,
      parseInt(start),
      parseInt(end)
    );

    res.json({
      success: true,
      metrics: metrics
    });
  } catch (error) {
    logger.error('Error fetching metrics range:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
