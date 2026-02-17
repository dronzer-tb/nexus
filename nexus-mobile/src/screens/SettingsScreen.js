import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { colors, spacing, fontScale } from '../theme';
import { getSettings, clearSettings, verifyConnection, resetApi } from '../api';
import { getNotificationsEnabled, setNotificationsEnabled, stopAlertPolling, startAlertPolling } from '../notifications';
import { Lock, ShieldCheck, Smartphone, CheckCircle, XCircle, CircleDot, Circle, Bell, BellOff } from 'lucide-react-native';

/**
 * Settings Screen (Post-Pairing)
 * Shows connection status, device info, and unpair option
 */
export default function SettingsScreen({ onUnpair }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [notifEnabled, setNotifEnabled] = useState(true);

  useEffect(() => {
    loadSettings();
    getNotificationsEnabled().then(setNotifEnabled).catch(() => {});
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const s = await getSettings();
      setSettings(s);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!settings?.serverUrl || !settings?.apiKey) return;
    setTesting(true);
    setTestResult(null);

    try {
      const result = await verifyConnection(settings.serverUrl, settings.apiKey);
      setTestResult({ success: true, name: result.name || 'Connected' });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Connection failed';
      setTestResult({ success: false, message: msg });
    } finally {
      setTesting(false);
    }
  };

  const handleUnpair = () => {
    Alert.alert(
      'Unpair Device',
      'This will remove all credentials from this device. You will need to re-pair to access Nexus.\n\nContinue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpair',
          style: 'destructive',
          onPress: async () => {
            await clearSettings();
            resetApi();
            if (onUnpair) onUnpair();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  const maskedKey = settings?.apiKey
    ? `${settings.apiKey.substring(0, 8)}${'•'.repeat(20)}${settings.apiKey.slice(-4)}`
    : '—';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SETTINGS</Text>
      </View>

      {/* Connection Status */}
      <View style={styles.section}>
        <SectionHeader title="CONNECTION" color={colors.cyan} />
        <View style={styles.card}>
          <InfoRow label="Server" value={settings?.serverUrl || '—'} />
          <InfoRow label="API Key" value={maskedKey} mono />
          <InfoRow label="Device ID" value={settings?.deviceId || '—'} mono />
          <InfoRow
            label="Status"
            value={settings?.isPaired ? 'PAIRED' : 'NOT PAIRED'}
            valueColor={settings?.isPaired ? colors.accent : colors.danger}
            icon={settings?.isPaired ? <CircleDot size={12} color={colors.accent} /> : <Circle size={12} color={colors.danger} />}
          />

          {/* Test result */}
          {testResult && (
            <View style={[
              styles.testResult,
              { borderColor: testResult.success ? (colors.success || '#22c55e') + '60' : colors.danger + '60' },
            ]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {testResult.success
                  ? <CheckCircle size={14} color={colors.success || '#22c55e'} />
                  : <XCircle size={14} color={colors.danger} />}
                <Text style={[
                  styles.testResultText,
                  { color: testResult.success ? (colors.success || '#22c55e') : colors.danger },
                ]}>
                  {testResult.success
                    ? `Connected! (${testResult.name})`
                    : testResult.message}
                </Text>
              </View>
            </View>
          )}

          {/* Test button */}
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={handleTest}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator size="small" color={colors.bg} />
            ) : (
              <Text style={styles.btnPrimaryText}>Test Connection</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Security Info */}
      <View style={styles.section}>
        <SectionHeader title="NOTIFICATIONS" color={colors.accent} />
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {notifEnabled
                ? <Bell size={14} color={colors.accent} />
                : <BellOff size={14} color={colors.textMuted} />}
              <Text style={styles.infoLabel}>Push Alerts</Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={async (val) => {
                setNotifEnabled(val);
                await setNotificationsEnabled(val);
              }}
              trackColor={{ false: colors.border, true: colors.accent + '60' }}
              thumbColor={notifEnabled ? colors.accent : colors.textMuted}
            />
          </View>
          <Text style={styles.notifHint}>
            {notifEnabled
              ? 'Polling server every 15s for new alerts. Local notifications will fire when thresholds are exceeded.'
              : 'Notifications are disabled. The app will still collect alerts but won\'t show push banners.'}
          </Text>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Method</Text>
            <Text style={[styles.infoValue, { color: colors.cyan }]}>LOCAL POLLING (NO FCM)</Text>
          </View>
        </View>
      </View>

      {/* Security Info — Original */}
      <View style={styles.section}>
        <SectionHeader title="SECURITY" color={colors.pink} />
        <View style={styles.card}>
          <Step icon={<Lock size={18} color={colors.pink} />} text="Credentials stored in encrypted secure storage" />
          <Step icon={<ShieldCheck size={18} color={colors.pink} />} text="API key is device-specific and revocable" />
          <Step icon={<Smartphone size={18} color={colors.pink} />} text="Unpair from dashboard to revoke remote access" />
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <SectionHeader title="DANGER ZONE" color={colors.danger} />
        <TouchableOpacity style={styles.dangerBtn} onPress={handleUnpair}>
          <Text style={styles.dangerBtnText}>Unpair This Device</Text>
        </TouchableOpacity>
        <Text style={styles.dangerHint}>
          Removes all stored credentials. You'll need to re-pair via QR code.
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>NEXUS MONITOR v2.1</Text>
        <Text style={styles.footerText}>SECURE MOBILE CLIENT</Text>
      </View>
    </ScrollView>
  );
}

function SectionHeader({ title, color }) {
  return (
    <View style={[styles.sectionHeader, { borderLeftColor: color }]}>
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
    </View>
  );
}

function InfoRow({ label, value, mono, valueColor, icon }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {icon}
        <Text
          style={[
            styles.infoValue,
            mono && { fontFamily: 'monospace', fontSize: 10 },
            valueColor && { color: valueColor },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function Step({ icon, text }) {
  return (
    <View style={styles.step}>
      {icon}
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 3,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1,
  },

  // Section
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },

  // Card
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
  },

  // Info row
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 12,
    color: colors.text,
    maxWidth: '60%',
    textAlign: 'right',
  },

  // Test result
  testResult: {
    borderWidth: 2,
    padding: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  testResultText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    textAlign: 'center',
  },

  // Buttons
  btn: {
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginTop: spacing.sm,
  },
  btnPrimary: {
    backgroundColor: colors.cyan,
    borderColor: colors.cyan,
  },
  btnPrimaryText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.bg,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Steps
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  stepIcon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // Danger
  dangerBtn: {
    borderWidth: 2,
    borderColor: colors.danger + '40',
    padding: spacing.md,
    alignItems: 'center',
  },
  dangerBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.danger,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  dangerHint: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  notifHint: {
    fontSize: 10,
    color: colors.textMuted,
    lineHeight: 16,
    marginVertical: spacing.xs,
    paddingHorizontal: 2,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: 2,
  },
  footerText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted + '60',
    letterSpacing: 3,
  },
});
