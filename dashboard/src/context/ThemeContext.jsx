import { createContext, useContext, useState, useLayoutEffect, useEffect, useCallback } from 'react';

/* ─── Helpers ─── */
export const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0 0 0';
  return `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`;
};

export const luminance = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 0;
  return (0.299 * parseInt(result[1], 16) + 0.587 * parseInt(result[2], 16) + 0.114 * parseInt(result[3], 16)) / 255;
};

/* ─── Built-in Presets ─── */
export const BUILT_IN_PRESETS = {
  dark: {
    id: 'dark',
    name: 'Midnight Hacker',
    isBuiltIn: true,
    colors: {
      bgPrimary: '#0a0a0a',
      bgSecondary: '#0f0f0f',
      bgCard: '#161616',
      accent1: '#00ff41',
      accent2: '#00d4aa',
      accent3: '#a0ff00',
      accent4: '#ff9500',
      text: '#c8c8c8',
      textSecondary: '#555555',
      textMuted: '#2a2a2a',
      danger: '#ff1744',
      success: '#00ff41',
    }
  },
  light: {
    id: 'light',
    name: 'Pastel Mocha',
    isBuiltIn: true,
    colors: {
      bgPrimary: '#f9f3ed',
      bgSecondary: '#f0e6d8',
      bgCard: '#ffffff',
      accent1: '#b07d62',
      accent2: '#8a9e82',
      accent3: '#9b8bb4',
      accent4: '#c9a96e',
      text: '#3a2d23',
      textSecondary: '#7a6b5d',
      textMuted: '#d4c4b4',
      danger: '#c47272',
      success: '#8a9e82',
    }
  }
};

export const COLOR_LABELS = {
  bgPrimary: 'Background',
  bgSecondary: 'Surface',
  bgCard: 'Card',
  accent1: 'Accent 1 (Primary)',
  accent2: 'Accent 2 (Secondary)',
  accent3: 'Accent 3 (Tertiary)',
  accent4: 'Accent 4 (Highlight)',
  text: 'Text Primary',
  textSecondary: 'Text Secondary',
  textMuted: 'Text Muted',
  danger: 'Danger / Error',
  success: 'Success / Online',
};

const STORAGE_KEY = 'nexus-theme';
const PRESETS_KEY = 'nexus-user-presets';
const MAX_USER_PRESETS = 5;

/* ─── Apply theme CSS variables to DOM ─── */
const applyThemeToDOM = (theme) => {
  const root = document.documentElement;
  const c = theme.colors;

  const setVar = (name, hex) => {
    root.style.setProperty(name, hex);
    root.style.setProperty(`${name}-rgb`, hexToRgb(hex));
  };

  // Backgrounds
  setVar('--brutal-bg', c.bgPrimary);
  setVar('--brutal-surface', c.bgSecondary);
  setVar('--brutal-card', c.bgCard);

  // Accents
  setVar('--neon-pink', c.accent1);
  setVar('--neon-cyan', c.accent2);
  setVar('--neon-purple', c.accent3);
  setVar('--neon-yellow', c.accent4);

  // Text
  setVar('--theme-text', c.text);
  setVar('--theme-text-secondary', c.textSecondary);
  setVar('--theme-text-muted', c.textMuted);

  // Status
  setVar('--theme-danger', c.danger);
  setVar('--theme-success', c.success);

  // Computed: contrast text for on-accent backgrounds
  root.style.setProperty('--on-primary', luminance(c.accent1) > 0.5 ? '#000000' : '#ffffff');
  root.style.setProperty('--on-neon-pink', luminance(c.accent1) > 0.5 ? '#000000' : '#ffffff');
  root.style.setProperty('--on-neon-cyan', luminance(c.accent2) > 0.5 ? '#000000' : '#ffffff');
  root.style.setProperty('--on-neon-purple', luminance(c.accent3) > 0.5 ? '#000000' : '#ffffff');
  root.style.setProperty('--on-neon-yellow', luminance(c.accent4) > 0.5 ? '#000000' : '#ffffff');

  // Legacy aliases
  root.style.setProperty('--accent-1', c.accent1);
  root.style.setProperty('--accent-2', c.accent2);
  root.style.setProperty('--accent-3', c.accent3);
  root.style.setProperty('--accent-4', c.accent4);
  root.style.setProperty('--primary', c.accent1);
};

/* ─── Context ─── */
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.colors) return parsed;
      }
    } catch { /* use default */ }
    return BUILT_IN_PRESETS.dark;
  });

  const [userPresets, setUserPresets] = useState(() => {
    try {
      const saved = localStorage.getItem(PRESETS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* use default */ }
    return [];
  });

  // Apply theme before paint (prevents flash)
  useLayoutEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  // Persist to localStorage (async)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(userPresets));
  }, [userPresets]);

  const setTheme = useCallback((t) => setThemeState(t), []);

  const updateColor = useCallback((key, value) => {
    setThemeState(prev => ({
      ...prev,
      isBuiltIn: false,
      name: prev.isBuiltIn ? 'Custom' : prev.name,
      colors: { ...prev.colors, [key]: value }
    }));
  }, []);

  const loadBuiltIn = useCallback((id) => {
    if (BUILT_IN_PRESETS[id]) setThemeState(BUILT_IN_PRESETS[id]);
  }, []);

  const loadUserPreset = useCallback((index) => {
    if (userPresets[index]) setThemeState(userPresets[index]);
  }, [userPresets]);

  const saveUserPreset = useCallback((name) => {
    if (userPresets.length >= MAX_USER_PRESETS) return false;
    setUserPresets(prev => [...prev, { ...theme, name, isBuiltIn: false }]);
    return true;
  }, [theme, userPresets.length]);

  const deleteUserPreset = useCallback((index) => {
    setUserPresets(prev => prev.filter((_, i) => i !== index));
  }, []);

  const overwriteUserPreset = useCallback((index) => {
    setUserPresets(prev => prev.map((p, i) =>
      i === index ? { ...theme, name: p.name, isBuiltIn: false } : p
    ));
  }, [theme]);

  return (
    <ThemeContext.Provider value={{
      theme,
      userPresets,
      setTheme,
      updateColor,
      loadBuiltIn,
      loadUserPreset,
      saveUserPreset,
      deleteUserPreset,
      overwriteUserPreset,
      maxUserPresets: MAX_USER_PRESETS,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
