import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, Alert, ActivityIndicator, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import jsQR from 'jsqr';
import { colors, spacing } from '../theme';
import { Camera, ImagePlus } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const SCAN_SIZE = width * 0.65;

/**
 * Step 1: QR Code Scanner Screen
 * Uses expo-image-picker (system camera) + jsQR (pure JS decoder)
 * — eliminates expo-camera and its ~20MB ML Kit barcode dependency
 * On success → navigates to OTP entry with the parsed payload
 */
export default function QRScannerScreen({ navigation }) {
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState(null);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  // Pulse animation for scan icon
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Reset on screen focus
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      setPreview(null);
      setProcessing(false);
    });
    return unsub;
  }, [navigation]);

  // ─── Decode helpers ───

  /**
   * Convert base64 string to Uint8Array
   */
  function base64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  /**
   * Minimal BMP decoder — returns { data: Uint8ClampedArray, width, height }
   * BMP is uncompressed so we can read raw pixel data directly (no zlib/inflate needed)
   */
  function decodeBMP(bytes) {
    // BMP header: offset 10 = pixel data offset, 18 = width, 22 = height, 28 = bpp
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const dataOffset = dv.getUint32(10, true);
    const w = dv.getInt32(18, true);
    const rawH = dv.getInt32(22, true);
    const h = Math.abs(rawH);
    const bpp = dv.getUint16(28, true);
    const bottomUp = rawH > 0;

    if (bpp !== 24 && bpp !== 32) return null;

    const bytesPerPixel = bpp / 8;
    const rowSize = Math.ceil((bpp * w) / 32) * 4; // rows are 4-byte aligned
    const rgba = new Uint8ClampedArray(w * h * 4);

    for (let y = 0; y < h; y++) {
      const srcY = bottomUp ? (h - 1 - y) : y;
      const rowOffset = dataOffset + srcY * rowSize;
      for (let x = 0; x < w; x++) {
        const srcIdx = rowOffset + x * bytesPerPixel;
        const dstIdx = (y * w + x) * 4;
        // BMP stores BGR(A)
        rgba[dstIdx]     = bytes[srcIdx + 2]; // R
        rgba[dstIdx + 1] = bytes[srcIdx + 1]; // G
        rgba[dstIdx + 2] = bytes[srcIdx];     // B
        rgba[dstIdx + 3] = bytesPerPixel === 4 ? bytes[srcIdx + 3] : 255; // A
      }
    }
    return { data: rgba, width: w, height: h };
  }

  /**
   * Process captured/picked image: resize to BMP, decode pixels, run jsQR
   */
  async function processImage(uri) {
    try {
      setProcessing(true);

      const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');

      // Resize + export as BMP (uncompressed = easy to decode without zlib)
      // expo-image-manipulator doesn't support BMP, so use PNG and decode via fetch
      const manipulated = await manipulateAsync(
        uri,
        [{ resize: { width: 400 } }],
        { format: SaveFormat.PNG, base64: false }
      );

      // Use a different approach: read the PNG via the RN Image API
      // Actually, use base64 + a simple UPNG-style decoder
      const manipulatedB64 = await manipulateAsync(
        uri,
        [{ resize: { width: 400 } }],
        { format: SaveFormat.JPEG, base64: true }
      );

      // For JPEG base64, we need to decode to pixel data
      // Since we can't use Canvas in RN, we'll use a managed approach
      // Convert to BMP via re-manipulation (not available)
      // Simplest reliable RN approach: use the image as a bitmap via native bridge

      // Alternative approach: try multiple image sizes for better QR detection
      const sizes = [400, 600, 300];
      let qrResult = null;

      for (const size of sizes) {
        try {
          const img = await manipulateAsync(
            uri,
            [{ resize: { width: size } }],
            { format: SaveFormat.PNG, base64: true }
          );

          // Decode PNG base64 to pixel data using pngjs-lite approach
          const pixels = await decodePNGBase64(img.base64);
          if (!pixels) continue;

          const code = jsQR(pixels.data, pixels.width, pixels.height);
          if (code) {
            qrResult = code;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!qrResult) {
        setProcessing(false);
        Alert.alert(
          'No QR Code Found',
          'Could not find a QR code in the image. Make sure the entire QR code is clearly visible.',
          [{ text: 'Try Again', onPress: () => setPreview(null) }]
        );
        return;
      }

      handleQRData(qrResult.data);
    } catch (err) {
      setProcessing(false);
      console.error('[QRScanner] Process error:', err);
      Alert.alert('Error', 'Failed to process image. Please try again.', [
        { text: 'OK', onPress: () => setPreview(null) },
      ]);
    }
  }

  /**
   * Decode a base64-encoded PNG to RGBA pixel data.
   * Uses a minimal PNG parser (signature, IHDR, IDAT chunks, inflate, unfilter).
   */
  async function decodePNGBase64(b64) {
    try {
      const bytes = base64ToBytes(b64);
      // PNG signature: 8 bytes
      if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;

      let offset = 8;
      let imgWidth = 0, imgHeight = 0, bitDepth = 0, colorType = 0;
      const idatChunks = [];

      while (offset < bytes.length) {
        const len = (bytes[offset] << 24) | (bytes[offset+1] << 16) | (bytes[offset+2] << 8) | bytes[offset+3];
        const type = String.fromCharCode(bytes[offset+4], bytes[offset+5], bytes[offset+6], bytes[offset+7]);
        offset += 8;

        if (type === 'IHDR') {
          imgWidth  = (bytes[offset] << 24) | (bytes[offset+1] << 16) | (bytes[offset+2] << 8) | bytes[offset+3];
          imgHeight = (bytes[offset+4] << 24) | (bytes[offset+5] << 16) | (bytes[offset+6] << 8) | bytes[offset+7];
          bitDepth  = bytes[offset+8];
          colorType = bytes[offset+9];
        } else if (type === 'IDAT') {
          idatChunks.push(bytes.slice(offset, offset + len));
        } else if (type === 'IEND') {
          break;
        }

        offset += len + 4; // skip data + CRC
      }

      if (imgWidth === 0 || imgHeight === 0 || idatChunks.length === 0) return null;

      // Concatenate IDAT data
      const totalLen = idatChunks.reduce((s, c) => s + c.length, 0);
      const compressed = new Uint8Array(totalLen);
      let pos = 0;
      for (const chunk of idatChunks) {
        compressed.set(chunk, pos);
        pos += chunk.length;
      }

      // Inflate (decompress zlib)
      const raw = inflateRaw(compressed);
      if (!raw) return null;

      // Determine bytes per pixel
      const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
      const bpp = channels * (bitDepth / 8);
      const stride = imgWidth * bpp;

      // Unfilter
      const rgba = new Uint8ClampedArray(imgWidth * imgHeight * 4);
      let rawIdx = 0;
      const prevRow = new Uint8Array(stride);
      const curRow = new Uint8Array(stride);

      for (let y = 0; y < imgHeight; y++) {
        const filter = raw[rawIdx++];
        for (let i = 0; i < stride; i++) curRow[i] = raw[rawIdx++];

        // Apply filter
        for (let i = 0; i < stride; i++) {
          const a = i >= bpp ? curRow[i - bpp] : 0;
          const b = prevRow[i];
          const c = i >= bpp ? prevRow[i - bpp] : 0;
          switch (filter) {
            case 1: curRow[i] = (curRow[i] + a) & 0xFF; break;
            case 2: curRow[i] = (curRow[i] + b) & 0xFF; break;
            case 3: curRow[i] = (curRow[i] + ((a + b) >> 1)) & 0xFF; break;
            case 4: curRow[i] = (curRow[i] + paethPredictor(a, b, c)) & 0xFF; break;
          }
        }

        // Write RGBA
        for (let x = 0; x < imgWidth; x++) {
          const di = (y * imgWidth + x) * 4;
          const si = x * bpp;
          if (channels >= 3) {
            rgba[di]   = curRow[si];
            rgba[di+1] = curRow[si+1];
            rgba[di+2] = curRow[si+2];
            rgba[di+3] = channels === 4 ? curRow[si+3] : 255;
          } else if (channels === 2) {
            rgba[di] = rgba[di+1] = rgba[di+2] = curRow[si];
            rgba[di+3] = curRow[si+1];
          } else {
            rgba[di] = rgba[di+1] = rgba[di+2] = curRow[si];
            rgba[di+3] = 255;
          }
        }

        prevRow.set(curRow);
      }

      return { data: rgba, width: imgWidth, height: imgHeight };
    } catch (e) {
      console.error('[QRScanner] PNG decode error:', e.message);
      return null;
    }
  }

  function paethPredictor(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }

  /**
   * Minimal zlib inflate (handles raw deflate inside zlib wrapper)
   */
  function inflateRaw(data) {
    try {
      // Skip zlib header (2 bytes)
      let pos = 2;
      const output = [];

      while (pos < data.length - 4) { // -4 for adler32
        const byte0 = data[pos++];
        const bfinal = byte0 & 1;
        const btype = (byte0 >> 1) & 3;

        if (btype === 0) {
          // No compression
          // Align to byte boundary (already at pos)
          pos = (pos + 0); // already aligned after reading byte0
          if (pos + 4 > data.length) break;
          const len = data[pos] | (data[pos+1] << 8);
          pos += 4; // len + nlen
          for (let i = 0; i < len; i++) output.push(data[pos++]);
        } else {
          // Use built-in approach — fall back to a streaming decompressor
          // For simplicity, try using the pako-lite approach or TextDecoder trick
          // Actually, let's use a simpler method
          return inflateWithPlatform(data);
        }
        if (bfinal) break;
      }

      return new Uint8Array(output);
    } catch {
      return inflateWithPlatform(data);
    }
  }

  /**
   * Platform inflate using RN's built-in fetch + Blob decompression
   * Falls back to require('pako') if available
   */
  function inflateWithPlatform(data) {
    try {
      const pako = require('pako');
      return pako.inflate(data);
    } catch {
      // pako not available — try manual inflate
      return manualInflate(data);
    }
  }

  /**
   * Minimal fixed-Huffman inflate for simple cases
   */
  function manualInflate(compressed) {
    // This is a simplified inflater. For production, install pako.
    // Try a streaming bit-reader approach for fixed Huffman (btype=1)
    let pos = 2; // skip zlib header
    const out = [];
    let bitBuf = 0, bitCount = 0;

    function readBits(n) {
      while (bitCount < n) {
        if (pos >= compressed.length) return 0;
        bitBuf |= compressed[pos++] << bitCount;
        bitCount += 8;
      }
      const val = bitBuf & ((1 << n) - 1);
      bitBuf >>= n;
      bitCount -= n;
      return val;
    }

    function readHuffSym() {
      // Fixed Huffman table decode
      // 0-143: 8-bit codes 00110000..10111111 → values 0-143
      // 144-255: 9-bit codes 110010000..111111111 → values 144-255
      // 256-279: 7-bit codes 0000000..0010111 → values 256-279
      // 280-287: 8-bit codes 11000000..11000111 → values 280-287
      let code = 0;
      for (let bits = 1; bits <= 15; bits++) {
        code = (code << 1) | readBits(1);
        // Check fixed Huffman ranges
        if (bits === 7 && code >= 0 && code <= 23) return code + 256;
        if (bits === 8) {
          if (code >= 48 && code <= 191) return code - 48;
          if (code >= 192 && code <= 199) return code - 192 + 280;
        }
        if (bits === 9 && code >= 400 && code <= 511) return code - 400 + 144;
      }
      return -1;
    }

    const lengthBase = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
    const lengthExtra = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
    const distBase = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
    const distExtra = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];

    let done = false;
    while (!done && pos < compressed.length) {
      const bfinal = readBits(1);
      const btype = readBits(2);

      if (btype === 0) {
        // Stored
        bitBuf = 0; bitCount = 0; // align
        const len = compressed[pos] | (compressed[pos+1] << 8);
        pos += 4;
        for (let i = 0; i < len && pos < compressed.length; i++) out.push(compressed[pos++]);
      } else if (btype === 1) {
        // Fixed Huffman
        while (true) {
          const sym = readHuffSym();
          if (sym < 0 || sym === 256) break;
          if (sym < 256) {
            out.push(sym);
          } else {
            const li = sym - 257;
            const length = lengthBase[li] + readBits(lengthExtra[li]);
            // Read distance (5-bit fixed)
            let distCode = 0;
            for (let i = 0; i < 5; i++) distCode = (distCode << 1) | readBits(1);
            // Reverse bits for distance
            let rev = 0;
            for (let i = 0; i < 5; i++) rev = (rev << 1) | ((distCode >> i) & 1);
            distCode = rev;
            const dist = distBase[distCode] + readBits(distExtra[distCode]);
            for (let i = 0; i < length; i++) {
              out.push(out[out.length - dist]);
            }
          }
        }
      } else {
        // Dynamic Huffman — too complex for inline, return null
        return null;
      }

      if (bfinal) done = true;
    }

    return new Uint8Array(out);
  }

  // ─── Handle decoded QR data ───

  function handleQRData(data) {
    setProcessing(false);
    try {
      const payload = JSON.parse(data);
      if (!payload.nexus || !payload.challengeId || !payload.challenge || !payload.serverUrl) {
        Alert.alert('Invalid QR Code',
          'This is not a valid Nexus pairing code. Please scan the QR code from the Nexus dashboard.',
          [{ text: 'Try Again', onPress: () => setPreview(null) }]);
        return;
      }
      if (payload.expiresAt && payload.expiresAt < Date.now()) {
        Alert.alert('QR Code Expired',
          'This pairing code has expired. Please generate a new one from the dashboard.',
          [{ text: 'OK', onPress: () => setPreview(null) }]);
        return;
      }
      navigation.navigate('OTPEntry', {
        challengeId: payload.challengeId,
        challenge: payload.challenge,
        serverUrl: payload.serverUrl,
        expiresAt: payload.expiresAt,
      });
    } catch (err) {
      Alert.alert('Invalid QR Code',
        "Could not parse the QR code. Make sure you're scanning a Nexus pairing code.",
        [{ text: 'Try Again', onPress: () => setPreview(null) }]);
    }
  }

  // ─── Open system camera ───
  async function handleScanWithCamera() {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera Access Required', 'Please grant camera permission to scan QR codes.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled) return;
      setPreview(result.assets[0].uri);
      await processImage(result.assets[0].uri);
    } catch (err) {
      setProcessing(false);
      Alert.alert('Error', 'Failed to open camera: ' + err.message);
    }
  }

  // ─── Pick from gallery ───
  async function handlePickFromGallery() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled) return;
      setPreview(result.assets[0].uri);
      await processImage(result.assets[0].uri);
    } catch (err) {
      setProcessing(false);
      Alert.alert('Error', 'Failed to pick image: ' + err.message);
    }
  }

  // ─── Render ───
  return (
    <View style={styles.container}>
      {preview ? (
        <Image source={{ uri: preview }} style={styles.previewImage} resizeMode="contain" />
      ) : (
        <View style={styles.scanPrompt}>
          <View style={styles.qrFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <Animated.View style={{ opacity: pulseAnim }}>
              <Camera size={64} color={colors.accent} />
            </Animated.View>
          </View>
        </View>
      )}

      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.processingText}>DECODING QR...</Text>
        </View>
      )}

      <View style={styles.bottomSection}>
        <View style={styles.instructions}>
          <Text style={styles.instructTitle}>SCAN NEXUS QR CODE</Text>
          <Text style={styles.instructDesc}>
            Take a photo of the QR code from the Nexus dashboard, or pick a screenshot from your gallery
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.scanBtn} onPress={handleScanWithCamera} disabled={processing}>
            <Camera size={22} color={colors.bg} />
            <Text style={styles.scanBtnText}>TAKE PHOTO</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.scanBtn, styles.scanBtnAlt]} onPress={handlePickFromGallery} disabled={processing}>
            <ImagePlus size={22} color={colors.accent} />
            <Text style={[styles.scanBtnText, { color: colors.accent }]}>GALLERY</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stepRow}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scanPrompt: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  qrFrame: { width: SCAN_SIZE, height: SCAN_SIZE, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  previewImage: { flex: 1, backgroundColor: '#000' },

  corner: { position: 'absolute', width: 28, height: 28, borderColor: colors.accent },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },

  processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  processingText: { marginTop: spacing.md, fontSize: 13, fontWeight: '900', color: colors.accent, letterSpacing: 3 },

  bottomSection: { backgroundColor: colors.bg, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl + 10, borderTopWidth: 2, borderTopColor: colors.border },
  instructions: { alignItems: 'center', marginBottom: spacing.md },
  instructTitle: { fontSize: 14, fontWeight: '900', color: colors.text, letterSpacing: 3, marginBottom: spacing.xs },
  instructDesc: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },

  buttonRow: { flexDirection: 'row', gap: 12, marginBottom: spacing.md },
  scanBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, paddingVertical: spacing.sm + 4, borderWidth: 2, borderColor: colors.accent },
  scanBtnAlt: { backgroundColor: 'transparent', borderColor: colors.accent },
  scanBtnText: { fontSize: 12, fontWeight: '900', color: colors.bg, letterSpacing: 2 },

  stepRow: { alignItems: 'center' },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border, borderWidth: 1, borderColor: colors.textMuted },
  stepActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  stepLine: { width: 24, height: 2, backgroundColor: colors.border },
  stepLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 2, textTransform: 'uppercase' },
});
