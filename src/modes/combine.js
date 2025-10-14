const logger = require('../utils/logger');
const NodeMode = require('./node');
const ServerMode = require('./server');

class CombineMode {
  constructor() {
    this.nodeMode = new NodeMode();
    this.serverMode = new ServerMode();
  }

  async start() {
    logger.info('Starting Nexus in COMBINE mode...');
    logger.info('Running both Node and Server components...');

    try {
      // Start server first
      await this.serverMode.start();

      // Wait a bit for server to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Start node mode
      await this.nodeMode.start();

      logger.info('Combine mode fully operational');
    } catch (error) {
      logger.error('Error starting combine mode:', error);
      throw error;
    }
  }

  stop() {
    logger.info('Stopping combine mode...');
    this.nodeMode.stop();
    this.serverMode.stop();
  }
}

module.exports = CombineMode;
