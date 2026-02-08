import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Save, Trash2, Check, RotateCcw, Key, Copy, Plus, Shield, Eye, EyeOff, Download, RefreshCw, ArrowUpCircle, Server, Send, Loader2, ExternalLink, AlertTriangle, Users, UserPlus } from 'lucide-react';
import { useTheme, BUILT_IN_PRESETS, COLOR_LABELS, luminance } from '../context/ThemeContext';
import axios from 'axios';

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

/* ─── Update Manager Component ─── */
function UpdateManager({ showFeedback }) {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [pushingNodes, setPushingNodes] = useState(false);
  const [releases, setReleases] = useState([]);
  const [showChangelog, setShowChangelog] = useState(false);

  const token = localStorage.getItem('token');
  const api = axios.create({
    baseURL: window.location.origin,
    headers: { Authorization: `Bearer ${token}` }
  });

  const checkForUpdate = useCallback(async () => {
    setChecking(true);
    try {
      const res = await api.get('/api/update/check');
      setUpdateInfo(res.data);
      if (res.data.error) {
        showFeedback(res.data.error);
      } else if (res.data.hasUpdate) {
        showFeedback(`Update available: v${res.data.latestVersion}`);
      } else {
        showFeedback('You\'re on the latest version!');
      }
    } catch {
      showFeedback('Failed to check for updates');
    } finally {
      setChecking(false);
    }
  }, []);

  const fetchReleases = async () => {
    try {
      const res = await api.get('/api/update/releases?limit=5');
      setReleases(res.data.releases || []);
      setShowChangelog(true);
    } catch {
      showFeedback('Failed to load changelog');
    }
  };

  const applyUpdate = async () => {
    setUpdating(true);
    try {
      const res = await api.post('/api/update/apply');
      showFeedback(res.data.message || 'Update started...');
    } catch {
      showFeedback('Failed to start update');
    } finally {
      // Keep updating state for a while since it's async
      setTimeout(() => {
        setUpdating(false);
        checkForUpdate(); // Re-check to see new version
      }, 30000);
    }
  };

  const pushNodeUpdate = async () => {
    setPushingNodes(true);
    try {
      const res = await api.post('/api/update/nodes');
      showFeedback(res.data.message || 'Update sent to nodes');
    } catch {
      showFeedback('Failed to push update to nodes');
    } finally {
      setPushingNodes(false);
    }
  };

  useEffect(() => {
    // Auto-check on mount
    checkForUpdate();
  }, []);

  return (
    <section className="mt-10 mb-8">
      <header className="mb-6 border-b-[3px] border-neon-purple/20 pb-4">
        <div className="flex items-center gap-4">
          <ArrowUpCircle className="w-8 h-8 text-neon-purple" strokeWidth={2.5} />
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter leading-[0.9]">
              <span className="text-tx">System</span>{' '}
              <span className="text-neon-purple" style={{ textShadow: '0 0 25px var(--neon-purple)' }}>
                Updates
              </span>
            </h2>
            <div className="font-mono text-[10px] text-tx/30 mt-1 tracking-wider uppercase">
              Check for updates · Download & install · Push to nodes
            </div>
          </div>
        </div>
      </header>

      {/* Version info card */}
      <div className="border-[3px] border-tx/10 bg-brutal-card p-6 mb-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-tx/30 mb-1">Current Version</div>
            <div className="text-3xl font-black text-tx tracking-tight">
              v{updateInfo?.currentVersion || '...'}
            </div>
          </div>

          {updateInfo?.hasUpdate && (
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-widest text-neon-purple/60 mb-1">Latest Available</div>
              <div className="text-3xl font-black text-neon-purple tracking-tight" style={{ textShadow: '0 0 15px var(--neon-purple)' }}>
                v{updateInfo.latestVersion}
              </div>
            </div>
          )}

          {updateInfo && !updateInfo.hasUpdate && !updateInfo.error && (
            <div className="flex items-center gap-2 px-4 py-2 border-2 border-green-500/30 bg-green-500/5">
              <Check className="w-4 h-4 text-green-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-green-500">Up to date</span>
            </div>
          )}
        </div>

        {/* Release name & date */}
        {updateInfo?.hasUpdate && updateInfo.releaseName && (
          <div className="mt-4 pt-4 border-t-2 border-tx/5">
            <div className="font-bold text-sm text-tx uppercase tracking-wider">{updateInfo.releaseName}</div>
            {updateInfo.publishedAt && (
              <div className="font-mono text-[10px] text-tx/30 mt-0.5">
                Released {new Date(updateInfo.publishedAt).toLocaleDateString()}
              </div>
            )}
            {updateInfo.releaseNotes && (
              <div className="mt-3 font-mono text-xs text-tx/50 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto border-l-2 border-neon-purple/20 pl-3">
                {updateInfo.releaseNotes.slice(0, 500)}
                {updateInfo.releaseNotes.length > 500 && '...'}
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {updateInfo?.error && (
          <div className="mt-4 flex items-center gap-2 text-yellow-500">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-mono text-xs">{updateInfo.error}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Check for updates */}
        <button
          onClick={checkForUpdate}
          disabled={checking}
          className="flex items-center gap-2 px-4 py-2.5 border-2 border-neon-purple/40 text-neon-purple font-bold uppercase text-[10px] tracking-widest hover:bg-neon-purple transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] disabled:opacity-40 disabled:cursor-not-allowed"
          onMouseEnter={(e) => !checking && (e.currentTarget.style.color = 'var(--on-neon-purple)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '')}
        >
          {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {checking ? 'Checking...' : 'Check for Updates'}
        </button>

        {/* Download & Install */}
        {updateInfo?.hasUpdate && (
          <button
            onClick={applyUpdate}
            disabled={updating}
            className="flex items-center gap-2 px-4 py-2.5 bg-neon-purple border-2 border-neon-purple font-bold uppercase text-[10px] tracking-widest hover:translate-x-[3px] hover:translate-y-[3px] shadow-brutal-sm hover:shadow-none transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: 'var(--on-neon-purple)' }}
          >
            {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {updating ? 'Updating...' : `Download & Install v${updateInfo.latestVersion}`}
          </button>
        )}

        {/* Push to nodes */}
        <button
          onClick={pushNodeUpdate}
          disabled={pushingNodes}
          className="flex items-center gap-2 px-4 py-2.5 border-2 border-neon-cyan/40 text-neon-cyan font-bold uppercase text-[10px] tracking-widest hover:bg-neon-cyan transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] disabled:opacity-40 disabled:cursor-not-allowed"
          onMouseEnter={(e) => !pushingNodes && (e.currentTarget.style.color = 'var(--on-neon-cyan)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '')}
        >
          {pushingNodes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {pushingNodes ? 'Sending...' : 'Update All Nodes'}
        </button>

        {/* Changelog */}
        <button
          onClick={fetchReleases}
          className="flex items-center gap-2 px-4 py-2.5 border-2 border-tx/10 text-tx/40 font-bold uppercase text-[10px] tracking-widest hover:border-neon-purple/30 hover:text-neon-purple transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Changelog
        </button>
      </div>

      {/* Update in progress warning */}
      <AnimatePresence>
        {updating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="border-[3px] border-neon-yellow/60 bg-neon-yellow/5 p-4">
              <div className="flex items-start gap-3">
                <Loader2 className="w-5 h-5 text-neon-yellow shrink-0 mt-0.5 animate-spin" />
                <div>
                  <div className="font-bold text-xs uppercase tracking-wider text-neon-yellow mb-1">
                    Update in progress
                  </div>
                  <div className="font-mono text-[10px] text-tx/40">
                    Downloading update, installing dependencies, and rebuilding dashboard.
                    This may take a few minutes. The server will need to be restarted after the update completes.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Changelog modal */}
      <AnimatePresence>
        {showChangelog && releases.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="border-[3px] border-neon-purple/20 bg-brutal-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-bold uppercase tracking-widest text-neon-purple">Recent Releases</div>
                <button onClick={() => setShowChangelog(false)} className="text-tx/20 hover:text-tx text-xs">✕</button>
              </div>
              <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                {releases.map((release, i) => (
                  <div key={i} className="border-l-2 border-neon-purple/20 pl-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-tx">v{release.version}</span>
                      {release.version === updateInfo?.currentVersion && (
                        <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30">current</span>
                      )}
                    </div>
                    {release.name && release.name !== `v${release.version}` && (
                      <div className="font-mono text-xs text-tx/50 mt-0.5">{release.name}</div>
                    )}
                    <div className="font-mono text-[10px] text-tx/20 mt-0.5">
                      {new Date(release.publishedAt).toLocaleDateString()}
                    </div>
                    {release.notes && (
                      <div className="font-mono text-[10px] text-tx/30 mt-1 whitespace-pre-wrap leading-relaxed">
                        {release.notes.slice(0, 200)}
                        {release.notes.length > 200 && '...'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ─── API Key Manager Component ─── */
function ApiKeyManager({ showFeedback }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);
  const [showKey, setShowKey] = useState(false);

  const token = localStorage.getItem('token');
  const api = axios.create({
    baseURL: window.location.origin,
    headers: { Authorization: `Bearer ${token}` }
  });

  const fetchKeys = async () => {
    try {
      const res = await api.get('/api/auth/api-keys');
      setKeys(res.data.keys || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    try {
      const res = await api.post('/api/auth/api-keys', { name: newKeyName.trim() });
      setNewlyCreatedKey(res.data.key);
      setNewKeyName('');
      setShowCreate(false);
      setShowKey(true);
      fetchKeys();
      showFeedback('API key created!');
    } catch (err) {
      showFeedback(err.response?.data?.message || 'Failed to create key');
    }
  };

  const handleDelete = async (keyId) => {
    try {
      await api.delete(`/api/auth/api-keys/${keyId}`);
      setKeys(keys.filter(k => k.id !== keyId));
      if (newlyCreatedKey?.id === keyId) setNewlyCreatedKey(null);
      showFeedback('API key revoked');
    } catch {
      showFeedback('Failed to delete key');
    }
  };

  const copyKey = (text) => {
    navigator.clipboard.writeText(text);
    showFeedback('Copied to clipboard!');
  };

  return (
    <section className="mt-10 mb-8">
      <header className="mb-6 border-b-[3px] border-neon-cyan/20 pb-4">
        <div className="flex items-center gap-4">
          <Key className="w-8 h-8 text-neon-cyan" strokeWidth={2.5} />
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter leading-[0.9]">
              <span className="text-tx">API</span>{' '}
              <span className="text-neon-cyan" style={{ textShadow: '0 0 25px var(--neon-cyan)' }}>
                Keys
              </span>
            </h2>
            <div className="font-mono text-[10px] text-tx/30 mt-1 tracking-wider uppercase">
              Manage keys for mobile app & external access
            </div>
          </div>
        </div>
      </header>

      {/* Newly created key warning */}
      <AnimatePresence>
        {newlyCreatedKey && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="border-[3px] border-neon-yellow/60 bg-neon-yellow/5 p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-neon-yellow shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-xs uppercase tracking-wider text-neon-yellow mb-2">
                    Save this key — it won't be shown again!
                  </div>
                  <div className="flex items-center gap-2 bg-brutal-bg border-2 border-tx/10 p-3">
                    <code className="flex-1 font-mono text-sm text-tx break-all">
                      {showKey ? newlyCreatedKey.rawKey : '•'.repeat(40)}
                    </code>
                    <button onClick={() => setShowKey(!showKey)}
                      className="text-tx/30 hover:text-neon-cyan p-1 transition-colors">
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => copyKey(newlyCreatedKey.rawKey)}
                      className="text-tx/30 hover:text-neon-pink p-1 transition-colors">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="font-mono text-[10px] text-tx/20 mt-2">
                    Key name: {newlyCreatedKey.name} · ID: {newlyCreatedKey.id}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create new key */}
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-[10px] text-tx/30 tracking-wider uppercase">
          {loading ? 'Loading...' : `${keys.length} key${keys.length !== 1 ? 's' : ''}`}
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 border-2 border-neon-cyan/40 text-neon-cyan font-bold uppercase text-[10px] tracking-widest hover:bg-neon-cyan transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px]"
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--on-neon-cyan)'}
          onMouseLeave={(e) => e.currentTarget.style.color = ''}
        >
          <Plus className="w-3.5 h-3.5" />
          New Key
        </button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="border-[3px] border-neon-cyan/20 bg-brutal-card p-4 flex gap-3 items-end">
              <div className="flex-1">
                <div className="text-[9px] font-bold uppercase tracking-widest text-tx/30 mb-1">Key Name</div>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="e.g. My Phone, Tablet..."
                  className="w-full bg-brutal-bg border-2 border-tx/10 px-3 py-2 font-mono text-sm text-tx focus:border-neon-cyan/40 focus:outline-none transition-colors"
                  maxLength={64}
                  autoFocus
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={!newKeyName.trim()}
                className="px-6 py-2 bg-neon-cyan font-bold uppercase text-xs tracking-wider border-2 border-neon-cyan hover:translate-x-[2px] hover:translate-y-[2px] shadow-brutal-sm hover:shadow-none transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ color: 'var(--on-neon-cyan)' }}
              >
                Create
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keys list */}
      {keys.length === 0 && !loading ? (
        <div className="border-[3px] border-tx/5 bg-brutal-card p-8 text-center">
          <Key className="w-8 h-8 text-tx/10 mx-auto mb-3" />
          <div className="font-mono text-tx/20 text-sm">No API keys yet</div>
          <div className="font-mono text-tx/10 text-[10px] mt-1">
            Create a key to connect the Nexus mobile app
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <motion.div
              key={key.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-[3px] border-tx/10 bg-brutal-card p-4 flex items-center gap-4 hover:border-neon-cyan/20 transition-colors"
            >
              <Key className="w-4 h-4 text-neon-cyan shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-tx uppercase tracking-wider truncate">{key.name}</div>
                <div className="font-mono text-[10px] text-tx/30 mt-0.5">
                  {key.key_preview} · Created {new Date(key.created_at * 1000).toLocaleDateString()}
                  {key.last_used ? ` · Last used ${new Date(key.last_used).toLocaleDateString()}` : ' · Never used'}
                </div>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border border-neon-cyan/30 text-neon-cyan/60">
                {key.permissions}
              </span>
              <button
                onClick={() => handleDelete(key.id)}
                className="text-tx/20 hover:text-red-500 transition-colors p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ─── User Manager Component ─── */
function UserManager({ showFeedback }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'viewer' });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await axios.get('/api/auth/users');
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async () => {
    if (!newUser.username.trim() || !newUser.password.trim()) return;
    try {
      await axios.post('/api/auth/users', newUser);
      showFeedback(`User '${newUser.username}' created!`);
      setNewUser({ username: '', password: '', role: 'viewer' });
      setShowCreate(false);
      fetchUsers();
    } catch (err) {
      showFeedback(err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleDelete = async (userId, username) => {
    if (!confirm(`Delete user '${username}'? This cannot be undone.`)) return;
    try {
      await axios.delete(`/api/auth/users/${userId}`);
      showFeedback(`User '${username}' deleted`);
      fetchUsers();
    } catch (err) {
      showFeedback(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const roleBadge = (role) => {
    const isAdmin = role === 'admin';
    return (
      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
        isAdmin
          ? 'border-neon-pink/40 text-neon-pink/80 bg-neon-pink/5'
          : 'border-neon-cyan/30 text-neon-cyan/60'
      }`}>
        {role}
      </span>
    );
  };

  return (
    <section className="mb-12 border-[3px] border-neon-purple/20 bg-brutal-card shadow-brutal p-6">
      <header className="mb-6 border-b-[3px] border-neon-purple/20 pb-4">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-neon-purple" />
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">
              <span className="text-tx">User</span>{' '}
              <span className="text-neon-purple" style={{ textShadow: '0 0 25px var(--neon-purple)' }}>
                Management
              </span>
            </h2>
            <div className="font-mono text-[10px] text-tx/30 mt-1 tracking-wider uppercase">
              Create and manage dashboard user accounts
            </div>
          </div>
        </div>
      </header>

      {/* Create button */}
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-[10px] text-tx/30 tracking-wider uppercase">
          {loading ? 'Loading...' : `${users.length} user${users.length !== 1 ? 's' : ''}`}
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 border-2 border-neon-purple/40 text-neon-purple font-bold uppercase text-[10px] tracking-widest hover:bg-neon-purple transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px]"
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = ''}
        >
          <UserPlus className="w-3.5 h-3.5" />
          New User
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="border-[3px] border-neon-purple/20 bg-brutal-card p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-tx/30 mb-1">Username</div>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="min 3 chars"
                    className="w-full bg-brutal-bg border-2 border-tx/10 px-3 py-2 font-mono text-sm text-tx focus:border-neon-purple/40 focus:outline-none transition-colors"
                    maxLength={32}
                    autoFocus
                  />
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-tx/30 mb-1">Password</div>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="min 8 chars"
                    className="w-full bg-brutal-bg border-2 border-tx/10 px-3 py-2 font-mono text-sm text-tx focus:border-neon-purple/40 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-tx/30 mb-1">Role</div>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full bg-brutal-bg border-2 border-tx/10 px-3 py-2 font-mono text-sm text-tx focus:border-neon-purple/40 focus:outline-none transition-colors"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleCreate}
                  disabled={!newUser.username.trim() || newUser.password.length < 8}
                  className="px-6 py-2 bg-neon-purple font-bold uppercase text-xs tracking-wider border-2 border-neon-purple hover:translate-x-[2px] hover:translate-y-[2px] shadow-brutal-sm hover:shadow-none transition-all disabled:opacity-30 disabled:cursor-not-allowed text-white"
                >
                  Create User
                </button>
              </div>
              <div className="font-mono text-[10px] text-tx/20">
                New users must change their password on first login.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users list */}
      {users.length === 0 && !loading ? (
        <div className="border-[3px] border-tx/5 bg-brutal-card p-8 text-center">
          <Users className="w-8 h-8 text-tx/10 mx-auto mb-3" />
          <div className="font-mono text-tx/20 text-sm">No users found</div>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-[3px] border-tx/10 bg-brutal-card p-4 flex items-center gap-4 hover:border-neon-purple/20 transition-colors"
            >
              <div className="w-8 h-8 border-2 border-neon-purple/30 bg-neon-purple/10 flex items-center justify-center text-neon-purple font-bold text-sm uppercase">
                {u.username.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-tx uppercase tracking-wider truncate">{u.username}</div>
                <div className="font-mono text-[10px] text-tx/30 mt-0.5">
                  {u.source === 'file' ? 'Primary Admin' : `Created ${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}`}
                </div>
              </div>
              {roleBadge(u.role)}
              {u.source !== 'file' && (
                <button
                  onClick={() => handleDelete(u.id, u.username)}
                  className="text-tx/20 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}

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

      {/* ─── System Updates ─── */}
      <UpdateManager showFeedback={showFeedback} />

      {/* ─── API Key Management ─── */}
      <ApiKeyManager showFeedback={showFeedback} />

      {/* ─── User Management ─── */}
      <UserManager showFeedback={showFeedback} />

      {/* Footer */}
      <div className="text-center py-4 font-mono text-[9px] text-tx/15 uppercase tracking-widest">
        Nexus Theme Engine /// Dronzer Studios
      </div>
    </div>
  );
}

export default Settings;
