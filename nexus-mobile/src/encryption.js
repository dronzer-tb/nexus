/**
 * Nexus Mobile E2E Encryption — AES-256-GCM
 * Dronzer Studios
 *
 * Client-side decryption for encrypted API responses.
 * Uses @noble/hashes for PBKDF2 key derivation and
 * @noble/ciphers for AES-256-GCM decryption.
 * These are pure-JS libraries — no native modules or Web Crypto API required.
 */

import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { gcm } from '@noble/ciphers/aes.js';

const PBKDF2_ITERATIONS = 50000;
const KEY_LENGTH = 32; // 256-bit
const IV_LENGTH = 12; // 96-bit
const AUTH_TAG_LENGTH = 16; // 128-bit

/**
 * Convert a hex string to Uint8Array.
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert a base64 string to Uint8Array.
 */
function base64ToBytes(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert string to Uint8Array (UTF-8).
 */
function stringToBytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) {
      bytes.push(c);
    } else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c < 0xd800 || c >= 0xe000) {
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else {
      // Surrogate pair
      i++;
      c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)
      );
    }
  }
  return new Uint8Array(bytes);
}

/**
 * Convert Uint8Array to UTF-8 string.
 */
function bytesToUtf8(bytes) {
  // Use TextDecoder if available, otherwise manual decode
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }
  // Manual UTF-8 decode fallback
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    let c = bytes[i++];
    if (c < 0x80) {
      result += String.fromCharCode(c);
    } else if (c < 0xe0) {
      result += String.fromCharCode(((c & 0x1f) << 6) | (bytes[i++] & 0x3f));
    } else if (c < 0xf0) {
      result += String.fromCharCode(
        ((c & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)
      );
    } else {
      const cp = ((c & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) |
                 ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
      result += String.fromCodePoint(cp);
    }
  }
  return result;
}

// ─── Key cache to avoid re-deriving on every request ───
const keyCache = new Map();

/**
 * Derive a 256-bit encryption key from an API key using PBKDF2-SHA512.
 * Uses @noble/hashes — pure JS, works everywhere.
 *
 * IMPORTANT: The server uses Node.js crypto.pbkdf2Sync(apiKey, salt, ...)
 * where salt is the hex STRING passed directly (UTF-8 encoded), NOT decoded
 * from hex to binary. We must match this behavior.
 *
 * @param {string} apiKey - The raw API key
 * @param {string} saltHex - The installation salt (hex string, used as-is)
 * @returns {Uint8Array} The derived 256-bit key
 */
function deriveKey(apiKey, saltHex) {
  const cacheKey = `${apiKey}:${saltHex}`;
  if (keyCache.has(cacheKey)) return keyCache.get(cacheKey);

  // Server passes the hex string directly as UTF-8 to PBKDF2, so we must too.
  // Do NOT convert hex to bytes — use the raw hex string as UTF-8 bytes.
  const salt = stringToBytes(saltHex);
  const passwordBytes = stringToBytes(apiKey);

  const key = pbkdf2(sha512, passwordBytes, salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: KEY_LENGTH,
  });

  // Cache up to 10 keys
  if (keyCache.size > 10) keyCache.clear();
  keyCache.set(cacheKey, key);

  return key;
}

/**
 * Decrypt AES-256-GCM encrypted data.
 * Uses @noble/ciphers — pure JS, no Web Crypto API needed.
 *
 * @param {string} encryptedBase64 - Base64 encoded string (iv + authTag + ciphertext)
 * @param {string} apiKey - The raw API key
 * @param {string} saltHex - The installation salt (hex string)
 * @returns {object|string} The decrypted data
 */
export function decrypt(encryptedBase64, apiKey, saltHex) {
  const packed = base64ToBytes(encryptedBase64);

  if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Invalid encrypted data: too short');
  }

  const iv = packed.slice(0, IV_LENGTH);
  const authTag = packed.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.slice(IV_LENGTH + AUTH_TAG_LENGTH);

  // @noble/ciphers gcm.decrypt expects ciphertext + authTag concatenated
  const ciphertextWithTag = new Uint8Array(ciphertext.length + authTag.length);
  ciphertextWithTag.set(ciphertext);
  ciphertextWithTag.set(authTag, ciphertext.length);

  const key = deriveKey(apiKey, saltHex);
  const aes = gcm(key, iv);
  const decryptedBytes = aes.decrypt(ciphertextWithTag);

  const decryptedText = bytesToUtf8(decryptedBytes);

  try {
    return JSON.parse(decryptedText);
  } catch {
    return decryptedText;
  }
}

/**
 * Check if a response is encrypted and decrypt it.
 *
 * @param {object} responseData - The API response data
 * @param {string} apiKey - The raw API key
 * @param {string} saltHex - The installation salt (hex string, fetched from server)
 * @returns {object} The decrypted (or original) data
 */
export function decryptResponse(responseData, apiKey, saltHex) {
  if (responseData && responseData.encrypted === true && responseData.data) {
    if (!saltHex) {
      console.warn('Encrypted response received but no encryption salt available');
      return responseData;
    }
    return decrypt(responseData.data, apiKey, saltHex);
  }
  return responseData;
}
