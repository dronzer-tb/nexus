import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { decryptResponse } from './encryption';

const KEYS = {
  SERVER_URL: 'nexus_server_url',
  API_KEY: 'nexus_api_key',
  ENCRYPTION_SALT: 'nexus_encryption_salt',
};

// Get stored connection settings
export async function getSettings() {
  const serverUrl = await SecureStore.getItemAsync(KEYS.SERVER_URL);
  const apiKey = await SecureStore.getItemAsync(KEYS.API_KEY);
  return { serverUrl: serverUrl || '', apiKey: apiKey || '' };
}

// Save connection settings
export async function saveSettings(serverUrl, apiKey) {
  await SecureStore.setItemAsync(KEYS.SERVER_URL, serverUrl.trim());
  await SecureStore.setItemAsync(KEYS.API_KEY, apiKey.trim());
}

// Clear connection settings
export async function clearSettings() {
  await SecureStore.deleteItemAsync(KEYS.SERVER_URL);
  await SecureStore.deleteItemAsync(KEYS.API_KEY);
  await SecureStore.deleteItemAsync(KEYS.ENCRYPTION_SALT);
}

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
  } catch {
    // Encryption info not available
  }
  return null;
}

// Create an axios instance using stored settings with automatic decryption
export async function createApi() {
  const { serverUrl, apiKey } = await getSettings();

  if (!serverUrl || !apiKey) {
    throw new Error('Server URL and API key are required. Configure them in Settings.');
  }

  // Normalize URL — remove trailing slash
  const baseURL = serverUrl.replace(/\/+$/, '');

  // Fetch encryption salt
  const salt = await getEncryptionSalt(baseURL, apiKey);

  const instance = axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  // Add response interceptor to auto-decrypt encrypted responses
  instance.interceptors.response.use(
    async (response) => {
      if (response.data && response.data.encrypted === true && response.data.data) {
        try {
          response.data = await decryptResponse(response.data, apiKey, salt);
        } catch (err) {
          console.warn('Failed to decrypt response:', err.message);
          // Return encrypted data as-is if decryption fails
        }
      }
      return response;
    },
    (error) => Promise.reject(error)
  );

  return instance;
}

// Verify connection + API key
export async function verifyConnection(serverUrl, apiKey) {
  const baseURL = serverUrl.replace(/\/+$/, '');

  const res = await axios.get(`${baseURL}/api/auth/api-keys/verify`, {
    headers: { 'X-API-Key': apiKey },
    timeout: 8000,
  });

  // Also fetch and cache encryption salt during verification
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

// Fetch all nodes with metrics
export async function fetchNodes() {
  const api = await createApi();
  const res = await api.get('/api/nodes');
  return res.data.nodes || [];
}

// Fetch latest metrics for a specific node
export async function fetchNodeMetrics(nodeId, limit = 50) {
  const api = await createApi();
  const res = await api.get(`/api/metrics/${nodeId}/latest`, {
    params: { limit },
  });
  return res.data;
}

// Fetch a specific node
export async function fetchNode(nodeId) {
  const api = await createApi();
  const res = await api.get(`/api/nodes/${nodeId}`);
  return res.data.node;
}
