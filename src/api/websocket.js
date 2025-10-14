const logger = require('../utils/logger');
const database = require('../utils/database');

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

      socket.on('disconnect', () => {
        logger.info(`WebSocket client disconnected: ${socket.id}`);
        this.clients.delete(socket.id);
      });
    });

    logger.info('WebSocket handler initialized');
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
