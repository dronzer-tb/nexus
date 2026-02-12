const logger = require('../utils/logger');
const auth = require('../utils/auth');
const database = require('../utils/database');
const jwt = require('jsonwebtoken');

// Try to load Authentik auth if available, otherwise use null
let validateWithUserInfo = null;
try {
  const authentikAuth = require('./authentik-auth');
  validateWithUserInfo = authentikAuth.validateWithUserInfo;
} catch (err) {
  // Authentik auth not available
}

async function authenticate(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];
    const token = req.headers.authorization?.replace('Bearer ', '');
    const authentikEnabled = process.env.AUTHENTIK_ENABLED === 'true';

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

    // Try Authentik authentication if enabled
    if (authentikEnabled && validateWithUserInfo) {
      try {
        const userInfo = await validateWithUserInfo(token);
        
        if (userInfo && userInfo.sub) {
          // Decode token to get groups/roles
          const decoded = jwt.decode(token);
          let roles = [];
          if (decoded && decoded.groups) {
            roles = decoded.groups;
          } else if (userInfo.groups) {
            roles = userInfo.groups;
          }
          
          // Map Authentik groups to Nexus roles
          let nexusRole = 'viewer'; // default
          if (roles.includes('nexus-admins') || roles.includes('admins')) {
            nexusRole = 'admin';
          } else if (roles.includes('nexus-operators') || roles.includes('operators')) {
            nexusRole = 'operator';
          }
          
          // Attach user info to request
          req.user = {
            userId: userInfo.sub,
            username: userInfo.preferred_username || userInfo.email || userInfo.sub,
            email: userInfo.email,
            roles: roles,
            role: nexusRole,
            name: userInfo.name,
            source: 'authentik'
          };
          req.authMethod = 'authentik';
          req.token = token;
          
          logger.debug(`Authentik auth successful for user: ${req.user.username}`);
          return next();
        }
      } catch (authentikError) {
        // Authentik validation failed, try legacy JWT as fallback
        logger.debug('Authentik validation failed, trying legacy JWT:', authentikError.message);
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
