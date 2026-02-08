/**
 * Nexus E2E Encryption — AES-256-GCM
 * Dronzer Studios
 *
 * Provides encrypt/decrypt for data in transit between:
 *   • Server ↔ Node  (shared secret derived from API key)
 *   • Server ↔ Mobile (shared secret derived from API key)
 *
 * The encryption key is derived from the raw API key using PBKDF2
 * with a fixed salt unique to this installation.
 */

const crypto = require('crypto');
const config = require('./config');
const logger = require('./logger');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;           // 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16;     // 128-bit auth tag
const KEY_LENGTH = 32;          // 256-bit key
const PBKDF2_ITERATIONS = 50000;

/**
 * Get or generate the installation salt (persisted to config).
 * This salt is combined with each API key to derive unique encryption keys.
 */
function getInstallationSalt() {
  let salt = config.get('security.encryptionSalt');
  if (!salt) {
    salt = crypto.randomBytes(32).toString('hex');
    config.set('security.encryptionSalt', salt);
    logger.info('Generated new encryption salt');
  }
  return salt;
}

/**
 * Derive a 256-bit encryption key from an API key using PBKDF2.
 * Results are cached in-memory for performance.
 */
const keyCache = new Map();

function deriveKey(apiKey) {
  if (keyCache.has(apiKey)) return keyCache.get(apiKey);

  const salt = getInstallationSalt();
  const key = crypto.pbkdf2Sync(apiKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');

  // Cache up to 100 keys
  if (keyCache.size > 100) keyCache.clear();
  keyCache.set(apiKey, key);

  return key;
}

/**
 * Encrypt data with AES-256-GCM.
 * @param {object|string} data — The data to encrypt (will be JSON.stringified if object)
 * @param {string} apiKey — The raw API key used to derive the encryption key
 * @returns {string} — Base64 encoded string: iv + authTag + ciphertext
 */
function encrypt(data, apiKey) {
  try {
    const key = deriveKey(apiKey);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

    const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Pack: iv (12) + authTag (16) + ciphertext (variable)
    const packed = Buffer.concat([iv, authTag, encrypted]);
    return packed.toString('base64');
  } catch (error) {
    logger.error('Encryption error:', error.message);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt AES-256-GCM encrypted data.
 * @param {string} encryptedBase64 — Base64 encoded string from encrypt()
 * @param {string} apiKey — The raw API key used to derive the encryption key
 * @returns {object|string} — The decrypted data (parsed as JSON if possible)
 */
function decrypt(encryptedBase64, apiKey) {
  try {
    const key = deriveKey(apiKey);
    const packed = Buffer.from(encryptedBase64, 'base64');

    if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      throw new Error('Invalid encrypted data: too short');
    }

    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');

    // Try to parse as JSON
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (error) {
    if (error.message.includes('Unsupported state') || error.message.includes('unable to authenticate')) {
      throw new Error('Decryption failed: invalid key or tampered data');
    }
    throw error;
  }
}

/**
 * Check if encryption is enabled in config.
 */
function isEnabled() {
  return config.get('security.encryption') !== false; // enabled by default
}

/**
 * Express middleware that decrypts incoming encrypted request bodies.
 * Looks for { encrypted: true, data: "base64..." } format.
 */
function decryptMiddleware(req, res, next) {
  if (!isEnabled()) return next();

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return next();

  if (req.body && req.body.encrypted === true && req.body.data) {
    try {
      req.body = decrypt(req.body.data, apiKey);
    } catch (error) {
      logger.warn(`Decryption failed from ${req.ip}: ${error.message}`);
      return res.status(400).json({ success: false, error: 'Failed to decrypt request data' });
    }
  }

  next();
}

/**
 * Express middleware that encrypts outgoing responses for API-key authenticated requests.
 * Wraps JSON responses in { encrypted: true, data: "base64..." } format.
 */
function encryptResponseMiddleware(req, res, next) {
  if (!isEnabled()) return next();

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return next();

  const originalJson = res.json.bind(res);
  res.json = function(body) {
    try {
      const encrypted = encrypt(body, apiKey);
      return originalJson({ encrypted: true, data: encrypted });
    } catch (error) {
      logger.error('Response encryption failed:', error.message);
      return originalJson(body); // Fallback to unencrypted
    }
  };

  next();
}

module.exports = {
  encrypt,
  decrypt,
  deriveKey,
  isEnabled,
  decryptMiddleware,
  encryptResponseMiddleware,
  getInstallationSalt,
  ALGORITHM,
};
