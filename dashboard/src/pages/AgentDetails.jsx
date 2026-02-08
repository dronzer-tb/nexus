import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Cpu, MemoryStick, HardDrive, Activity, Zap } from 'lucide-react';
import axios from 'axios';
import MetricsChart from '../components/MetricsChart';

/* ─── Helpers ─── */
const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatUptime = (seconds) => {
  if (!seconds) return 'Unknown';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

/* ─── Stat Card ─── */
const StatCard = ({ label, value, sub, icon: Icon, color, delay = 0, onClick }) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="border-[3px] p-5 bg-brutal-card cursor-pointer hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal transition-all"
    style={{ borderColor: `${color}30`, boxShadow: `4px 4px 0 ${color}20` }}
    onClick={onClick}
  >
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-tx/30">{label}</span>
      {Icon && <Icon className="w-5 h-5" style={{ color }} />}
    </div>
    <div className="text-3xl font-black tracking-tighter" style={{ color }}>{value}</div>
    {sub && <div className="text-[10px] font-mono text-tx/25 mt-1">{sub}</div>}
  </motion.div>
);

/* ─── Brutal Progress Bar ─── */
const BrutalBar = ({ value, label, color, sub }) => (
  <div>
    <div className="flex justify-between font-bold text-xs mb-1.5">
      <span className="text-tx/50 uppercase tracking-wider">{label}</span>
      <span style={{ color }}>{value.toFixed(1)}%</span>
    </div>
    <div className="h-4 border-2 overflow-hidden" style={{ borderColor: `${color}40`, backgroundColor: `${color}08` }}>
      <motion.div
        className="h-full"
        style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 1 }}
      />
    </div>
    {sub && <div className="text-[10px] font-mono text-tx/25 mt-1">{sub}</div>}
  </div>
);

