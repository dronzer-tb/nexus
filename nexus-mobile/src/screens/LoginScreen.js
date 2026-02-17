import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing } from '../theme';

/**
 * Step 3: Login Screen
 * User enters Nexus username + password
 * On success → navigates to 2FA screen
 */
export default function LoginScreen({ route, navigation }) {
  const { serverUrl, tempToken, tokenExpiresIn } = route.params;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tokenTimeLeft, setTokenTimeLeft] = useState(tokenExpiresIn || 300);

  // Token countdown
  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = Math.max(0, (tokenExpiresIn || 300) - elapsed);
      setTokenTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(tick);
        Alert.alert(
          'Session Expired',
          'The pairing session has expired. Please start over.',
          [{ text: 'OK', onPress: () => navigation.popToTop() }]
        );
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [tokenExpiresIn, navigation]);

  const handleContinue = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }

    // Navigate to 2FA screen with credentials
    navigation.navigate('TwoFactor', {
      serverUrl,
      tempToken,
      username: username.trim(),
      password: password.trim(),
    });
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

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
            <Text style={styles.emoji}>🔐</Text>
            <Text style={styles.title}>LOGIN</Text>
            <Text style={styles.subtitle}>
              Enter your Nexus dashboard credentials
            </Text>
          </View>

          {/* Session timer */}
          <View style={styles.sessionTimer}>
            <Text style={styles.sessionTimerLabel}>SESSION</Text>
            <Text style={[
              styles.sessionTimerValue,
              tokenTimeLeft < 60 && { color: colors.danger },
            ]}>
              {formatTime(tokenTimeLeft)}
            </Text>
          </View>

          {/* Login form */}
          <View style={styles.form}>
            {/* Username */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>USERNAME</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={(t) => { setUsername(t); setError(null); }}
                placeholder="admin"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                returnKeyType="next"
              />
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(null); }}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  returnKeyType="go"
                  onSubmitEditing={handleContinue}
                />
                <TouchableOpacity
                  style={styles.toggleBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.toggleBtnText}>
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>✗ {error}</Text>
            </View>
          )}

          {/* Continue button */}
          <TouchableOpacity
            style={[
              styles.continueBtn,
              (!username.trim() || !password.trim()) && styles.continueBtnDisabled,
            ]}
            onPress={handleContinue}
            disabled={!username.trim() || !password.trim()}
          >
            <Text style={styles.continueBtnText}>CONTINUE TO 2FA →</Text>
          </TouchableOpacity>

          {/* Server info */}
          <View style={styles.serverInfo}>
            <Text style={styles.serverInfoLabel}>CONNECTING TO</Text>
            <Text style={styles.serverInfoValue} numberOfLines={1}>
              {serverUrl}
            </Text>
          </View>

          {/* Step indicator */}
          <View style={styles.footer}>
            <View style={styles.stepIndicator}>
              <View style={[styles.stepDot, styles.stepDone]} />
              <View style={[styles.stepLine, styles.stepLineDone]} />
              <View style={[styles.stepDot, styles.stepDone]} />
              <View style={[styles.stepLine, styles.stepLineDone]} />
              <View style={[styles.stepDot, styles.stepActive]} />
              <View style={styles.stepLine} />
              <View style={styles.stepDot} />
            </View>
            <Text style={styles.stepLabel}>Step 3 of 4</Text>
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
  },

  // Session timer
  sessionTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  sessionTimerLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 2,
  },
  sessionTimerValue: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.cyan,
    fontFamily: 'monospace',
  },

  // Form
  form: {
    marginBottom: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 3,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 2,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
    fontFamily: 'monospace',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  passwordRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleBtn: {
    backgroundColor: colors.bgCard,
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

  // Continue button
  continueBtn: {
    backgroundColor: colors.cyan,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.cyan,
    marginBottom: spacing.lg,
  },
  continueBtnDisabled: {
    opacity: 0.4,
  },
  continueBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.bg,
    letterSpacing: 2,
  },

  // Server info
  serverInfo: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  serverInfoLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 3,
    marginBottom: 2,
  },
  serverInfoValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.textSecondary,
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
    backgroundColor: colors.accent,
    borderColor: colors.accent,
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
