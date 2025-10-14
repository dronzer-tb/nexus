const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const authenticate = require('../../middleware/auth');

// Apply authentication
router.use(authenticate);

// Get all processes from all agents
router.get('/', async (req, res) => {
  try {
    // This would aggregate processes from all agents
    // For now, return an empty array - will be populated by agent data
    res.json([]);
  } catch (error) {
    logger.error('Error fetching processes:', error);
    res.status(500).json({ message: 'Failed to fetch processes' });
  }
});

module.exports = router;
