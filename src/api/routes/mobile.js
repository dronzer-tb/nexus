const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const os = require('os');
const qrcode = require('qrcode');
const logger = require('../../utils/logger');
const database = require('../../utils/database');
const authMiddleware = require('../../middleware/auth');
const { comparePassword } = require('../../utils/password');
const { verifyToken, decryptSecret } = require('../../utils/totp');
const { hashApiKey } = require('../../utils/auth');
const { createSession } = require('../../utils/session');

/**
 * Get the first non-internal IPv4 LAN address
 */
function getLanIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal/loopback and IPv6
      if (iface.family === 'IPv4' && !iface.internal) {
        // Prefer 192.168.x.x or 10.x.x.x over docker/virtual interfaces
        if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.')) {
          return iface.address;
        }
      }
    }
  }
  // Fallback: return any non-internal IPv4
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

/**
 * Secure Mobile Authentication Routes
 * Multi-step auth flow: QR Scan → OTP → Login + 2FA → API Key
 * 
 * Flow:
 *   1. Dashboard calls init-pairing → gets QR data + OTP (60s)
 *   2. Mobile scans QR, user enters OTP → validate-otp → tempToken (5min)
 *   3. Mobile sends credentials + 2FA + tempToken → complete-auth → apiKey
 */

// ─── In-memory stores ───
const pendingPairings = new Map();  // challengeId → { otp, challenge, serverUrl, expiresAt, otpAttempts, userId, username, step }
const tempTokens = new Map();       // tempToken → { challengeId, userId, username, expiresAt }

// ─── Clean up expired entries every 30s ───
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of pendingPairings.entries()) {
    if (data.expiresAt < now) {
      pendingPairings.delete(id);
      logger.debug(`Expired pairing challenge removed: ${id}`);
    }
  }
  for (const [token, data] of tempTokens.entries()) {
    if (data.expiresAt < now) {
      tempTokens.delete(token);
      logger.debug(`Expired temp token removed`);
    }
  }
}, 30000);


// ═══════════════════════════════════════════════════════════════
// POST /api/mobile/init-pairing
// Dashboard initiates pairing → returns QR data + 6-digit OTP
// Requires dashboard auth (session token)
// ═══════════════════════════════════════════════════════════════

router.post('/init-pairing', authMiddleware, async (req, res) => {
  try {
    const challengeId = `ch_${crypto.randomBytes(12).toString('hex')}`;
    const challenge = crypto.randomBytes(32).toString('hex');
    const otp = String(crypto.randomInt(100000, 999999)); // 6-digit OTP
    const otpExpiresAt = Date.now() + 60000; // 60 seconds

    // Determine server URL from request or user-provided override
    const { serverUrl: userServerUrl } = req.body;
    let serverUrl = userServerUrl;

    if (!serverUrl) {
      const protocol = req.protocol;
      const host = req.get('host');
      const [hostname, port] = host.split(':');

      // If accessed via localhost/127.0.0.1/0.0.0.0, auto-detect LAN IP
      // so the mobile device can actually reach the server
      if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname)) {
        const lanIp = getLanIP();
        serverUrl = `${protocol}://${lanIp}${port ? ':' + port : ''}`;
        logger.info(`Auto-detected LAN IP for mobile pairing: ${serverUrl}`);
      } else {
        serverUrl = `${protocol}://${host}`;
      }
    }

    // QR payload — scanned by mobile app
    const qrPayload = {
      nexus: true,
      version: '2.0',
      challengeId,
      challenge,
      serverUrl,
      expiresAt: otpExpiresAt,
    };

    // Generate QR code as data URL
    const qrCodeDataURL = await qrcode.toDataURL(JSON.stringify(qrPayload), {
      width: 320,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    // Store pending pairing
    pendingPairings.set(challengeId, {
      otp,
      challenge,
      serverUrl,
      expiresAt: otpExpiresAt,
      otpAttempts: 0,
      maxAttempts: 3,
      userId: req.user.userId || req.user.apiKeyId,
      username: req.user.username || req.user.name,
      step: 'waiting_otp', // waiting_otp → otp_verified → completed
    });

    logger.info(`Mobile pairing initiated by ${req.user.username || req.user.name} — challenge ${challengeId}`);

    res.json({
      success: true,
      challengeId,
      qrCode: qrCodeDataURL,
      otp,
      otpExpiresIn: 60,
      expiresAt: otpExpiresAt,
    });

  } catch (error) {
    logger.error('Init pairing error:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate pairing' });
  }
});


