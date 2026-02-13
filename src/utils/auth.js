const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('./config');
const logger = require('./logger');

/**
 * Auth utilities for Nexus
 * Provides node ID/API key generation, hashing, and JWT verification
 */

/**
 * Generate a unique node ID
 * Format: node_<16 hex chars>
 */
function generateNodeId() {
  return `node_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Generate a secure API key
 * 64-character hex string (32 bytes)
 */
function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash an API key using SHA-256
 * Used for storing/comparing API keys without keeping plaintext
 */
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Verify an API key against a stored hash
 * Uses timing-safe comparison to prevent timing attacks
 */
function verifyApiKey(apiKey, storedHash) {
  if (!apiKey || !storedHash) return false;

  const inputHash = hashApiKey(apiKey);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(inputHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch (error) {
    // If buffers are different lengths, they don't match
    return false;
  }
}

/**
 * Verify a JWT token
 * Returns decoded payload or null if invalid
 */
function verifyJWT(token) {
  try {
    const secret = config.get('server.jwtSecret');
    if (!secret) {
      logger.warn('JWT secret not configured');
      return null;
    }
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
}

/**
 * Sign a JWT token
 * Returns the signed token string
 */
function signJWT(payload, expiresIn = '24h') {
  const secret = config.get('server.jwtSecret');
  if (!secret) {
    throw new Error('JWT secret not configured');
  }
  return jwt.sign(payload, secret, { expiresIn });
}

module.exports = {
  generateNodeId,
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  verifyJWT,
  signJWT,
};
