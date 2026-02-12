import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Terminal, ArrowLeft, Send, Trash2, Shield, Lock } from 'lucide-react';
import axios from 'axios';
import TwoFactorVerifyModal from '../components/TwoFactorVerifyModal';

/* ─── Per-Node Console ─── */
function NodeConsole({ socket }) {
  const { agentId } = useParams();
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [executing, setExecuting] = useState(false);
  const [node, setNode] = useState(null);
  const [is2FAVerified, setIs2FAVerified] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [has2FA, setHas2FA] = useState(false);
  const [pendingCommand, setPendingCommand] = useState('');
  const outputRef = useRef(null);
  const inputRef = useRef(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    // Check if user has 2FA enabled
    const check2FAStatus = async () => {
      try {
        const res = await axios.get('/api/2fa/status', { headers: { Authorization: `Bearer ${token}` } });
        setHas2FA(res.data.enabled);
      } catch { /* ignore */ }
    };
    check2FAStatus();

    // Fetch node info
    const fetchNode = async () => {
      try {
        const res = await axios.get(`/api/nodes/${agentId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data.success) setNode(res.data.node);
      } catch { /* ignore */ }
    };
    fetchNode();

    // Fetch command history
    const fetchHistory = async () => {
      try {
        const res = await axios.get('/api/commands/history', { headers: { Authorization: `Bearer ${token}` } });
        setHistory(res.data || []);
      } catch { /* ignore */ }
    };
    fetchHistory();

    if (socket) {
      socket.on('command:output', (data) => {
        setOutput(prev => [...prev, { type: 'output', content: data.output, timestamp: new Date().toLocaleTimeString() }]);
      });
      socket.on('command:error', (data) => {
        setOutput(prev => [...prev, { type: 'error', content: data.error, timestamp: new Date().toLocaleTimeString() }]);
        setExecuting(false);
      });
      socket.on('command:complete', () => setExecuting(false));
    }

    return () => {
      if (socket) {
        socket.off('command:output');
        socket.off('command:error');
        socket.off('command:complete');
      }
    };
  }, [agentId, socket]);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const handleExecute = async () => {
    if (!command.trim() || executing) return;

    // Check if 2FA is required and not yet verified
    if (has2FA && !is2FAVerified) {
      setPendingCommand(command);
      setShow2FAModal(true);
      return;
    }

    setExecuting(true);
    setOutput(prev => [...prev, {
      type: 'command',
      content: `$ ${command}`,
      timestamp: new Date().toLocaleTimeString()
    }]);

    try {
      await axios.post(`/api/agents/${agentId}/execute`,
        { command },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHistory(prev => [command, ...prev.slice(0, 49)]);
      setCommand('');
      setHistoryIndex(-1);
    } catch (error) {
      setOutput(prev => [...prev, {
        type: 'error',
        content: error.response?.data?.message || 'Command execution failed',
        timestamp: new Date().toLocaleTimeString()
      }]);
      setExecuting(false);
    }
  };

  const handle2FAVerified = async (credentials) => {
    // Verify the 2FA code with backend
    try {
      // Just mark as verified locally for this session
      setIs2FAVerified(true);
      setShow2FAModal(false);
      
      // Execute the pending command
      if (pendingCommand) {
        setCommand(pendingCommand);
        setPendingCommand('');
        // Trigger execution after state update
        setTimeout(() => {
          const cmd = pendingCommand;
          setExecuting(true);
          setOutput(prev => [...prev, {
            type: 'command',
            content: `$ ${cmd}`,
            timestamp: new Date().toLocaleTimeString()
          }]);

          axios.post(`/api/agents/${agentId}/execute`,
            { command: cmd },
            { headers: { Authorization: `Bearer ${token}` } }
          ).then(() => {
            setHistory(prev => [cmd, ...prev.slice(0, 49)]);
            setCommand('');
            setHistoryIndex(-1);
          }).catch(error => {
            setOutput(prev => [...prev, {
              type: 'error',
              content: error.response?.data?.message || 'Command execution failed',
              timestamp: new Date().toLocaleTimeString()
            }]);
            setExecuting(false);
          });
        }, 100);
      }
    } catch (err) {
      throw new Error('2FA verification failed');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleExecute();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommand(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(history[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  const isOnline = node?.status === 'online';

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col">
      {/* Back link */}
      <Link to={`/nodes/${agentId}`}
        className="inline-flex items-center gap-2 text-neon-pink/60 hover:text-neon-pink text-xs font-bold uppercase tracking-wider mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to {node?.hostname || 'Node'}
      </Link>

      {/* Header */}
      <header className="mb-6 border-b-[3px] border-neon-cyan/20 pb-4">
        <div className="flex items-center gap-4">
          <Terminal className="w-8 h-8 text-neon-cyan" strokeWidth={2.5} />
          <div className="flex-1">
            <h1 className="text-4xl font-black uppercase tracking-tighter leading-[0.9]">
              <span className="text-tx">Node</span>{' '}
              <span className="text-neon-cyan" style={{ textShadow: '0 0 25px var(--neon-cyan)' }}>Console</span>
            </h1>
            <div className="font-mono text-[10px] text-tx/30 mt-1 tracking-wider uppercase flex items-center gap-3">
              <span>{node?.hostname || agentId.substring(0, 16)}</span>
              <span className={`px-2 py-0.5 border text-[8px] font-bold uppercase tracking-widest ${
                isOnline ? 'border-neon-cyan/40 text-neon-cyan' : 'border-red-500/40 text-red-400'
              }`}>
                {isOnline ? '● ONLINE' : '● OFFLINE'}
              </span>
              {has2FA && (
                <span className={`px-2 py-0.5 border text-[8px] font-bold uppercase tracking-widest flex items-center gap-1 ${
                  is2FAVerified ? 'border-neon-cyan/40 text-neon-cyan' : 'border-neon-yellow/40 text-neon-yellow'
                }`}>
                  {is2FAVerified ? <Shield className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                  {is2FAVerified ? '2FA VERIFIED' : '2FA REQUIRED'}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => setOutput([])}
            className="flex items-center gap-2 px-3 py-2 border-2 border-tx/10 text-tx/30 hover:text-red-400 hover:border-red-500/30 transition-all font-bold uppercase text-[9px] tracking-widest">
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        </div>
      </header>

      {/* Output area */}
      <div
        ref={outputRef}
        className="flex-1 min-h-[300px] border-[3px] border-neon-cyan/15 bg-brutal-card shadow-brutal overflow-y-auto custom-scrollbar mb-4"
      >
        {output.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Terminal className="w-10 h-10 text-tx/10 mx-auto mb-3" />
              <div className="font-mono text-tx/20 text-sm">Ready for commands</div>
              <div className="font-mono text-tx/10 text-[10px] mt-1">
                Type a command below and press Enter to execute on {node?.hostname || 'this node'}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-1">
            {output.map((line, index) => (
              <div key={index} className="font-mono text-xs leading-relaxed flex items-start gap-2">
                <span className="text-tx/15 text-[10px] shrink-0">[{line.timestamp}]</span>
                <span className={
                  line.type === 'command' ? 'text-neon-cyan font-bold' :
                  line.type === 'error' ? 'text-red-400' :
                  'text-tx/60'
                }>
                  {line.content}
                </span>
              </div>
            ))}
            {executing && (
              <div className="font-mono text-[10px] text-neon-cyan/40 animate-pulse">
                ▍ Executing...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Command input */}
      <div className="border-[3px] border-neon-cyan/20 bg-brutal-card p-3 flex gap-3 items-center shadow-brutal-cyan">
        <span className="font-mono text-neon-cyan font-bold text-sm shrink-0">$</span>
        <input
          ref={inputRef}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={executing || !isOnline}
          className="flex-1 bg-transparent font-mono text-sm text-tx focus:outline-none placeholder:text-tx/15 disabled:opacity-40"
          placeholder={isOnline ? 'Enter command...' : 'Node is offline'}
          type="text"
          autoFocus
        />
        <button
          onClick={handleExecute}
          disabled={executing || !command.trim() || !isOnline}
          className="px-4 py-2 bg-neon-cyan border-2 border-neon-cyan font-bold uppercase text-[10px] tracking-widest hover:translate-x-[2px] hover:translate-y-[2px] shadow-brutal-sm hover:shadow-none transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          style={{ color: 'var(--on-neon-cyan)' }}
        >
          <Send className="w-3 h-3" />
          {executing ? 'Running...' : 'Execute'}
        </button>
      </div>

      {/* Hints */}
      <div className="font-mono text-[9px] text-tx/15 mt-2 flex gap-4 uppercase tracking-wider">
        <span>↑↓ History</span>
        <span>Enter Execute</span>
        <span>History: {history.length} cmds</span>
        {has2FA && !is2FAVerified && (
          <span className="text-neon-yellow">⚠ 2FA Required for Execution</span>
        )}
      </div>

      {/* 2FA Verification Modal */}
      <TwoFactorVerifyModal
        isOpen={show2FAModal}
        onClose={() => setShow2FAModal(false)}
        onVerified={handle2FAVerified}
        title="Verify Console Access"
        description="Enter your 2FA code to authorize command execution. This verification is valid for the current session."
      />
    </div>
  );
}

export default NodeConsole;
