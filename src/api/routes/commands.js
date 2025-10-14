const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const authenticate = require('../middleware/auth');

// Command history storage
const commandHistory = [];
const MAX_HISTORY = 500;

// Apply authentication
router.use(authenticate);

// Get command history
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    res.json(commandHistory.slice(0, limit));
  } catch (error) {
    logger.error('Error fetching command history:', error);
    res.status(500).json({ message: 'Failed to fetch command history' });
  }
});

// Add to command history
function addToHistory(command, agentId, userId) {
  commandHistory.unshift({
    command,
    agentId,
    userId,
    timestamp: new Date().toISOString()
  });

  if (commandHistory.length > MAX_HISTORY) {
    commandHistory.pop();
  }
}

router.addToHistory = addToHistory;

module.exports = router;
