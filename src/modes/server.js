const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../utils/config');
const database = require('../utils/database');
const auth = require('../utils/auth');

// Import routes
const authRouter = require('../api/routes/auth');
const agentsRouter = require('../api/routes/agents');
const nodesRouter = require('../api/routes/nodes');
const metricsRouter = require('../api/routes/metrics');
const processesRouter = require('../api/routes/processes');
const commandsRouter = require('../api/routes/commands');
const logsRouter = require('../api/routes/logs');
const updateRouter = require('../api/routes/update');

// Import WebSocket handler
const WebSocketHandler = require('../api/websocket');
const discordBot = require('../utils/discord-bot');

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

    // Ensure admin credentials file exists (auto-create on fresh install)
    this.ensureAdminCredentials();

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

    // Expose io on express app for route handlers (e.g., update push to nodes)
    this.app.set('io', this.io);

    // Setup metrics broadcast
    this.setupMetricsBroadcast();

    // Start listening
    this.server.listen(this.port, this.host, () => {
      logger.info(`Server mode started on http://${this.host}:${this.port}`);
      logger.info(`Dashboard available at http://${this.host}:${this.port}/`);
      logger.info('Default credentials: admin / admin123');
    });

    // Initialize Discord bot (non-blocking)
    discordBot.init().catch(err => {
      logger.warn('[Discord] Bot init skipped:', err.message);
    });

    // Graceful shutdown
    this.setupGracefulShutdown();
  }

  ensureAdminCredentials() {
    const { adminExists, saveAdmin } = require('../utils/setup-admin');
    if (!adminExists()) {
      try {
        const bcrypt = require('bcrypt');
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        const saved = saveAdmin({
          id: 1,
          username: 'admin',
          password: hashedPassword,
          mustChangePassword: true,
          createdAt: new Date().toISOString()
        });
        if (saved) {
          logger.info('Default admin account created (admin / admin123) — password change required on first login');
        }
      } catch (error) {
        logger.warn('Could not auto-create admin credentials:', error.message);
      }
    }
  }

  setupMiddleware() {
    // Trust proxy when behind nginx (required for express-rate-limit, correct IPs)
    const nginxEnabled = config.get('nginx.enabled');
    if (nginxEnabled) {
      this.app.set('trust proxy', 1);
      logger.info('Trust proxy enabled (behind nginx)');
    }

    // Security
    this.app.use(helmet({
      contentSecurityPolicy: false,
    }));

    // CORS — allow all origins in development, restrict in production
    const allowedOrigins = config.get('server.corsOrigins') || [];
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (same-origin, curl, mobile apps, Postman)
        if (!origin) return callback(null, true);
        
        // In development mode, allow all origins
        if (isDevelopment) return callback(null, true);

        // During onboarding (before config is fully set), allow the requesting origin
        const onboardingComplete = config.get('nginx.enabled');
        if (!onboardingComplete) return callback(null, true);
        
        // Allow configured origins
        if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        
        // Allow same-host requests (dashboard served from same server)
        const selfOrigin = `http://${this.host === '0.0.0.0' ? 'localhost' : this.host}:${this.port}`;
        if (origin === selfOrigin || origin === `http://localhost:${this.port}` || origin.startsWith('http://localhost:')) {
          return callback(null, true);
        }
        
        // Allow 127.0.0.1
        if (origin.startsWith('http://127.0.0.1:')) {
          return callback(null, true);
        }

        // Allow Tailscale IPs (100.x.x.x)
        if (/^https?:\/\/100\.\d+\.\d+\.\d+/.test(origin)) {
          return callback(null, true);
        }
        
        // Allow nginx domain if configured
        const nginxDomain = config.get('nginx.domain');
        if (nginxDomain) {
          if (origin === `https://${nginxDomain}` || origin === `http://${nginxDomain}`) {
            return callback(null, true);
          }
        }
        
        // Allow origin but log it — don't block requests with CORS errors
        logger.warn(`CORS: allowing unlisted origin: ${origin}`);
        callback(null, true);
      },
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
    // Onboarding routes (no auth required - only for initial setup)
    this.app.use('/api/onboarding', require('../api/routes/onboarding'));
    
    // Authentication routes (no auth required for login, but required for others)
    this.app.use('/api/auth', require('../api/routes/auth'));
    
    // Mobile pairing routes (require authentication)
    this.app.use('/api/mobile', require('../api/routes/mobile'));
    
    // API routes - Require authentication (session or API key)
    this.app.use('/api/system', require('../api/routes/system'));
    this.app.use('/api/agents', agentsRouter);
    this.app.use('/api/nodes', nodesRouter);
    this.app.use('/api/metrics', metricsRouter);
    this.app.use('/api/processes', processesRouter);
    this.app.use('/api/commands', commandsRouter);
    this.app.use('/api/logs', logsRouter);
    this.app.use('/api/console', require('../api/routes/console'));
    this.app.use('/api/update', updateRouter);
    this.app.use('/api/audit', require('../api/routes/audit'));
    this.app.use('/api/alerts', require('../api/routes/alerts'));
    this.app.use('/api/tailscale', require('../api/routes/tailscale'));

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
    // Only serve index.html for non-API routes (SPA client-side routing)
    this.app.get('*', (req, res, next) => {
      // Skip API routes — let them 404 naturally instead of serving HTML
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'Endpoint not found' });
      }
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
      const status = err.status || 500;
      res.status(status).json({
        success: false,
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
      });
    });
  }

  setupWebSocket() {
    this.io = new Server(this.server, {
      cors: {
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          const allowedOrigins = config.get('server.corsOrigins') || [];
          // Allow localhost and 127.0.0.1 on the configured port
          const selfOrigins = [
            `http://localhost:${this.port}`,
            `http://127.0.0.1:${this.port}`,
            `https://localhost:${this.port}`,
            `https://127.0.0.1:${this.port}`
          ];
          if (allowedOrigins.includes(origin) || selfOrigins.includes(origin)) {
            return callback(null, true);
          }
          callback(new Error('CORS not allowed'));
        },
        methods: ['GET', 'POST']
      }
    });

    // Agent namespace for agent connections (requires API key)
    const agentNamespace = this.io.of('/agent');

    agentNamespace.use((socket, next) => {
      const apiKey = socket.handshake.auth.apiKey;
      if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 32) {
        return next(new Error('Valid API key required'));
      }
      socket.apiKey = apiKey;
      next();
    });
    
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
        // Validate session token (custom auth system v2.2.8)
        const { validateSession } = require('../utils/session');
        const session = validateSession(token);
        if (!session) return next(new Error('Invalid or expired session'));

        // Get user info from session
        const user = database.getUserById(session.user_id);
        if (!user) return next(new Error('User not found'));

        socket.user = {
          userId: user.id,
          username: user.username,
          role: user.role
        };
        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });

    // Initialize WebSocket handler for terminal, nodes, and metrics
    const wsHandler = new WebSocketHandler(this.io);
    wsHandler.init();

    // Create a mechanism to monitor agents for backward compatibility with dashboard
    // This broadcasts agents list periodically
    this.setupAgentBroadcast();

    logger.info('WebSocket server initialized');
  }

  setupMetricsBroadcast() {
    // Broadcast database node data with metrics periodically
    setInterval(() => {
      try {
        const nodes = database.getAllNodes();
        const now = Date.now();
        const offlineThreshold = 30000;

        const nodesWithMetrics = nodes.map(node => {
          if (node.last_seen && (now - node.last_seen) > offlineThreshold) {
            if (node.status !== 'offline') {
              database.updateNodeStatus(node.id, 'offline');
              node.status = 'offline';
            }
          }

          const latestMetrics = database.getLatestMetrics(node.id, 1);
          const metricsData = latestMetrics.length > 0 ? latestMetrics[0].data : null;

          return {
            id: node.id,
            hostname: node.hostname,
            status: node.status,
            last_seen: node.last_seen,
            system_info: node.system_info,
            metrics: metricsData ? {
              cpu: metricsData.cpu?.usage || 0,
              memory: metricsData.memory?.usagePercent || 0,
              memoryUsed: metricsData.memory?.used ? (metricsData.memory.used / 1073741824).toFixed(1) : '0',
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

        this.io.emit('nodes:update', nodesWithMetrics);
      } catch (error) {
        logger.error('Error broadcasting node metrics:', error);
      }
    }, 5000);
  }

  setupAgentBroadcast() {
    // Broadcast agents list periodically for backward compatibility
    setInterval(() => {
      try {
        this.io.emit('agents:update', Array.from(this.agents.values()).map(a => ({
          id: a.id,
          hostname: a.hostname,
          ip: a.ip,
          status: a.status,
          metrics: a.metrics,
          lastSeen: a.lastSeen
        })));
      } catch (error) {
        logger.error('Error broadcasting agents update:', error);
      }
    }, 10000);
  }

  setupGracefulShutdown() {
    const shutdown = () => {
      logger.info('Shutting down server...');

      // Disconnect Discord bot
      discordBot.destroy().catch(() => {});

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
