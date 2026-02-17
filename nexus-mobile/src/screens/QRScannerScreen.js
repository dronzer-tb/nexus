import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, Alert, Platform, Linking,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, spacing } from '../theme';

const { width } = Dimensions.get('window');
const SCAN_SIZE = width * 0.7;

/**
 * Step 1: QR Code Scanner Screen
 * Scans the Nexus pairing QR code from the dashboard
 * On success → navigates to OTP entry with the parsed payload
 */
export default function QRScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Scan line animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanLineAnim]);

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);

    try {
      const payload = JSON.parse(data);

      // Validate it's a Nexus pairing QR
      if (!payload.nexus || !payload.challengeId || !payload.challenge || !payload.serverUrl) {
        Alert.alert(
          'Invalid QR Code',
          'This is not a valid Nexus pairing code. Please scan the QR code from the Nexus dashboard.',
          [{ text: 'Try Again', onPress: () => setScanned(false) }]
        );
        return;
      }

      // Check expiry
      if (payload.expiresAt && payload.expiresAt < Date.now()) {
        Alert.alert(
          'QR Code Expired',
          'This pairing code has expired. Please generate a new one from the dashboard.',
          [{ text: 'OK', onPress: () => setScanned(false) }]
        );
        return;
      }

      // Navigate to OTP entry with the payload
      navigation.navigate('OTPEntry', {
        challengeId: payload.challengeId,
        challenge: payload.challenge,
        serverUrl: payload.serverUrl,
        expiresAt: payload.expiresAt,
      });

    } catch (err) {
      Alert.alert(
        'Invalid QR Code',
        'Could not parse the QR code. Make sure you\'re scanning a Nexus pairing code.',
        [{ text: 'Try Again', onPress: () => setScanned(false) }]
      );
    }
  };

  // Reset scanned state when screen comes back into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setScanned(false);
    });
    return unsubscribe;
  }, [navigation]);

  // Permission handling
  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Checking camera permission...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.icon}>📷</Text>
          <Text style={styles.permTitle}>Camera Access Required</Text>
          <Text style={styles.permDesc}>
            We need camera access to scan the pairing QR code from the Nexus dashboard.
          </Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Grant Access</Text>
          </TouchableOpacity>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.permBtn, styles.permBtnSecondary]}
              onPress={() => Linking.openSettings()}
            >
              <Text style={[styles.permBtnText, { color: colors.textSecondary }]}>
                Open Settings
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCAN_SIZE - 4],
  });

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top */}
        <View style={styles.overlaySection} />

        {/* Middle row */}
        <View style={styles.middleRow}>
          <View style={styles.overlaySection} />

          {/* Scan window */}
          <View style={styles.scanWindow}>
            {/* Corners */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Scanning line */}
            {!scanned && (
              <Animated.View
                style={[
                  styles.scanLine,
                  { transform: [{ translateY: scanLineTranslate }] },
                ]}
              />
            )}
          </View>

          <View style={styles.overlaySection} />
        </View>

        {/* Bottom */}
        <View style={[styles.overlaySection, styles.bottomSection]}>
          <View style={styles.instructions}>
            <Text style={styles.instructTitle}>SCAN NEXUS QR CODE</Text>
            <Text style={styles.instructDesc}>
              Point your camera at the QR code shown on the Nexus dashboard
            </Text>

            <View style={styles.stepIndicator}>
              <View style={[styles.stepDot, styles.stepActive]} />
              <View style={styles.stepLine} />
              <View style={styles.stepDot} />
              <View style={styles.stepLine} />
              <View style={styles.stepDot} />
              <View style={styles.stepLine} />
              <View style={styles.stepDot} />
            </View>
            <Text style={styles.stepLabel}>Step 1 of 4</Text>
          </View>

          {scanned && (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => setScanned(false)}
            >
              <Text style={styles.retryBtnText}>SCAN AGAIN</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },

  // Permission
  icon: { fontSize: 64, marginBottom: spacing.lg },
  permTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  permDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
    maxWidth: 280,
  },
  permBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 4,
    borderWidth: 2,
    borderColor: colors.accent,
    marginBottom: spacing.sm,
    width: '100%',
    maxWidth: 260,
    alignItems: 'center',
  },
  permBtnSecondary: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  permBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.bg,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlaySection: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  middleRow: {
    flexDirection: 'row',
    height: SCAN_SIZE,
  },
  scanWindow: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    position: 'relative',
  },

  // Corners
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: colors.accent,
  },
  cornerTL: {
    top: 0, left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 0, right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 0, left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 0, right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },

  // Scan line
  scanLine: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 2,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },

  // Bottom instructions
  bottomSection: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  instructions: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  instructTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 3,
    marginBottom: spacing.xs,
  },
  instructDesc: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.md,
  },

  // Step indicator
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
  stepActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  stepLine: {
    width: 24,
    height: 2,
    backgroundColor: colors.border,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  retryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.bg,
    letterSpacing: 2,
  },
});
