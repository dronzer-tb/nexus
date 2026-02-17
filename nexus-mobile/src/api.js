import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { decryptResponse } from './encryption';

/**
 * Nexus Mobile API Layer
 * Handles secure storage, multi-step pairing flow, and data fetching
 */

// ─── Secure Storage Keys ───
const KEYS = {
  SERVER_URL: 'nexus_server_url',
  API_KEY: 'nexus_api_key',
  ENCRYPTION_SALT: 'nexus_encryption_salt',
  DEVICE_ID: 'nexus_device_id',
  IS_PAIRED: 'nexus_is_paired',
};

// ═══════════════════════════════════════════════════════════════
// Secure Storage
// ═══════════════════════════════════════════════════════════════

export async function getSettings() {
  const [serverUrl, apiKey, deviceId, isPaired] = await Promise.all([
    SecureStore.getItemAsync(KEYS.SERVER_URL),
    SecureStore.getItemAsync(KEYS.API_KEY),
    SecureStore.getItemAsync(KEYS.DEVICE_ID),
    SecureStore.getItemAsync(KEYS.IS_PAIRED),
  ]);
  return {
    serverUrl: serverUrl || '',
    apiKey: apiKey || '',
    deviceId: deviceId || '',
    isPaired: isPaired === 'true',
  };
}

export async function savePairingResult({ serverUrl, apiKey, deviceId }) {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.SERVER_URL, serverUrl),
    SecureStore.setItemAsync(KEYS.API_KEY, apiKey),
    SecureStore.setItemAsync(KEYS.DEVICE_ID, deviceId || ''),
    SecureStore.setItemAsync(KEYS.IS_PAIRED, 'true'),
  ]);
}

export async function clearSettings() {
  await Promise.all(
    Object.values(KEYS).map(k => SecureStore.deleteItemAsync(k))
  );
}

export async function isPaired() {
  const val = await SecureStore.getItemAsync(KEYS.IS_PAIRED);
  return val === 'true';
}

// ═══════════════════════════════════════════════════════════════
// API Client Factory (for authenticated requests)
// ═══════════════════════════════════════════════════════════════

let _apiInstance = null;
let _apiSalt = null;

// Get the cached encryption salt, or fetch from server
async function getEncryptionSalt(baseURL, apiKey) {
  let salt = await SecureStore.getItemAsync(KEYS.ENCRYPTION_SALT);
  if (salt) return salt;

  try {
    const res = await axios.get(`${baseURL}/api/auth/encryption-info`, {
      headers: { 'X-API-Key': apiKey },
      timeout: 8000,
    });
    if (res.data?.encryption?.enabled && res.data.encryption.salt) {
      salt = res.data.encryption.salt;
      await SecureStore.setItemAsync(KEYS.ENCRYPTION_SALT, salt);
      return salt;
    }
  } catch (err) {
    console.warn('Failed to fetch encryption salt:', err.message);
  }
  return null;
}

export async function createApi() {
  const { serverUrl, apiKey } = await getSettings();

  if (!serverUrl || !apiKey) {
    throw new Error('Not paired. Please pair this device first.');
  }

  const baseURL = serverUrl.replace(/\/+$/, '');
  // Do not proactively fetch encryption salt here — defer to response interceptor
  // which will fetch it lazily when an encrypted response is received.

  const instance = axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  // Auto-decrypt encrypted responses
  instance.interceptors.response.use(
    async (response) => {
      if (response.data && response.data.encrypted === true && response.data.data) {
        // If we don't have the salt yet, try fetching it now
        if (!_apiSalt) {
          _apiSalt = await getEncryptionSalt(baseURL, apiKey);
        }
        try {
          response.data = decryptResponse(response.data, apiKey, _apiSalt);
        } catch (err) {
          // If decryption fails, try re-fetching salt in case it changed
          try {
            await SecureStore.deleteItemAsync(KEYS.ENCRYPTION_SALT);
            _apiSalt = await getEncryptionSalt(baseURL, apiKey);
            if (_apiSalt) {
              response.data = decryptResponse(response.data, apiKey, _apiSalt);
            }
          } catch (retryErr) {
            console.warn('Decrypt retry also failed:', retryErr.message);
          }
        }
      }
      return response;
    },
    (error) => Promise.reject(error)
  );

  return instance;
}

