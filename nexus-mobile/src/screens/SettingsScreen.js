import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, spacing } from '../theme';
import { getSettings, saveSettings, clearSettings, verifyConnection } from '../api';

/* ─── Settings Screen ─── */
export default function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const settings = await getSettings();
      setServerUrl(settings.serverUrl);
      setApiKey(settings.apiKey);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!serverUrl.trim()) {
      Alert.alert('Error', 'Server URL is required');
      return;
    }
    if (!apiKey.trim()) {
      Alert.alert('Error', 'API Key is required');
      return;
    }

    await saveSettings(serverUrl, apiKey);
    setSaved(true);
    setTestResult(null);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleTest = async () => {
    if (!serverUrl.trim() || !apiKey.trim()) {
      Alert.alert('Error', 'Fill in both Server URL and API Key first');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await verifyConnection(serverUrl.trim(), apiKey.trim());
      setTestResult({ success: true, name: result.name || 'Valid' });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Connection failed';
      setTestResult({ success: false, message: msg });
    } finally {
      setTesting(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Clear Settings',
      'This will remove your server URL and API key. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearSettings();
            setServerUrl('');
            setApiKey('');
            setTestResult(null);
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SETTINGS</Text>
        </View>

        {/* Connection Section */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, { borderLeftColor: colors.cyan }]}>
            <Text style={[styles.sectionTitle, { color: colors.cyan }]}>CONNECTION</Text>
          </View>

          <View style={styles.card}>
            {/* Server URL */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>SERVER URL</Text>
              <TextInput
                style={styles.input}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="http://192.168.1.100:8080"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Text style={styles.inputHint}>
                The full URL of your Nexus server (include port)
              </Text>
            </View>

            {/* API Key */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>API KEY</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder="nxk_..."
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.toggleBtn}
                  onPress={() => setShowKey(!showKey)}
                >
                  <Text style={styles.toggleBtnText}>{showKey ? 'HIDE' : 'SHOW'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.inputHint}>
                Generate an API key from the Nexus dashboard (Settings → API Keys)
              </Text>
            </View>

            {/* Test Result */}
            {testResult && (
              <View style={[
                styles.testResult,
                { borderColor: testResult.success ? colors.success + '60' : colors.danger + '60' }
              ]}>
                <Text style={[
                  styles.testResultText,
                  { color: testResult.success ? colors.success : colors.danger }
                ]}>
                  {testResult.success
                    ? `✓ Connected! Key: "${testResult.name}"`
                    : `✗ ${testResult.message}`}
                </Text>
              </View>
            )}

            {/* Saved Feedback */}
            {saved && (
              <View style={[styles.testResult, { borderColor: colors.accent + '60' }]}>
                <Text style={[styles.testResultText, { color: colors.accent }]}>
                  ✓ Settings saved!
                </Text>
              </View>
            )}

            {/* Buttons */}
            <View style={styles.btnRow}>
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

              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={handleSave}
              >
                <Text style={styles.btnSecondaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Help Section */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, { borderLeftColor: colors.pink }]}>
            <Text style={[styles.sectionTitle, { color: colors.pink }]}>HOW TO CONNECT</Text>
          </View>

          <View style={styles.card}>
            <Step number="1" text="Open Nexus dashboard in your browser" />
            <Step number="2" text="Go to Settings → API Keys" />
            <Step number="3" text='Click "New Key" and give it a name (e.g. "My Phone")' />
            <Step number="4" text="Copy the generated key (starts with nxk_)" />
            <Step number="5" text="Paste the server URL and key above" />
            <Step number="6" text='Hit "Test Connection" to verify' />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, { borderLeftColor: colors.danger }]}>
            <Text style={[styles.sectionTitle, { color: colors.danger }]}>DANGER ZONE</Text>
          </View>

          <TouchableOpacity style={styles.dangerBtn} onPress={handleClear}>
            <Text style={styles.dangerBtnText}>Clear All Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>NEXUS MONITOR v1.0</Text>
          <Text style={styles.footerText}>DRONZER STUDIOS</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Step({ number, text }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
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

  // Input
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 2,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
    fontFamily: 'monospace',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputHint: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  toggleBtn: {
    backgroundColor: colors.bgInput,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  toggleBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 2,
  },

  // Test result
  testResult: {
    borderWidth: 2,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  testResultText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },

  // Buttons
  btnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
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
  btnSecondary: {
    backgroundColor: 'transparent',
    borderColor: colors.accent,
  },
  btnSecondaryText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.accent,
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
  stepNumber: {
    width: 22,
    height: 22,
    backgroundColor: colors.pink + '20',
    borderWidth: 1,
    borderColor: colors.pink + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.pink,
    fontFamily: 'monospace',
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingTop: 1,
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
