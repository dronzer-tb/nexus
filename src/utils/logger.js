const winston = require('winston');
const path = require('path');
const config = require('./config');

class Logger {
  constructor() {
    this.logger = null;
  }

  init() {
    const logConfig = config.get('logging') || { level: 'info', file: './data/nexus.log' };
    const logDir = path.dirname(logConfig.file);
    const fs = require('fs');
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.logger = winston.createLogger({
      level: logConfig.level,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
      ),
      defaultMeta: { service: 'nexus' },
      transports: [
        new winston.transports.File({ 
          filename: logConfig.file,
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, ...meta }) => {
              let msg = `${timestamp} [${level}]: ${message}`;
              if (Object.keys(meta).length > 0 && meta.service !== 'nexus') {
                msg += ` ${JSON.stringify(meta)}`;
              }
              return msg;
            })
          )
        })
      ]
    });

    return this.logger;
  }

  get() {
    if (!this.logger) {
      this.init();
    }
    return this.logger;
  }

  info(message, meta = {}) {
    this.get().info(this._formatMessage(message, meta));
  }

  error(message, meta = {}) {
    this.get().error(this._formatMessage(message, meta));
  }

  warn(message, meta = {}) {
    this.get().warn(this._formatMessage(message, meta));
  }

  debug(message, meta = {}) {
    this.get().debug(this._formatMessage(message, meta));
  }

  /**
   * Format message + meta into a single string so winston printf always prints it.
   * Handles: strings, Error objects, and plain objects.
   */
  _formatMessage(message, meta) {
    if (meta === undefined || meta === null) return message;
    if (typeof meta === 'string') return `${message} ${meta}`;
    if (meta instanceof Error) return `${message} ${meta.message}${meta.stack ? '\n' + meta.stack : ''}`;
    if (typeof meta === 'object' && Object.keys(meta).length > 0) return `${message} ${JSON.stringify(meta)}`;
    return message;
  }
}

module.exports = new Logger();
