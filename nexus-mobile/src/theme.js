// Nexus Mobile — Synthwave / Brutalist Theme
// Matches the dashboard's Midnight Hacker preset

import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_WIDTH = 375; // iPhone design base

// Scale a value proportionally to screen width
export function scale(size) {
  return Math.round((SCREEN_WIDTH / BASE_WIDTH) * size);
}

// Scale font size with a moderate factor (less aggressive than full scale)
export function fontScale(size) {
  const factor = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size * Math.min(factor, 1.3); // cap at 1.3x
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

// Moderate scale for spacing/padding (between scale and fontScale)
export function moderateScale(size, factor = 0.5) {
  return Math.round(size + (scale(size) - size) * factor);
}

export { SCREEN_WIDTH, SCREEN_HEIGHT };

export const colors = {
  bg: '#0a0a0a',
  bgCard: '#141414',
  bgSecondary: '#111111',
  bgInput: '#1a1a1a',

  accent: '#00ff41',       // neon green (primary)
  cyan: '#00d4aa',         // neon cyan
  pink: '#ff2d7b',         // neon pink
  purple: '#a855f7',       // neon purple
  yellow: '#fbbf24',       // neon yellow
  orange: '#ff9500',       // accent4

  text: '#e0e0e0',
  textSecondary: '#888888',
  textMuted: '#555555',

  danger: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',

  border: '#222222',
  borderLight: '#333333',
};

export const fonts = {
  mono: 'monospace',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
