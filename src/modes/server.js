const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const config = require('../utils/config');
const database = require('../utils/database');

// Import routes
const authRouter = require('../api/routes/auth');
const agentsRouter = require('../api/routes/agents');
const processesRouter = require('../api/routes/processes');
const commandsRouter = require('../api/routes/commands');
const logsRouter = require('../api/routes/logs');

class ServerMode {
  constructor() {
    this.app = express();
    this.server = null;
    this.io = null;
    this.port = null;
    this.host = null;
    this.agents = agentsRouter.agents;
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
      logger.info(`Dashboard available at http://${this.host}:${this.port}/`);
      logger.info('Default credentials: admin / admin123');
    });

    // Graceful shutdown
    this.setupGracefulShutdown();
  }

  setupMiddleware() {
    // Security
    this.app.use(helmet({
      contentSecurityPolicy: false,
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
    this.app.use('/api/auth', authRouter);
    this.app.use('/api/agents', agentsRouter);
    this.app.use('/api/processes', processesRouter);
    this.app.use('/api/commands', commandsRouter);
    this.app.use('/api/logs', logsRouter);

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: Date.now(),
        agents: {
          total: this.agents.size,
          online: Array.from(this.agents.values()).filter(a => a.status === 'online').length
        }
      });
    });

    // API info
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'Nexus API',
        version: '1.0.0',
        endpoints: {
          auth: '/api/auth',
          agents: '/api/agents',
          processes: '/api/processes',
          commands: '/api/commands',
          logs: '/api/logs',
          health: '/health'
        }
      });
    });

    // Serve dashboard static files
    const dashboardPath = path.join(__dirname, '../../dashboard/dist');
    this.app.use(express.static(dashboardPath));

    // Dashboard fallback for client-side routing
    this.app.get('*', (req, res) => {
      const indexPath = path.join(dashboardPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          res.status(404).send('Dashboard not found. Please build the dashboard first with: npm run build:dashboard');
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

    // Agent namespace for agent connections
    const agentNamespace = this.io.of('/agent');
    
    agentNamespace.on('connection', (socket) => {
      logger.info(`Agent connected: ${socket.id}`);

      // Register agent
      socket.on('agent:register', (data) => {
        const agentId = socket.id;
        const agent = {
          id: agentId,
          socket: socket,
          hostname: data.hostname,
          ip: data.ip || socket.handshake.address,
          status: 'online',
          metrics: data.metrics || {},
          systemInfo: data.systemInfo || {},
          connectedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString()
        };

        this.agents.set(agentId, agent);
        logger.info(`Agent registered: ${agent.hostname} (${agentId})`);

        // Broadcast agent list update to dashboard clients
        this.io.emit('agents:update', Array.from(this.agents.values()).map(a => ({
          id: a.id,
          hostname: a.hostname,
          ip: a.ip,
          status: a.status,
          metrics: a.metrics,
          lastSeen: a.lastSeen
        })));

        // Log the connection
        logsRouter.addLog('info', `Agent connected: ${agent.hostname}`, { agentId, ip: agent.ip });
      });

      // Handle metrics updates
      socket.on('agent:metrics', (data) => {
        const agent = this.agents.get(socket.id);
        if (agent) {
          agent.metrics = data;
          agent.lastSeen = new Date().toISOString();

          // Broadcast to dashboard clients
          this.io.emit('agent:metrics', {
            agentId: socket.id,
            metrics: data
          });
        }
      });

      // Handle command output
      socket.on('command:output', (data) => {
        // Broadcast to dashboard clients
        this.io.emit('command:output', {
          agentId: socket.id,
          output: data.output
        });
      });

      // Handle agent disconnect
      socket.on('disconnect', () => {
        const agent = this.agents.get(socket.id);
        if (agent) {
          agent.status = 'offline';
          agent.socket = null;
          logger.info(`Agent disconnected: ${agent.hostname} (${socket.id})`);

          // Broadcast agent status update
          this.io.emit('agent:status', {
            agentId: socket.id,
            status: 'offline'
          });

          // Log the disconnection
          logsRouter.addLog('info', `Agent disconnected: ${agent.hostname}`, { agentId: socket.id });

          // Remove agent after 5 minutes of being offline
          setTimeout(() => {
            const currentAgent = this.agents.get(socket.id);
            if (currentAgent && currentAgent.status === 'offline') {
              this.agents.delete(socket.id);
              this.io.emit('agents:update', Array.from(this.agents.values()).map(a => ({
                id: a.id,
                hostname: a.hostname,
                ip: a.ip,
                status: a.status,
                metrics: a.metrics,
                lastSeen: a.lastSeen
              })));
            }
          }, 5 * 60 * 1000);
        }
      });
    });

    // Dashboard namespace for dashboard clients
    const dashboardNamespace = this.io;

    dashboardNamespace.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      try {
        const decoded = jwt.verify(token, config.get('server.jwtSecret', 'nexus-secret-key'));
        socket.user = decoded;
        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });

    dashboardNamespace.on('connection', (socket) => {
      logger.info(`Dashboard client connected: ${socket.id} (user: ${socket.user.username})`);

      // Send current agent list on connection
      socket.emit('agents:update', Array.from(this.agents.values()).map(a => ({
        id: a.id,
        hostname: a.hostname,
        ip: a.ip,
        status: a.status,
        metrics: a.metrics,
        lastSeen: a.lastSeen
      })));

      socket.on('disconnect', () => {
        logger.info(`Dashboard client disconnected: ${socket.id}`);
      });
    });

    logger.info('WebSocket server initialized');
  }

  setupMetricsBroadcast() {
    // Broadcast metrics periodically
    setInterval(() => {
      const agentsList = Array.from(this.agents.values()).map(a => ({
        id: a.id,
        hostname: a.hostname,
        ip: a.ip,
        status: a.status,
        metrics: a.metrics,
        lastSeen: a.lastSeen
      }));

      this.io.emit('agents:update', agentsList);
    }, 5000);
  }

  setupGracefulShutdown() {
    const shutdown = () => {
      logger.info('Shutting down server...');

      if (this.io) {
        this.io.close();
      }

      if (this.server) {
        this.server.close(() => {
          logger.info('Server closed');
          database.close();
          process.exit(0);
        });
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
    if (this.io) {
      this.io.close();
    }
    database.close();
  }
}

module.exports = ServerMode;