/* ─── Agent Details Page ─── */
function AgentDetails({ socket }) {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [node, setNode] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [latestMetrics, setLatestMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchNodeData();
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);

    if (socket) {
      socket.on('nodes:update', (nodes) => {
        const current = nodes.find(n => n.id === agentId);
        if (current) {
          setNode(prev => prev ? { ...prev, status: current.status, last_seen: current.last_seen } : prev);
        }
      });
    }

    return () => {
      clearInterval(interval);
      if (socket) socket.off('nodes:update');
    };
  }, [agentId, socket]);

  const fetchNodeData = async () => {
    try {
      const response = await axios.get(`/api/nodes/${agentId}`);
      if (response.data.success) setNode(response.data.node);
      else setError('Node not found');
    } catch (err) {
      setError('Failed to load node details');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await axios.get(`/api/metrics/${agentId}/latest?limit=50`);
      if (response.data.success && response.data.metrics) {
        setMetrics(response.data.metrics);
        if (response.data.metrics.length > 0) setLatestMetrics(response.data.metrics[0]);
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="font-mono text-tx/30">Loading node data...</div>
    </div>
  );

  if (error || !node) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <div className="font-bold text-xl text-red-400 uppercase">{error || 'Node not found'}</div>
      <Link to="/nodes" className="text-neon-pink text-sm font-bold uppercase tracking-wider hover:underline">
        ← Back to Nodes
      </Link>
    </div>
  );

  const data = latestMetrics?.data || null;
  const isOnline = node.status === 'online';

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back link */}
      <Link to="/nodes"
        className="inline-flex items-center gap-2 text-neon-pink/60 hover:text-neon-pink text-xs font-bold uppercase tracking-wider mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Nodes
      </Link>

      {/* Node Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="border-[3px] border-neon-pink/20 bg-brutal-card p-6 mb-6 shadow-brutal"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-black uppercase tracking-tighter text-tx">{node.hostname}</h1>
              <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest border-2 ${
                isOnline
                  ? 'border-neon-cyan/40 text-neon-cyan bg-neon-cyan/10'
                  : 'border-red-500/40 text-red-400 bg-red-500/10'
              }`}>
                {isOnline ? '● ONLINE' : '● OFFLINE'}
              </span>
            </div>
            <div className="font-mono text-[10px] text-tx/30 flex gap-4 tracking-wider uppercase">
              <span>ID: {node.id.substring(0, 24)}...</span>
              <span>{node.system_info?.os?.distro || '—'}</span>
              {node.system_info?.uptime && <span>Uptime: {formatUptime(node.system_info.uptime)}</span>}
            </div>
          </div>
          <div className="font-mono text-[10px] bg-brutal-bg border-2 border-neon-pink/10 text-tx/25 p-3 tracking-wider">
            ARCH: {node.system_info?.os?.arch || '—'}<br />
            KERNEL: {node.system_info?.os?.kernel || '—'}
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="CPU" value={`${(data.cpu?.usage || 0).toFixed(1)}%`}
            icon={Cpu} color="var(--neon-pink)" delay={0.1}
            sub={node.system_info?.cpu?.brand}
            onClick={() => navigate(`/nodes/${agentId}/processes`)} />
          <StatCard label="Memory" value={`${(data.memory?.usagePercent || 0).toFixed(1)}%`}
            icon={MemoryStick} color="var(--neon-cyan)" delay={0.15}
            sub={`${formatBytes(data.memory?.active || 0)} used · ${formatBytes(data.memory?.cached || 0)} cached / ${formatBytes(data.memory?.total)}`}
            onClick={() => navigate(`/nodes/${agentId}/processes`)} />
          <StatCard label="Swap" value={`${(data.swap?.usagePercent || 0).toFixed(1)}%`}
            icon={Zap} color="var(--neon-purple)" delay={0.2}
            onClick={() => navigate(`/nodes/${agentId}/processes`)} />
          <StatCard label="Processes" value={data.processes?.all || 0}
            icon={Activity} color="var(--neon-yellow)" delay={0.25}
            sub={`${data.processes?.running || 0} running`}
            onClick={() => navigate(`/nodes/${agentId}/processes`)} />
        </div>
      )}

      {!data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="border-[3px] border-neon-pink/10 bg-brutal-card p-10 mb-6 text-center">
          <div className="font-mono text-tx/30 text-sm">Awaiting metrics data...</div>
          <div className="font-mono text-tx/15 text-[10px] mt-1">Metrics appear once the node starts reporting.</div>
        </motion.div>
      )}

      {/* Metrics Chart */}
      {metrics.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="border-[3px] border-neon-pink/15 bg-brutal-card p-6 mb-6 shadow-brutal">
          <h3 className="font-bold text-sm uppercase tracking-widest text-neon-pink mb-4">
            <span className="bg-neon-pink px-2 py-0.5 text-[10px] mr-2"
              style={{ color: 'var(--on-neon-pink)' }}>LIVE</span>
            Metrics History
          </h3>
          <MetricsChart metrics={metrics} />
        </motion.div>
      )}

      {/* Disk Usage */}
      {data?.disk && data.disk.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
          className="border-[3px] border-neon-cyan/15 bg-brutal-card p-6 mb-6 shadow-brutal-cyan">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-tx/30 mb-4">
            <HardDrive className="w-4 h-4 inline mr-2 text-neon-cyan" />
            Disk Partitions
          </h3>
          <div className="space-y-4">
            {data.disk.map((d, i) => (
              <BrutalBar
                key={i}
                label={d.mount}
                value={d.usagePercent || 0}
                color={d.usagePercent > 90 ? 'var(--neon-pink)' : 'var(--neon-cyan)'}
                sub={`${formatBytes(d.used)} / ${formatBytes(d.size)}`}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Process Table */}
      {data?.processes?.list && data.processes.list.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="border-[3px] border-neon-purple/15 bg-brutal-card shadow-brutal-purple mb-6">
          <div className="px-5 py-3 border-b-[3px] border-neon-purple/10 bg-neon-purple/[0.04] flex justify-between items-center">
            <h3 className="font-bold text-sm uppercase tracking-wider text-neon-purple">Top Processes</h3>
            <span className="font-mono text-[10px] text-tx/25">
              {data.processes.all} total · {data.processes.running} running
            </span>
          </div>

          {/* Process grid header */}
          <div className="grid grid-cols-12 gap-2 px-5 py-2 text-[9px] font-bold uppercase tracking-widest text-tx/20 border-b-2 border-neon-purple/[0.06]">
            <div className="col-span-2">PID</div>
            <div className="col-span-6">Name</div>
            <div className="col-span-2 text-right">CPU %</div>
            <div className="col-span-2 text-right">MEM %</div>
          </div>

          {data.processes.list.slice(0, 10).map((proc, i) => (
            <div key={i}
              className="grid grid-cols-12 gap-2 px-5 py-2.5 text-xs border-b border-neon-purple/[0.04] hover:bg-neon-purple/[0.03] transition-colors"
            >
              <div className="col-span-2 font-mono text-tx/30">{proc.pid}</div>
              <div className="col-span-6 font-bold text-tx/80 truncate">{proc.name}</div>
              <div className="col-span-2 text-right font-mono font-bold"
                style={{ color: proc.cpu > 50 ? 'var(--neon-pink)' : 'var(--neon-cyan)' }}>
                {proc.cpu?.toFixed(1)}
              </div>
              <div className="col-span-2 text-right font-mono text-tx/40">
                {proc.mem?.toFixed(1)}
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Network Stats */}
      {data?.network && data.network.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
          className="border-[3px] border-neon-yellow/15 bg-brutal-card shadow-brutal-yellow mb-6">
          <div className="px-5 py-3 border-b-[3px] border-neon-yellow/10 bg-neon-yellow/[0.03]">
            <h3 className="font-bold text-sm uppercase tracking-wider text-neon-yellow">Network Interfaces</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-neon-yellow/[0.06]">
                  <th className="text-left py-2 px-5 text-tx/25 font-bold uppercase tracking-wider text-[9px]">Interface</th>
                  <th className="text-right py-2 px-5 text-tx/25 font-bold uppercase tracking-wider text-[9px]">RX/s</th>
                  <th className="text-right py-2 px-5 text-tx/25 font-bold uppercase tracking-wider text-[9px]">TX/s</th>
                  <th className="text-right py-2 px-5 text-tx/25 font-bold uppercase tracking-wider text-[9px]">Total RX</th>
                  <th className="text-right py-2 px-5 text-tx/25 font-bold uppercase tracking-wider text-[9px]">Total TX</th>
                </tr>
              </thead>
              <tbody>
                {data.network.map((iface, i) => (
                  <tr key={i} className="border-b border-neon-yellow/[0.04] hover:bg-neon-yellow/[0.02] transition-colors">
                    <td className="py-2 px-5 font-bold text-tx/70">{iface.iface}</td>
                    <td className="py-2 px-5 text-right font-mono text-neon-cyan">{formatBytes(iface.rx_sec || 0)}/s</td>
                    <td className="py-2 px-5 text-right font-mono text-neon-pink">{formatBytes(iface.tx_sec || 0)}/s</td>
                    <td className="py-2 px-5 text-right font-mono text-tx/30">{formatBytes(iface.rx_bytes || 0)}</td>
                    <td className="py-2 px-5 text-right font-mono text-tx/30">{formatBytes(iface.tx_bytes || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Footer */}
      <div className="text-center py-4 font-mono text-[9px] text-tx/15 uppercase tracking-widest">
        Nexus Fleet Monitor /// Dronzer Studios
      </div>
    </div>
  );
}

export default AgentDetails;
