const logger = require('../utils/logger');
const crypto = require('crypto');
const database = require('../utils/database');

/**
 * Simple API Key Authentication Only
 * No JWT, no OAuth, no user login - just API keys for nodes
 */

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

async function authenticate(req, res, next) {
  try {
    // Only API Key authentication
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({ message: 'API key required' });
    }

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
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = authenticate;
