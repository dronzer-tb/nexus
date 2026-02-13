import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  List, ArrowLeft, Cpu, ElectronicsChip, Flash, Activity,
  Search, Refresh, XmarkCircle, Pause, Undo, Filter, NavArrowUp, NavArrowDown
} from 'iconoir-react';
import axios from 'axios';

/* ─── Helpers ─── */
const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/* ─── Stat Card ─── */
const StatCard = ({ label, value, sub, icon: Icon, color, active, onClick }) => (
  <button
    onClick={onClick}
    className={`border-[3px] p-4 bg-brutal-card transition-all text-left w-full hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal ${
      active ? 'shadow-brutal translate-x-[-2px] translate-y-[-2px]' : ''
    }`}
    style={{ borderColor: `${color}${active ? '' : '30'}`, boxShadow: active ? `4px 4px 0 ${color}40` : undefined }}
  >
    <div className="flex items-center justify-between mb-1">
      <span className="text-[9px] font-bold uppercase tracking-widest text-tx/30">{label}</span>
      {Icon && <Icon className="w-4 h-4" style={{ color }} />}
    </div>
    <div className="text-2xl font-black tracking-tighter" style={{ color }}>{value}</div>
    {sub && <div className="text-[9px] font-mono text-tx/25 mt-0.5">{sub}</div>}
  </button>
);

