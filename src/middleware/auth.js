const logger = require('../utils/logger');
const auth = require('../utils/auth');
const database = require('../utils/database');

function authenticate(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];
    const token = req.headers.authorization?.replace('Bearer ', '');

    // --- API Key authentication (mobile app / external) ---
    if (apiKey) {
      const keyHash = auth.hashApiKey(apiKey);
      const keyRecord = database.getApiKeyByHash(keyHash);

      if (!keyRecord) {
        return res.status(401).json({ message: 'Invalid API key' });
      }

      // Check expiry
      if (keyRecord.expires_at && Date.now() > keyRecord.expires_at) {
        return res.status(401).json({ message: 'API key has expired' });
      }

      // Update last used timestamp
      database.updateApiKeyLastUsed(keyRecord.id);

      req.user = { apiKeyId: keyRecord.id, name: keyRecord.name, permissions: keyRecord.permissions };
      req.authMethod = 'api-key';
      return next();
    }

    // --- JWT authentication (dashboard) ---
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = auth.verifyJWT(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.user = decoded;
    req.authMethod = 'jwt';
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = authenticate;
