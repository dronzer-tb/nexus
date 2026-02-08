const axios = require('axios');
const os = require('os');
const fs = require('fs');
const path = require('path');
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

    // Collect and send initial system info
    await this.sendSystemInfo();

    // Start periodic metrics reporting
    this.startMetricsReporting();

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
      }
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

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('Node mode stopped');
  }
}

module.exports = NodeMode;
