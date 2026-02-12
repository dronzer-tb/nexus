const logger = require('../utils/logger');
const auth = require('../utils/auth');
const database = require('../utils/database');
const { validateWithUserInfo } = require('./keycloak-auth');
const jwt = require('jsonwebtoken');

async function authenticate(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];
    const token = req.headers.authorization?.replace('Bearer ', '');
    const keycloakEnabled = process.env.KEYCLOAK_ENABLED === 'true';

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

    // --- Token authentication ---
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Try Keycloak authentication if enabled
    if (keycloakEnabled) {
      try {
        const userInfo = await validateWithUserInfo(token);
        
        if (userInfo && userInfo.sub) {
          // Decode token to get roles
          const decoded = jwt.decode(token);
          let roles = [];
          if (decoded && decoded.realm_access && decoded.realm_access.roles) {
            roles = decoded.realm_access.roles;
          }
          
          // Attach user info to request
          req.user = {
            userId: userInfo.sub,
            username: userInfo.preferred_username || userInfo.email,
            email: userInfo.email,
            roles: roles,
            name: userInfo.name,
            source: 'keycloak'
          };
          req.authMethod = 'keycloak';
          req.token = token;
          
          logger.debug(`Keycloak auth successful for user: ${req.user.username}`);
          return next();
        }
      } catch (keycloakError) {
        // Keycloak validation failed, try legacy JWT as fallback
        logger.debug('Keycloak validation failed, trying legacy JWT:', keycloakError.message);
      }
    }

    // --- Legacy JWT authentication (backward compatibility) ---
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
