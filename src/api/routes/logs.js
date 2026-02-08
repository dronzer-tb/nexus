const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const authenticate = require('../../middleware/auth');
const fs = require('fs').promises;
const path = require('path');

// Log storage
const logs = [];
const MAX_LOGS = 10000;
const LOG_FILE = path.join(__dirname, '../../logs/nexus.log');
// Also check data directory for log file
const DATA_LOG_FILE = path.join(process.cwd(), 'data', 'nexus.log');

// Apply authentication
router.use(authenticate);

// Get event logs (in-memory)
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

// Get server logs from log file
router.get('/server', async (req, res) => {
  try {
    const lines = parseInt(req.query.lines) || 500;
    
    // Try multiple log file locations
    let logContent = '';
    let logPath = null;

    for (const p of [LOG_FILE, DATA_LOG_FILE]) {
      try {
        await fs.access(p);
        logPath = p;
        break;
      } catch { /* try next */ }
    }

    if (!logPath) {
      return res.json({ logs: [], message: 'No log file found' });
    }

    logContent = await fs.readFile(logPath, 'utf-8');
    
    // Parse log lines (handle both JSON and plain text formats)
    const rawLines = logContent.split('\n').filter(l => l.trim());
    const parsedLogs = rawLines.slice(-lines).reverse().map(line => {
      try {
        // Try JSON format first (winston default)
        const parsed = JSON.parse(line);
        return {
          timestamp: parsed.timestamp || new Date().toISOString(),
          level: parsed.level || 'info',
          message: parsed.message || line,
          meta: parsed.meta || {}
        };
      } catch {
        // Plain text format: try to extract level and timestamp
        const match = line.match(/^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*Z?)\]?\s*\[?(\w+)\]?\s*:?\s*(.*)/);
        if (match) {
          return {
            timestamp: match[1],
            level: match[2].toLowerCase(),
            message: match[3],
          };
        }
        // Fallback
        return {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: line,
        };
      }
    });

    res.json({ logs: parsedLogs });
  } catch (error) {
    logger.error('Error reading server logs:', error);
    res.status(500).json({ message: 'Failed to read server logs', logs: [] });
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