/* ─── Per-Node Process Manager ─── */
function NodeProcesses({ socket }) {
  const { agentId } = useParams();
  const [node, setNode] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('cpu');
  const [sortDir, setSortDir] = useState('desc');
  const [filterBy, setFilterBy] = useState('all'); // all, high-cpu, high-mem
  const [actionInProgress, setActionInProgress] = useState(null);

  const token = localStorage.getItem('token');

  const fetchData = useCallback(async () => {
    try {
      const [nodeRes, metricsRes] = await Promise.all([
        axios.get(`/api/nodes/${agentId}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`/api/metrics/${agentId}/latest?limit=1`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (nodeRes.data.success) setNode(nodeRes.data.node);
      if (metricsRes.data.success && metricsRes.data.metrics?.length > 0) {
        const data = metricsRes.data.metrics[0].data;
        setMetrics(data);
        if (data?.processes?.list) {
          setProcesses(data.processes.list);
        }
      }
    } catch (err) {
      console.error('Failed to fetch process data:', err);
    } finally {
      setLoading(false);
    }
  }, [agentId, token]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);

    if (socket) {
      socket.on('nodes:update', (nodes) => {
        const current = nodes.find(n => n.id === agentId);
        if (current) setNode(prev => prev ? { ...prev, status: current.status } : prev);
      });
    }

    return () => {
      clearInterval(interval);
      if (socket) socket.off('nodes:update');
    };
  }, [agentId, socket, fetchData]);

  const handleKill = async (pid) => {
    if (!confirm(`Kill process ${pid}?`)) return;
    setActionInProgress(pid);
    try {
      await axios.post(`/api/nodes/${agentId}/processes/${pid}/kill`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTimeout(fetchData, 1000);
    } catch (err) {
      alert('Failed to kill process: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSignal = async (pid, signal) => {
    setActionInProgress(pid);
    try {
      await axios.post(`/api/nodes/${agentId}/processes/${pid}/signal`, { signal }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTimeout(fetchData, 1000);
    } catch (err) {
      // Fallback if signal endpoint doesn't exist - use kill
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        handleKill(pid);
        return;
      }
      alert('Signal not supported');
    } finally {
      setActionInProgress(null);
    }
  };

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  // Filter and sort processes
  const getProcessed = () => {
    let list = [...processes];

    // Search
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p => (p.name || '').toLowerCase().includes(s) || String(p.pid).includes(s));
    }

    // Filter
    if (filterBy === 'high-cpu') list = list.filter(p => (p.cpu || 0) > 10);
    else if (filterBy === 'high-mem') list = list.filter(p => (p.mem || 0) > 5);

    // Sort
    list.sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return list;
  };

  const processedList = getProcessed();
  const isOnline = node?.status === 'online';
  const cpuUsage = metrics?.cpu?.usage || 0;
  const memUsage = metrics?.memory?.usagePercent || 0;
  const swapUsage = metrics?.swap?.usagePercent || 0;
  const totalProcs = metrics?.processes?.all || 0;
  const runningProcs = metrics?.processes?.running || 0;

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return null;
    return sortDir === 'desc' ? <NavArrowDown className="w-3 h-3 inline" /> : <NavArrowUp className="w-3 h-3 inline" />;
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back link */}
      <Link to={`/nodes/${agentId}`}
        className="inline-flex items-center gap-2 text-neon-pink/60 hover:text-neon-pink text-xs font-bold uppercase tracking-wider mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to {node?.hostname || 'Node'}
      </Link>

      {/* Header */}
      <header className="mb-6 border-b-[3px] border-neon-purple/20 pb-4">
        <div className="flex items-center gap-4">
          <List className="w-8 h-8 text-neon-purple" strokeWidth={2.5} />
          <div className="flex-1">
            <h1 className="text-4xl font-black uppercase tracking-tighter leading-[0.9]">
              <span className="text-tx">Node</span>{' '}
              <span className="text-neon-purple" style={{ textShadow: '0 0 25px var(--neon-purple)' }}>Processes</span>
            </h1>
            <div className="font-mono text-[10px] text-tx/30 mt-1 tracking-wider uppercase flex items-center gap-3">
              <span>{node?.hostname || agentId.substring(0, 16)}</span>
              <span className={`px-2 py-0.5 border text-[8px] font-bold uppercase tracking-widest ${
                isOnline ? 'border-neon-cyan/40 text-neon-cyan' : 'border-red-500/40 text-red-400'
              }`}>
                {isOnline ? '● ONLINE' : '● OFFLINE'}
              </span>
            </div>
          </div>
          <button onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 border-2 border-tx/10 text-tx/30 hover:text-neon-purple hover:border-neon-purple/30 transition-all font-bold uppercase text-[9px] tracking-widest">
            <Refresh className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </header>

      {/* Resource stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="CPU" value={`${cpuUsage.toFixed(1)}%`} icon={Cpu} color="var(--neon-pink)"
          sub={node?.system_info?.cpu?.brand || '—'}
          active={filterBy === 'high-cpu'} onClick={() => setFilterBy(f => f === 'high-cpu' ? 'all' : 'high-cpu')} />
        <StatCard label="Memory" value={`${memUsage.toFixed(1)}%`} icon={ElectronicsChip} color="var(--neon-cyan)"
          sub={metrics?.memory ? `${formatBytes(metrics.memory.active || 0)} / ${formatBytes(metrics.memory.total)}` : '—'}
          active={filterBy === 'high-mem'} onClick={() => setFilterBy(f => f === 'high-mem' ? 'all' : 'high-mem')} />
        <StatCard label="Swap" value={`${swapUsage.toFixed(1)}%`} icon={Flash} color="var(--neon-purple)"
          sub={metrics?.swap ? `${formatBytes(metrics.swap.used || 0)} / ${formatBytes(metrics.swap.total)}` : '—'}
          onClick={() => {}} />
        <StatCard label="Processes" value={totalProcs} icon={Activity} color="var(--neon-yellow)"
          sub={`${runningProcs} running`}
          onClick={() => setFilterBy('all')} />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or PID..."
            className="w-full bg-brutal-card border-[3px] border-tx/10 text-tx px-4 py-2 pl-9 font-mono text-xs focus:outline-none focus:border-neon-purple/40 transition-colors"
          />
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-tx/30" />
        </div>

        <div className="relative">
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value)}
            className="appearance-none bg-brutal-card border-[3px] border-tx/10 text-tx px-4 py-2 pr-8 font-bold uppercase text-[10px] tracking-widest focus:outline-none focus:border-neon-purple/40 transition-colors cursor-pointer"
          >
            <option value="all">All Processes</option>
            <option value="high-cpu">High CPU (&gt;10%)</option>
            <option value="high-mem">High Memory (&gt;5%)</option>
          </select>
          <Filter className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-tx/30 pointer-events-none" />
        </div>

        <div className="font-mono text-[10px] text-tx/20 tracking-wider uppercase">
          {processedList.length} of {processes.length}
        </div>
      </div>

      {/* Process table */}
      <div className="border-[3px] border-neon-purple/15 bg-brutal-card shadow-brutal overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-tx/25 border-b-[3px] border-neon-purple/10 bg-neon-purple/[0.03]">
          <div className="col-span-1 cursor-pointer hover:text-neon-purple" onClick={() => toggleSort('pid')}>
            PID <SortIcon field="pid" />
          </div>
          <div className="col-span-4">Name</div>
          <div className="col-span-2 text-right cursor-pointer hover:text-neon-pink" onClick={() => toggleSort('cpu')}>
            CPU % <SortIcon field="cpu" />
          </div>
          <div className="col-span-2 text-right cursor-pointer hover:text-neon-cyan" onClick={() => toggleSort('mem')}>
            MEM % <SortIcon field="mem" />
          </div>
          <div className="col-span-3 text-right">Actions</div>
        </div>

        {/* Process rows */}
        <div className="max-h-[calc(100vh-500px)] min-h-[200px] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-8 text-center font-mono text-tx/20">Loading processes...</div>
          ) : processedList.length === 0 ? (
            <div className="p-8 text-center">
              <List className="w-8 h-8 text-tx/10 mx-auto mb-3" />
              <div className="font-mono text-tx/20 text-sm">
                {search ? 'No matching processes' : 'No process data available'}
              </div>
            </div>
          ) : (
            processedList.map((proc, i) => (
              <motion.div
                key={`${proc.pid}-${i}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.01 }}
                className="grid grid-cols-12 gap-2 px-4 py-2 text-xs border-b border-neon-purple/[0.04] hover:bg-neon-purple/[0.03] transition-colors items-center group"
              >
                <div className="col-span-1 font-mono text-tx/30">{proc.pid}</div>
                <div className="col-span-4 font-bold text-tx/80 truncate" title={proc.name}>{proc.name}</div>
                <div className="col-span-2 text-right font-mono font-bold"
                  style={{ color: (proc.cpu || 0) > 50 ? 'var(--neon-pink)' : (proc.cpu || 0) > 10 ? 'var(--neon-yellow)' : 'var(--neon-cyan)' }}>
                  {(proc.cpu || 0).toFixed(1)}
                </div>
                <div className="col-span-2 text-right font-mono text-tx/40">
                  {(proc.mem || 0).toFixed(1)}
                </div>
                <div className="col-span-3 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {actionInProgress === proc.pid ? (
                    <span className="text-[9px] font-mono text-neon-yellow animate-pulse">Working...</span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleSignal(proc.pid, 'SIGSTOP')}
                        className="px-2 py-1 border border-neon-yellow/30 text-neon-yellow/60 hover:bg-neon-yellow/10 text-[8px] font-bold uppercase tracking-wider transition-all"
                        title="Stop (SIGSTOP)"
                      >
                        <Pause className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleSignal(proc.pid, 'SIGCONT')}
                        className="px-2 py-1 border border-neon-cyan/30 text-neon-cyan/60 hover:bg-neon-cyan/10 text-[8px] font-bold uppercase tracking-wider transition-all"
                        title="Resume (SIGCONT)"
                      >
                        <Undo className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleKill(proc.pid)}
                        className="px-2 py-1 border border-red-500/30 text-red-500/60 hover:bg-red-500/10 text-[8px] font-bold uppercase tracking-wider transition-all"
                        title="Kill (SIGKILL)"
                      >
                        <XmarkCircle className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Footer hint */}
      <div className="font-mono text-[9px] text-tx/15 mt-3 flex gap-4 uppercase tracking-wider">
        <span>Click stat cards to filter</span>
        <span>Click column headers to sort</span>
        <span>Hover rows for actions</span>
        <span>Auto-refresh: 5s</span>
      </div>
    </div>
  );
}

export default NodeProcesses;
