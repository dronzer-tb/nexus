/**
 * Notification Service — Local push notifications + alert polling
 * No FCM — uses expo-notifications for LOCAL notifications only.
 * Polls the Nexus server for new alerts and fires local notifications.
 * Maintains an in-app alert feed with persistent storage.
 */
let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.warn('[Notifications] expo-notifications not available:', e.message);
}
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform, AppState } from 'react-native';
import { fetchAlertsPoll, getSettings } from './api';

// ─── Storage abstraction ───
let AsyncStorage = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage');
} catch {
  AsyncStorage = null;
}

async function storageGetItem(key) {
  if (AsyncStorage?.getItem) return await AsyncStorage.getItem(key);
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}

async function storageSetItem(key, value) {
  if (AsyncStorage?.setItem) return await AsyncStorage.setItem(key, value);
  return await SecureStore.setItemAsync(key, value);
}

// ─── Constants ───
const ALERTS_STORAGE_KEY = 'nexus_alert_feed';
const LAST_POLL_KEY = 'nexus_last_poll_ts';
const NOTIF_ENABLED_KEY = 'nexus_notifications_enabled';
const MAX_FEED_ITEMS = 100;
const POLL_INTERVAL_MS = 8000; // 8 seconds

// ─── State ───
let pollTimer = null;
let isPolling = false;
let lastPollTimestamp = 0;

// ─── Notification handler (show alerts even when app is in foreground) ───
if (Notifications?.setNotificationHandler) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
    }),
  });
}

// ═══════════════════════════════════════════════════════════════
// PUSH PERMISSION & CHANNEL SETUP
// ═══════════════════════════════════════════════════════════════

/**
 * Request notification permissions and create Android channel.
 * Does NOT use FCM push tokens — only local notification permissions.
 */
export async function registerForPushNotifications() {
  if (!Notifications) return null;
  if (!Device.isDevice) {
    console.log('[Notifications] Must use physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission not granted');
    return null;
  }

  // Android notification channel
  if (Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
    await Notifications.setNotificationChannelAsync('alerts', {
      name: 'Nexus Alerts',
      importance: Notifications.AndroidImportance?.HIGH || 4,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00ff41',
      sound: 'default',
    });
  }

  return 'local-only';
}

// ═══════════════════════════════════════════════════════════════
// LOCAL NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

export async function sendLocalNotification({ title, body, data = {} }) {
  if (!Notifications) return;

  // Check if notifications are enabled by user
  const enabled = await getNotificationsEnabled();
  if (!enabled) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: 'alerts' } : {}),
    },
    trigger: null, // fire immediately
  });
}

// ═══════════════════════════════════════════════════════════════
// ALERT FEED (persistent in-app storage)
// ═══════════════════════════════════════════════════════════════