export function resetApi() {
  _apiInstance = null;
  _apiSalt = null;
}

async function getApi() {
  if (_apiInstance) return _apiInstance;
  _apiInstance = await createApi();
  return _apiInstance;
}

// ═══════════════════════════════════════════════════════════════
// Pairing Flow API (no API key needed)
// ═══════════════════════════════════════════════════════════════

/**
 * Step 1 result: QR payload parsed from scan
 * { nexus: true, version, challengeId, challenge, serverUrl, expiresAt }
 */

/**
 * Step 2: Validate OTP — sends challengeId + challenge + user-entered OTP
 * Returns: { success, tempToken, expiresIn, message }
 */
export async function validateOTP(serverUrl, challengeId, challenge, otp) {
  const baseURL = serverUrl.replace(/\/+$/, '');
  const res = await axios.post(`${baseURL}/api/mobile/validate-otp`, {
    challengeId,
    challenge,
    otp,
  }, { timeout: 15000 });
  return res.data;
}

/**
 * Step 3: Complete auth — sends tempToken + credentials + 2FA
 * Returns: { success, apiKey, serverUrl, deviceId, message }
 */
export async function completeAuth(serverUrl, { tempToken, username, password, totpCode, recoveryCode, deviceName, deviceInfo }) {
  const baseURL = serverUrl.replace(/\/+$/, '');
  const res = await axios.post(`${baseURL}/api/mobile/complete-auth`, {
    tempToken,
    username,
    password,
    totpCode,
    recoveryCode,
    deviceName,
    deviceInfo,
  }, { timeout: 15000 });
  return res.data;
}

// ═══════════════════════════════════════════════════════════════
// Connection Verification
// ═══════════════════════════════════════════════════════════════

export async function verifyConnection(serverUrl, apiKey) {
  const baseURL = (serverUrl || '').replace(/\/+$/, '');
  const res = await axios.get(`${baseURL}/api/auth/api-keys/verify`, {
    headers: { 'X-API-Key': apiKey },
    timeout: 8000,
  });

  // Cache encryption salt
  try {
    const encRes = await axios.get(`${baseURL}/api/auth/encryption-info`, {
      headers: { 'X-API-Key': apiKey },
      timeout: 8000,
    });
    if (encRes.data?.encryption?.salt) {
      await SecureStore.setItemAsync(KEYS.ENCRYPTION_SALT, encRes.data.encryption.salt);
    }
  } catch {
    // Non-critical
  }

  return res.data;
}

// ═══════════════════════════════════════════════════════════════
// Data Fetching (authenticated)
// ═══════════════════════════════════════════════════════════════

export async function fetchNodes() {
  const api = await getApi();
  const res = await api.get('/api/nodes');
  return res.data.nodes || [];
}

export async function fetchNode(nodeId) {
  const api = await getApi();
  const res = await api.get(`/api/nodes/${nodeId}`);
  return res.data;
}

export async function fetchNodeMetrics(nodeId, limit = 50) {
  const api = await getApi();
  const res = await api.get(`/api/metrics/${nodeId}/latest`, {
    params: { limit },
  });
  return res.data;
}

/**
 * Poll server for new alerts since a timestamp
 * @param {number} since - Unix timestamp in ms (0 for recent alerts)
 * @returns {{ alerts: Array, thresholds: object, serverTime: number }}
 */
export async function fetchAlertsPoll(since = 0) {
  const api = await getApi();
  const res = await api.get('/api/mobile/alerts/poll', {
    params: { since },
  });
  return res.data;
}

/**
 * Acknowledge an alert on the server
 */
export async function acknowledgeAlert(alertId) {
  const api = await getApi();
  const res = await api.post(`/api/mobile/alerts/${alertId}/acknowledge`);
  return res.data;
}
