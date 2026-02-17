import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing } from '../theme';
import { completeAuth, savePairingResult } from '../api';
import { CircleCheck, ShieldCheck, XCircle } from 'lucide-react-native';

const CODE_LENGTH = 6;

/**
 * Step 4: Two-Factor Authentication Screen
 * User enters their TOTP code from authenticator app
 * On success → saves API key to SecureStore and signals completion
 */
export default function TwoFactorScreen({ route, navigation }) {
  const { serverUrl, tempToken, username, password } = route.params;

  const [code, setCode] = useState(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [success, setSuccess] = useState(false);

  const inputRefs = useRef([]);

  const handleDigitChange = (text, index) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError(null);

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit
    if (digit && index === CODE_LENGTH - 1 && newCode.every(d => d)) {
      submitAuth(newCode.join(''));
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
    }
  };

  const submitAuth = async (totpCode) => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const deviceName = `${Platform.OS === 'ios' ? 'iPhone' : 'Android'} Device`;
      const deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
      };

      const result = await completeAuth(serverUrl, {
        tempToken,
        username,
        password,
        totpCode: useRecovery ? undefined : (totpCode || code.join('')),
        recoveryCode: useRecovery ? recoveryCode.trim() : undefined,
        deviceName,
        deviceInfo,
      });

      if (!result.success) {
        throw new Error(result.error || 'Authentication failed');
      }

      // Save the API key and server URL securely
      await savePairingResult({
        serverUrl: result.serverUrl || serverUrl,
        apiKey: result.apiKey,
        deviceId: result.deviceId,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);

      // Navigate to main app after brief success state
      setTimeout(() => {
        // Signal to App.js that pairing is complete
        navigation.reset({
          index: 0,
          routes: [{ name: 'PairingComplete' }],
        });
      }, 2000);

    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err.response?.data?.error || err.message || 'Authentication failed';
      setError(msg);

      // Clear code on error
      if (!useRecovery) {
        setCode(Array(CODE_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={[styles.container, styles.successContainer]}>
        <CircleCheck size={64} color={colors.accent} strokeWidth={2} style={{ marginBottom: spacing.md }} />
        <Text style={styles.successTitle}>PAIRED SUCCESSFULLY</Text>
        <Text style={styles.successSubtitle}>
          Your device is now securely connected to Nexus
        </Text>
        <ActivityIndicator
          size="small"
          color={colors.accent}
          style={{ marginTop: spacing.lg }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <ShieldCheck size={40} color={colors.accent} strokeWidth={2} style={{ marginBottom: 8 }} />
            <Text style={styles.title}>2FA VERIFY</Text>
            <Text style={styles.subtitle}>
              Enter the code from your{'\n'}authenticator app
            </Text>
          </View>

          {!useRecovery ? (
            <>
              {/* TOTP Input */}
              <View style={styles.codeContainer}>
                {code.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(ref) => (inputRefs.current[i] = ref)}
                    style={[
                      styles.codeInput,
                      digit && styles.codeInputFilled,
                      error && styles.codeInputError,
                    ]}
                    value={digit}
                    onChangeText={(text) => handleDigitChange(text, i)}
                    onKeyPress={(e) => handleKeyPress(e, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    autoFocus={i === 0}
                  />
                ))}
              </View>

              {/* Switch to recovery code */}
              <TouchableOpacity
                style={styles.switchBtn}
                onPress={() => { setUseRecovery(true); setError(null); }}
              >
                <Text style={styles.switchBtnText}>
                  Lost authenticator? Use recovery code →
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Recovery Code Input */}
              <View style={styles.recoveryContainer}>
                <Text style={styles.inputLabel}>RECOVERY CODE</Text>
                <TextInput
                  style={styles.recoveryInput}
                  value={recoveryCode}
                  onChangeText={(t) => { setRecoveryCode(t); setError(null); }}
                  placeholder="XXXX-XXXX"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                />
                <Text style={styles.recoveryHint}>
                  Enter one of your saved recovery codes
                </Text>
              </View>

              {/* Switch back to TOTP */}
              <TouchableOpacity
                style={styles.switchBtn}
                onPress={() => { setUseRecovery(false); setError(null); setRecoveryCode(''); }}
              >
                <Text style={styles.switchBtnText}>
                  ← Use authenticator code instead
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Error */}
          {error && (
            <View style={styles.errorContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <XCircle size={14} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            </View>
          )}

          {/* Submit */}
          {(useRecovery || code.every(d => d)) && (
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={() => submitAuth()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.bg} />
              ) : (
                <Text style={styles.submitBtnText}>COMPLETE PAIRING</Text>
              )}
            </TouchableOpacity>
          )}

          {/* User info */}
          <View style={styles.userInfo}>
            <Text style={styles.userInfoLabel}>AUTHENTICATING AS</Text>
            <Text style={styles.userInfoValue}>{username}</Text>
          </View>

          {/* Step indicator */}
          <View style={styles.footer}>
            <View style={styles.stepIndicator}>
              <View style={[styles.stepDot, styles.stepDone]} />
              <View style={[styles.stepLine, styles.stepLineDone]} />
              <View style={[styles.stepDot, styles.stepDone]} />
              <View style={[styles.stepLine, styles.stepLineDone]} />
              <View style={[styles.stepDot, styles.stepDone]} />
              <View style={[styles.stepLine, styles.stepLineDone]} />
              <View style={[styles.stepDot, styles.stepActive]} />
            </View>
            <Text style={styles.stepLabel}>Step 4 of 4</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },

  // Success
  successContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  successEmoji: { fontSize: 72, marginBottom: spacing.md },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 3,
    marginBottom: spacing.sm,
  },
  successSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 4,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Code input
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: spacing.md,
  },
  codeInput: {
    width: 48,
    height: 56,
    backgroundColor: colors.bgCard,
    borderWidth: 2,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  codeInputFilled: {
    borderColor: colors.pink + '60',
    backgroundColor: colors.pink + '08',
  },
  codeInputError: {
    borderColor: colors.danger + '60',
  },

  // Recovery
  recoveryContainer: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 3,
    marginBottom: spacing.xs,
  },
  recoveryInput: {
    backgroundColor: colors.bgCard,
    borderWidth: 2,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'monospace',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    letterSpacing: 4,
  },
  recoveryHint: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Switch button
  switchBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  switchBtnText: {
    fontSize: 11,
    color: colors.cyan,
    fontWeight: '700',
  },

  // Error
  errorContainer: {
    backgroundColor: colors.danger + '15',
    borderWidth: 1,
    borderColor: colors.danger + '40',
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
    textAlign: 'center',
    fontFamily: 'monospace',
  },

  // Submit
  submitBtn: {
    backgroundColor: colors.pink,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.pink,
    marginBottom: spacing.lg,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
  },

  // User info
  userInfo: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  userInfoLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 3,
    marginBottom: 2,
  },
  userInfoValue: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: 'monospace',
    color: colors.accent,
  },

  // Footer / Steps
  footer: {
    alignItems: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
  stepDone: {
    backgroundColor: colors.success || '#22c55e',
    borderColor: colors.success || '#22c55e',
  },
  stepActive: {
    backgroundColor: colors.pink,
    borderColor: colors.pink,
  },
  stepLine: {
    width: 24,
    height: 2,
    backgroundColor: colors.border,
  },
  stepLineDone: {
    backgroundColor: colors.success || '#22c55e',
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
