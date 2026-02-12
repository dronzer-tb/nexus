const axios = require('axios');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const config = require('../utils/config');

/**
 * Keycloak Authentication Middleware
 * Validates JWT tokens issued by Keycloak
 */

let jwksClient = null;
let publicKeys = {};
let lastKeyFetch = 0;
const KEY_CACHE_DURATION = 3600000; // 1 hour

/**
 * Fetch JWKS (JSON Web Key Set) from Keycloak
 */
async function fetchJWKS() {
  const now = Date.now();
  
  // Return cached keys if still valid
  if (now - lastKeyFetch < KEY_CACHE_DURATION && Object.keys(publicKeys).length > 0) {
    return publicKeys;
  }

  try {
    const keycloakUrl = process.env.KEYCLOAK_URL || config.get('keycloak.url');
    const realm = process.env.KEYCLOAK_REALM || config.get('keycloak.realm');
    
    if (!keycloakUrl || !realm) {
      throw new Error('Keycloak URL or realm not configured');
    }

    const jwksUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`;
    const response = await axios.get(jwksUrl);
    
    // Convert JWKS to simple key-value map
    const keys = {};
    if (response.data && response.data.keys) {
      response.data.keys.forEach(key => {
        if (key.kid) {
          // Store the key with its kid (key ID)
          keys[key.kid] = key;
        }
      });
    }
    
    publicKeys = keys;
    lastKeyFetch = now;
    
    logger.info(`Fetched ${Object.keys(keys).length} public keys from Keycloak`);
    return keys;
  } catch (error) {
    logger.error('Failed to fetch JWKS from Keycloak:', error.message);
    throw error;
  }
}

/**
 * Convert JWK to PEM format for JWT verification
 */
function jwkToPem(jwk) {
  // For RS256 keys
  if (jwk.kty === 'RSA') {
    const { n, e } = jwk;
    
    // This is a simplified approach - in production, use a library like 'jwk-to-pem'
    // For now, we'll verify using the raw key data
    return { n, e, kty: 'RSA' };
  }
  
  throw new Error('Unsupported key type: ' + jwk.kty);
}

/**
 * Verify Keycloak JWT token
 */
async function verifyKeycloakToken(token) {
  try {
    // Decode token header to get key ID
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded || !decoded.header || !decoded.header.kid) {
      throw new Error('Invalid token structure');
    }
    
    const kid = decoded.header.kid;
    
    // Fetch public keys
    const keys = await fetchJWKS();
    const publicKey = keys[kid];
    
    if (!publicKey) {
      throw new Error('Public key not found for token');
    }

    // Verify token using Keycloak's public key
    const keycloakUrl = process.env.KEYCLOAK_URL || config.get('keycloak.url');
    const realm = process.env.KEYCLOAK_REALM || config.get('keycloak.realm');
    const issuer = `${keycloakUrl}/realms/${realm}`;
    
    // For RS256 verification, we need to construct the public key
    // In production, use a proper library like node-jose or jwk-to-pem
    const verified = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: issuer,
      // We'll do manual verification since we have the raw JWK
      complete: false
    });
    
    return verified;
  } catch (error) {
    logger.error('Token verification failed:', error.message);
    throw error;
  }
}

/**
 * Validate token with Keycloak userinfo endpoint (alternative method)
 */
async function validateWithUserInfo(token) {
  try {
    const keycloakUrl = process.env.KEYCLOAK_URL || config.get('keycloak.url');
    const realm = process.env.KEYCLOAK_REALM || config.get('keycloak.realm');
    
    const response = await axios.get(
      `${keycloakUrl}/realms/${realm}/protocol/openid-connect/userinfo`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    return response.data;
  } catch (error) {
    logger.error('Userinfo validation failed:', error.message);
    throw error;
  }
}

/**
 * Keycloak authentication middleware
 */
async function keycloakAuth(req, res, next) {
  try {
    // Check if Keycloak is enabled
    const keycloakEnabled = process.env.KEYCLOAK_ENABLED === 'true' || 
                           config.get('keycloak.enabled') === true;
    
    if (!keycloakEnabled) {
      // Fall back to legacy authentication
      return next();
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'No authorization token provided',
        keycloakEnabled: true 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Validate token with userinfo endpoint (more reliable than JWT verification)
    const userInfo = await validateWithUserInfo(token);
    
    if (!userInfo || !userInfo.sub) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Decode token to get roles and other claims
    const decoded = jwt.decode(token);
    
    // Extract roles from token
    let roles = [];
    if (decoded.realm_access && decoded.realm_access.roles) {
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
    next();
  } catch (error) {
    logger.error('Keycloak authentication error:', error.message);
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: error.message 
    });
  }
}

/**
 * Check if user has required role
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) {
      return res.status(403).json({ error: 'Access denied: No roles assigned' });
    }
    
    if (!req.user.roles.includes(role) && !req.user.roles.includes('admin')) {
      return res.status(403).json({ 
        error: `Access denied: ${role} role required`,
        userRoles: req.user.roles 
      });
    }
    
    next();
  };
}

/**
 * Exchange authorization code for tokens (OAuth2 flow)
 */
async function exchangeCodeForTokens(code, redirectUri) {
  try {
    const keycloakUrl = process.env.KEYCLOAK_URL || config.get('keycloak.url');
    const realm = process.env.KEYCLOAK_REALM || config.get('keycloak.realm');
    const clientId = process.env.KEYCLOAK_CLIENT_ID || config.get('keycloak.clientId');
    const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || config.get('keycloak.clientSecret');
    
    const tokenUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`;
    
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    
    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    return response.data;
  } catch (error) {
    logger.error('Token exchange failed:', error.message);
    throw error;
  }
}

/**
 * Refresh access token
 */
async function refreshAccessToken(refreshToken) {
  try {
    const keycloakUrl = process.env.KEYCLOAK_URL || config.get('keycloak.url');
    const realm = process.env.KEYCLOAK_REALM || config.get('keycloak.realm');
    const clientId = process.env.KEYCLOAK_CLIENT_ID || config.get('keycloak.clientId');
    const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || config.get('keycloak.clientSecret');
    
    const tokenUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`;
    
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    
    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    return response.data;
  } catch (error) {
    logger.error('Token refresh failed:', error.message);
    throw error;
  }
}

/**
 * Logout user from Keycloak
 */
async function logoutUser(refreshToken) {
  try {
    const keycloakUrl = process.env.KEYCLOAK_URL || config.get('keycloak.url');
    const realm = process.env.KEYCLOAK_REALM || config.get('keycloak.realm');
    const clientId = process.env.KEYCLOAK_CLIENT_ID || config.get('keycloak.clientId');
    const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || config.get('keycloak.clientSecret');
    
    const logoutUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/logout`;
    
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('refresh_token', refreshToken);
    
    await axios.post(logoutUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    return true;
  } catch (error) {
    logger.error('Logout failed:', error.message);
    return false;
  }
}

module.exports = {
  keycloakAuth,
  requireRole,
  exchangeCodeForTokens,
  refreshAccessToken,
  logoutUser,
  verifyKeycloakToken,
  validateWithUserInfo
};
