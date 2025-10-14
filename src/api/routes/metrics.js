const express = require('express');
const database = require('../../utils/database');
const logger = require('../../utils/logger');

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

    if (node.api_key !== apiKey) {
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

// Get latest metrics for a node
router.get('/:nodeId/latest', (req, res) => {
  try {
    const { nodeId } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    const node = database.getNode(nodeId);
    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Node not found'
      });
    }

    const metrics = database.getLatestMetrics(nodeId, limit);

    res.json({
      success: true,
      metrics: metrics
    });
  } catch (error) {
    logger.error('Error fetching metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get metrics in time range
router.get('/:nodeId/range', (req, res) => {
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