// ═══════════════════════════════════════════════════════════════
// POST /api/mobile/validate-otp
// Mobile sends challengeId + challenge + OTP → gets tempToken (5min)
// No auth required (mobile doesn't have credentials yet)
// ═══════════════════════════════════════════════════════════════

router.post('/validate-otp', (req, res) => {
  try {
    const { challengeId, challenge, otp } = req.body;

    if (!challengeId || !challenge || !otp) {
      return res.status(400).json({
        success: false,
        error: 'challengeId, challenge, and otp are required',
      });
    }

    const pairing = pendingPairings.get(challengeId);

    if (!pairing) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired pairing challenge',
      });
    }

    // Check expiry
    if (pairing.expiresAt < Date.now()) {
      pendingPairings.delete(challengeId);
      return res.status(410).json({
        success: false,
        error: 'OTP has expired. Please generate a new pairing code.',
      });
    }

    // Verify challenge matches
    if (pairing.challenge !== challenge) {
      logger.warn(`Challenge mismatch for ${challengeId}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid challenge',
      });
    }

    // Check attempt limit
    if (pairing.otpAttempts >= pairing.maxAttempts) {
      pendingPairings.delete(challengeId);
      logger.warn(`OTP max attempts reached for ${challengeId}`);
      return res.status(429).json({
        success: false,
        error: 'Too many attempts. Please generate a new pairing code.',
      });
    }

    pairing.otpAttempts++;

    // Verify OTP (timing-safe)
    const otpBuffer = Buffer.from(otp.padEnd(6, '0'));
    const expectedBuffer = Buffer.from(pairing.otp.padEnd(6, '0'));
    if (otpBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(otpBuffer, expectedBuffer)) {
      const remaining = pairing.maxAttempts - pairing.otpAttempts;
      logger.warn(`Invalid OTP for ${challengeId} — ${remaining} attempts remaining`);
      return res.status(401).json({
        success: false,
        error: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
        attemptsRemaining: remaining,
      });
    }

    // OTP valid — generate temp token (5 minutes)
    const tempToken = crypto.randomBytes(32).toString('hex');
    const tempExpiresAt = Date.now() + 5 * 60 * 1000;

    tempTokens.set(tempToken, {
      challengeId,
      userId: pairing.userId,
      username: pairing.username,
      expiresAt: tempExpiresAt,
    });

    // Mark pairing as OTP verified
    pairing.step = 'otp_verified';
    pairing.expiresAt = tempExpiresAt; // Extend lifetime for auth step

    logger.info(`OTP validated for challenge ${challengeId}`);

    res.json({
      success: true,
      tempToken,
      expiresIn: 300, // 5 mins
      message: 'OTP verified. Please login with your credentials.',
    });

  } catch (error) {
    logger.error('Validate OTP error:', error);
    res.status(500).json({ success: false, error: 'OTP validation failed' });
  }
});


// ═══════════════════════════════════════════════════════════════
// POST /api/mobile/complete-auth
// Mobile sends tempToken + username + password + totpCode → gets apiKey
// No auth required (uses tempToken as proof of QR+OTP verification)
// ═══════════════════════════════════════════════════════════════

router.post('/complete-auth', async (req, res) => {
  try {
    const { tempToken, username, password, totpCode, recoveryCode, deviceName, deviceInfo } = req.body;

    // Validate required fields
    if (!tempToken) {
      return res.status(400).json({ success: false, error: 'tempToken is required' });
    }
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }
    if (!totpCode && !recoveryCode) {
      return res.status(400).json({ success: false, error: '2FA code is required' });
    }

    // Verify temp token
    const tokenData = tempTokens.get(tempToken);
    if (!tokenData) {
      return res.status(401).json({ success: false, error: 'Invalid or expired temp token. Please restart pairing.' });
    }
    if (tokenData.expiresAt < Date.now()) {
      tempTokens.delete(tempToken);
      return res.status(410).json({ success: false, error: 'Temp token expired. Please restart pairing.' });
    }

    // Verify user credentials
    const user = database.getUserByUsername(username);
    if (!user) {
      logger.warn(`Mobile auth: invalid username "${username}"`);
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const passwordValid = await comparePassword(password, user.password);
    if (!passwordValid) {
      logger.warn(`Mobile auth: invalid password for "${username}"`);
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    // Verify 2FA
    if (!user.totp_enabled || !user.totp_secret) {
      return res.status(403).json({ success: false, error: '2FA is not enabled for this account' });
    }

    const totpSecret = decryptSecret(user.totp_secret);
    let valid2FA = false;

    if (totpCode) {
      valid2FA = verifyToken(totpCode, totpSecret);
      if (!valid2FA) {
        logger.warn(`Mobile auth: invalid TOTP for "${username}"`);
        return res.status(401).json({ success: false, error: 'Invalid 2FA code' });
      }
    } else if (recoveryCode) {
      const { verifyRecoveryCode, hashRecoveryCode } = require('../../utils/totp');
      const recoveryCodes = user.recovery_codes ? JSON.parse(user.recovery_codes) : [];
      // Try the code as-is, then uppercase, then trimmed — handle case/whitespace from mobile input
      const codesToTry = [
        recoveryCode,
        recoveryCode.toUpperCase(),
        recoveryCode.trim().toUpperCase(),
        recoveryCode.replace(/[\s-]/g, '').toUpperCase(),
      ];
      let verification = { valid: false, usedIndex: -1 };
      for (const attempt of codesToTry) {
        verification = verifyRecoveryCode(attempt, recoveryCodes);
        if (verification.valid) break;
      }
      if (!verification.valid) {
        return res.status(401).json({ success: false, error: 'Invalid recovery code' });
      }
      // Remove used recovery code
      recoveryCodes.splice(verification.usedIndex, 1);
      database.updateUser(user.id, { recoveryCodes: JSON.stringify(recoveryCodes) });
      valid2FA = true;
    }

    if (!valid2FA) {
      return res.status(401).json({ success: false, error: 'Invalid 2FA verification' });
    }

    // ── All checks passed — generate API key for mobile device ──
    const apiKey = crypto.randomBytes(32).toString('hex');
    const keyHash = hashApiKey(apiKey);
    const keyId = `mobile_${crypto.randomBytes(8).toString('hex')}`;
    const finalDeviceName = deviceName || 'Mobile Device';

    database.createApiKey({
      id: keyId,
      name: `${finalDeviceName} (Mobile)`,
      keyHash,
      keyPreview: `${apiKey.substring(0, 8)}...`,
      permissions: 'read,write',
      expiresAt: null,
      metadata: JSON.stringify({
        type: 'mobile',
        deviceName: finalDeviceName,
        deviceInfo: deviceInfo || {},
        pairedBy: username,
        pairedAt: Date.now(),
        challengeId: tokenData.challengeId,
      }),
    });

    // Clean up temp token and pairing
    tempTokens.delete(tempToken);
    pendingPairings.delete(tokenData.challengeId);

    // Get the server URL from the pairing data
    const serverUrl = `${req.protocol}://${req.get('host')}`;

    logger.info(`Mobile device paired: "${finalDeviceName}" for user "${username}" (key: ${keyId})`);

    res.json({
      success: true,
      apiKey,
      serverUrl,
      deviceId: keyId,
      message: 'Device paired successfully',
    });

  } catch (error) {
    logger.error('Complete auth error:', error);
    res.status(500).json({ success: false, error: 'Authentication failed' });
  }
});


