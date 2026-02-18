const logger = require('../utils/logger');
const crypto = require('crypto');
const database = require('../utils/database');
const { validateSession, extractTokenFromRequest } = require('../utils/session');

/**
 * Unified Authentication Middleware
 * Supports both session tokens (dashboard users) and API keys (nodes)
 * For custom auth system v2.2.8
 */

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

async function authenticate(req, res, next) {
  try {
    // Try API Key authentication first (for nodes)
    const apiKey = req.headers['x-api-key'];
    
    if (apiKey) {
      const keyHash = hashApiKey(apiKey);
      const keyRecord = database.getApiKeyByHash(keyHash);

      if (!keyRecord) {
        logger.warn(`Invalid API key attempt from ${req.ip}`);
        return res.status(401).json({ message: 'Invalid API key' });
      }

      // Check expiry
      if (keyRecord.expires_at && Date.now() > keyRecord.expires_at) {
        logger.warn(`Expired API key used: ${keyRecord.name}`);
        return res.status(401).json({ message: 'API key has expired' });
      }

      // Update last used timestamp
      database.updateApiKeyLastUsed(keyRecord.id);

      // Attach API key info to request
      req.user = { 
        apiKeyId: keyRecord.id, 
        name: keyRecord.name, 
        permissions: keyRecord.permissions 
      };
      req.authMethod = 'api-key';
      
      return next();
    }

    // Try session token authentication (for dashboard users)
    const token = extractTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const session = validateSession(token);

    if (!session) {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    // Get user data
    const user = database.getUserById(session.user_id);

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Attach user info to request
    req.user = {
      userId: user.id,
      username: user.username,
      role: user.role,
      totpEnabled: user.totp_enabled === 1
    };
    req.authMethod = 'session';
    req.sessionToken = token;

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = authenticate;
