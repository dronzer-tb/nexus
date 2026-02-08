const express = require('express');
const database = require('../../utils/database');
const auth = require('../../utils/auth');
const authenticate = require('../../middleware/auth');
const logger = require('../../utils/logger');

const router = express.Router();

// Register a new node or update existing one
router.post('/register', (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const { nodeId, hostname, systemInfo } = req.body;

    if (!apiKey || !nodeId || !hostname) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: nodeId, hostname, or API key'
      });
    }

    // Validate nodeId format (alphanumeric + underscores/hyphens, max 128 chars)
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(nodeId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid nodeId format. Use only alphanumeric characters, underscores, and hyphens (max 128 chars).'
      });
    }

    // Sanitize hostname: strip HTML/script tags, limit length
    const sanitizedHostname = String(hostname).replace(/<[^>]*>/g, '').trim().substring(0, 255);
    if (!sanitizedHostname) {
      return res.status(400).json({
        success: false,
        error: 'Invalid hostname'
      });
    }

    // Check if node already exists
    let existingNode = database.getNode(nodeId);

    if (existingNode) {
      // Verify API key matches using secure hash comparison
      if (!auth.verifyApiKey(apiKey, existingNode.api_key_hash)) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key for this node'
        });
      }

      // Update existing node
      database.updateNodeStatus(nodeId, 'online');
      database.updateNodeLastSeen(nodeId);
      
      if (systemInfo) {
        database.updateNodeSystemInfo(nodeId, systemInfo);
      }

      logger.info(`Node ${nodeId} (${sanitizedHostname}) reconnected`);
      
      return res.json({
        success: true,
        message: 'Node updated successfully',
        nodeId: nodeId
      });
    }

    // Create new node
    const apiKeyHash = auth.hashApiKey(apiKey);
    
    database.createNode({
      id: nodeId,
      hostname: sanitizedHostname,
      apiKey: apiKey,
      apiKeyHash: apiKeyHash,
      status: 'online',
      systemInfo: systemInfo
    });

    logger.info(`New node registered: ${nodeId} (${sanitizedHostname})`);

    res.json({
      success: true,
      message: 'Node registered successfully',
      nodeId: nodeId
    });
  } catch (error) {
    logger.error('Error registering node:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all nodes (requires authentication)
router.get('/', authenticate, (req, res) => {
  try {
    const nodes = database.getAllNodes();
    
    // Update status based on last seen (offline if not seen in 30 seconds)
    const now = Date.now();
    const offlineThreshold = 30000; // 30 seconds

    nodes.forEach(node => {
      if (node.last_seen && (now - node.last_seen) > offlineThreshold) {
        if (node.status !== 'offline') {
          database.updateNodeStatus(node.id, 'offline');
          node.status = 'offline';
        }
      }
    });

    // Include latest metrics for each node
    const nodesWithMetrics = nodes.map(node => {
      const latestMetrics = database.getLatestMetrics(node.id, 1);
      const metricsData = latestMetrics.length > 0 ? latestMetrics[0].data : null;

      return {
        id: node.id,
        hostname: node.hostname,
        status: node.status,
        last_seen: node.last_seen,
        created_at: node.created_at,
        system_info: node.system_info,
        metrics: metricsData ? {
          cpu: metricsData.cpu?.usage || 0,
          memory: metricsData.memory?.usagePercent || 0,
          memoryUsed: metricsData.memory?.active ? (metricsData.memory.active / 1073741824).toFixed(1) : '0',
          memoryCached: metricsData.memory?.cached ? (metricsData.memory.cached / 1073741824).toFixed(1) : '0',
          memoryTotal: metricsData.memory?.total ? (metricsData.memory.total / 1073741824).toFixed(1) : '0',
          swap: metricsData.swap?.usagePercent || 0,
          disk: metricsData.disk && metricsData.disk.length > 0 ? metricsData.disk[0].usagePercent : 0,
          diskUsed: metricsData.disk && metricsData.disk.length > 0 ? (metricsData.disk[0].used / 1073741824).toFixed(1) : '0',
          diskTotal: metricsData.disk && metricsData.disk.length > 0 ? (metricsData.disk[0].size / 1073741824).toFixed(1) : '0',
          processes: metricsData.processes || {},
          timestamp: metricsData.timestamp
        } : null
      };
    });

    res.json({
      success: true,
      nodes: nodesWithMetrics
    });
  } catch (error) {
    logger.error('Error fetching nodes:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get specific node (requires authentication)
router.get('/:nodeId', authenticate, (req, res) => {
  try {
    const { nodeId } = req.params;
    const node = database.getNode(nodeId);

    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Node not found'
      });
    }

    // Remove sensitive data
    const sanitizedNode = {
      id: node.id,
      hostname: node.hostname,
      status: node.status,
      last_seen: node.last_seen,
      created_at: node.created_at,
      system_info: node.system_info
    };

    res.json({
      success: true,
      node: sanitizedNode
    });
  } catch (error) {
    logger.error('Error fetching node:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete a node (requires authentication)
router.delete('/:nodeId', authenticate, (req, res) => {
  try {
    const { nodeId } = req.params;
    const node = database.getNode(nodeId);

    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Node not found'
      });
    }

    database.deleteNode(nodeId);
    logger.info(`Node deleted: ${nodeId}`);

    res.json({
      success: true,
      message: 'Node deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting node:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
