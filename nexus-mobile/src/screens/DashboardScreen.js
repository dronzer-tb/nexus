import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../theme';
import { fetchNodes, getSettings } from '../api';
import { getPercentColor, timeAgo } from '../utils';

const { width } = Dimensions.get('window');

/* ─── Metric Bar ─── */
function MetricBar({ label, value, color }) {
  const pct = Math.min(Math.max(value || 0, 0), 100);
  return (
    <View style={styles.metricBar}>
      <View style={styles.metricBarHeader}>
        <Text style={styles.metricBarLabel}>{label}</Text>
        <Text style={[styles.metricBarValue, { color }]}>{pct.toFixed(1)}%</Text>
      </View>
      <View style={styles.metricBarTrack}>
        <View style={[styles.metricBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

/* ─── Node Card ─── */
function NodeCard({ node, onPress }) {
  const isOnline = node.status === 'online';
  const m = node.metrics;

  return (
    <TouchableOpacity
      style={[styles.card, isOnline ? styles.cardOnline : styles.cardOffline]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.success : colors.danger }]} />
          <Text style={styles.cardHostname} numberOfLines={1}>{node.hostname}</Text>
        </View>
        <Text style={styles.cardSeen}>{timeAgo(node.last_seen)}</Text>
      </View>

      {/* Metrics */}
      {m && isOnline ? (
        <View style={styles.cardMetrics}>
          <MetricBar label="CPU" value={m.cpu} color={getPercentColor(m.cpu, colors)} />
          <MetricBar label="RAM" value={m.memory} color={getPercentColor(m.memory, colors)} />
          <MetricBar label="DISK" value={m.disk} color={getPercentColor(m.disk, colors)} />
          <View style={styles.cardFooter}>
            <Text style={styles.cardMeta}>
              RAM: {m.memoryUsed}GB / {m.memoryTotal}GB
              {m.memoryCached ? ` · Cache: ${m.memoryCached}GB` : ''}
            </Text>
            <Text style={styles.cardMeta}>DISK: {m.diskUsed}GB / {m.diskTotal}GB</Text>
          </View>
        </View>
      ) : (
        <View style={styles.cardOfflineMsg}>
          <Text style={styles.cardOfflineText}>
            {isOnline ? 'Waiting for metrics...' : 'OFFLINE'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/* ─── Fleet Summary ─── */
function FleetSummary({ nodes }) {
  const online = nodes.filter(n => n.status === 'online');
  const offline = nodes.length - online.length;

  const avgCpu = online.length > 0
    ? online.reduce((s, n) => s + (n.metrics?.cpu || 0), 0) / online.length
    : 0;
  const avgMem = online.length > 0
    ? online.reduce((s, n) => s + (n.metrics?.memory || 0), 0) / online.length
    : 0;

  return (
    <View style={styles.summary}>
      <View style={styles.summaryRow}>
        <SummaryItem label="Nodes" value={nodes.length} color={colors.accent} />
        <SummaryItem label="Online" value={online.length} color={colors.success} />
        <SummaryItem label="Offline" value={offline} color={offline > 0 ? colors.danger : colors.textMuted} />
      </View>
      <View style={styles.summaryRow}>
        <SummaryItem label="Avg CPU" value={`${avgCpu.toFixed(1)}%`} color={getPercentColor(avgCpu, colors)} />
        <SummaryItem label="Avg RAM" value={`${avgMem.toFixed(1)}%`} color={getPercentColor(avgMem, colors)} />
      </View>
    </View>
  );
}

function SummaryItem({ label, value, color }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

/* ─── Dashboard Screen ─── */
export default function DashboardScreen({ navigation }) {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [configured, setConfigured] = useState(true);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);

      const settings = await getSettings();
      if (!settings.serverUrl || !settings.apiKey) {
        setConfigured(false);
        setLoading(false);
        return;
      }
      setConfigured(true);

      const data = await fetchNodes();
      setNodes(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Connection failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // Auto-refresh every 5 seconds
      const interval = setInterval(() => load(true), 5000);
      return () => clearInterval(interval);
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Not configured state
  if (!configured && !loading) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⚙️</Text>
          <Text style={styles.emptyTitle}>Setup Required</Text>
          <Text style={styles.emptyDesc}>
            Configure your server URL and API key in Settings to get started.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.emptyBtnText}>Go to Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>NEXUS</Text>
        <Text style={styles.headerSubtitle}>MONITOR</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Connecting...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={[styles.emptyTitle, { color: colors.danger }]}>Connection Error</Text>
          <Text style={styles.emptyDesc}>{error}</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => load()}>
            <Text style={styles.emptyBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
              progressBackgroundColor={colors.bgCard}
            />
          }
        >
          {/* Fleet Summary */}
          <FleetSummary nodes={nodes} />

          {/* Node Cards */}
          {nodes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📡</Text>
              <Text style={styles.emptyTitle}>No Nodes</Text>
              <Text style={styles.emptyDesc}>No nodes are registered with this server yet.</Text>
            </View>
          ) : (
            nodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                onPress={() => navigation.navigate('NodeDetails', { nodeId: node.id, hostname: node.hostname })}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
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
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.pink,
    letterSpacing: -1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },

  // Fleet Summary
  summary: {
    backgroundColor: colors.bgCard,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'monospace',
  },

  // Node Card
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 2,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardOnline: {
    borderColor: colors.accent + '30',
  },
  cardOffline: {
    borderColor: colors.danger + '20',
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardHostname: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  cardSeen: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },

  // Metric bars
  cardMetrics: {
    gap: spacing.xs,
  },
  metricBar: {
    marginBottom: 2,
  },
  metricBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  metricBarLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  metricBarValue: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  metricBarTrack: {
    height: 6,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  metricBarFill: {
    height: '100%',
  },
  cardFooter: {
    marginTop: spacing.xs,
    gap: 2,
  },
  cardMeta: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.textMuted,
  },
  cardOfflineMsg: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cardOfflineText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
    maxWidth: 280,
  },
  emptyBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  emptyBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.bg,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});
