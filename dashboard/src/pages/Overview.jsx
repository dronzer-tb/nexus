import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Server, Cpu, MemoryStick, AlertOctagon,
  Activity, ArrowUpRight
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

/* ─── Brutalist Card ─── */
const BrutalCard = ({ title, value, sub, icon: Icon, color = 'neon-pink', delay = 0, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className={`border-[3px] p-5 shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-lg transition-all ${className}`}
    style={{ borderColor: `var(--${color})`, backgroundColor: 'var(--brutal-card)' }}
  >
    <div className="flex justify-between items-start mb-3">
      <h3 className="font-bold text-xs uppercase tracking-widest px-2 py-0.5 inline-block transform -rotate-1"
        style={{ backgroundColor: `var(--${color})`, color: color === 'neon-yellow' ? '#0a001a' : '#fff' }}>
        {title}
      </h3>
      {Icon && <Icon className="w-6 h-6 stroke-[2.5]" style={{ color: `var(--${color})` }} />}
    </div>
    <div className="text-4xl font-black mb-1 tracking-tighter" style={{ color: `var(--${color})` }}>{value}</div>
    {sub && (
      <div className="font-mono text-[10px] uppercase border-t-2 pt-2 mt-2 flex justify-between text-white/30"
        style={{ borderColor: `var(--${color})20` }}>
        <span>{sub}</span>
        <span>/// RAW</span>
      </div>
    )}
  </motion.div>
);

/* ─── Node Row ─── */
const NodeRow = ({ node, index }) => {
  const cpu = node.metrics?.cpu || 0;
  const isOnline = node.status === 'online';
  return (
    <Link to={`/nodes/${node.id}`}>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 + 0.3 }}
        className="border-b-2 border-neon-pink/10 p-4 flex items-center justify-between hover:bg-neon-pink/[0.04] transition-colors group cursor-pointer"
      >
        <div className="flex items-center gap-4">
          <div className={`w-5 h-5 border-2 ${isOnline ? 'bg-neon-cyan border-neon-cyan/60' : 'bg-red-500 border-red-500/60'}`} />
          <div>
            <div className="font-bold uppercase text-base text-white group-hover:text-neon-pink transition-colors">
              {node.hostname || node.id?.substring(0, 12)}
            </div>
            <div className="font-mono text-[10px] text-white/30 tracking-wider">
              {node.system_info?.os?.distro || 'Unknown OS'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="font-mono font-bold text-lg group-hover:text-neon-pink transition-colors"
              style={{ color: cpu > 80 ? 'var(--neon-pink)' : cpu > 50 ? 'var(--neon-yellow)' : 'var(--neon-cyan)' }}>
              {cpu.toFixed(0)}%
            </div>
            <div className="text-[9px] text-white/30 uppercase tracking-wider">CPU</div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-neon-pink transition-colors" />
        </div>
      </motion.div>
    </Link>
  );
};

