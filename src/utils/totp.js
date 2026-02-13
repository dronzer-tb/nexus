const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');

/**
 * TOTP (Time-based One-Time Password) Utilities
 * For mandatory 2FA in custom authentication system v1.9.5
 */

const TOTP_CONFIG = {
  name: 'Nexus',
  issuer: 'Nexus Monitoring',
  algorithm: 'sha1',
  digits: 6,
  period: 30,
  window: 1 // Allow 1 step before/after for clock drift
};

/**
 * Generate a new TOTP secret for a user
 * @param {string} username - Username to associate with secret
 * @returns {Object} { secret: string, otpauth_url: string }
 */
function generateSecret(username) {
  const secret = speakeasy.generateSecret({
    name: `${TOTP_CONFIG.issuer}:${username}`,
    issuer: TOTP_CONFIG.issuer,
    length: 32
  });

  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url
  };
}

/**
 * Generate QR code data URL from otpauth URL
 * @param {string} otpauth_url - OTPAuth URL from generateSecret
 * @returns {Promise<string>} Data URL for QR code image
 */
async function generateQRCode(otpauth_url) {
  try {
    return await qrcode.toDataURL(otpauth_url);
  } catch (error) {
    throw new Error('Failed to generate QR code: ' + error.message);
  }
}

/**
 * Verify a TOTP code against a secret
 * @param {string} token - 6-digit code from authenticator app
 * @param {string} secret - Base32 encoded secret
 * @returns {boolean} True if code is valid
 */
function verifyToken(token, secret) {
  if (!token || !secret) {
    return false;
  }

  // Remove any spaces or dashes from token
  const cleanToken = token.replace(/[\s-]/g, '');

  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: cleanToken,
    window: TOTP_CONFIG.window,
    algorithm: TOTP_CONFIG.algorithm,
    digits: TOTP_CONFIG.digits,
    period: TOTP_CONFIG.period
  });
}

/**
 * Generate backup/recovery codes
 * @param {number} count - Number of codes to generate (default: 10)
 * @returns {string[]} Array of recovery codes
 */
function generateRecoveryCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    // Format as XXXX-XXXX for readability
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

/**
 * Hash a recovery code for storage
 * @param {string} code - Recovery code to hash
 * @returns {string} Hashed code
 */
function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Verify a recovery code against hashed codes
 * @param {string} code - Code provided by user
 * @param {string[]} hashedCodes - Array of hashed codes from database
 * @returns {Object} { valid: boolean, usedIndex: number }
 */
function verifyRecoveryCode(code, hashedCodes) {
  if (!code || !hashedCodes || !Array.isArray(hashedCodes)) {
    return { valid: false, usedIndex: -1 };
  }

  const hashedInput = hashRecoveryCode(code);
  const index = hashedCodes.indexOf(hashedInput);

  return {
    valid: index !== -1,
    usedIndex: index
  };
}

/**
 * Derive a 32-byte key from a passphrase using SHA-256
 * @param {string} passphrase
 * @returns {Buffer}
 */
function deriveKey(passphrase) {
  return crypto.createHash('sha256').update(passphrase).digest();
}

/**
 * Encrypt TOTP secret for storage
 * Uses AES-256-CBC with a random IV prepended to the ciphertext
 * @param {string} secret - Base32 secret to encrypt
 * @param {string} key - Encryption passphrase (from config)
 * @returns {string} Hex-encoded IV + ciphertext
 */
function encryptSecret(secret, key = process.env.TOTP_ENCRYPTION_KEY || 'nexus-default-key-change-me') {
  const derivedKey = deriveKey(key);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  // Prepend IV so we can extract it during decryption
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt TOTP secret from storage
 * @param {string} encryptedSecret - Hex-encoded IV:ciphertext
 * @param {string} key - Encryption passphrase (from config)
 * @returns {string} Decrypted base32 secret
 */
function decryptSecret(encryptedSecret, key = process.env.TOTP_ENCRYPTION_KEY || 'nexus-default-key-change-me') {
  const derivedKey = deriveKey(key);
  const [ivHex, ciphertext] = encryptedSecret.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Generate current TOTP code (for testing/debugging)
 * @param {string} secret - Base32 secret
 * @returns {string} Current 6-digit code
 */
function generateCurrentToken(secret) {
  return speakeasy.totp({
    secret: secret,
    encoding: 'base32',
    algorithm: TOTP_CONFIG.algorithm,
    digits: TOTP_CONFIG.digits,
    period: TOTP_CONFIG.period
  });
}

module.exports = {
  TOTP_CONFIG,
  generateSecret,
  generateQRCode,
  verifyToken,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyRecoveryCode,
  encryptSecret,
  decryptSecret,
  generateCurrentToken
};
