import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../theme';
import { fetchNodeMetrics, fetchNode } from '../api';
import { formatBytes, formatUptime, getPercentColor, timeAgo } from '../utils';

/* ─── Stat Card ─── */
function StatCard({ label, value, sub, color }) {
  return (
    <View style={[styles.statCard, { borderColor: color + '30' }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

/* ─── Info Row ─── */
function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value || '—'}</Text>
    </View>
  );
}

/* ─── Section Header ─── */
function SectionHeader({ title, color }) {
  return (
    <View style={[styles.sectionHeader, { borderLeftColor: color }]}>
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
    </View>
  );
}

/* ─── Node Details Screen ─── */
export default function NodeDetailsScreen({ route }) {
  const { nodeId, hostname } = route.params;

  const [data, setData] = useState(null);
  const [nodeInfo, setNodeInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);

      const [metricsRes, node] = await Promise.all([
        fetchNodeMetrics(nodeId, 1),
        fetchNode(nodeId),
      ]);

      // The latest metric is in the response
      const metrics = metricsRes.metrics || metricsRes;
      const latest = Array.isArray(metrics) ? metrics[0]?.data : metrics;

      setData(latest || null);
      setNodeInfo(node || null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [nodeId]);

  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(() => load(true), 5000);
      return () => clearInterval(interval);
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading metrics...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={{ fontSize: 40, marginBottom: spacing.md }}>⚠️</Text>
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        </View>
      </View>
    );
  }

  const mem = data?.memory;
  const cpu = data?.cpu;
  const swap = data?.swap;
  const disk = data?.disk?.[0];
  const net = data?.network;
  const os = data?.os || nodeInfo?.system_info?.os;
  const sysHw = nodeInfo?.system_info;

  return (
    <View style={styles.container}>
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
        {/* ─── Quick Stats ─── */}
        <SectionHeader title="Quick Stats" color={colors.accent} />
        <View style={styles.statsGrid}>
          <StatCard
            label="CPU"
            value={`${(cpu?.usage || 0).toFixed(1)}%`}
            sub={cpu?.model ? cpu.model.substring(0, 30) : undefined}
            color={getPercentColor(cpu?.usage || 0, colors)}
          />
          <StatCard
            label="Memory"
            value={`${(mem?.usagePercent || 0).toFixed(1)}%`}
            sub={mem ? `${formatBytes(mem.active || 0)} used · ${formatBytes(mem.cached || 0)} cached` : undefined}
            color={getPercentColor(mem?.usagePercent || 0, colors)}
          />
          <StatCard
            label="Swap"
            value={`${(swap?.usagePercent || 0).toFixed(1)}%`}
            sub={swap ? `${formatBytes(swap.used)} / ${formatBytes(swap.total)}` : undefined}
            color={getPercentColor(swap?.usagePercent || 0, colors)}
          />
          <StatCard
            label="Disk"
            value={disk ? `${disk.usagePercent?.toFixed(1)}%` : 'N/A'}
            sub={disk ? `${formatBytes(disk.used)} / ${formatBytes(disk.size)}` : undefined}
            color={getPercentColor(disk?.usagePercent || 0, colors)}
          />
        </View>

        {/* ─── Memory Breakdown ─── */}
        {mem && (
          <>
            <SectionHeader title="Memory Breakdown" color={colors.cyan} />
            <View style={styles.infoCard}>
              <InfoRow label="Total" value={formatBytes(mem.total)} />
              <InfoRow label="Active (Used)" value={formatBytes(mem.active)} />
              <InfoRow label="Cached / Buffers" value={formatBytes(mem.cached)} />
              <InfoRow label="Free" value={formatBytes(mem.free)} />
              <InfoRow label="Available" value={formatBytes(mem.available)} />

              {/* Visual bar */}
              <View style={styles.memBar}>
                <View style={[styles.memBarSegment, {
                  flex: mem.active || 1,
                  backgroundColor: colors.cyan,
                }]} />
                <View style={[styles.memBarSegment, {
                  flex: mem.cached || 0,
                  backgroundColor: colors.yellow,
                }]} />
                <View style={[styles.memBarSegment, {
                  flex: mem.free || 1,
                  backgroundColor: colors.bg,
                }]} />
              </View>
              <View style={styles.memLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.cyan }]} />
                  <Text style={styles.legendText}>Active</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.yellow }]} />
                  <Text style={styles.legendText}>Cached</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.textMuted }]} />
                  <Text style={styles.legendText}>Free</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ─── Disk ─── */}
        {data?.disk && data.disk.length > 0 && (
          <>
            <SectionHeader title="Disks" color={colors.purple} />
            {data.disk.map((d, i) => (
              <View key={i} style={styles.infoCard}>
                <InfoRow label="Mount" value={d.mount} />
                <InfoRow label="Filesystem" value={d.fs} />
                <InfoRow label="Type" value={d.type} />
                <InfoRow label="Total" value={formatBytes(d.size)} />
                <InfoRow label="Used" value={`${formatBytes(d.used)} (${d.usagePercent?.toFixed(1)}%)`} />
                <InfoRow label="Available" value={formatBytes(d.available)} />

                <View style={[styles.barTrack, { marginTop: spacing.sm }]}>
                  <View style={[styles.barFill, {
                    width: `${Math.min(d.usagePercent || 0, 100)}%`,
                    backgroundColor: getPercentColor(d.usagePercent || 0, colors),
                  }]} />
                </View>
              </View>
            ))}
          </>
        )}

        {/* ─── Network ─── */}
        {net && net.length > 0 && (
          <>
            <SectionHeader title="Network" color={colors.orange} />
            {net.filter(n => n.operstate === 'up' || n.tx_sec > 0 || n.rx_sec > 0).slice(0, 5).map((iface, i) => (
              <View key={i} style={styles.infoCard}>
                <InfoRow label="Interface" value={iface.iface} />
                <InfoRow label="Speed" value={iface.speed ? `${iface.speed} Mbps` : '—'} />
                <InfoRow label="RX/s" value={formatBytes(iface.rx_sec || 0) + '/s'} />
                <InfoRow label="TX/s" value={formatBytes(iface.tx_sec || 0) + '/s'} />
                <InfoRow label="Total RX" value={formatBytes(iface.rx_bytes)} />
                <InfoRow label="Total TX" value={formatBytes(iface.tx_bytes)} />
              </View>
            ))}
          </>
        )}

        {/* ─── System Info ─── */}
        {(os || sysHw) && (
          <>
            <SectionHeader title="System" color={colors.pink} />
            <View style={styles.infoCard}>
              {os && (
                <>
                  <InfoRow label="OS" value={`${os.distro || os.platform || ''} ${os.release || ''}`} />
                  <InfoRow label="Kernel" value={os.kernel} />
                  <InfoRow label="Arch" value={os.arch} />
                  <InfoRow label="Hostname" value={os.hostname || hostname} />
                </>
              )}
              {sysHw?.cpu && (
                <>
                  <InfoRow label="CPU" value={sysHw.cpu.brand || sysHw.cpu.manufacturer} />
                  <InfoRow label="Cores" value={`${sysHw.cpu.physicalCores}P / ${sysHw.cpu.cores}L`} />
                  <InfoRow label="Speed" value={`${sysHw.cpu.speed} GHz`} />
                </>
              )}
              {data?.uptime && (
                <InfoRow label="Uptime" value={formatUptime(data.uptime)} />
              )}
            </View>
          </>
        )}

        {/* ─── Processes ─── */}
        {data?.processes && (
          <>
            <SectionHeader title="Processes" color={colors.accent} />
            <View style={styles.infoCard}>
              <InfoRow label="Total" value={data.processes.all} />
              <InfoRow label="Running" value={data.processes.running} />
              <InfoRow label="Sleeping" value={data.processes.sleeping} />
              <InfoRow label="Blocked" value={data.processes.blocked} />
            </View>
          </>
        )}

        <View style={{ height: spacing.xl * 2 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Section header
  sectionHeader: {
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    width: (Dimensions.get('window').width - spacing.md * 2 - spacing.sm) / 2 - 1,
    backgroundColor: colors.bgCard,
    borderWidth: 2,
    padding: spacing.md,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  statSub: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.textMuted,
    marginTop: 4,
  },

  // Info card
  infoCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.text,
    maxWidth: '60%',
    textAlign: 'right',
  },

  // Memory bar
  memBar: {
    flexDirection: 'row',
    height: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  memBarSegment: {
    height: '100%',
  },
  memLegend: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
  },
  legendText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Generic bar
  barTrack: {
    height: 8,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
});
