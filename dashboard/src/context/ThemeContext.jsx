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
  },
  readyPlayerOne: {
    id: 'readyPlayerOne',
    name: 'Ready Player One',
    isBuiltIn: true,
    colors: {
      bgPrimary: '#1a1a1a',
      bgSecondary: '#2a2a2a',
      bgCard: '#1f1f1f',
      accent1: '#ff6b35',
      accent2: '#f7931e',
      accent3: '#ffd23f',
      accent4: '#00d9ff',
      text: '#e8e8e8',
      textSecondary: '#b8b8b8',
      textMuted: '#888888',
      danger: '#ff3864',
      success: '#00ff88',
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
const MAX_USER_PRESETS = 10;

/* ─── Apply theme CSS variables to DOM ─── */
const applyThemeToDOM = (theme) => {
  const root = document.documentElement;
  const c = theme.colors;

  const setVar = (name, hex) => {
    root.style.setProperty(name, hex);
    root.style.setProperty(`${name}-rgb`, hexToRgb(hex));
  };

  setVar('--brutal-bg', c.bgPrimary);
  setVar('--brutal-surface', c.bgSecondary);
  setVar('--brutal-card', c.bgCard);
  setVar('--neon-pink', c.accent1);
  setVar('--neon-cyan', c.accent2);
  setVar('--neon-purple', c.accent3);
  setVar('--neon-yellow', c.accent4);
  setVar('--theme-text', c.text);
  setVar('--theme-text-secondary', c.textSecondary);
  setVar('--theme-text-muted', c.textMuted);
  setVar('--theme-danger', c.danger);
  setVar('--theme-success', c.success);

  root.style.setProperty('--on-primary', luminance(c.accent1) > 0.5 ? '#000000' : '#ffffff');
  root.style.setProperty('--on-neon-pink', luminance(c.accent1) > 0.5 ? '#000000' : '#ffffff');
  root.style.setProperty('--on-neon-cyan', luminance(c.accent2) > 0.5 ? '#000000' : '#ffffff');
  root.style.setProperty('--on-neon-purple', luminance(c.accent3) > 0.5 ? '#000000' : '#ffffff');
  root.style.setProperty('--on-neon-yellow', luminance(c.accent4) > 0.5 ? '#000000' : '#ffffff');

  root.style.setProperty('--accent-1', c.accent1);
  root.style.setProperty('--accent-2', c.accent2);
  root.style.setProperty('--accent-3', c.accent3);
  root.style.setProperty('--accent-4', c.accent4);
  root.style.setProperty('--primary', c.accent1);
};

/* ─── Context ─── */
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // Active theme = what's applied to the whole site
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

  // Draft theme = what's being edited in the theme creator (NOT auto-applied to site)
  const [draft, setDraft] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.colors) return { ...parsed };
      }
    } catch { /* use default */ }
    return { ...BUILT_IN_PRESETS.dark };
  });

  // Track which preset is being edited (null = new theme)
  const [editingPresetIndex, setEditingPresetIndex] = useState(null);

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

  // Apply ACTIVE theme to DOM (not draft)
  useLayoutEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  // Persist active theme
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(userPresets));
  }, [userPresets]);

  const setTheme = useCallback((t) => setThemeState(t), []);

  // Update a color in the DRAFT only (preview only, not applied to site)
  const updateDraftColor = useCallback((key, value) => {
    setDraft(prev => ({
      ...prev,
      isBuiltIn: false,
      name: prev.isBuiltIn ? 'Custom' : prev.name,
      colors: { ...prev.colors, [key]: value }
    }));
  }, []);

  // Legacy: update color and apply immediately (backwards compat)
  const updateColor = useCallback((key, value) => {
    setThemeState(prev => ({
      ...prev,
      isBuiltIn: false,
      name: prev.isBuiltIn ? 'Custom' : prev.name,
      colors: { ...prev.colors, [key]: value }
    }));
  }, []);

  // Apply the draft as the active theme (user clicks "Apply Theme")
  const applyDraft = useCallback(() => {
    setThemeState({ ...draft });
  }, [draft]);

  // Load a built-in preset into draft AND apply
  const loadBuiltIn = useCallback((id) => {
    if (BUILT_IN_PRESETS[id]) {
      setDraft({ ...BUILT_IN_PRESETS[id] });
      setThemeState({ ...BUILT_IN_PRESETS[id] });
      setEditingPresetIndex(null);
    }
  }, []);

  // Load built-in into draft only (for editing/previewing)
  const loadBuiltInToDraft = useCallback((id) => {
    if (BUILT_IN_PRESETS[id]) {
      setDraft({ ...BUILT_IN_PRESETS[id] });
      setEditingPresetIndex(null);
    }
  }, []);

  // Load a user preset and apply
  const loadUserPreset = useCallback((index) => {
    if (userPresets[index]) {
      setDraft({ ...userPresets[index] });
      setThemeState({ ...userPresets[index] });
      setEditingPresetIndex(null);
    }
  }, [userPresets]);

  // Load user preset into draft only (for editing)
  const loadUserPresetToDraft = useCallback((index) => {
    if (userPresets[index]) {
      setDraft({ ...userPresets[index] });
      setEditingPresetIndex(index);
    }
  }, [userPresets]);

  // Save current draft as a new user preset
  const saveUserPreset = useCallback((name) => {
    if (userPresets.length >= MAX_USER_PRESETS) return false;
    const preset = { ...draft, name, isBuiltIn: false };
    setUserPresets(prev => [...prev, preset]);
    setEditingPresetIndex(null);
    return true;
  }, [draft, userPresets.length]);

  const deleteUserPreset = useCallback((index) => {
    setUserPresets(prev => prev.filter((_, i) => i !== index));
    if (editingPresetIndex === index) setEditingPresetIndex(null);
  }, [editingPresetIndex]);

  // Overwrite an existing user preset with current draft colors
  const overwriteUserPreset = useCallback((index) => {
    setUserPresets(prev => prev.map((p, i) =>
      i === index ? { ...draft, name: p.name, isBuiltIn: false } : p
    ));
  }, [draft]);

  // Rename a user preset
  const renameUserPreset = useCallback((index, newName) => {
    setUserPresets(prev => prev.map((p, i) =>
      i === index ? { ...p, name: newName } : p
    ));
  }, []);

  // Export theme as JSON file download
  const exportTheme = useCallback((themeToExport) => {
    const t = themeToExport || draft;
    const exportData = {
      nexusTheme: true,
      version: 1,
      name: t.name || 'Custom Theme',
      colors: t.colors,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-theme-${(exportData.name).toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [draft]);

  // Import theme from JSON file → loads into draft AND auto-saves as preset
  const importTheme = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.colors || !data.nexusTheme) {
            reject(new Error('Invalid theme file'));
            return;
          }
          const requiredKeys = Object.keys(BUILT_IN_PRESETS.dark.colors);
          const hasAllKeys = requiredKeys.every(k => data.colors[k]);
          if (!hasAllKeys) {
            reject(new Error('Theme file is missing required color keys'));
            return;
          }
          const imported = {
            name: data.name || 'Imported Theme',
            isBuiltIn: false,
            colors: data.colors,
          };
          setDraft(imported);
          setEditingPresetIndex(null);
          
          // Auto-save imported theme as a user preset if there's room
          if (userPresets.length < MAX_USER_PRESETS) {
            setUserPresets(prev => [...prev, imported]);
          }
          
          resolve(imported);
        } catch {
          reject(new Error('Failed to parse theme file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }, [userPresets.length]);

  return (
    <ThemeContext.Provider value={{
      theme,
      draft,
      userPresets,
      editingPresetIndex,
      setTheme,
      setDraft,
      updateColor,
      updateDraftColor,
      applyDraft,
      loadBuiltIn,
      loadBuiltInToDraft,
      loadUserPreset,
      loadUserPresetToDraft,
      saveUserPreset,
      deleteUserPreset,
      overwriteUserPreset,
      renameUserPreset,
      exportTheme,
      importTheme,
      setEditingPresetIndex,
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
