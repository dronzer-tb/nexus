import { useEffect, useRef, useMemo } from 'react';
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

let _sessionCounter = 0;

/**
 * Reusable terminal widget — mounts xterm into a container,
 * connects via WebSocket events, and handles lifecycle.
 *
 * Each widget creates a unique sessionId so multiple terminals
 * on the same socket don't interfere with each other (split mode).
 *
 * Props:
 *  - socket        : socket.io instance
 *  - nodeId        : the node id to connect to
 *  - isLocal       : if true, uses local PTY instead of SSH
 *  - host          : SSH host (for remote)
 *  - username      : SSH username (for remote)
 *  - onConnected   : callback when terminal connects
 *  - onDisconnected: callback when terminal closes
 *  - onError       : callback on error
 *  - className     : extra CSS classes for the container
 */
export default function TerminalWidget({
  socket,
  nodeId,
  isLocal = false,
  host,
  username,
  onConnected,
  onDisconnected,
  onError,
  className = '',
}) {
  const termRef = useRef(null);
  const termInstance = useRef(null);
  const fitAddon = useRef(null);
  const cleanupRef = useRef(null);

  // Generate a stable unique sessionId for this widget instance
  const sessionId = useMemo(() => `term_${Date.now()}_${++_sessionCounter}`, []);

  // Store callbacks in refs so they never trigger re-connect cycles
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  const onErrorRef = useRef(onError);
  onConnectedRef.current = onConnected;
  onDisconnectedRef.current = onDisconnected;
  onErrorRef.current = onError;

  // Initialize terminal once on mount, tear down on unmount
  useEffect(() => {
    if (!termRef.current || !socket) return;
    if (termInstance.current) return; // already mounted

    const term = new Terminal({
      theme: TERMINAL_THEME,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      cursorStyle: 'bar',
      allowTransparency: true,
      scrollback: 10000,
      convertEol: true,
    });

    const fit = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);

    term.open(termRef.current);
    termInstance.current = term;
    fitAddon.current = fit;

    // Fit after render
    setTimeout(() => {
      try { fit.fit(); } catch {}
    }, 50);

    // Terminal input → socket (scoped by sessionId)
    term.onData((data) => socket.emit('terminal:data', { sessionId, data }));
    term.onResize(({ cols, rows }) => socket.emit('terminal:resize', { sessionId, cols, rows }));

    // Socket → terminal output handlers (filtered by sessionId)
    const handleData = (payload) => {
      // Support both old format (string) and new format ({ sessionId, data })
      if (typeof payload === 'object' && payload.sessionId) {
        if (payload.sessionId !== sessionId) return; // not for us
        term.write(payload.data);
      } else {
        // Legacy: no sessionId — write to all (backwards compat)
        term.write(payload);
      }
    };
    const handleConnected = (info) => {
      if (info && info.sessionId && info.sessionId !== sessionId) return;
      term.focus();
      setTimeout(() => {
        try {
          fit.fit();
          socket.emit('terminal:resize', { sessionId, cols: term.cols, rows: term.rows });
        } catch {}
      }, 150);
      onConnectedRef.current?.(info);
    };
    const handleError = (err) => {
      if (err && err.sessionId && err.sessionId !== sessionId) return;
      onErrorRef.current?.(err);
    };
    const handleClosed = (info) => {
      if (info && info.sessionId && info.sessionId !== sessionId) return;
      term.writeln('\r\n\x1b[31m── Session ended ──\x1b[0m');
      onDisconnectedRef.current?.();
    };

    socket.on('terminal:data', handleData);
    socket.on('terminal:connected', handleConnected);
    socket.on('terminal:error', handleError);
    socket.on('terminal:closed', handleClosed);

    cleanupRef.current = () => {
      socket.off('terminal:data', handleData);
      socket.off('terminal:connected', handleConnected);
      socket.off('terminal:error', handleError);
      socket.off('terminal:closed', handleClosed);
    };

    // Start connection (include sessionId)
    socket.emit('terminal:connect', {
      sessionId,
      nodeId,
      isLocal,
      host: host || undefined,
      username: username || undefined,
    });

    return () => {
      cleanupRef.current?.();
      if (socket) socket.emit('terminal:disconnect', { sessionId });
      if (termInstance.current) {
        termInstance.current.dispose();
        termInstance.current = null;
      }
    };
  // Only re-connect when connection identity changes, NOT when callbacks change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, nodeId, isLocal, host, username, sessionId]);

  // Window resize → refit
  useEffect(() => {
    const handleResize = () => {
      try { fitAddon.current?.fit(); } catch {}
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Observe container resize (for split view changes)
  useEffect(() => {
    if (!termRef.current) return;
    let cleanup;
    if (typeof ResizeObserver !== 'undefined') {
      const obs = new ResizeObserver(() => {
        try { fitAddon.current?.fit(); } catch {}
      });
      obs.observe(termRef.current);
      cleanup = () => obs.disconnect();
    } else {
      const interval = setInterval(() => {
        try { fitAddon.current?.fit(); } catch {}
      }, 1000);
      cleanup = () => clearInterval(interval);
    }
    return cleanup;
  }, []);

  return (
    <div
      ref={termRef}
      className={`bg-[#0a0a0f] ${className}`}
      style={{ padding: '6px', height: '100%', minHeight: '200px' }}
    />
  );
}
