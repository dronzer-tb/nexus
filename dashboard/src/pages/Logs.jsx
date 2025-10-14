import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

function Logs({ socket }) {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsRef = useRef(null);

  useEffect(() => {
    fetchLogs();

    if (socket) {
      socket.on('log:new', (log) => {
        setLogs(prev => [log, ...prev].slice(0, 1000));
      });
    }

    return () => {
      if (socket) {
        socket.off('log:new');
      }
    };
  }, [socket]);

  useEffect(() => {
    if (autoScroll && logsRef.current) {
      logsRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/logs', {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 500 }
      });
      setLogs(response.data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const clearLogs = async () => {
    if (!confirm('Are you sure you want to clear all logs?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete('/api/logs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs([]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
      alert('Failed to clear logs');
    }
  };

  const getFilteredLogs = () => {
    let filtered = logs;

    if (filter !== 'all') {
      filtered = filtered.filter(log => log.level === filter);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(searchLower) ||
        (log.meta && JSON.stringify(log.meta).toLowerCase().includes(searchLower))
      );
    }

    return filtered;
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'error': return 'text-red-400 bg-red-500/20';
      case 'warn': return 'text-yellow-400 bg-yellow-500/20';
      case 'info': return 'text-blue-400 bg-blue-500/20';
      case 'debug': return 'text-gray-400 bg-gray-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const filteredLogs = getFilteredLogs();

  return (
    <main className="flex-1 p-8">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-white">System Logs</h2>
        <p className="text-white/60">View and monitor system logs in real-time</p>
      </header>

      <div className="bg-background-dark/70 rounded-xl border border-primary/20 p-6 mb-4">
        <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
          <div className="flex gap-4 items-center">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-black/50 border border-primary/30 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Levels</option>
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="bg-black/50 border border-primary/30 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <label className="flex items-center gap-2 text-white cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-primary/30 text-primary focus:ring-primary focus:ring-offset-background-dark"
              />
              Auto-scroll
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchLogs}
              className="bg-primary/20 text-primary hover:bg-primary/30 px-4 py-2 rounded-lg transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={clearLogs}
              className="bg-red-500/20 text-red-400 hover:bg-red-500/30 px-4 py-2 rounded-lg transition-colors"
            >
              Clear Logs
            </button>
          </div>
        </div>

        <div
          ref={logsRef}
          className="bg-black/50 rounded-lg p-4 h-[600px] overflow-y-auto font-mono text-sm"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-gray-500">No logs found</div>
          ) : (
            filteredLogs.map((log, index) => (
              <div key={index} className="mb-3 border-b border-gray-800 pb-3 last:border-b-0">
                <div className="flex items-start gap-3">
                  <span className="text-gray-500 text-xs whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${getLevelColor(log.level)}`}>
                    {log.level.toUpperCase()}
                  </span>
                  <span className="text-gray-300 flex-1">{log.message}</span>
                </div>
                {log.meta && Object.keys(log.meta).length > 0 && (
                  <div className="mt-2 ml-32 text-gray-500 text-xs">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(log.meta, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-4 text-center text-gray-500 text-sm">
          Showing {filteredLogs.length} of {logs.length} logs
        </div>
      </div>
    </main>
  );
}

export default Logs;
