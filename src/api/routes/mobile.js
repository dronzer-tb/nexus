const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const qrcode = require('qrcode');
const logger = require('../../utils/logger');
const database = require('../../utils/database');
const authMiddleware = require('../../middleware/auth');

/**
 * Mobile App Pairing Routes
 * For secure QR code-based mobile app connection
 * Part of v1.9.5 custom auth system
 */

// In-memory storage for pending pairings (expires after 5 minutes)
const pendingPairings = new Map();

// Clean up expired pairings every minute
setInterval(() => {
  const now = Date.now();
  for (const [pairingId, data] of pendingPairings.entries()) {
    if (data.expiresAt < now) {
      pendingPairings.delete(pairingId);
      logger.debug(`Expired pairing request removed: ${pairingId}`);
    }
  }
}, 60000);

// ═══════════════════════════════════════════════════════════════
// POST /api/mobile/generate-pairing - Generate QR code for pairing
// ═══════════════════════════════════════════════════════════════

router.post('/generate-pairing', authMiddleware, async (req, res) => {
  try {
    // Generate unique pairing ID and token
    const pairingId = `pair_${crypto.randomBytes(8).toString('hex')}`;
    const pairingToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (5 * 60 * 1000); // 5 minutes

    // Get server URL (from request or config)
    const protocol = req.protocol;
    const host = req.get('host');
    const serverUrl = `${protocol}://${host}`;

    // Create pairing data
    const pairingData = {
      version: '1.9.5',
      server_url: serverUrl,
      pairing_id: pairingId,
      token: pairingToken,
      expires_at: expiresAt,
      user_id: req.user.userId || req.user.apiKeyId
    };

    // Store pending pairing
    pendingPairings.set(pairingId, {
      token: pairingToken,
      expiresAt,
      userId: req.user.userId || req.user.apiKeyId,
      username: req.user.username || req.user.name
    });

    // Generate QR code
    const qrCodeDataURL = await qrcode.toDataURL(JSON.stringify(pairingData));

    logger.info(`Mobile pairing QR code generated for user ${req.user.username || req.user.name}`);

    res.json({
      success: true,
      pairingId,
      qrCode: qrCodeDataURL,
      expiresAt,
      expiresIn: 300 // 5 minutes in seconds
    });

  } catch (error) {
    logger.error('Generate pairing QR code error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate pairing code'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/mobile/pair - Complete pairing and get API key
// ═══════════════════════════════════════════════════════════════

router.post('/pair', async (req, res) => {
  try {
    const { pairing_id, token, device_name, device_info } = req.body;

    // Validation
    if (!pairing_id || !token) {
      return res.status(400).json({
        success: false,
        error: 'Pairing ID and token are required'
      });
    }

    // Check if pairing exists
    const pairingData = pendingPairings.get(pairing_id);

    if (!pairingData) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired pairing code'
      });
    }

    // Verify token
    if (pairingData.token !== token) {
      logger.warn(`Invalid pairing token attempt for ${pairing_id}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid pairing token'
      });
    }

    // Check expiration
    if (pairingData.expiresAt < Date.now()) {
      pendingPairings.delete(pairing_id);
      return res.status(410).json({
        success: false,
        error: 'Pairing code has expired'
      });
    }

    // Generate API key for mobile device
    const apiKey = crypto.randomBytes(32).toString('hex');
    const { hashApiKey } = require('../../utils/auth');
    const keyHash = hashApiKey(apiKey);
    const keyId = `mobile_${crypto.randomBytes(8).toString('hex')}`;
    const deviceNameFinal = device_name || 'Mobile Device';

    // Create API key in database
    const result = database.createApiKey({
      id: keyId,
      name: `${deviceNameFinal} (Mobile)`,
      keyHash: keyHash,
      keyPreview: `${apiKey.substring(0, 8)}...`,
      permissions: 'read,write',
      expiresAt: null,
      metadata: JSON.stringify({
        type: 'mobile',
        deviceName: deviceNameFinal,
        deviceInfo: device_info || {},
        pairedBy: pairingData.username,
        pairedAt: Date.now()
      })
    });

    // Remove pending pairing
    pendingPairings.delete(pairing_id);

    logger.info(`Mobile device paired successfully: ${deviceNameFinal} (API Key ID: ${result.lastInsertRowid})`);

    res.json({
      success: true,
      api_key: apiKey,
      server_url: req.body.server_url || `${req.protocol}://${req.get('host')}`,
      message: 'Device paired successfully'
    });

  } catch (error) {
    logger.error('Mobile pairing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete pairing'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/mobile/paired-devices - Get list of paired mobile devices
// ═══════════════════════════════════════════════════════════════

router.get('/paired-devices', authMiddleware, (req, res) => {
  try {
    // Get all API keys
    const allKeys = database.getAllApiKeys();

    // Filter for mobile devices
    const mobileDevices = allKeys
      .filter(key => {
        try {
          const metadata = key.metadata ? JSON.parse(key.metadata) : {};
          return metadata.type === 'mobile';
        } catch {
          return false;
        }
      })
      .map(key => {
        const metadata = JSON.parse(key.metadata);
        return {
          id: key.id,
          name: key.name,
          deviceName: metadata.deviceName,
          deviceInfo: metadata.deviceInfo,
          pairedBy: metadata.pairedBy,
          pairedAt: metadata.pairedAt,
          lastUsed: key.last_used,
          createdAt: key.created_at
        };
      });

    res.json({
      success: true,
      devices: mobileDevices,
      count: mobileDevices.length
    });

  } catch (error) {
    logger.error('Get paired devices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get paired devices'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /api/mobile/unpair/:deviceId - Unpair a mobile device
// ═══════════════════════════════════════════════════════════════

router.delete('/unpair/:deviceId', authMiddleware, (req, res) => {
  try {
    const { deviceId } = req.params;

    // Get the API key to verify it's a mobile device
    const apiKey = database.getApiKeyById(deviceId);

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    // Verify it's a mobile device
    try {
      const metadata = JSON.parse(apiKey.metadata);
      if (metadata.type !== 'mobile') {
        return res.status(400).json({
          success: false,
          error: 'This is not a mobile device'
        });
      }
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid device metadata'
      });
    }

    // Delete the API key
    database.deleteApiKey(deviceId);

    logger.info(`Mobile device unpaired: ${apiKey.name} (ID: ${deviceId})`);

    res.json({
      success: true,
      message: 'Device unpaired successfully'
    });

  } catch (error) {
    logger.error('Unpair device error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unpair device'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/mobile/pairing-status/:pairingId - Check pairing status
// ═══════════════════════════════════════════════════════════════

router.get('/pairing-status/:pairingId', authMiddleware, (req, res) => {
  try {
    const { pairingId } = req.params;

    const pairingData = pendingPairings.get(pairingId);

    if (!pairingData) {
      return res.json({
        success: true,
        status: 'completed_or_expired',
        pending: false
      });
    }

    const timeRemaining = Math.max(0, Math.floor((pairingData.expiresAt - Date.now()) / 1000));

    res.json({
      success: true,
      status: 'pending',
      pending: true,
      expiresIn: timeRemaining
    });

  } catch (error) {
    logger.error('Pairing status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check pairing status'
    });
  }
});

module.exports = router;