/* ─── Overview Page ─── */
function Overview({ socket }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAgents();

    if (socket) {
      socket.on('nodes:update', (updatedNodes) => {
        setAgents(updatedNodes);
      });
    }
    return () => { if (socket) socket.off('nodes:update'); };
  }, [socket, isAuthenticated]);

  const fetchAgents = async () => {
    try {
      const response = await axios.get('/api/nodes');
      setAgents(response.data.nodes || []);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  };

  const online = agents.filter(a => a.status === 'online');
  const offline = agents.filter(a => a.status === 'offline');
  const avgCpu = online.length > 0
    ? online.reduce((s, a) => s + (a.metrics?.cpu || 0), 0) / online.length
    : 0;
  const avgMem = online.length > 0
    ? online.reduce((s, a) => s + (a.metrics?.memory || 0), 0) / online.length
    : 0;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-10 flex items-end gap-6 border-b-[3px] border-neon-pink/20 pb-6">
        <div>
          <h1 className="text-6xl font-black uppercase tracking-tighter leading-[0.85]">
            <span className="text-white">System</span><br />
            <span className="text-neon-pink" style={{ textShadow: '0 0 30px rgba(255,45,149,0.3)' }}>
              Override
            </span>
          </h1>
        </div>
        <div className="mb-2 font-mono text-[10px] bg-brutal-card border-2 border-neon-cyan/20 text-neon-cyan/60 p-3 tracking-wider">
          USER: {user?.username?.toUpperCase() || 'ADMIN'}<br />
          SESSION: #{Math.floor(Math.random() * 99999).toString().padStart(5, '0')}
        </div>
      </header>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <BrutalCard title="Nodes" value={agents.length} icon={Server} color="neon-cyan" delay={0.05}
          sub={`${online.length} online`} />
        <BrutalCard title="Avg CPU" value={`${avgCpu.toFixed(0)}%`} icon={Cpu} color="neon-pink" delay={0.1}
          sub="Fleet average" />
        <BrutalCard title="Avg Memory" value={`${avgMem.toFixed(0)}%`} icon={MemoryStick} color="neon-purple" delay={0.15}
          sub="Fleet average" />
        <BrutalCard title="Offline" value={offline.length} icon={AlertOctagon} color={offline.length > 0 ? 'neon-yellow' : 'neon-cyan'} delay={0.2}
          sub={offline.length > 0 ? 'Needs attention' : 'All clear'} />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Node List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="lg:col-span-2 border-[3px] border-neon-pink/20 bg-brutal-card shadow-brutal"
        >
          <div className="bg-neon-pink/10 border-b-[3px] border-neon-pink/20 p-4 flex justify-between items-center">
            <h2 className="font-bold text-lg uppercase tracking-tight text-neon-pink">Active Nodes</h2>
            <button
              onClick={fetchAgents}
              className="border-2 border-neon-pink/40 px-4 py-1 text-neon-pink hover:bg-neon-pink hover:text-white transition-colors font-bold uppercase text-[10px] tracking-widest"
            >
              Refresh
            </button>
          </div>
          <div>
            {loading ? (
              <div className="p-8 text-center font-mono text-white/30 text-sm">Scanning network...</div>
            ) : agents.length === 0 ? (
              <div className="p-8 text-center">
                <div className="font-mono text-white/30 text-sm mb-2">No nodes connected</div>
                <div className="text-[10px] text-white/20">Run `nexus --mode=node` on target machines</div>
              </div>
            ) : (
              <>
                {agents.slice(0, 6).map((node, i) => (
                  <NodeRow key={node.id} node={node} index={i} />
                ))}
                {agents.length > 6 && (
                  <Link to="/nodes"
                    className="block p-4 text-center font-mono text-xs uppercase cursor-pointer hover:bg-neon-pink/[0.06] text-neon-pink/60 hover:text-neon-pink transition-colors tracking-widest border-t-2 border-neon-pink/10"
                  >
                    View All {agents.length} Nodes ///
                  </Link>
                )}
              </>
            )}
          </div>
        </motion.div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Resource Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="border-[3px] border-neon-cyan/20 bg-brutal-card p-6 shadow-brutal-cyan"
          >
            <h2 className="font-black text-2xl uppercase mb-4 text-neon-cyan"
              style={{ textShadow: '0 0 15px rgba(0,240,255,0.2)' }}>
              Fleet<br />Resources
            </h2>
            <div className="space-y-4">
              {[
                { label: 'CPU', value: avgCpu, color: 'var(--neon-pink)' },
                { label: 'RAM', value: avgMem, color: 'var(--neon-cyan)' },
              ].map((m, i) => (
                <div key={i}>
                  <div className="flex justify-between font-mono font-bold text-xs mb-1.5">
                    <span className="text-white/50">{m.label}</span>
                    <span style={{ color: m.color }}>{m.value.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 border-2 overflow-hidden" style={{ borderColor: `${m.color}40`, backgroundColor: `${m.color}10` }}>
                    <motion.div
                      className="h-full"
                      style={{ backgroundColor: m.color, boxShadow: `0 0 8px ${m.color}` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${m.value}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-mono font-bold text-xs mt-4 pt-3 border-t-2 border-neon-cyan/10 text-white/30">
              <span>IN: {online.length} nodes</span>
              <span>OUT: {offline.length} nodes</span>
            </div>
          </motion.div>

          {/* Status Block */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="border-[3px] border-neon-purple/20 bg-brutal-card p-6 shadow-brutal-purple"
          >
            <div className="flex items-start gap-4">
              <Activity className="w-10 h-10 border-2 border-neon-purple/30 p-1.5 bg-neon-purple/10 text-neon-purple rounded-none flex-shrink-0" />
              <div>
                <h3 className="font-bold uppercase text-lg text-neon-purple">System Status</h3>
                <p className="font-mono text-[10px] mt-2 leading-relaxed border-l-2 border-neon-purple/30 pl-3 text-white/40">
                  {offline.length > 0
                    ? `Warning: ${offline.length} node${offline.length > 1 ? 's' : ''} offline. Check connectivity on affected systems.`
                    : 'All systems nominal. No alerts detected across monitored infrastructure.'
                  }
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default Overview;
