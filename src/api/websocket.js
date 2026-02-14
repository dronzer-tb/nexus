const logger = require('../utils/logger');
const database = require('../utils/database');
const sshTerminal = require('./ssh-terminal');

class WebSocketHandler {
  constructor(io) {
    this.io = io;
    this.clients = new Map();
  }

  init() {
    this.io.on('connection', (socket) => {
      logger.info(`WebSocket client connected: ${socket.id}`);
      this.clients.set(socket.id, socket);

      // Send initial data
      this.sendInitialData(socket);

      // Handle client requests
      socket.on('subscribe:node', (nodeId) => {
        socket.join(`node:${nodeId}`);
        logger.debug(`Client ${socket.id} subscribed to node ${nodeId}`);
      });

      socket.on('unsubscribe:node', (nodeId) => {
        socket.leave(`node:${nodeId}`);
        logger.debug(`Client ${socket.id} unsubscribed from node ${nodeId}`);
      });

      socket.on('request:nodes', () => {
        this.sendNodes(socket);
      });

      socket.on('request:metrics', ({ nodeId, limit }) => {
        this.sendMetrics(socket, nodeId, limit);
      });

      // ─── SSH Terminal Events ─────────────────
      socket.on('terminal:connect', (data) => {
        this.handleTerminalConnect(socket, data);
      });

      socket.on('terminal:data', (data) => {
        sshTerminal.write(socket.id, data);
      });

      socket.on('terminal:resize', ({ cols, rows }) => {
        sshTerminal.resize(socket.id, cols, rows);
      });

      socket.on('terminal:disconnect', () => {
        sshTerminal.disconnect(socket.id);
      });

      socket.on('disconnect', () => {
        logger.info(`WebSocket client disconnected: ${socket.id}`);
        sshTerminal.disconnect(socket.id);
        this.clients.delete(socket.id);
      });
    });

    logger.info('WebSocket handler initialized');
  }

  // Handle terminal connection requests
  handleTerminalConnect(socket, data) {
    const { nodeId, host, port, username, password, privateKey, isLocal } = data || {};

    // Check if console is globally enabled
    if (!sshTerminal.isConsoleEnabled()) {
      socket.emit('terminal:error', { message: 'Console is disabled globally. Enable it in Settings.' });
      return;
    }

    // Check per-node console enabled (if nodeId provided)
    if (nodeId) {
      const node = database.getNode(nodeId);
      if (node && node.console_enabled === 0) {
        socket.emit('terminal:error', { message: `Console is disabled for node "${node.hostname || nodeId}". Enable it in node settings.` });
        return;
      }
    }

    if (isLocal) {
      // Connect to local machine (combine mode)
      logger.info(`Local terminal requested by socket ${socket.id}`);
      sshTerminal.connectLocal(socket);
      return;
    }

    // SSH to remote node
    if (!host) {
      socket.emit('terminal:error', { message: 'Host is required for remote connections' });
      return;
    }

    logger.info(`SSH terminal requested: ${username || 'root'}@${host}:${port || 22} (socket: ${socket.id})`);
    sshTerminal.connect(socket, {
      host,
      port: port || 22,
      username: username || 'root',
      password,
      privateKey,
    });
  }

  sendInitialData(socket) {
    try {
      const nodes = database.getAllNodes();
      socket.emit('nodes:update', nodes);
    } catch (error) {
      logger.error('Error sending initial data:', error);
    }
  }

  sendNodes(socket) {
    try {
      const nodes = database.getAllNodes();
      socket.emit('nodes:update', nodes);
    } catch (error) {
      logger.error('Error sending nodes:', error);
    }
  }

  sendMetrics(socket, nodeId, limit = 100) {
    try {
      const metrics = database.getLatestMetrics(nodeId, limit);
      socket.emit('metrics:update', { nodeId, metrics });
    } catch (error) {
      logger.error('Error sending metrics:', error);
    }
  }

  // Broadcast to all connected clients
  broadcastNodesUpdate() {
    try {
      const nodes = database.getAllNodes();
      this.io.emit('nodes:update', nodes);
    } catch (error) {
      logger.error('Error broadcasting nodes update:', error);
    }
  }

  // Broadcast metrics update for a specific node
  broadcastMetricsUpdate(nodeId, metrics) {
    try {
      // Send to room subscribers
      this.io.to(`node:${nodeId}`).emit('metrics:update', {
        nodeId,
        metrics: [metrics]
      });

      // Also send to general audience
      this.io.emit('metrics:new', {
        nodeId,
        metrics
      });
    } catch (error) {
      logger.error('Error broadcasting metrics update:', error);
    }
  }

  // Broadcast node status change
  broadcastNodeStatus(nodeId, status) {
    try {
      this.io.emit('node:status', { nodeId, status });
    } catch (error) {
      logger.error('Error broadcasting node status:', error);
    }
  }

  // Send message to specific client
  sendToClient(socketId, event, data) {
    const socket = this.clients.get(socketId);
    if (socket) {
      socket.emit(event, data);
    }
  }
}

module.exports = WebSocketHandler;
