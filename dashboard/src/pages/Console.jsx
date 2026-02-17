import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal as TerminalIcon, Shield, Lock, Server,
  ViewColumns2, Xmark, WarningTriangle, Key, RefreshDouble,
} from 'iconoir-react';
import axios from 'axios';
import clsx from 'clsx';
import TerminalWidget from '../components/TerminalWidget';
import TwoFactorVerifyModal from '../components/TwoFactorVerifyModal';

/* ─── Node Card ─── */
const NodeCard = ({ node, selected, onSelect, disabled }) => (
  <button
    onClick={() => !disabled && onSelect(node)}
    disabled={disabled}
    className={clsx(
      'w-full text-left px-4 py-3 border-[3px] transition-all',
      selected
        ? 'border-neon-cyan bg-neon-cyan/10 shadow-brutal-cyan'
        : disabled
          ? 'border-tx/5 bg-brutal-card/50 opacity-40 cursor-not-allowed'
          : 'border-tx/8 bg-brutal-card hover:border-neon-cyan/40 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-sm',
    )}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div className={clsx(
          'w-2.5 h-2.5 rounded-none flex-shrink-0',
          node.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-tx/20',
        )} />
        <div className="min-w-0">
          <div className="text-sm font-black uppercase tracking-tight text-tx truncate">
            {node.hostname || node.id}
          </div>
          <div className="text-[10px] font-mono text-tx/30 truncate">
            {node.ip || node.id}
          </div>
        </div>
      </div>
      {!node.console_enabled && (
        <Lock className="w-3.5 h-3.5 text-tx/20 flex-shrink-0" />
      )}
    </div>
  </button>
);

/* ─── Terminal Panel ─── */
const TerminalPanel = ({ socket, node, panelId, onClose, isSplit }) => {
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState(null);

  // Use server-provided isLocal flag (detected in combine mode by hostname match)
  const isLocalNode = !!node.isLocal;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="flex flex-col h-full border-[3px] border-neon-cyan/15 overflow-hidden"
      style={{ boxShadow: '4px 4px 0 rgba(0,240,255,0.06)' }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0a0a0f] border-b-[3px] border-neon-cyan/10 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-neon-pink/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          </div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neon-cyan/50">
            {node.hostname || node.id}
          </span>
          {status === 'connected' && (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] font-mono text-green-500/50">LIVE</span>
            </div>
          )}
          {status === 'connecting' && (
            <span className="text-[9px] font-mono text-yellow-500/50 animate-pulse">CONNECTING...</span>
          )}
        </div>
        {isSplit && (
          <button
            onClick={() => onClose(panelId)}
            className="p-0.5 hover:bg-tx/10 transition-colors"
          >
            <Xmark className="w-3.5 h-3.5 text-tx/30 hover:text-neon-pink" />
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-neon-pink/10 border-b-[2px] border-neon-pink/20 flex items-center gap-2">
          <WarningTriangle className="w-3.5 h-3.5 text-neon-pink flex-shrink-0" />
          <span className="text-[11px] font-mono text-neon-pink truncate">{error}</span>
        </div>
      )}

      {/* Terminal */}
      <div className="flex-1 min-h-0">
        <TerminalWidget
          socket={socket}
          nodeId={node.id}
          isLocal={isLocalNode}
          host={node.ip || undefined}
          username={node.ssh_user || undefined}
          onConnected={() => { setStatus('connected'); setError(null); }}
          onDisconnected={() => setStatus('disconnected')}
          onError={(err) => { setError(err.message); setStatus('error'); }}
        />
      </div>
    </motion.div>
  );
};

