import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Save, Trash2, Check, RotateCcw } from 'lucide-react';
import { useTheme, BUILT_IN_PRESETS, COLOR_LABELS, luminance } from '../context/ThemeContext';

/* ─── Color Swatch Row ─── */
const SwatchRow = ({ colors }) => (
  <div className="flex gap-1 mt-2">
    {[colors.bgPrimary, colors.bgSecondary, colors.bgCard].map((c, i) => (
      <div key={`bg-${i}`} className="w-5 h-5 border border-tx/10" style={{ backgroundColor: c }} />
    ))}
    <div className="w-px bg-tx/10 mx-0.5" />
    {[colors.accent1, colors.accent2, colors.accent3, colors.accent4].map((c, i) => (
      <div key={`ac-${i}`} className="w-5 h-5 border border-tx/10" style={{ backgroundColor: c }} />
    ))}
  </div>
);

/* ─── Preset Card ─── */
const PresetCard = ({ preset, isActive, onApply, onDelete, showDelete = false }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={`border-[3px] p-4 cursor-pointer transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal ${
      isActive ? 'border-neon-pink shadow-brutal bg-neon-pink/5' : 'border-tx/10 bg-brutal-card'
    }`}
    onClick={onApply}
  >
    <div className="flex justify-between items-start">
      <div>
        <div className="font-bold text-sm uppercase tracking-wider text-tx">{preset.name}</div>
        <SwatchRow colors={preset.colors} />
      </div>
      <div className="flex gap-2 items-center">
        {isActive && <Check className="w-4 h-4 text-neon-pink" />}
        {showDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-tx/30 hover:text-red-500 transition-colors p-1">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
    {/* Text preview */}
    <div className="mt-3 flex gap-2 items-center">
      <div className="text-[9px] font-mono uppercase tracking-wider" style={{ color: preset.colors.text }}>Aa</div>
      <div className="text-[9px] font-mono uppercase tracking-wider" style={{ color: preset.colors.textSecondary }}>Aa</div>
      <div className="flex-1" />
      <div className="w-3 h-3 border" style={{ backgroundColor: preset.colors.success, borderColor: preset.colors.success + '60' }} />
      <div className="w-3 h-3 border" style={{ backgroundColor: preset.colors.danger, borderColor: preset.colors.danger + '60' }} />
    </div>
  </motion.div>
);

/* ─── Color Input ─── */
const ColorInput = ({ label, value, onChange }) => (
  <div className="flex items-center gap-3 group">
    <div className="relative shrink-0">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 cursor-pointer border-2 border-tx/10 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-none hover:border-neon-pink/40 transition-colors"
      />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-[9px] font-bold uppercase tracking-widest text-tx/30 mb-1">{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (/^#[0-9a-fA-F]{0,6}$/.test(v) || v === '' || v === '#') {
            if (v.length === 7 || v.length === 4) onChange(v);
            else if (v.length < 7) onChange(v);
          }
        }}
        onBlur={(e) => {
          if (!/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
            // Don't change — keep existing value
          }
        }}
        className="w-full bg-brutal-bg border-2 border-tx/10 px-3 py-1.5 font-mono text-xs text-tx uppercase tracking-wider focus:border-neon-pink/40 focus:outline-none transition-colors"
        placeholder="#000000"
        maxLength={7}
      />
    </div>
  </div>
);