export async function getAlertFeed() {
  try {
    const raw = await storageGetItem(ALERTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function addAlertToFeed(alert) {
  try {
    const feed = await getAlertFeed();
    const newAlert = {
      id: alert.id ? String(alert.id) : Date.now().toString(),
      ...alert,
      timestamp: alert.fired_at || alert.timestamp || Date.now(),
      read: false,
    };

    // Deduplicate by server alert ID
    if (alert.id && feed.some(a => a.id === String(alert.id))) {
      return null; // already exists
    }

    feed.unshift(newAlert);
    if (feed.length > MAX_FEED_ITEMS) feed.length = MAX_FEED_ITEMS;
    await storageSetItem(ALERTS_STORAGE_KEY, JSON.stringify(feed));
    return newAlert;
  } catch (err) {
    console.error('[Notifications] Failed to save alert:', err);
    return null;
  }
}

export async function markAlertRead(alertId) {
  try {
    const feed = await getAlertFeed();
    const alert = feed.find(a => a.id === alertId);
    if (alert) {
      alert.read = true;
      await storageSetItem(ALERTS_STORAGE_KEY, JSON.stringify(feed));
    }
  } catch {}
}

export async function markAllAlertsRead() {
  try {
    const feed = await getAlertFeed();
    feed.forEach(a => { a.read = true; });
    await storageSetItem(ALERTS_STORAGE_KEY, JSON.stringify(feed));
  } catch {}
}

export async function clearAlertFeed() {
  try {
    await storageSetItem(ALERTS_STORAGE_KEY, JSON.stringify([]));
  } catch {}
}

export async function getUnreadCount() {
  const feed = await getAlertFeed();
  return feed.filter(a => !a.read).length;
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION PREFERENCE
// ═══════════════════════════════════════════════════════════════

export async function getNotificationsEnabled() {
  try {
    const val = await storageGetItem(NOTIF_ENABLED_KEY);
    return val !== 'false'; // default true
  } catch { return true; }
}

export async function setNotificationsEnabled(enabled) {
  await storageSetItem(NOTIF_ENABLED_KEY, enabled ? 'true' : 'false');
}

// ═══════════════════════════════════════════════════════════════
// SERVER ALERT POLLING (the core of no-FCM push)
// ═══════════════════════════════════════════════════════════════

const SEVERITY_EMOJI = {
  critical: '\u{1F534}',
  warning: '\u{1F7E0}',
  resolved: '\u{1F7E2}',
  info: '\u{1F535}',
};

/**
 * Poll the server for new alerts and fire local notifications.
 * Called on a timer while the app is paired and active.
 */
async function pollAlerts() {
  if (isPolling) return;
  isPolling = true;

  try {
    // Check if paired
    const settings = await getSettings();
    if (!settings.serverUrl || !settings.apiKey) {
      isPolling = false;
      return;
    }

    // Load last poll timestamp
    if (lastPollTimestamp === 0) {
      try {
        const stored = await storageGetItem(LAST_POLL_KEY);
        lastPollTimestamp = stored ? parseInt(stored) : 0;
      } catch { lastPollTimestamp = 0; }
    }

    const result = await fetchAlertsPoll(lastPollTimestamp);

    if (result.success && result.alerts?.length > 0) {
      // Process each alert (newest first from server, we reverse to notify oldest first)
      const newAlerts = [...result.alerts].reverse();

      for (const alert of newAlerts) {
        const firedAt = alert.fired_at || 0;
        if (firedAt <= lastPollTimestamp) continue;

        // Add to in-app feed
        const added = await addAlertToFeed({
          id: alert.id,
          type: alert.metric || alert.type,
          severity: alert.severity,
          nodeName: alert.node_name,
          nodeId: alert.node_id,
          value: alert.value,
          threshold: alert.threshold,
          message: alert.message,
          topProcess: alert.top_process,
          fired_at: firedAt,
        });

        // Fire local notification if genuinely new
        if (added) {
          const emoji = SEVERITY_EMOJI[alert.severity] || '\u26A1';
          const title = `${emoji} ${(alert.type || alert.metric || 'Alert').toUpperCase()}`;
          const body = alert.message || `${alert.metric} alert on ${alert.node_name}`;

          await sendLocalNotification({
            title,
            body,
            data: { nodeId: alert.node_id, alertId: alert.id },
          });
        }
      }
    }

    // Update last poll timestamp
    if (result.serverTime) {
      lastPollTimestamp = result.serverTime;
      try {
        await storageSetItem(LAST_POLL_KEY, String(lastPollTimestamp));
      } catch {}
    }
  } catch (err) {
    // Silently fail on network errors
    console.log('[Notifications] Poll failed:', err.message);
  } finally {
    isPolling = false;
  }
}

/**
 * Start the alert polling loop.
 * Automatically pauses when the app goes to background.
 */
export function startAlertPolling() {
  if (pollTimer) return;

  console.log('[Notifications] Starting alert polling (every 8s)');

  // Poll immediately on start
  pollAlerts();

  // Then poll on interval
  pollTimer = setInterval(pollAlerts, POLL_INTERVAL_MS);

  // Pause/resume on app state changes
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      if (!pollTimer) {
        pollAlerts();
        pollTimer = setInterval(pollAlerts, POLL_INTERVAL_MS);
      }
    } else if (state === 'background' || state === 'inactive') {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }
  });

  return () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    subscription?.remove();
  };
}

/**
 * Stop the alert polling loop.
 */
export function stopAlertPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('[Notifications] Alert polling stopped');
  }
}

/**
 * Force an immediate poll (e.g., on pull-to-refresh)
 */
export async function pollNow() {
  await pollAlerts();
}

/**
 * Listen for notification tap interactions.
 * Returns a subscription that should be cleaned up.
 */
export function addNotificationResponseListener(handler) {
  if (!Notifications?.addNotificationResponseReceivedListener) {
    return { remove: () => {} };
  }
  return Notifications.addNotificationResponseReceivedListener(handler);
}
