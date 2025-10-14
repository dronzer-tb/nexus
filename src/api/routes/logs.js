const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const authenticate = require('../middleware/auth');
const fs = require('fs').promises;
const path = require('path');

// Log storage
const logs = [];
const MAX_LOGS = 10000;
const LOG_FILE = path.join(__dirname, '../../logs/nexus.log');

// Apply authentication
router.use(authenticate);

// Get logs
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 500;
    const level = req.query.level;

    let filteredLogs = [...logs];

    if (level && level !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }

    res.json(filteredLogs.slice(0, limit));
  } catch (error) {
    logger.error('Error fetching logs:', error);
    res.status(500).json({ message: 'Failed to fetch logs' });
  }
});

// Clear logs
router.delete('/', async (req, res) => {
  try {
    logs.length = 0;
    logger.info('Logs cleared by user');
    res.json({ message: 'Logs cleared successfully' });
  } catch (error) {
    logger.error('Error clearing logs:', error);
    res.status(500).json({ message: 'Failed to clear logs' });
  }
});

// Add log entry
function addLog(level, message, meta = {}) {
  const logEntry = {
    level,
    message,
    meta,
    timestamp: new Date().toISOString()
  };

  logs.unshift(logEntry);

  if (logs.length > MAX_LOGS) {
    logs.pop();
  }

  return logEntry;
}

router.addLog = addLog;
router.logs = logs;

module.exports = router;