// ═══════════════════════════════════════════════════════════════
// GET /api/mobile/pairing-status/:challengeId
// Dashboard polls to check if mobile has completed pairing
// ═══════════════════════════════════════════════════════════════

router.get('/pairing-status/:challengeId', authMiddleware, (req, res) => {
  try {
    const { challengeId } = req.params;
    const pairing = pendingPairings.get(challengeId);

    if (!pairing) {
      // Either completed or expired
      return res.json({
        success: true,
        status: 'completed_or_expired',
        step: 'unknown',
        pending: false,
      });
    }

    const timeRemaining = Math.max(0, Math.floor((pairing.expiresAt - Date.now()) / 1000));

    res.json({
      success: true,
      status: pairing.step,
      pending: pairing.step !== 'completed',
      expiresIn: timeRemaining,
      otpAttempts: pairing.otpAttempts,
    });

  } catch (error) {
    logger.error('Pairing status error:', error);
    res.status(500).json({ success: false, error: 'Failed to check pairing status' });
  }
});


// ═══════════════════════════════════════════════════════════════
// GET /api/mobile/paired-devices
// Get list of paired mobile devices (requires auth)
// ═══════════════════════════════════════════════════════════════

router.get('/paired-devices', authMiddleware, (req, res) => {
  try {
    const allKeys = database.getAllApiKeys();

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
          createdAt: key.created_at,
        };
      });

    res.json({
      success: true,
      devices: mobileDevices,
      count: mobileDevices.length,
    });

  } catch (error) {
    logger.error('Get paired devices error:', error);
    res.status(500).json({ success: false, error: 'Failed to get paired devices' });
  }
});