/* ─── Settings Page ─── */
function Settings() {
  const {
    theme, userPresets, updateColor,
    loadBuiltIn, loadUserPreset,
    saveUserPreset, deleteUserPreset,
    maxUserPresets
  } = useTheme();

  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleSave = () => {
    if (!saveName.trim()) return;
    const success = saveUserPreset(saveName.trim());
    if (success) {
      showFeedback('Theme saved successfully!');
      setSaveName('');
      setShowSave(false);
    } else {
      showFeedback(`Max ${maxUserPresets} presets reached`);
    }
  };

  const colorGroups = [
    { title: 'Backgrounds', icon: '◼', keys: ['bgPrimary', 'bgSecondary', 'bgCard'] },
    { title: 'Accents', icon: '◆', keys: ['accent1', 'accent2', 'accent3', 'accent4'] },
    { title: 'Text', icon: '◇', keys: ['text', 'textSecondary', 'textMuted'] },
    { title: 'Status', icon: '●', keys: ['danger', 'success'] },
  ];

  const isActiveBuiltIn = (id) => theme.isBuiltIn && theme.id === id;
  const isActiveUser = (index) => !theme.isBuiltIn && theme.name === userPresets[index]?.name;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <header className="mb-10 border-b-[3px] border-neon-pink/20 pb-6">
        <div className="flex items-center gap-4">
          <Palette className="w-10 h-10 text-neon-pink" strokeWidth={2.5} />
          <div>
            <h1 className="text-5xl font-black uppercase tracking-tighter leading-[0.9]">
              <span className="text-tx">Theme</span>{' '}
              <span className="text-neon-pink" style={{ textShadow: '0 0 25px var(--neon-pink)' }}>
                Creator
              </span>
            </h1>
            <div className="font-mono text-[10px] text-tx/30 mt-2 tracking-wider uppercase">
              Customize your dashboard appearance · Changes apply instantly
            </div>
          </div>
        </div>
      </header>

      {/* Feedback toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-neon-pink px-5 py-3 font-bold uppercase text-sm tracking-wider shadow-brutal border-[3px] border-neon-pink"
            style={{ color: 'var(--on-neon-pink)' }}
          >
            <Check className="w-4 h-4 inline mr-2" />
            {feedback}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Built-in Presets ─── */}
      <section className="mb-8">
        <div className="bg-neon-pink px-2 py-1 text-[10px] font-bold uppercase inline-block rotate-[-1deg] tracking-widest mb-4"
          style={{ color: 'var(--on-neon-pink)' }}>
          Built-in Presets
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(BUILT_IN_PRESETS).map(([id, preset]) => (
            <PresetCard
              key={id}
              preset={preset}
              isActive={isActiveBuiltIn(id)}
              onApply={() => loadBuiltIn(id)}
            />
          ))}
        </div>
      </section>

      {/* ─── User Presets ─── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="bg-neon-cyan px-2 py-1 text-[10px] font-bold uppercase inline-block rotate-[1deg] tracking-widest"
            style={{ color: 'var(--on-neon-cyan)' }}>
            Your Presets ({userPresets.length}/{maxUserPresets})
          </div>
          {userPresets.length < maxUserPresets && (
            <button
              onClick={() => setShowSave(!showSave)}
              className="flex items-center gap-2 px-4 py-2 border-2 border-neon-pink/40 text-neon-pink font-bold uppercase text-[10px] tracking-widest hover:bg-neon-pink transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px]"
              style={{ '--tw-hover-color': 'var(--on-neon-pink)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--on-neon-pink)'}
              onMouseLeave={(e) => e.currentTarget.style.color = ''}
            >
              <Save className="w-3.5 h-3.5" />
              Save Current
            </button>
          )}
        </div>

        {/* Save dialog */}
        <AnimatePresence>
          {showSave && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="border-[3px] border-neon-pink/20 bg-brutal-card p-4 flex gap-3 items-end">
                <div className="flex-1">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-tx/30 mb-1">Preset Name</div>
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    placeholder="My Custom Theme"
                    className="w-full bg-brutal-bg border-2 border-tx/10 px-3 py-2 font-mono text-sm text-tx focus:border-neon-pink/40 focus:outline-none transition-colors"
                    maxLength={24}
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleSave}
                  disabled={!saveName.trim()}
                  className="px-6 py-2 bg-neon-pink font-bold uppercase text-xs tracking-wider border-2 border-neon-pink hover:translate-x-[2px] hover:translate-y-[2px] shadow-brutal-sm hover:shadow-none transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ color: 'var(--on-neon-pink)' }}
                >
                  Save
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {userPresets.length === 0 ? (
          <div className="border-[3px] border-tx/5 bg-brutal-card p-8 text-center">
            <div className="font-mono text-tx/20 text-sm">No saved presets yet</div>
            <div className="font-mono text-tx/10 text-[10px] mt-1">
              Customize colors below, then save as a preset
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userPresets.map((preset, i) => (
              <PresetCard
                key={i}
                preset={preset}
                isActive={isActiveUser(i)}
                onApply={() => loadUserPreset(i)}
                onDelete={() => { deleteUserPreset(i); showFeedback('Preset deleted'); }}
                showDelete
              />
            ))}
          </div>
        )}
      </section>

      {/* ─── Color Editor ─── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="bg-neon-purple px-2 py-1 text-[10px] font-bold uppercase inline-block rotate-[-0.5deg] tracking-widest"
            style={{ color: 'var(--on-neon-purple)' }}>
            Color Editor
          </div>
          <div className="flex items-center gap-3">
            <div className="font-mono text-[10px] text-tx/20 tracking-wider hidden md:block">
              LIVE PREVIEW
            </div>
            <button
              onClick={() => loadBuiltIn('dark')}
              className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-tx/10 text-tx/40 font-bold uppercase text-[9px] tracking-wider hover:border-neon-pink/40 hover:text-neon-pink transition-all"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {colorGroups.map((group, gi) => (
            <motion.div
              key={group.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.05 }}
              className="border-[3px] border-tx/10 bg-brutal-card p-5"
            >
              <h3 className="font-bold text-xs uppercase tracking-widest text-tx/50 mb-4 flex items-center gap-2">
                <span className="text-neon-pink">{group.icon}</span>
                {group.title}
              </h3>
              <div className="space-y-4">
                {group.keys.map((key) => (
                  <ColorInput
                    key={key}
                    label={COLOR_LABELS[key]}
                    value={theme.colors[key]}
                    onChange={(val) => updateColor(key, val)}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Live Preview ─── */}
      <section className="mt-8 mb-8">
        <div className="bg-neon-yellow px-2 py-1 text-[10px] font-bold uppercase inline-block rotate-[0.5deg] tracking-widest mb-4"
          style={{ color: 'var(--on-neon-yellow)' }}>
          Live Preview
        </div>
        <div className="border-[3px] border-tx/10 p-6" style={{ backgroundColor: theme.colors.bgPrimary }}>
          {/* Mini cards */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 border-[3px] p-4" style={{
              backgroundColor: theme.colors.bgCard,
              borderColor: theme.colors.accent1 + '30',
              boxShadow: `4px 4px 0 ${theme.colors.accent1}20`
            }}>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: theme.colors.textSecondary }}>
                CPU Usage
              </div>
              <div className="text-2xl font-black mt-1" style={{ color: theme.colors.accent1 }}>85.2%</div>
              <div className="text-[10px] font-mono mt-1" style={{ color: theme.colors.textMuted }}>Fleet Average</div>
            </div>
            <div className="flex-1 border-[3px] p-4" style={{
              backgroundColor: theme.colors.bgCard,
              borderColor: theme.colors.accent2 + '30',
              boxShadow: `4px 4px 0 ${theme.colors.accent2}20`
            }}>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: theme.colors.textSecondary }}>
                Memory
              </div>
              <div className="text-2xl font-black mt-1" style={{ color: theme.colors.accent2 }}>62.7%</div>
              <div className="text-[10px] font-mono mt-1" style={{ color: theme.colors.textMuted }}>4.2 GB / 8 GB</div>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-3 mb-4">
            <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider border-2"
              style={{ borderColor: theme.colors.success + '60', color: theme.colors.success, backgroundColor: theme.colors.success + '15' }}>
              ● Online
            </span>
            <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider border-2"
              style={{ borderColor: theme.colors.danger + '60', color: theme.colors.danger, backgroundColor: theme.colors.danger + '15' }}>
              ● Offline
            </span>
            <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: theme.colors.accent1, color: luminance(theme.colors.accent1) > 0.5 ? '#000' : '#fff' }}>
              Accent Badge
            </span>
            <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: theme.colors.accent3, color: luminance(theme.colors.accent3) > 0.5 ? '#000' : '#fff' }}>
              Alt Badge
            </span>
          </div>

          {/* Text samples */}
          <div className="space-y-1.5 border-t-2 pt-3" style={{ borderColor: theme.colors.textMuted + '30' }}>
            <div className="text-sm font-bold" style={{ color: theme.colors.text }}>Primary text — headings and content</div>
            <div className="text-xs" style={{ color: theme.colors.textSecondary }}>Secondary text — descriptions and labels</div>
            <div className="text-[10px] font-mono" style={{ color: theme.colors.textMuted }}>Muted text — timestamps, metadata, IDs</div>
          </div>

          {/* Progress bars */}
          <div className="mt-4 space-y-2">
            {[
              { label: 'CPU', value: 72, color: theme.colors.accent1 },
              { label: 'RAM', value: 58, color: theme.colors.accent2 },
            ].map((bar, i) => (
              <div key={i}>
                <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider mb-1">
                  <span style={{ color: theme.colors.textSecondary }}>{bar.label}</span>
                  <span style={{ color: bar.color }}>{bar.value}%</span>
                </div>
                <div className="h-2.5 border-2 overflow-hidden" style={{ borderColor: bar.color + '40', backgroundColor: bar.color + '10' }}>
                  <div className="h-full" style={{ width: `${bar.value}%`, backgroundColor: bar.color, boxShadow: `0 0 8px ${bar.color}` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="text-center py-4 font-mono text-[9px] text-tx/15 uppercase tracking-widest">
        Nexus Theme Engine /// Dronzer Studios
      </div>
    </div>
  );
}

export default Settings;
