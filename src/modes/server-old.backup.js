const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../utils/config');
const database = require('../utils/database');
const WebSocketHandler = require('../api/websocket');

// Import routes
const nodesRouter = require('../api/routes/nodes');
const metricsRouter = require('../api/routes/metrics');

class ServerMode {
  constructor() {
    this.app = express();
    this.server = null;
    this.io = null;
    this.wsHandler = null;
    this.port = null;
    this.host = null;
  }

  async start() {
    logger.info('Starting Nexus in SERVER mode...');

    // Initialize database
    database.init();

    // Load configuration
    this.port = config.get('server.port') || 8080;
    this.host = config.get('server.host') || '0.0.0.0';

    // Setup Express middleware
    this.setupMiddleware();

    // Setup routes
    this.setupRoutes();

    // Create HTTP server
    this.server = http.createServer(this.app);

    // Setup Socket.IO
    this.setupWebSocket();

    // Setup metrics broadcast
    this.setupMetricsBroadcast();

    // Start listening
    this.server.listen(this.port, this.host, () => {
      logger.info(`Server mode started on http://${this.host}:${this.port}`);
      logger.info(`Dashboard available at http://${this.host}:${this.port}/dashboard`);
    });

    // Graceful shutdown
    this.setupGracefulShutdown();
  }

  setupMiddleware() {
    // Security
    this.app.use(helmet({
      contentSecurityPolicy: false, // Allow inline scripts for dashboard
    }));

    // CORS
    this.app.use(cors({
      origin: '*',
      credentials: true
    }));

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // API routes
    this.app.use('/api/nodes', nodesRouter);
    this.app.use('/api/metrics', metricsRouter);

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: Date.now()
      });
    });

    // API info
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'Nexus API',
        version: '1.0.0',
        endpoints: {
          nodes: '/api/nodes',
          metrics: '/api/metrics',
          health: '/health'
        }
      });
    });

    // Serve dashboard static files
    const dashboardPath = path.join(__dirname, '../../dashboard/build');
    this.app.use('/dashboard', express.static(dashboardPath));

    // Serve dashboard on root as well
    this.app.use('/', express.static(dashboardPath));

    // Dashboard fallback for client-side routing
    this.app.get('*', (req, res) => {
      const indexPath = path.join(dashboardPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          res.status(404).send('Dashboard not found. Please build the dashboard first.');
        }
      });
    });

    // Error handling
    this.app.use((err, req, res, next) => {
      logger.error('Express error:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    });
  }

  setupWebSocket() {
    this.io = new Server(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.wsHandler = new WebSocketHandler(this.io);
    this.wsHandler.init();

    logger.info('WebSocket server initialized');
  }

  setupMetricsBroadcast() {
    // Periodically broadcast node updates
    setInterval(() => {
      if (this.wsHandler) {
        this.wsHandler.broadcastNodesUpdate();
      }
    }, 5000);

    // Monitor for node status changes
    setInterval(() => {
      const nodes = database.getAllNodes();
      const now = Date.now();
      const offlineThreshold = 30000; // 30 seconds

      nodes.forEach(node => {
        if (node.last_seen && (now - node.last_seen) > offlineThreshold) {
          if (node.status !== 'offline') {
            database.updateNodeStatus(node.id, 'offline');
            if (this.wsHandler) {
              this.wsHandler.broadcastNodeStatus(node.id, 'offline');
            }
            logger.info(`Node ${node.id} went offline`);
          }
        }
      });
    }, 10000);
  }

  setupGracefulShutdown() {
    const shutdown = () => {
      logger.info('Shutting down server...');
      
      this.server.close(() => {
        logger.info('Server closed');
        database.close();
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Forcing shutdown...');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
    database.close();
    logger.info('Server mode stopped');
  }
}

module.exports = ServerMode;