// ═══════════════════════════════════════════════════════════════
// DELETE /api/mobile/unpair/:deviceId
// Unpair (revoke) a mobile device (requires auth)
// ═══════════════════════════════════════════════════════════════

router.delete('/unpair/:deviceId', authMiddleware, (req, res) => {
  try {
    const { deviceId } = req.params;
    const apiKey = database.getApiKeyById(deviceId);

    if (!apiKey) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    try {
      const metadata = JSON.parse(apiKey.metadata);
      if (metadata.type !== 'mobile') {
        return res.status(400).json({ success: false, error: 'Not a mobile device' });
      }
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid device metadata' });
    }

    database.deleteApiKey(deviceId);
    logger.info(`Mobile device unpaired: ${apiKey.name} (ID: ${deviceId})`);

    res.json({ success: true, message: 'Device unpaired successfully' });

  } catch (error) {
    logger.error('Unpair device error:', error);
    res.status(500).json({ success: false, error: 'Failed to unpair device' });
  }
});


// ═══════════════════════════════════════════════════════════════
// MOBILE ALERT POLLING (no FCM — app polls for new alerts)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/mobile/alerts/poll?since=<timestamp>&limit=50
 * Returns alerts fired after the given timestamp.
 * Mobile app calls this on a timer to fetch new alerts.
 * Authenticated via X-API-Key (same as all mobile requests).
 */
router.get('/alerts/poll', authMiddleware, (req, res) => {
  try {
    const since = parseInt(req.query.since) || 0;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    const alerts = since > 0
      ? database.getAlertsSince(since, limit)
      : database.getRecentAlerts(limit);

    // Get alert thresholds so app can display settings
    const thresholdsRaw = database.getSetting('alerts_thresholds');
    let thresholds = { cpu: 80, memory: 85, disk: 90 };
    if (thresholdsRaw) {
      try { thresholds = JSON.parse(thresholdsRaw); } catch {}
    }

    res.json({
      success: true,
      alerts,
      thresholds,
      serverTime: Date.now(),
    });
  } catch (error) {
    logger.error('Alert poll error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

/**
 * POST /api/mobile/alerts/:alertId/acknowledge
 * Mark an alert as acknowledged from the mobile app.
 */
router.post('/alerts/:alertId/acknowledge', authMiddleware, (req, res) => {
  try {
    const alertId = parseInt(req.params.alertId);
    if (!alertId) {
      return res.status(400).json({ success: false, error: 'Invalid alert ID' });
    }
    database.acknowledgeAlert(alertId);
    res.json({ success: true, message: 'Alert acknowledged' });
  } catch (error) {
    logger.error('Alert acknowledge error:', error);
    res.status(500).json({ success: false, error: 'Failed to acknowledge alert' });
  }
});


module.exports = router;
