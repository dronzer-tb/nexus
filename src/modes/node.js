const axios = require('axios');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('../utils/logger');
const config = require('../utils/config');
const metrics = require('../utils/metrics');
const auth = require('../utils/auth');

class NodeMode {
  constructor() {
    this.nodeId = null;
    this.apiKey = null;
    this.serverUrl = null;
    this.reportInterval = null;
    this.intervalId = null;
    this.nodeInfoPath = path.join(__dirname, '../../data/node-info.json');
    this.reverseSSHProcess = null;
    this.reverseSSHTunnelActive = false;
  }

  async start() {
    logger.info('Starting Nexus in NODE mode...');

    // Load configuration
    this.serverUrl = config.get('node.serverUrl');
    this.reportInterval = config.get('node.reportInterval') || 5000;

    if (!this.serverUrl) {
      logger.error('Server URL not configured. Please set node.serverUrl in config.json');
      process.exit(1);
    }

    // Load or create node credentials
    await this.loadOrCreateNodeInfo();

    // Collect and send initial system info with retry
    let registered = false;
    while (!registered) {
      registered = await this.sendSystemInfo();
      if (!registered) {
        logger.warn('Failed to register node, retrying in 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Start periodic metrics reporting
    this.startMetricsReporting();

    // Initialize reverse SSH tunnel for centralized console access
    this.initializeReverseSSHTunnel();

    logger.info(`Node mode started. Reporting to ${this.serverUrl} every ${this.reportInterval}ms`);
    logger.info(`Node ID: ${this.nodeId}`);
    logger.info(`API Key: ${this.apiKey.substring(0, 8)}...[REDACTED]`);
    logger.info('The full API key is stored in data/node-info.json');
  }

  async loadOrCreateNodeInfo() {
    // Check if node info exists
    if (fs.existsSync(this.nodeInfoPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.nodeInfoPath, 'utf8'));
        this.nodeId = data.nodeId;
        this.apiKey = data.apiKey;
        logger.info('Loaded existing node credentials');
        return;
      } catch (error) {
        logger.warn('Failed to load node info, creating new credentials');
      }
    }

    // Create new node credentials
    this.nodeId = auth.generateNodeId();
    this.apiKey = auth.generateApiKey();

    // Save credentials
    const dataDir = path.dirname(this.nodeInfoPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(this.nodeInfoPath, JSON.stringify({
      nodeId: this.nodeId,
      apiKey: this.apiKey,
      createdAt: Date.now()
    }, null, 2));

    logger.info('Created new node credentials');
  }

  async sendSystemInfo() {
    try {
      const systemInfo = await metrics.getSystemInfo();
      const hostname = config.get('node.hostname') || os.hostname();

      const response = await axios.post(
        `${this.serverUrl}/api/nodes/register`,
        {
          nodeId: this.nodeId,
          hostname: hostname,
          systemInfo: systemInfo
        },
        {
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data.success) {
        logger.info('Successfully registered with server');
        return true;
      }
      return false;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        logger.error(`Cannot connect to server at ${this.serverUrl}`);
      } else if (error.response) {
        // Server responded with an error status
        logger.error(`Failed to register with server: HTTP ${error.response.status} — ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        // Request was made but no response received
        logger.error(`No response from server at ${this.serverUrl}: ${error.message || error.code || 'unknown error'}`);
      } else {
        logger.error(`Failed to send system info: ${error.message || 'unknown error'}`);
      }
      return false;
    }
  }

  async sendMetrics() {
    try {
      const metricsData = await metrics.getAllMetrics();

      const response = await axios.post(
        `${this.serverUrl}/api/metrics`,
        {
          nodeId: this.nodeId,
          metrics: metricsData
        },
        {
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (!response.data.success) {
        logger.warn('Server rejected metrics:', response.data.error);
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        logger.debug('Server unavailable, will retry...');
      } else if (error.response?.status === 401) {
        logger.error('Authentication failed - invalid API key');
      } else if (error.response) {
        logger.debug(`Failed to send metrics: HTTP ${error.response.status} — ${JSON.stringify(error.response.data)}`);
      } else {
        logger.debug(`Failed to send metrics: ${error.message || error.code || 'unknown error'}`);
      }
    }
  }

  startMetricsReporting() {
    // Send metrics immediately
    this.sendMetrics();

    // Then send periodically
    this.intervalId = setInterval(() => {
      this.sendMetrics();
    }, this.reportInterval);
  }

  /**
   * Initialize reverse SSH tunnel to server
   * This allows the Nexus server to connect back to this node via reverse tunnel
   */
  async initializeReverseSSHTunnel() {
    try {
      const enableReverseTunnel = config.get('node.enableReverseTunnel') !== false;
      if (!enableReverseTunnel) {
        logger.info('Reverse SSH tunnel disabled in config');
        return;
      }

      const serverHost = config.get('node.serverHost') || config.get('server.host') || 'localhost';
      const serverPort = config.get('node.serverSSHPort') || 22;
      const reverseUsername = config.get('node.reverseUsername') || 'nexus';
      const reversePassword = config.get('node.reversePassword') || 'nexus-tunnel-123';
      const reversePort = config.get('node.reverseLocalPort') || 9000;

      logger.info(`Initializing reverse SSH tunnel...`);
      logger.info(`Reverse SSH config: ${reverseUsername}@${serverHost}:${serverPort}, reverse port: ${reversePort}`);

      // Try to find and execute reverse-ssh binary
      const reversSSHBinary = this.findReverseSSHBinary();
      if (!reversSSHBinary) {
        logger.warn('Reverse-SSH binary not found. Download from https://github.com/Fahrj/reverse-ssh/releases');
        logger.info('Manual setup: Run on this machine: reverse-ssh -v -b 9000 nexus@' + serverHost);
        return;
      }

      this.startReverseSSHProcess(reversSSHBinary, reverseUsername, serverHost, serverPort, reversePort, reversePassword);
    } catch (error) {
      logger.error('Failed to initialize reverse SSH tunnel:', error.message);
    }
  }

  /**
   * Find reverse-ssh binary in common locations
   */
  findReverseSSHBinary() {
    const commonPaths = [
      '/usr/local/bin/reverse-ssh',
      '/usr/bin/reverse-ssh',
      './reverse-ssh',
      path.join(__dirname, '../../bin/reverse-ssh'),
      path.join(process.cwd(), 'reverse-ssh'),
    ];

    if (os.platform() === 'win32') {
      commonPaths.push(
        'C:\\Program Files\\reverse-ssh\\reverse-ssh.exe',
        './reverse-ssh.exe',
        path.join(__dirname, '../../bin/reverse-ssh.exe')
      );
    }

    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        logger.info(`Found reverse-ssh binary at: ${p}`);
        return p;
      }
    }

    return null;
  }

  /**
   * Start reverse SSH process
   */
  startReverseSSHProcess(binaryPath, username, serverHost, serverPort, homePort, password) {
    try {
      logger.info(`Starting reverse SSH process: ${binaryPath}`);

      const args = [
        '-v',
        `-b ${homePort}`,
        `-p ${serverPort}`,
        `${username}@${serverHost}`,
      ];

      this.reverseSSHProcess = spawn(binaryPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
        env: {
          ...process.env,
          // Note: reverse-ssh reads password from stdin if needed
        },
      });

      let processOutput = '';

      this.reverseSSHProcess.stdout.on('data', (data) => {
        const message = data.toString().trim();
        processOutput += message;
        logger.debug(`[reverse-ssh] ${message}`);
        
        if (message.includes('Success') || message.includes('listening')) {
          this.reverseSSHTunnelActive = true;
          logger.info('Reverse SSH tunnel established successfully');
        }
      });

      this.reverseSSHProcess.stderr.on('data', (data) => {
        logger.debug(`[reverse-ssh stderr] ${data.toString().trim()}`);
      });

      this.reverseSSHProcess.on('error', (error) => {
        logger.error('Failed to start reverse-ssh:', error.message);
        this.reverseSSHTunnelActive = false;
      });

      this.reverseSSHProcess.on('close', (code) => {
        logger.warn(`Reverse SSH process exited with code ${code}`);
        this.reverseSSHTunnelActive = false;

        // Try to restart
        if (config.get('node.autoRestartReverseTunnel') !== false) {
          logger.info('Restarting reverse SSH tunnel in 10 seconds...');
          setTimeout(() => {
            this.initializeReverseSSHTunnel();
          }, 10000);
        }
      });

      // Send password if not using key authentication
      if (password && this.reverseSSHProcess.stdin) {
        // Note: This is a simplified approach. For production, consider using expect-like logic
        setTimeout(() => {
          if (this.reverseSSHProcess && this.reverseSSHProcess.stdin) {
            this.reverseSSHProcess.stdin.write(password + '\n');
          }
        }, 1000);
      }

      logger.info('Reverse SSH process started');
    } catch (error) {
      logger.error('Error starting reverse SSH process:', error.message);
      this.reverseSSHTunnelActive = false;
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Stop reverse SSH process
    if (this.reverseSSHProcess) {
      try {
        logger.info('Stopping reverse SSH process...');
        this.reverseSSHProcess.kill('SIGTERM');
        setTimeout(() => {
          if (this.reverseSSHProcess && !this.reverseSSHProcess.killed) {
            this.reverseSSHProcess.kill('SIGKILL');
          }
        }, 5000);
      } catch (error) {
        logger.debug('Error stopping reverse SSH process:', error.message);
      }
      this.reverseSSHProcess = null;
      this.reverseSSHTunnelActive = false;
    }

    logger.info('Node mode stopped');
  }
}

module.exports = NodeMode;
