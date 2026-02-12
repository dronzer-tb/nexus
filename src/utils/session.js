const crypto = require('crypto');
const database = require('./database');
const logger = require('./logger');

/**
 * Session Management Utilities
 * For custom authentication system v1.9.5
 */

const SESSION_CONFIG = {
  tokenLength: 64, // 64-character random string
  expiryHours: 24, // 24 hours by default
  autoRefreshThreshold: 60 * 60 * 1000, // Refresh if < 1 hour remaining
  cleanupInterval: 60 * 60 * 1000 // Clean expired sessions every hour
};

/**
 * Generate a secure random session token
 * @returns {string} 64-character random token
 */
function generateToken() {
  return crypto.randomBytes(SESSION_CONFIG.tokenLength / 2).toString('hex');
}

/**
 * Create a new session for a user
 * @param {number} userId - User ID
 * @param {Object} options - Optional session data
 * @returns {Object} { token, expiresAt, createdAt }
 */
function createSession(userId, options = {}) {
  const token = generateToken();
  const now = Date.now();
  const expiresAt = now + (SESSION_CONFIG.expiryHours * 60 * 60 * 1000);

  try {
    database.createSession({
      userId,
      token,
      createdAt: now,
      expiresAt,
      lastActivity: now,
      ipAddress: options.ipAddress || null,
      userAgent: options.userAgent || null
    });

    logger.info(`Session created for user ${userId}`);

    return {
      token,
      expiresAt,
      createdAt: now
    };
  } catch (error) {
    logger.error('Failed to create session:', error);
    throw new Error('Session creation failed');
  }
}

/**
 * Validate a session token
 * @param {string} token - Session token
 * @returns {Object|null} Session data if valid, null otherwise
 */
function validateSession(token) {
  if (!token) {
    return null;
  }

  try {
    const session = database.getSessionByToken(token);

    if (!session) {
      return null;
    }

    // Update last activity
    database.updateSessionActivity(token);

    // Check if session should be auto-refreshed
    const timeRemaining = session.expires_at - Date.now();
    if (timeRemaining < SESSION_CONFIG.autoRefreshThreshold) {
      refreshSession(token);
    }

    return session;
  } catch (error) {
    logger.error('Session validation error:', error);
    return null;
  }
}

/**
 * Refresh a session (extend expiry time)
 * @param {string} token - Session token
 * @returns {boolean} True if refreshed successfully
 */
function refreshSession(token) {
  try {
    const session = database.getSessionByToken(token);

    if (!session) {
      return false;
    }

    const newExpiresAt = Date.now() + (SESSION_CONFIG.expiryHours * 60 * 60 * 1000);

    // Update expires_at
    const stmt = database.db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?');
    stmt.run(newExpiresAt, token);

    logger.debug(`Session refreshed: ${token.substring(0, 8)}...`);
    return true;
  } catch (error) {
    logger.error('Session refresh error:', error);
    return false;
  }
}

/**
 * Destroy a session (logout)
 * @param {string} token - Session token
 * @returns {boolean} True if destroyed successfully
 */
function destroySession(token) {
  try {
    database.deleteSession(token);
    logger.info(`Session destroyed: ${token.substring(0, 8)}...`);
    return true;
  } catch (error) {
    logger.error('Session destruction error:', error);
    return false;
  }
}

/**
 * Destroy all sessions for a user
 * @param {number} userId - User ID
 * @returns {boolean} True if destroyed successfully
 */
function destroyUserSessions(userId) {
  try {
    database.deleteUserSessions(userId);
    logger.info(`All sessions destroyed for user ${userId}`);
    return true;
  } catch (error) {
    logger.error('User sessions destruction error:', error);
    return false;
  }
}

/**
 * Clean up expired sessions
 * @returns {number} Number of sessions cleaned
 */
function cleanExpiredSessions() {
  try {
    const result = database.cleanExpiredSessions();
    const count = result.changes || 0;
    
    if (count > 0) {
      logger.info(`Cleaned ${count} expired sessions`);
    }
    
    return count;
  } catch (error) {
    logger.error('Session cleanup error:', error);
    return 0;
  }
}

/**
 * Start automatic session cleanup interval
 * @returns {NodeJS.Timeout} Interval ID
 */
function startCleanupInterval() {
  logger.info('Starting session cleanup interval');
  
  return setInterval(() => {
    cleanExpiredSessions();
  }, SESSION_CONFIG.cleanupInterval);
}

/**
 * Get session info without updating activity
 * @param {string} token - Session token
 * @returns {Object|null} Session data if found
 */
function getSessionInfo(token) {
  try {
    return database.getSessionByToken(token);
  } catch (error) {
    logger.error('Get session info error:', error);
    return null;
  }
}

/**
 * Extract session token from request headers
 * @param {Object} req - Express request object
 * @returns {string|null} Token if found
 */
function extractTokenFromRequest(req) {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookie (if using cookies)
  if (req.cookies && req.cookies.session_token) {
    return req.cookies.session_token;
  }

  return null;
}

module.exports = {
  SESSION_CONFIG,
  generateToken,
  createSession,
  validateSession,
  refreshSession,
  destroySession,
  destroyUserSessions,
  cleanExpiredSessions,
  startCleanupInterval,
  getSessionInfo,
  extractTokenFromRequest
};
