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

// Execute command on agent (or node)
router.post('/:agentId/execute', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { command } = req.body;
    
    // First try to find as WebSocket agent
    let agent = agents.get(agentId);
    
    // If not found as agent, try to find as database node
    if (!agent) {
      const database = require('../../utils/database');
      const node = database.getNode(agentId);
      
      if (!node) {
        return res.status(404).json({ 
          message: 'Node/Agent not found',
          hint: 'This node may not be connected. Nodes using HTTP reporting cannot execute commands in real-time. Please use WebSocket agent mode for command execution.'
        });
      }
      
      // Node exists but is HTTP-only (cannot execute commands)
      return res.status(503).json({ 
        message: 'Command execution not supported for HTTP-only nodes',
        detail: 'This node uses HTTP reporting and cannot execute commands in real-time. To enable command execution, run the node with WebSocket agent mode.',
        nodeStatus: node.status
      });
    }

    if (agent.status !== 'online' || !agent.socket) {
      return res.status(503).json({ message: 'Agent is offline or not connected via WebSocket' });
    }

    if (!command) {
      return res.status(400).json({ message: 'Command is required' });
    }

    // Security: validate command length and block dangerous patterns
    if (command.length > 2000) {
      return res.status(400).json({ message: 'Command too long (max 2000 characters)' });
    }

    const dangerousPatterns = [
      /rm\s+(-rf?|--no-preserve-root)\s+\//i,  // rm -rf /
      /mkfs\./i,                                  // filesystem format
      /dd\s+if=.*of=\/dev\//i,                   // overwrite devices
      />(\/dev\/[sh]d|\/dev\/nvme)/i,             // redirect to disk devices
      /:(){ :\|:& };:/,                           // fork bomb
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        logger.warn(`Blocked dangerous command from user ${req.user.userId}: ${command}`);
        return res.status(403).json({ message: 'Command blocked by security policy' });
      }
    }

    logger.info(`Command requested by user ${req.user.userId} on agent ${agentId}: ${command.substring(0, 100)}`);

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

// Connect new agent manually
router.post('/connect', async (req, res) => {
  try {
    const { name, apiKey } = req.body;

    if (!name || !apiKey) {
      return res.status(400).json({ 
        success: false,
        message: 'Agent name and API key are required' 
      });
    }

    // Validate API key format (basic validation)
    if (apiKey.length < 32) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid API key format' 
      });
    }

    // Store the agent connection request
    // The actual connection will happen when the agent connects via WebSocket
    // For now, we'll create a placeholder entry
    const agentId = `agent_${Date.now()}`;
    
    logger.info(`Manual agent connection requested: ${name} (${agentId})`);
    
    // In a real implementation, you would:
    // 1. Validate the API key against stored credentials
    // 2. Store the agent info in database
    // 3. Wait for WebSocket connection from the agent
    
    // For now, return success and let the WebSocket handler manage the actual connection
    res.json({ 
      success: true,
      message: 'Agent connection request received. The agent will appear once it connects.',
      agentId
    });
  } catch (error) {
    logger.error('Error connecting agent:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to process agent connection' 
    });
  }
});

// Export agents map for use in WebSocket handler
router.agents = agents;

module.exports = router;
