const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const { 
  exchangeCodeForTokens, 
  refreshAccessToken, 
  revokeToken,
  validateWithUserInfo 
} = require('../../middleware/authentik-auth');

/**
 * Authentik OAuth2 callback endpoint
 * Exchanges authorization code for access token
 */
router.post('/callback', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    const redirect = redirectUri || process.env.AUTHENTIK_REDIRECT_URI || 'http://localhost:8080/api/auth/callback';

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, redirect);

    logger.info('Authentik OAuth2 token exchange successful');

    res.json({
      success: true,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type,
      id_token: tokens.id_token
    });
  } catch (error) {
    logger.error('Authentik callback error:', error);
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
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Refresh the access token
    const tokens = await refreshAccessToken(refresh_token);

    logger.info('Access token refreshed successfully');

    res.json({
      success: true,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in
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
    const { token } = req.body;

    if (token) {
      await revokeToken(token);
    }

    logger.info('User logged out from Authentik');

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
 * Get current user info from Authentik
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
 * Get Authentik configuration for frontend
 */
router.get('/config', (req, res) => {
  try {
    const authentikEnabled = process.env.AUTHENTIK_ENABLED === 'true';
    
    if (!authentikEnabled) {
      return res.json({
        enabled: false
      });
    }

    const authentikUrl = process.env.AUTHENTIK_URL;
    const clientId = process.env.AUTHENTIK_CLIENT_ID;
    const redirectUri = process.env.AUTHENTIK_REDIRECT_URI || 'http://localhost:8080/api/auth/callback';

    res.json({
      enabled: true,
      url: authentikUrl,
      clientId: clientId,
      redirectUri: redirectUri,
      endpoints: {
        authorize: `${authentikUrl}/application/o/authorize/`,
        token: `${authentikUrl}/application/o/token/`,
        userinfo: `${authentikUrl}/application/o/userinfo/`,
        logout: `${authentikUrl}/application/o/logout/`,
        revoke: `${authentikUrl}/application/o/revoke/`
      }
    });
  } catch (error) {
    logger.error('Get Authentik config error:', error);
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

module.exports = router;
