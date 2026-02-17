import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Bell, CheckCircle, Trash2, CheckCheck } from 'lucide-react-native';
import { colors, spacing, fontScale } from '../theme';
import {
  getAlertFeed, markAlertRead, markAllAlertsRead, clearAlertFeed, pollNow,
} from '../notifications';

const SEVERITY_COLORS = {
  critical: colors.danger,
  warning: colors.warning || '#f59e0b',
  info: colors.cyan,
  resolved: colors.success || '#22c55e',
};

function AlertItem({ item, onPress }) {
  const severityColor = SEVERITY_COLORS[item.severity] || colors.textMuted;
  const age = getTimeAgo(item.timestamp);

  return (
    <TouchableOpacity
      style={[
        styles.alertCard,
        !item.read && styles.alertCardUnread,
        { borderLeftColor: severityColor },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.alertHeader}>
        <View style={styles.alertIconRow}>
          {item.severity === 'critical' ? (
            <AlertTriangle size={16} color={severityColor} />
          ) : item.severity === 'resolved' ? (
            <CheckCircle size={16} color={severityColor} />
          ) : (
            <Bell size={16} color={severityColor} />
          )}
          <Text style={[styles.alertType, { color: severityColor }]}>
            {item.type} {(item.severity || 'info').toUpperCase()}
          </Text>
        </View>
        <Text style={styles.alertTime}>{age}</Text>
      </View>

      <Text style={styles.alertNode}>{item.nodeName || 'Unknown'}</Text>
      <Text style={styles.alertMessage}>{item.message}</Text>

      {item.value != null && (
        <View style={styles.alertDetails}>
          <Text style={styles.alertDetailText}>
            {item.value}% / {item.threshold}% threshold
          </Text>
        </View>
      )}

      {!item.read && <View style={[styles.unreadDot, { backgroundColor: severityColor }]} />}
    </TouchableOpacity>
  );
}

function getTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AlertFeedScreen() {
  const [alerts, setAlerts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    try {
      const feed = await getAlertFeed();
      setAlerts(feed);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Poll for fresh alerts when screen is focused
      pollNow().then(() => loadAlerts()).catch(() => loadAlerts());
    }, [loadAlerts])
  );

  const handlePress = async (item) => {
    if (!item.read) {
      await markAlertRead(item.id);
      loadAlerts();
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAlertsRead();
    loadAlerts();
  };

  const handleClear = () => {
    Alert.alert(
      'Clear All Alerts',
      'This will remove all alerts from the feed. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearAlertFeed();
            loadAlerts();
          },
        },
      ],
    );
  };

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>ALERTS</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleMarkAllRead}>
              <CheckCheck size={18} color={colors.accent} />
            </TouchableOpacity>
          )}
          {alerts.length > 0 && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleClear}>
              <Trash2 size={18} color={colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Alert list */}
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AlertItem item={item} onPress={() => handlePress(item)} />
        )}
        contentContainerStyle={alerts.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              pollNow().then(() => loadAlerts()).catch(() => loadAlerts());
            }}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.bgCard}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Bell size={48} color={colors.textMuted} style={{ opacity: 0.3 }} />
            <Text style={styles.emptyTitle}>No Alerts</Text>
            <Text style={styles.emptyDesc}>
              When metric thresholds are exceeded, alerts will appear here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontScale(24),
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: fontScale(12),
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    padding: spacing.sm,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    padding: spacing.md,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  alertCardUnread: {
    backgroundColor: colors.bgCard + 'CC',
    borderColor: colors.borderLight,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  alertIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertType: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  alertTime: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: colors.textMuted,
  },
  alertNode: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  alertMessage: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  alertDetails: {
    marginTop: spacing.xs,
    backgroundColor: colors.bg,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alertDetailText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.textMuted,
  },
  unreadDot: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl * 2,
  },
  emptyTitle: {
    fontSize: fontScale(18),
    fontWeight: '900',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyDesc: {
    fontSize: fontScale(13),
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: fontScale(20),
    maxWidth: 280,
  },
});
