const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

// Store for agents (in-memory for now, can be moved to database)
const agents = new Map();

// Authentication middleware
const authenticate = require('../../middleware/auth');

// Apply authentication to all routes
router.use(authenticate);

// Get all agents
router.get('/', (req, res) => {
  try {
    const agentsList = Array.from(agents.values()).map(agent => ({
      id: agent.id,
      hostname: agent.hostname,
      ip: agent.ip,
      status: agent.status,
      metrics: agent.metrics,
      lastSeen: agent.lastSeen,
      connectedAt: agent.connectedAt
    }));

    res.json(agentsList);
  } catch (error) {
    logger.error('Error fetching agents:', error);
    res.status(500).json({ message: 'Failed to fetch agents' });
  }
});

// Get specific agent
router.get('/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = agents.get(agentId);

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    res.json({
      id: agent.id,
      hostname: agent.hostname,
      ip: agent.ip,
      status: agent.status,
      metrics: agent.metrics,
      systemInfo: agent.systemInfo,
      lastSeen: agent.lastSeen,
      connectedAt: agent.connectedAt
    });
  } catch (error) {
    logger.error('Error fetching agent:', error);
    res.status(500).json({ message: 'Failed to fetch agent' });
  }
});

// Get agent processes
router.get('/:agentId/processes', async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = agents.get(agentId);

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    if (agent.status !== 'online' || !agent.socket) {
      return res.status(503).json({ message: 'Agent is offline' });
    }

    // Request processes from agent via socket
    agent.socket.emit('request:processes', {}, (response) => {
      if (response.error) {
        return res.status(500).json({ message: response.error });
      }
      res.json(response.processes || []);
    });

    // Timeout if agent doesn't respond
    setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({ message: 'Agent response timeout' });
      }
    }, 10000);
  } catch (error) {
    logger.error('Error fetching processes:', error);
    res.status(500).json({ message: 'Failed to fetch processes' });
  }
});

// Kill a process on agent
router.post('/:agentId/processes/:pid/kill', async (req, res) => {
  try {
    const { agentId, pid } = req.params;
    const agent = agents.get(agentId);

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    if (agent.status !== 'online' || !agent.socket) {
      return res.status(503).json({ message: 'Agent is offline' });
    }

    // Send kill command to agent
    agent.socket.emit('command:kill-process', { pid }, (response) => {
      if (response.error) {
        return res.status(500).json({ message: response.error });
      }
      logger.info(`Process ${pid} killed on agent ${agentId}`);
      res.json({ message: 'Process killed successfully' });
    });

    // Timeout if agent doesn't respond
    setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({ message: 'Agent response timeout' });
      }
    }, 10000);
  } catch (error) {
    logger.error('Error killing process:', error);
    res.status(500).json({ message: 'Failed to kill process' });
  }
});

// Execute command on agent
router.post('/:agentId/execute', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { command } = req.body;
    const agent = agents.get(agentId);

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    if (agent.status !== 'online' || !agent.socket) {
      return res.status(503).json({ message: 'Agent is offline' });
    }

    if (!command) {
      return res.status(400).json({ message: 'Command is required' });
    }

    // Send command to agent
    agent.socket.emit('command:execute', { command, userId: req.user.userId }, (response) => {
      if (response.error) {
        return res.status(500).json({ message: response.error });
      }
      logger.info(`Command executed on agent ${agentId}: ${command}`);
      res.json({ message: 'Command execution started' });
    });

    // Timeout if agent doesn't respond
    setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({ message: 'Agent response timeout' });
      }
    }, 5000);
  } catch (error) {
    logger.error('Error executing command:', error);
    res.status(500).json({ message: 'Failed to execute command' });
  }
});

// Export agents map for use in WebSocket handler
router.agents = agents;

module.exports = router;
