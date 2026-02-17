import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing } from '../theme';
import { validateOTP } from '../api';

const OTP_LENGTH = 6;

/**
 * Step 2: OTP Entry Screen
 * User enters the 6-digit OTP shown on the dashboard
 * On success → navigates to Login screen with tempToken
 */
export default function OTPEntryScreen({ route, navigation }) {
  const { challengeId, challenge, serverUrl, expiresAt } = route.params;

  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(
    Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
  );

  const inputRefs = useRef([]);
  const timerRef = useRef(null);
  const otpVerifiedRef = useRef(false);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      // Don't fire expiry if OTP was already verified
      if (otpVerifiedRef.current) {
        clearInterval(timerRef.current);
        return;
      }

      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        Alert.alert(
          'OTP Expired',
          'The pairing code has expired. Please generate a new one from the dashboard.',
          [{ text: 'OK', onPress: () => navigation.popToTop() }]
        );
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [expiresAt, navigation]);

  const handleDigitChange = (text, index) => {
    // Only accept digits
    const digit = text.replace(/[^0-9]/g, '').slice(-1);

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError(null);

    // Auto-advance to next input
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    if (digit && index === OTP_LENGTH - 1 && newOtp.every(d => d)) {
      submitOTP(newOtp.join(''));
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  const submitOTP = async (otpString) => {
    if (loading) return;

    const code = otpString || otp.join('');
    if (code.length !== OTP_LENGTH) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await validateOTP(serverUrl, challengeId, challenge, code);

      // Stop the OTP countdown — it's no longer relevant
      otpVerifiedRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to login with tempToken
      navigation.navigate('Login', {
        serverUrl,
        tempToken: result.tempToken,
        tokenExpiresIn: result.expiresIn,
      });

    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      const msg = err.response?.data?.error || err.message || 'OTP validation failed';
      const attemptsRemaining = err.response?.data?.attemptsRemaining;

      setError(msg);

      // Clear OTP on error
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();

      // If max attempts reached, go back
      if (err.response?.status === 429) {
        Alert.alert('Too Many Attempts', msg, [
          { text: 'OK', onPress: () => navigation.popToTop() },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const isUrgent = timeRemaining <= 15;
  const progress = (timeRemaining / 60) * 100;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🔢</Text>
          <Text style={styles.title}>ENTER OTP</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code shown on the{'\n'}Nexus dashboard
          </Text>
        </View>

        {/* Timer */}
        <View style={[
          styles.timerContainer,
          isUrgent && styles.timerUrgent,
        ]}>
          <Text style={[styles.timerLabel, isUrgent && { color: colors.danger }]}>
            ⏱ EXPIRES IN
          </Text>
          <Text style={[styles.timerValue, isUrgent && { color: colors.danger }]}>
            {timeRemaining}s
          </Text>
          <View style={styles.timerBar}>
            <View
              style={[
                styles.timerBarFill,
                { width: `${progress}%` },
                isUrgent && { backgroundColor: colors.danger },
              ]}
            />
          </View>
        </View>

        {/* OTP Input */}
        <View style={styles.otpContainer}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => (inputRefs.current[i] = ref)}
              style={[
                styles.otpInput,
                digit && styles.otpInputFilled,
                error && styles.otpInputError,
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

        {/* Error */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>✗ {error}</Text>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={() => submitOTP()}
          disabled={loading || otp.some(d => !d)}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.bg} />
          ) : (
            <Text style={styles.submitBtnText}>VERIFY OTP</Text>
          )}
        </TouchableOpacity>

        {/* Step indicator */}
        <View style={styles.footer}>
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, styles.stepDone]} />
            <View style={[styles.stepLine, styles.stepLineDone]} />
            <View style={[styles.stepDot, styles.stepActive]} />
            <View style={styles.stepLine} />
            <View style={styles.stepDot} />
            <View style={styles.stepLine} />
            <View style={styles.stepDot} />
          </View>
          <Text style={styles.stepLabel}>Step 2 of 4</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
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

  // Timer
  timerContainer: {
    backgroundColor: colors.bgCard,
    borderWidth: 2,
    borderColor: colors.cyan + '30',
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  timerUrgent: {
    borderColor: colors.danger + '60',
    backgroundColor: colors.danger + '08',
  },
  timerLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.cyan,
    letterSpacing: 3,
    marginBottom: 4,
  },
  timerValue: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.cyan,
    fontFamily: 'monospace',
    marginBottom: spacing.sm,
  },
  timerBar: {
    height: 4,
    width: '100%',
    backgroundColor: colors.bg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  timerBarFill: {
    height: '100%',
    backgroundColor: colors.cyan,
    borderRadius: 2,
  },

  // OTP Input
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: spacing.md,
  },
  otpInput: {
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
  otpInputFilled: {
    borderColor: colors.accent + '60',
    backgroundColor: colors.accent + '08',
  },
  otpInputError: {
    borderColor: colors.danger + '60',
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
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.bg,
    letterSpacing: 3,
  },

  // Footer / Steps
  footer: {
    alignItems: 'center',
    marginTop: spacing.xl,
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
