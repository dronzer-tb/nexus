import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  SERVER_URL: 'nexus_server_url',
  API_KEY: 'nexus_api_key',
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
}

// Create an axios instance using stored settings
export async function createApi() {
  const { serverUrl, apiKey } = await getSettings();

  if (!serverUrl || !apiKey) {
    throw new Error('Server URL and API key are required. Configure them in Settings.');
  }

  // Normalize URL — remove trailing slash
  const baseURL = serverUrl.replace(/\/+$/, '');

  return axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });
}

// Verify connection + API key
export async function verifyConnection(serverUrl, apiKey) {
  const baseURL = serverUrl.replace(/\/+$/, '');

  const res = await axios.get(`${baseURL}/api/auth/api-keys/verify`, {
    headers: { 'X-API-Key': apiKey },
    timeout: 8000,
  });

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
