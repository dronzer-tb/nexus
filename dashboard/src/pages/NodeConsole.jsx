import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Terminal as TerminalIcon, Lock, Shield, WarningTriangle } from 'iconoir-react';
import axios from 'axios';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

/* ─── Neon Cyan xterm theme ─── */
const TERMINAL_THEME = {
  background: '#0a0a0f',
  foreground: '#e0e0e8',
  cursor: '#00f0ff',
  cursorAccent: '#0a0a0f',
  selectionBackground: '#00f0ff30',
  selectionForeground: '#ffffff',
  black: '#0a0a0f',
  red: '#ff3860',
  green: '#00e676',
  yellow: '#ffdd57',
  blue: '#3d7aed',
  magenta: '#ff66c4',
  cyan: '#00f0ff',
  white: '#e0e0e8',
  brightBlack: '#4a4a5a',
  brightRed: '#ff5c7c',
  brightGreen: '#69f0ae',
  brightYellow: '#ffeb3b',
  brightBlue: '#6c9eff',
  brightMagenta: '#ff8fd4',
  brightCyan: '#66ffff',
  brightWhite: '#ffffff',
};

/* ─── Connection Form ─── */
const ConnectionForm = ({ node, onConnect, loading }) => {
  const [mode, setMode] = useState('local');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (node?.ip) {
      setHost(node.ip);
    }
  }, [node]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'local') {
      onConnect({ isLocal: true });
    } else {
      onConnect({ host, port: parseInt(port, 10), username, password });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-[3px] border-neon-cyan/20 bg-brutal-card p-6 max-w-lg mx-auto"
      style={{ boxShadow: '6px 6px 0 rgba(0,240,255,0.1)' }}
    >
      <div className="flex items-center gap-3 mb-6">
        <TerminalIcon className="w-6 h-6 text-neon-cyan" />
        <h3 className="text-lg font-black uppercase tracking-wider text-tx">Connect Terminal</h3>
      </div>

      <div className="flex gap-2 mb-6">
        {['local', 'ssh'].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-[3px] transition-all ${
              mode === m
                ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan'
                : 'border-tx/10 text-tx/40 hover:border-tx/30'
            }`}
          >
            {m === 'local' ? 'Local Shell' : 'SSH Remote'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'ssh' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-tx/30 mb-1 block">Host</label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="192.168.1.100"
                  required
                  className="w-full bg-brutal-bg border-[3px] border-tx/10 px-3 py-2 text-sm font-mono text-tx focus:border-neon-cyan focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-tx/30 mb-1 block">Port</label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="w-full bg-brutal-bg border-[3px] border-tx/10 px-3 py-2 text-sm font-mono text-tx focus:border-neon-cyan focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-tx/30 mb-1 block">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="root"
                required
                className="w-full bg-brutal-bg border-[3px] border-tx/10 px-3 py-2 text-sm font-mono text-tx focus:border-neon-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-tx/30 mb-1 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-brutal-bg border-[3px] border-tx/10 px-3 py-2 text-sm font-mono text-tx focus:border-neon-cyan focus:outline-none"
              />
            </div>
          </>
        )}

        {mode === 'local' && (
          <div className="bg-brutal-bg border-[3px] border-neon-cyan/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-neon-cyan" />
              <span className="text-xs font-bold uppercase tracking-widest text-neon-cyan">Local Shell</span>
            </div>
            <p className="text-xs text-tx/40 font-mono">
              Opens a terminal on the Nexus server machine. Dangerous commands are blocked by security policy.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-neon-cyan/10 border-[3px] border-neon-cyan text-neon-cyan font-black uppercase tracking-widest text-sm hover:bg-neon-cyan/20 transition-all disabled:opacity-40"
          style={{ boxShadow: '4px 4px 0 rgba(0,240,255,0.15)' }}
        >
          {loading ? 'Connecting...' : mode === 'local' ? 'Open Local Terminal' : 'Connect via SSH'}
        </button>
      </form>
    </motion.div>
  );
};

/* ─── Main NodeConsole ─── */
function NodeConsole({ socket }) {
  const { agentId } = useParams();
  const termRef = useRef(null);
  const termInstanceRef = useRef(null);
  const fitAddonRef = useRef(null);

  const [node, setNode] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [consoleConfig, setConsoleConfig] = useState(null);

  /* ── Load node info ── */
  useEffect(() => {
    axios.get(`/api/nodes/${agentId}`)
      .then((res) => {
        if (res.data.success) setNode(res.data.node);
      })
      .catch(() => {});

    axios.get('/api/console/config')
      .then((res) => {
        if (res.data.success) setConsoleConfig(res.data.config);
      })
      .catch(() => {});
  }, [agentId]);

  /* ── Initialize xterm ── */
  const initTerminal = useCallback(() => {
    if (termInstanceRef.current) return;
    if (!termRef.current) return;

    const term = new Terminal({
      theme: TERMINAL_THEME,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 14,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: 'bar',
      allowTransparency: true,
      scrollback: 10000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(termRef.current);

    // Slight delay to ensure proper sizing
    setTimeout(() => {
      try { fitAddon.fit(); } catch {}
    }, 100);

    termInstanceRef.current = term;
    fitAddonRef.current = fitAddon;

    return term;
  }, []);

  /* ── Handle terminal connect ── */
  const handleConnect = useCallback((connectionInfo) => {
    if (!socket) {
      setError('WebSocket not connected');
      return;
    }

    setConnecting(true);
    setError(null);

    const term = initTerminal();
    if (!term) {
      setConnecting(false);
      setError('Failed to initialize terminal');
      return;
    }

    // Terminal input → socket
    term.onData((data) => {
      socket.emit('terminal:data', data);
    });

    // Handle resize
    term.onResize(({ cols, rows }) => {
      socket.emit('terminal:resize', { cols, rows });
    });

    // Socket → terminal output
    const onData = (data) => {
      term.write(data);
    };

    const onConnected = (info) => {
      setConnected(true);
      setConnecting(false);
      term.focus();

      // Fit after connection
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          const { cols, rows } = term;
          socket.emit('terminal:resize', { cols, rows });
        } catch {}
      }, 200);
    };

    const onError = (err) => {
      setError(err.message || 'Terminal connection error');
      setConnecting(false);
    };

    const onClosed = () => {
      setConnected(false);
      term.writeln('\r\n\x1b[31m── Session ended ──\x1b[0m');
    };

    socket.on('terminal:data', onData);
    socket.on('terminal:connected', onConnected);
    socket.on('terminal:error', onError);
    socket.on('terminal:closed', onClosed);

    // Initiate connection
    socket.emit('terminal:connect', {
      nodeId: agentId,
      ...connectionInfo,
    });

    // Cleanup function stored for disconnect
    termInstanceRef.current._socketCleanup = () => {
      socket.off('terminal:data', onData);
      socket.off('terminal:connected', onConnected);
      socket.off('terminal:error', onError);
      socket.off('terminal:closed', onClosed);
    };
  }, [socket, agentId, initTerminal]);

  /* ── Window resize handler ── */
  useEffect(() => {
    const handleResize = () => {
      try { fitAddonRef.current?.fit(); } catch {}
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      if (termInstanceRef.current) {
        termInstanceRef.current._socketCleanup?.();
        termInstanceRef.current.dispose();
        termInstanceRef.current = null;
      }
      if (socket) {
        socket.emit('terminal:disconnect');
      }
    };
  }, [socket]);

  /* ── Disconnect handler ── */
  const handleDisconnect = () => {
    if (socket) socket.emit('terminal:disconnect');
    if (termInstanceRef.current) {
      termInstanceRef.current._socketCleanup?.();
      termInstanceRef.current.dispose();
      termInstanceRef.current = null;
    }
    setConnected(false);
    setConnecting(false);
    setError(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={`/nodes/${agentId}`}
            className="text-tx/30 hover:text-neon-cyan transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-tx flex items-center gap-3">
              <TerminalIcon className="w-6 h-6 text-neon-cyan" />
              Terminal
              {node && (
                <span className="text-sm font-mono text-tx/30 lowercase">
                  — {node.hostname || node.id}
                </span>
              )}
            </h1>
          </div>
        </div>

        {connected && (
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 text-xs font-black uppercase tracking-widest border-[3px] border-neon-pink/30 text-neon-pink hover:bg-neon-pink/10 transition-all"
          >
            Disconnect
          </button>
        )}
      </div>

      {/* Security Notice */}
      {consoleConfig && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 border-[3px] border-tx/5 bg-brutal-card"
        >
          <Lock className="w-4 h-4 text-tx/30 flex-shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-tx/25">
            Security: {consoleConfig.allowSudo ? 'sudo enabled' : 'sudo disabled'}
            {' · '}
            {consoleConfig.blockedCommands?.length || 0} blocked patterns
            {' · '}
            {consoleConfig.blockedPaths?.length || 0} protected paths
          </span>
        </motion.div>
      )}

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scaleY: 0.9 }}
          animate={{ opacity: 1, scaleY: 1 }}
          className="flex items-center gap-3 px-4 py-3 border-[3px] border-neon-pink/30 bg-neon-pink/5"
        >
          <WarningTriangle className="w-5 h-5 text-neon-pink flex-shrink-0" />
          <span className="text-sm font-mono text-neon-pink">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-xs font-bold text-neon-pink/50 hover:text-neon-pink"
          >
            ✕
          </button>
        </motion.div>
      )}

      {/* Connection Form or Terminal */}
      {!connected && !connecting ? (
        <ConnectionForm
          node={node}
          onConnect={handleConnect}
          loading={connecting}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-[3px] border-neon-cyan/15 overflow-hidden"
          style={{ boxShadow: '6px 6px 0 rgba(0,240,255,0.08)' }}
        >
          {/* Terminal bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0f] border-b-[3px] border-neon-cyan/10">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-neon-pink/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neon-cyan/40">
                {connecting ? 'connecting...' : node?.hostname || 'terminal'}
              </span>
            </div>
            {connected && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-mono text-green-500/60">LIVE</span>
              </div>
            )}
          </div>

          {/* xterm container */}
          <div
            ref={termRef}
            className="bg-[#0a0a0f]"
            style={{ height: 'calc(100vh - 340px)', minHeight: '400px', padding: '8px' }}
          />
        </motion.div>
      )}

      {/* Hints bar */}
      <div className="flex items-center gap-4 px-2">
        <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-tx/15">
          {connected ? 'ctrl+c interrupt · ctrl+d exit · type "exit" to close' : 'select connection type to start'}
        </span>
      </div>
    </motion.div>
  );
}

export default NodeConsole;