/* ═══════ MAIN CONSOLE PAGE ═══════ */
function Console({ socket }) {
  // 2FA gate state
  const [verified, setVerified] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [has2FA, setHas2FA] = useState(null); // null = loading, true/false

  // Console state
  const [consoleEnabled, setConsoleEnabled] = useState(true);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active terminals — array of { id, node }
  const [terminals, setTerminals] = useState([]);
  const [splitMode, setSplitMode] = useState(false);

  /* ─── Check if user has 2FA enabled ─── */
  useEffect(() => {
    axios.get('/api/auth/me')
      .then(res => {
        setHas2FA(res.data.user?.totp_enabled === 1);
        // If no 2FA configured, auto-verify (but show warning)
        if (res.data.user?.totp_enabled !== 1) {
          setVerified(true);
        }
      })
      .catch(() => setHas2FA(false));
  }, []);

  /* ─── Load console data after verification ─── */
  useEffect(() => {
    if (!verified) return;

    const fetchData = async () => {
      try {
        const [configRes, nodesRes] = await Promise.all([
          axios.get('/api/console/config'),
          axios.get('/api/console/nodes'),
        ]);
        setConsoleEnabled(configRes.data.config?.enabled !== false);
        setNodes(nodesRes.data.nodes || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Refresh nodes periodically
    const interval = setInterval(async () => {
      try {
        const res = await axios.get('/api/console/nodes');
        setNodes(res.data.nodes || []);
      } catch {}
    }, 15000);

    return () => clearInterval(interval);
  }, [verified]);

  /* ─── Handle 2FA verification ─── */
  const handleVerified = useCallback(() => {
    setVerified(true);
    setShow2FA(false);
  }, []);

  /* ─── Open terminal for a node ─── */
  const openTerminal = useCallback((node) => {
    // Check if already open
    if (terminals.some(t => t.node.id === node.id)) return;

    if (splitMode && terminals.length >= 2) {
      // Replace the second terminal
      setTerminals(prev => [prev[0], { id: Date.now(), node }]);
    } else if (splitMode && terminals.length === 1) {
      setTerminals(prev => [...prev, { id: Date.now(), node }]);
    } else {
      // Single mode — replace
      setTerminals([{ id: Date.now(), node }]);
    }
  }, [terminals, splitMode]);

  /* ─── Close terminal panel ─── */
  const closeTerminal = useCallback((panelId) => {
    setTerminals(prev => prev.filter(t => t.id !== panelId));
  }, []);

  /* ─── Toggle split view ─── */
  const toggleSplit = useCallback(() => {
    setSplitMode(prev => {
      if (prev && terminals.length > 1) {
        // Collapse to first terminal only
        setTerminals(t => [t[0]]);
      }
      return !prev;
    });
  }, [terminals]);

  // ════════════ RENDER ════════════

  // Not yet checked for 2FA
  if (has2FA === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-tx/30 font-mono text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  // 2FA gate — show blurred background with verification prompt
  if (!verified) {
    return (
      <div className="relative h-full">
        {/* Blurred background preview */}
        <div className="absolute inset-0 overflow-hidden" style={{ filter: 'blur(12px) brightness(0.4)' }}>
          <div className="p-8 space-y-4">
            <div className="flex items-center gap-3">
              <TerminalIcon className="w-7 h-7 text-neon-cyan" />
              <h1 className="text-3xl font-black uppercase tracking-tight text-tx">Console</h1>
            </div>
            {/* Fake node cards for blur effect */}
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 border-[3px] border-tx/10 bg-brutal-card" />
            ))}
            <div className="h-[300px] border-[3px] border-neon-cyan/10 bg-[#0a0a0f]" />
          </div>
        </div>

        {/* 2FA prompt overlay */}
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-[3px] border-neon-cyan/40 bg-brutal-card p-8 max-w-md w-full mx-4"
            style={{ boxShadow: '8px 8px 0 rgba(0,240,255,0.1)' }}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-neon-cyan/10 border-[3px] border-neon-cyan/30">
                <Shield className="w-8 h-8 text-neon-cyan" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-tx">Security Gate</h2>
                <p className="text-xs text-tx/30 font-mono mt-1">2FA verification required for console access</p>
              </div>
            </div>

            <p className="text-sm text-tx/40 mb-6">
              The console provides direct shell access to your nodes. Verify your identity with two-factor authentication to proceed.
            </p>

            <button
              onClick={() => setShow2FA(true)}
              className="w-full py-3 bg-neon-cyan/10 border-[3px] border-neon-cyan text-neon-cyan font-black uppercase tracking-widest text-sm hover:bg-neon-cyan/20 transition-all"
              style={{ boxShadow: '4px 4px 0 rgba(0,240,255,0.15)' }}
            >
              Verify 2FA
            </button>
          </motion.div>
        </div>

        <TwoFactorVerifyModal
          isOpen={show2FA}
          onClose={() => setShow2FA(false)}
          onVerified={handleVerified}
          title="Console Access"
          description="Enter your 2FA code to access the terminal console."
        />
      </div>
    );
  }

  // Console disabled globally
  if (!consoleEnabled) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-[3px] border-tx/10 bg-brutal-card p-8 max-w-md text-center"
        >
          <Lock className="w-12 h-12 text-tx/20 mx-auto mb-4" />
          <h2 className="text-xl font-black uppercase tracking-tight text-tx mb-2">Console Disabled</h2>
          <p className="text-sm text-tx/30 font-mono">
            The console has been disabled globally. Enable it in setup or Settings.
          </p>
        </motion.div>
      </div>
    );
  }

  // Main console UI
  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <TerminalIcon className="w-7 h-7 text-neon-cyan" />
          <h1 className="text-2xl font-black uppercase tracking-tight text-tx">Console</h1>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-tx/20 border border-tx/10 px-2 py-0.5">
            {nodes.length} node{nodes.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSplit}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest border-[3px] transition-all',
              splitMode
                ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan'
                : 'border-tx/10 text-tx/30 hover:border-neon-cyan/30 hover:text-neon-cyan',
            )}
          >
            <ViewColumns2 className="w-4 h-4" />
            {splitMode ? 'Split On' : 'Split View'}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Node list sidebar */}
        <div className="w-56 flex-shrink-0 flex flex-col min-h-0">
          <div className="text-[10px] font-black uppercase tracking-widest text-tx/20 mb-2 px-1">
            Nodes
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
            {loading ? (
              <div className="text-xs text-tx/20 font-mono animate-pulse px-2">Loading nodes...</div>
            ) : nodes.length === 0 ? (
              <div className="text-xs text-tx/20 font-mono px-2">No nodes registered</div>
            ) : (
              nodes.map(node => (
                <NodeCard
                  key={node.id}
                  node={node}
                  selected={terminals.some(t => t.node.id === node.id)}
                  onSelect={openTerminal}
                  disabled={!node.console_enabled || node.status !== 'online'}
                />
              ))
            )}
          </div>

          {/* Hints */}
          <div className="mt-3 pt-3 border-t-[2px] border-tx/5 flex-shrink-0">
            <div className="text-[9px] font-mono text-tx/15 leading-relaxed space-y-1">
              <div>Click a node to open terminal</div>
              <div>Use Split View for 2 terminals</div>
              <div className="flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> = console disabled
              </div>
            </div>
          </div>
        </div>

        {/* Terminal area */}
        <div className="flex-1 min-w-0 min-h-0">
          {terminals.length === 0 ? (
            /* Empty state */
            <div className="h-full flex items-center justify-center border-[3px] border-dashed border-tx/8 bg-brutal-card/30">
              <div className="text-center">
                <TerminalIcon className="w-16 h-16 text-tx/8 mx-auto mb-4" />
                <p className="text-sm font-bold uppercase tracking-widest text-tx/15">
                  Select a node to open terminal
                </p>
                <p className="text-[10px] font-mono text-tx/10 mt-2">
                  SSH connection uses auto-generated Nexus keypair
                </p>
              </div>
            </div>
          ) : (
            /* Terminal panels */
            <div className={clsx(
              'h-full gap-3',
              splitMode && terminals.length === 2 ? 'grid grid-cols-2' : 'flex flex-col',
            )}>
              <AnimatePresence mode="sync">
                {terminals.map(term => (
                  <TerminalPanel
                    key={term.id}
                    socket={socket}
                    node={term.node}
                    panelId={term.id}
                    onClose={closeTerminal}
                    isSplit={splitMode && terminals.length > 1}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Console;
