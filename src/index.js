const fs = require('fs');
const path = require('path');
const config = require('./utils/config');
const logger = require('./utils/logger');

// ASCII Art Banner
const BANNER = `
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
`;

// Read version from VERSION file or package.json
let VERSION = '1.1.0';
try {
  const versionFile = path.join(__dirname, '../VERSION');
  if (fs.existsSync(versionFile)) {
    VERSION = fs.readFileSync(versionFile, 'utf8').trim();
  } else {
    const packageJson = require('../package.json');
    VERSION = packageJson.version;
  }
} catch (error) {
  // Use default version if files not found
}

const COMPANY = 'Dronzer Studios';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1];
  const setup = args.includes('--setup');
  
  return {
    mode: mode || 'combine', // Default to combine mode
    setup,
  };
}

// Display banner
function displayBanner(mode) {
  console.log('\x1b[36m%s\x1b[0m', BANNER); // Cyan color
  console.log('\x1b[33m%s\x1b[0m', `        ${COMPANY} - v${VERSION}`); // Yellow color
  console.log('\x1b[32m%s\x1b[0m', `               Mode: ${mode.toUpperCase()}`); // Green color
  console.log('');
}

// Main function
async function main() {
  try {
    // Load configuration
    config.load();
    
    // Initialize logger
    logger.init();

    // Parse arguments
    const { mode, setup } = parseArgs();

    // Run setup wizard if --setup flag is passed
    if (setup) {
      const { runWizard } = require('./setup/wizard');
      await runWizard();
      return;
    }

    // Display banner
    displayBanner(mode);

    // Validate mode
    const validModes = ['node', 'server', 'combine'];
    if (!validModes.includes(mode)) {
      logger.error(`Invalid mode: ${mode}`);
      logger.info(`Valid modes are: ${validModes.join(', ')}`);
      process.exit(1);
    }

    // Start appropriate mode
    let modeInstance;

    switch (mode) {
      case 'node':
        const NodeMode = require('./modes/node');
        modeInstance = new NodeMode();
        break;
      
      case 'server':
        const ServerMode = require('./modes/server');
        modeInstance = new ServerMode();
        break;
      
      case 'combine':
        const CombineMode = require('./modes/combine');
        modeInstance = new CombineMode();
        break;
    }

    await modeInstance.start();

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM signal');
      modeInstance.stop();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.info('Received SIGINT signal');
      modeInstance.stop();
      process.exit(0);
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run main function
main();
