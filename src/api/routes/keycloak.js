const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const { 
  exchangeCodeForTokens, 
  refreshAccessToken, 
  logoutUser,
  validateWithUserInfo 
} = require('../../middleware/keycloak-auth');

/**
 * Keycloak OAuth2 callback endpoint
 * Exchanges authorization code for access token
 */
router.post('/callback', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    logger.info('Keycloak OAuth2 token exchange successful');

    res.json({
      success: true,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type
    });
  } catch (error) {
    logger.error('Keycloak callback error:', error);
    res.status(500).json({ 
      error: 'Failed to exchange authorization code',
      message: error.message 
    });
  }
});

/**
 * Refresh access token endpoint
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Refresh the access token
    const tokens = await refreshAccessToken(refreshToken);

    logger.info('Access token refreshed successfully');

    res.json({
      success: true,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({ 
      error: 'Failed to refresh token',
      message: error.message 
    });
  }
});

/**
 * Logout endpoint
 */
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await logoutUser(refreshToken);
    }

    logger.info('User logged out from Keycloak');

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ 
      error: 'Logout failed',
      message: error.message 
    });
  }
});

/**
 * Get current user info from Keycloak
 */
router.get('/userinfo', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.substring(7);
    const userInfo = await validateWithUserInfo(token);

    res.json({
      success: true,
      user: userInfo
    });
  } catch (error) {
    logger.error('Get userinfo error:', error);
    res.status(401).json({ 
      error: 'Failed to get user info',
      message: error.message 
    });
  }
});

/**
 * Get Keycloak configuration for frontend
 */
router.get('/config', (req, res) => {
  try {
    const keycloakEnabled = process.env.KEYCLOAK_ENABLED === 'true';
    
    if (!keycloakEnabled) {
      return res.json({
        enabled: false
      });
    }

    const keycloakUrl = process.env.KEYCLOAK_URL;
    const realm = process.env.KEYCLOAK_REALM;
    const clientId = process.env.KEYCLOAK_CLIENT_ID;

    res.json({
      enabled: true,
      url: keycloakUrl,
      realm: realm,
      clientId: clientId,
      endpoints: {
        auth: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/auth`,
        token: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`,
        logout: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/logout`,
        userinfo: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/userinfo`
      }
    });
  } catch (error) {
    logger.error('Get Keycloak config error:', error);
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

module.exports = router;
