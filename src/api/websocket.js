const logger = require('../utils/logger');
const database = require('../utils/database');
const sshTerminal = require('./ssh-terminal');
const revTunnelManager = require('../utils/reverse-ssh-tunnel');
const os = require('os');

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
        const sessionId = data?.sessionId || socket.id;
        logger.info(`terminal:connect received from ${socket.id} (session: ${sessionId}): ${JSON.stringify(data)}`);
        this.handleTerminalConnect(socket, data, sessionId);
      });

      socket.on('terminal:data', (payload) => {
        // Support both old format (string) and new format ({ sessionId, data })
        if (typeof payload === 'object' && payload.sessionId) {
          const sessionKey = `${socket.id}:${payload.sessionId}`;
          sshTerminal.write(sessionKey, payload.data);
        } else {
          // Legacy: no sessionId
          sshTerminal.write(socket.id, payload);
        }
      });

      socket.on('terminal:resize', (payload) => {
        const { cols, rows, sessionId } = payload || {};
        if (sessionId) {
          const sessionKey = `${socket.id}:${sessionId}`;
          sshTerminal.resize(sessionKey, cols, rows);
        } else {
          sshTerminal.resize(socket.id, cols, rows);
        }
      });

      socket.on('terminal:disconnect', (payload) => {
        if (payload && payload.sessionId) {
          const sessionKey = `${socket.id}:${payload.sessionId}`;
          sshTerminal.disconnect(sessionKey);
        } else {
          sshTerminal.disconnect(socket.id);
        }
      });

      socket.on('disconnect', () => {
        logger.info(`WebSocket client disconnected: ${socket.id}`);
        sshTerminal.disconnectAllForSocket(socket.id);
        this.clients.delete(socket.id);
      });
    });

    logger.info('WebSocket handler initialized');
  }

  // Handle terminal connection requests
  handleTerminalConnect(socket, data, sessionId) {
    const { nodeId, host, port, username, password, privateKey, isLocal, useReverseTunnel } = data || {};
    const sessionKey = `${socket.id}:${sessionId}`;

    // Check if console is globally enabled
    if (!sshTerminal.isConsoleEnabled()) {
      socket.emit('terminal:error', { sessionId, message: 'Console is disabled globally. Enable it in Settings.' });
      return;
    }

    // Explicit local connection request
    if (isLocal === true) {
      logger.info(`Local terminal requested by socket ${socket.id} (session: ${sessionId})`);
      sshTerminal.connectLocal(socket, sessionKey, sessionId);
      return;
    }

    // Check per-node console enabled (if nodeId provided)
    if (nodeId) {
      const node = database.getNode(nodeId);
      if (node && node.console_enabled === 0) {
        socket.emit('terminal:error', { sessionId, message: `Console is disabled for node "${node.hostname || nodeId}". Enable it in node settings.` });
        return;
      }

      // Check if this is the local node (combine mode)
      if (node) {
        const localHostname = os.hostname();
        if (node.hostname === localHostname || node.system_info?.os?.hostname === localHostname) {
          logger.info(`Local console for node ${nodeId} (hostname: ${node.hostname}) matches current machine (socket: ${socket.id}, session: ${sessionId})`);
          sshTerminal.connectLocal(socket, sessionKey, sessionId);
          return;
        }
      }

      // Try reverse SSH tunnel for remote nodes
      const tunnelInfo = revTunnelManager.getTunnelInfo(nodeId);
      if (tunnelInfo || useReverseTunnel) {
        logger.info(`Using reverse SSH tunnel for node ${nodeId} (socket: ${socket.id}, session: ${sessionId})`);
        sshTerminal.connectReverse(socket, { nodeId }, sessionKey, sessionId);
        return;
      }
    }

    // SSH to remote node
    if (host) {
      logger.info(`SSH terminal requested: ${username || 'root'}@${host}:${port || 22} (socket: ${socket.id}, session: ${sessionId})`);
      sshTerminal.connect(socket, {
        host,
        port: port || 22,
        username: username || 'root',
        password,
        privateKey,
      }, sessionKey, sessionId);
      return;
    }

    // Default to local PTY (combine mode fallback)
    logger.info(`No remote host specified, using local terminal (combine mode) (socket: ${socket.id}, session: ${sessionId})`);
    sshTerminal.connectLocal(socket, sessionKey, sessionId);
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
