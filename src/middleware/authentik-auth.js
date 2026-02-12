const axios = require('axios');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Authentik Authentication Middleware
 * Validates OAuth2/OIDC tokens issued by Authentik
 */

/**
 * Validate token with Authentik userinfo endpoint
 */
async function validateWithUserInfo(token) {
  try {
    const authentikUrl = process.env.AUTHENTIK_URL;
    
    if (!authentikUrl) {
      throw new Error('AUTHENTIK_URL not configured');
    }

    const response = await axios.get(
      `${authentikUrl}/application/o/userinfo/`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        timeout: 5000
      }
    );
    
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('Invalid or expired token');
    }
    logger.error('Authentik userinfo validation failed:', error.message);
    throw error;
  }
}

/**
 * Authentik authentication middleware
 */
async function authentikAuth(req, res, next) {
  try {
    // Check if Authentik is enabled
    const authentikEnabled = process.env.AUTHENTIK_ENABLED === 'true';
    
    if (!authentikEnabled) {
      // Fall back to next middleware (legacy auth)
      return next();
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'No authorization token provided',
        authentikEnabled: true 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Validate token with userinfo endpoint
    const userInfo = await validateWithUserInfo(token);
    
    if (!userInfo || !userInfo.sub) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Decode token to get additional claims
    const decoded = jwt.decode(token);
    
    // Extract groups/roles from token or userinfo
    let roles = [];
    if (decoded && decoded.groups) {
      roles = decoded.groups;
    } else if (userInfo.groups) {
      roles = userInfo.groups;
    }
    
    // Map Authentik groups to Nexus roles
    let nexusRole = 'viewer'; // default role
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
    next();
  } catch (error) {
    logger.error('Authentik authentication error:', error.message);
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
    if (!req.user) {
      return res.status(403).json({ error: 'Access denied: Not authenticated' });
    }
    
    // Admin has access to everything
    if (req.user.role === 'admin') {
      return next();
    }
    
    if (req.user.role !== role) {
      return res.status(403).json({ 
        error: `Access denied: ${role} role required`,
        userRole: req.user.role 
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
    const authentikUrl = process.env.AUTHENTIK_URL;
    const clientId = process.env.AUTHENTIK_CLIENT_ID;
    const clientSecret = process.env.AUTHENTIK_CLIENT_SECRET;
    
    if (!authentikUrl || !clientId || !clientSecret) {
      throw new Error('Authentik configuration incomplete');
    }
    
    const tokenUrl = `${authentikUrl}/application/o/token/`;
    
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    
    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });
    
    return response.data;
  } catch (error) {
    logger.error('Token exchange failed:', error.message);
    if (error.response) {
      logger.error('Response:', error.response.data);
    }
    throw error;
  }
}

/**
 * Refresh access token
 */
async function refreshAccessToken(refreshToken) {
  try {
    const authentikUrl = process.env.AUTHENTIK_URL;
    const clientId = process.env.AUTHENTIK_CLIENT_ID;
    const clientSecret = process.env.AUTHENTIK_CLIENT_SECRET;
    
    const tokenUrl = `${authentikUrl}/application/o/token/`;
    
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    
    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });
    
    return response.data;
  } catch (error) {
    logger.error('Token refresh failed:', error.message);
    throw error;
  }
}

/**
 * Revoke token (logout)
 */
async function revokeToken(token) {
  try {
    const authentikUrl = process.env.AUTHENTIK_URL;
    const clientId = process.env.AUTHENTIK_CLIENT_ID;
    const clientSecret = process.env.AUTHENTIK_CLIENT_SECRET;
    
    const revokeUrl = `${authentikUrl}/application/o/revoke/`;
    
    const params = new URLSearchParams();
    params.append('token', token);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    
    await axios.post(revokeUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });
    
    return true;
  } catch (error) {
    logger.error('Token revocation failed:', error.message);
    return false;
  }
}

module.exports = {
  authentikAuth,
  requireRole,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeToken,
  validateWithUserInfo
};
