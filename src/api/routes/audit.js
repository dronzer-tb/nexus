const express = require('express');
const router = express.Router();
const authenticate = require('../../middleware/auth');
const audit = require('../../utils/audit');
const logger = require('../../utils/logger');

/**
 * Audit Logs API Routes
 * Phase 6: Console 2FA Protection - Audit logging
 */

// Apply authentication to all routes
router.use(authenticate);

// ═══════════════════════════════════════════════════════════════
// GET /api/audit/logs - Get audit logs with filters
// ═══════════════════════════════════════════════════════════════

router.get('/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const filters = {};

    if (req.query.eventType) {
      filters.eventType = req.query.eventType;
    }

    if (req.query.userId) {
      filters.userId = parseInt(req.query.userId);
    }

    if (req.query.startTime) {
      filters.startTime = parseInt(req.query.startTime);
    }

    if (req.query.endTime) {
      filters.endTime = parseInt(req.query.endTime);
    }

    const logs = audit.getRecentLogs(limit, filters);

    res.json({
      success: true,
      logs,
      count: logs.length
    });
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/audit/clean - Clean old audit logs
// ═══════════════════════════════════════════════════════════════

router.post('/clean', (req, res) => {
  try {
    // Only admin can clean logs
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const retentionDays = parseInt(req.body.retentionDays) || 90;
    audit.cleanOldLogs(retentionDays);

    res.json({
      success: true,
      message: `Cleaned audit logs older than ${retentionDays} days`
    });
  } catch (error) {
    logger.error('Error cleaning audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean audit logs'
    });
  }
});

module.exports = router;
