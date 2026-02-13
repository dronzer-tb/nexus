const logger = require('./logger');
const database = require('./database');

/**
 * Audit Logging System
 * Tracks sensitive operations for security and compliance
 * Phase 6: Console 2FA Protection - Audit logging
 */

class AuditLogger {
  constructor() {
    this.ensureAuditTable();
  }

  /**
   * Create audit_logs table if it doesn't exist
   */
  ensureAuditTable() {
    try {
      const db = database.db;
      if (!db) {
        logger.warn('Database not initialized, skipping audit table creation');
        return;
      }

      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          user_id INTEGER,
          username TEXT,
          action TEXT NOT NULL,
          resource_type TEXT,
          resource_id TEXT,
          ip_address TEXT,
          user_agent TEXT,
          success INTEGER DEFAULT 1,
          details TEXT,
          metadata TEXT
        )
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_logs(event_type);
      `);

      logger.debug('Audit logs table ensured');
    } catch (error) {
      logger.error('Failed to create audit_logs table:', error);
    }
  }

  /**
   * Log an audit event
   * @param {Object} event - Audit event details
   */
  log(event) {
    try {
      const db = database.db;
      if (!db) {
        logger.warn('Database not initialized, audit log skipped');
        return;
      }

      const stmt = db.prepare(`
        INSERT INTO audit_logs (
          timestamp, event_type, user_id, username, action,
          resource_type, resource_id, ip_address, user_agent,
          success, details, metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        event.timestamp || Date.now(),
        event.eventType || 'unknown',
        event.userId || null,
        event.username || null,
        event.action || 'unknown',
        event.resourceType || null,
        event.resourceId || null,
        event.ipAddress || null,
        event.userAgent || null,
        event.success !== false ? 1 : 0,
        event.details || null,
        event.metadata ? JSON.stringify(event.metadata) : null
      );

      // Also log to Winston for real-time monitoring
      const logMessage = `AUDIT: ${event.action} by ${event.username || 'unknown'} - ${event.success !== false ? 'SUCCESS' : 'FAILED'}`;
      if (event.success !== false) {
        logger.info(logMessage, { auditEvent: event });
      } else {
        logger.warn(logMessage, { auditEvent: event });
      }
    } catch (error) {
      logger.error('Failed to write audit log:', error);
    }
  }

  /**
   * Log console access attempt
   */
  logConsoleAccess(user, nodeId, ipAddress, userAgent, success = true, details = null) {
    this.log({
      eventType: 'console_access',
      userId: user.userId,
      username: user.username,
      action: 'Console Access',
      resourceType: 'node',
      resourceId: nodeId,
      ipAddress,
      userAgent,
      success,
      details
    });
  }

  /**
   * Log 2FA verification attempt
   */
  log2FAVerification(user, purpose, ipAddress, userAgent, success = true, details = null) {
    this.log({
      eventType: '2fa_verification',
      userId: user.userId,
      username: user.username,
      action: `2FA Verification - ${purpose}`,
      ipAddress,
      userAgent,
      success,
      details
    });
  }

  /**
   * Log command execution
   */
  logCommandExecution(user, nodeId, command, ipAddress, userAgent, success = true, details = null) {
    this.log({
      eventType: 'command_execution',
      userId: user.userId,
      username: user.username,
      action: 'Execute Command',
      resourceType: 'node',
      resourceId: nodeId,
      ipAddress,
      userAgent,
      success,
      details: details || command,
      metadata: { command }
    });
  }

  /**
   * Get recent audit logs
   */
  getRecentLogs(limit = 100, filters = {}) {
    try {
      const db = database.db;
      if (!db) return [];

      let query = 'SELECT * FROM audit_logs WHERE 1=1';
      const params = [];

      if (filters.eventType) {
        query += ' AND event_type = ?';
        params.push(filters.eventType);
      }

      if (filters.userId) {
        query += ' AND user_id = ?';
        params.push(filters.userId);
      }

      if (filters.startTime) {
        query += ' AND timestamp >= ?';
        params.push(filters.startTime);
      }

      if (filters.endTime) {
        query += ' AND timestamp <= ?';
        params.push(filters.endTime);
      }

      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);

      const stmt = db.prepare(query);
      const logs = stmt.all(...params);

      return logs.map(log => {
        if (log.metadata) {
          try {
            log.metadata = JSON.parse(log.metadata);
          } catch (e) {
            // Keep as string if parse fails
          }
        }
        return log;
      });
    } catch (error) {
      logger.error('Failed to fetch audit logs:', error);
      return [];
    }
  }

  /**
   * Clean old audit logs (retention policy)
   */
  cleanOldLogs(retentionDays = 90) {
    try {
      const db = database.db;
      if (!db) return;

      const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
      const stmt = db.prepare('DELETE FROM audit_logs WHERE timestamp < ?');
      const result = stmt.run(cutoffTime);

      if (result.changes > 0) {
        logger.info(`Cleaned ${result.changes} old audit log entries`);
      }
    } catch (error) {
      logger.error('Failed to clean old audit logs:', error);
    }
  }
}

module.exports = new AuditLogger();
