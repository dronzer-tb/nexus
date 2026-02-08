/**
 * Nexus Mobile E2E Encryption — AES-256-GCM
 * Dronzer Studios
 *
 * Client-side decryption for encrypted API responses.
 * Uses expo-crypto for PBKDF2 key derivation and
 * a pure-JS AES-256-GCM implementation via SubtleCrypto (Web Crypto API).
 */

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
 * Convert Uint8Array to UTF-8 string.
 */
function bytesToUtf8(bytes) {
  return new TextDecoder().decode(bytes);
}

/**
 * Convert string to Uint8Array.
 */
function stringToBytes(str) {
  return new TextEncoder().encode(str);
}

/**
 * Derive a 256-bit encryption key from an API key using PBKDF2.
 * Uses the Web Crypto API (available in React Native via expo-crypto polyfill).
 *
 * @param {string} apiKey - The raw API key
 * @param {string} saltHex - The installation salt (hex string)
 * @returns {Promise<CryptoKey>} The derived key
 */
async function deriveKey(apiKey, saltHex) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    stringToBytes(apiKey),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const salt = hexToBytes(saltHex);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-512',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

/**
 * Decrypt AES-256-GCM encrypted data.
 *
 * @param {string} encryptedBase64 - Base64 encoded string (iv + authTag + ciphertext)
 * @param {string} apiKey - The raw API key
 * @param {string} saltHex - The installation salt (hex string)
 * @returns {Promise<object|string>} The decrypted data
 */
export async function decrypt(encryptedBase64, apiKey, saltHex) {
  const packed = base64ToBytes(encryptedBase64);

  if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Invalid encrypted data: too short');
  }

  const iv = packed.slice(0, IV_LENGTH);
  const authTag = packed.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.slice(IV_LENGTH + AUTH_TAG_LENGTH);

  // AES-GCM expects ciphertext + authTag concatenated
  const ciphertextWithTag = new Uint8Array(ciphertext.length + authTag.length);
  ciphertextWithTag.set(ciphertext);
  ciphertextWithTag.set(authTag, ciphertext.length);

  const key = await deriveKey(apiKey, saltHex);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: AUTH_TAG_LENGTH * 8,
    },
    key,
    ciphertextWithTag
  );

  const decryptedText = bytesToUtf8(new Uint8Array(decryptedBuffer));

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
 * @returns {Promise<object>} The decrypted (or original) data
 */
export async function decryptResponse(responseData, apiKey, saltHex) {
  if (responseData && responseData.encrypted === true && responseData.data) {
    if (!saltHex) {
      console.warn('Encrypted response received but no encryption salt available');
      return responseData;
    }
    return decrypt(responseData.data, apiKey, saltHex);
  }
  return responseData;
}
