import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Search, Trash2, RefreshCw, Download, Filter, ChevronDown } from 'lucide-react';
import axios from 'axios';

/* ─── Brutalist Log Viewer ─── */
function Logs({ socket }) {
  const [logs, setLogs] = useState([]);
  const [serverLogs, setServerLogs] = useState([]);
  const [source, setSource] = useState('server'); // 'server' or 'events'
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [loading, setLoading] = useState(false);
  const logsRef = useRef(null);

  const token = localStorage.getItem('token');

  // Fetch event logs (in-memory)
  const fetchEventLogs = async () => {
    try {
      const response = await axios.get('/api/logs', {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 500 }
      });
      setLogs(response.data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  // Fetch server logs (from nexus.log file)
  const fetchServerLogs = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/logs/server', {
        headers: { Authorization: `Bearer ${token}` },
        params: { lines: 500 }
      });
      setServerLogs(response.data.logs || []);
    } catch (error) {
      console.error('Failed to fetch server logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventLogs();
    fetchServerLogs();

    if (socket) {
      socket.on('log:new', (log) => {
        setLogs(prev => [log, ...prev].slice(0, 1000));
      });
    }

    const interval = setInterval(fetchServerLogs, 10000);

    return () => {
      clearInterval(interval);
      if (socket) socket.off('log:new');
    };
  }, [socket]);

  useEffect(() => {
    if (autoScroll && logsRef.current) {
      logsRef.current.scrollTop = 0;
    }
  }, [logs, serverLogs, autoScroll]);

  const clearLogs = async () => {
    if (!confirm('Clear all event logs?')) return;
    try {
      await axios.delete('/api/logs', { headers: { Authorization: `Bearer ${token}` } });
      setLogs([]);
    } catch { alert('Failed to clear logs'); }
  };

  const currentLogs = source === 'server' ? serverLogs : logs;

  const getFilteredLogs = () => {
    let filtered = currentLogs;
    if (filter !== 'all') {
      filtered = filtered.filter(log => log.level === filter);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(log =>
        (log.message || '').toLowerCase().includes(searchLower) ||
        (log.meta && JSON.stringify(log.meta).toLowerCase().includes(searchLower))
      );
    }
    return filtered;
  };

  const getLevelStyle = (level) => {
    switch (level) {
      case 'error': return { color: 'var(--theme-danger)', bg: 'var(--theme-danger)', border: 'var(--theme-danger)' };
      case 'warn': return { color: 'var(--neon-yellow)', bg: 'var(--neon-yellow)', border: 'var(--neon-yellow)' };
      case 'info': return { color: 'var(--neon-cyan)', bg: 'var(--neon-cyan)', border: 'var(--neon-cyan)' };
      case 'debug': return { color: 'var(--neon-purple)', bg: 'var(--neon-purple)', border: 'var(--neon-purple)' };
      default: return { color: 'var(--theme-text-secondary)', bg: 'var(--theme-text-secondary)', border: 'var(--theme-text-secondary)' };
    }
  };

  const filteredLogs = getFilteredLogs();

  const downloadLogs = () => {
    const text = filteredLogs.map(l =>
      `[${l.timestamp || ''}] [${(l.level || 'info').toUpperCase()}] ${l.message || ''}`
    ).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-8 border-b-[3px] border-neon-pink/20 pb-6">
        <div className="flex items-center gap-4">
          <FileText className="w-10 h-10 text-neon-pink" strokeWidth={2.5} />
          <div>
            <h1 className="text-5xl font-black uppercase tracking-tighter leading-[0.9]">
              <span className="text-tx">System</span>{' '}
              <span className="text-neon-pink" style={{ textShadow: '0 0 25px var(--neon-pink)' }}>Logs</span>
            </h1>
            <div className="font-mono text-[10px] text-tx/30 mt-2 tracking-wider uppercase">
              Server output · Event stream · Real-time monitoring
            </div>
          </div>
        </div>
      </header>

      {/* Source toggle + Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        {/* Source tabs */}
        <div className="flex border-[3px] border-tx/10">
          <button
            onClick={() => setSource('server')}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
              source === 'server'
                ? 'bg-neon-pink text-white'
                : 'bg-brutal-card text-tx/40 hover:text-neon-pink'
            }`}
            style={source === 'server' ? { color: 'var(--on-neon-pink)', backgroundColor: 'var(--neon-pink)' } : undefined}
          >
            Server Logs
          </button>
          <button
            onClick={() => setSource('events')}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-l-[3px] border-tx/10 transition-all ${
              source === 'events'
                ? 'bg-neon-cyan text-white'
                : 'bg-brutal-card text-tx/40 hover:text-neon-cyan'
            }`}
            style={source === 'events' ? { color: 'var(--on-neon-cyan)', backgroundColor: 'var(--neon-cyan)' } : undefined}
          >
            Event Logs
          </button>
        </div>

        {/* Level filter */}
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="appearance-none bg-brutal-card border-[3px] border-tx/10 text-tx px-4 py-2 pr-8 font-bold uppercase text-[10px] tracking-widest focus:outline-none focus:border-neon-pink/40 transition-colors cursor-pointer"
          >
            <option value="all">All Levels</option>
            <option value="error">Error</option>
            <option value="warn">Warning</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
          <Filter className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-tx/30 pointer-events-none" />
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="w-full bg-brutal-card border-[3px] border-tx/10 text-tx px-4 py-2 pl-9 font-mono text-xs focus:outline-none focus:border-neon-pink/40 transition-colors"
          />
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-tx/30" />
        </div>

        {/* Auto-scroll toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <div className={`w-4 h-4 border-2 flex items-center justify-center transition-all ${
            autoScroll ? 'bg-neon-pink border-neon-pink' : 'border-tx/20'
          }`}
            onClick={() => setAutoScroll(!autoScroll)}
          >
            {autoScroll && <div className="w-2 h-2 bg-white" style={{ backgroundColor: 'var(--on-neon-pink)' }} />}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-tx/40">Auto-scroll</span>
        </label>

        {/* Action buttons */}
        <button onClick={source === 'server' ? fetchServerLogs : fetchEventLogs}
          className="p-2 border-2 border-tx/10 text-tx/30 hover:text-neon-pink hover:border-neon-pink/40 transition-colors"
          title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <button onClick={downloadLogs}
          className="p-2 border-2 border-tx/10 text-tx/30 hover:text-neon-cyan hover:border-neon-cyan/40 transition-colors"
          title="Download">
          <Download className="w-4 h-4" />
        </button>
        {source === 'events' && (
          <button onClick={clearLogs}
            className="p-2 border-2 border-red-500/30 text-red-500/40 hover:text-red-400 hover:border-red-500/50 transition-colors"
            title="Clear">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Log count */}
      <div className="flex justify-between items-center mb-2">
        <div className="font-mono text-[10px] text-tx/20 tracking-wider uppercase">
          Showing {filteredLogs.length} of {currentLogs.length} entries
        </div>
        <div className="flex gap-3">
          {['error', 'warn', 'info', 'debug'].map(level => {
            const count = currentLogs.filter(l => l.level === level).length;
            if (count === 0) return null;
            const style = getLevelStyle(level);
            return (
              <span key={level} className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: style.color }}>
                {level}: {count}
              </span>
            );
          })}
        </div>
      </div>

      {/* Log container */}
      <div
        ref={logsRef}
        className="border-[3px] border-neon-pink/15 bg-brutal-card shadow-brutal h-[calc(100vh-340px)] min-h-[400px] overflow-y-auto custom-scrollbar"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <FileText className="w-12 h-12 text-tx/10 mb-4" />
            <div className="font-bold text-tx/20 uppercase tracking-wider text-sm">No logs found</div>
            <div className="font-mono text-tx/10 text-[10px] mt-1">
              {search ? 'Try adjusting your search or filter' : 'Logs will appear as the system runs'}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-tx/[0.04]">
            {filteredLogs.map((log, index) => {
              const style = getLevelStyle(log.level);
              return (
                <div key={index}
                  className="px-4 py-2.5 hover:bg-neon-pink/[0.02] transition-colors group flex items-start gap-3"
                >
                  {/* Timestamp */}
                  <span className="font-mono text-[10px] text-tx/20 whitespace-nowrap shrink-0 mt-0.5">
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}
                  </span>

                  {/* Level badge */}
                  <span
                    className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 border"
                    style={{
                      color: style.color,
                      borderColor: style.border + '40',
                      backgroundColor: style.bg + '10',
                    }}
                  >
                    {(log.level || 'info').toUpperCase()}
                  </span>

                  {/* Message */}
                  <span className="font-mono text-xs text-tx/70 flex-1 break-all leading-relaxed">
                    {log.message}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Logs;
