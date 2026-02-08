import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import axios from 'axios';

/* ─── Brutalist Node Row ─── */
const NodeRow = ({ node, index }) => {
  const cpu = node.metrics?.cpu || 0;
  const mem = node.metrics?.memory || 0;
  const disk = node.metrics?.disk || 0;
  const isOnline = node.status === 'online';

  const BarCell = ({ value, color }) => (
    <div className="flex items-center gap-3">
      <div className="w-20 h-2.5 border-2 overflow-hidden" style={{ borderColor: `${color}40`, backgroundColor: `${color}10` }}>
        <div className="h-full" style={{ width: `${value}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
      </div>
      <span className="font-mono font-bold text-xs w-10 text-right" style={{ color }}>{value.toFixed(0)}%</span>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 + 0.2 }}
    >
      <Link to={`/nodes/${node.id}`}
        className="grid grid-cols-12 gap-4 items-center px-5 py-4 border-b-2 border-neon-pink/[0.07] hover:bg-neon-pink/[0.03] transition-colors group"
      >
        {/* Status + Name */}
        <div className="col-span-4 flex items-center gap-3">
          <div className={`w-4 h-4 border-2 flex-shrink-0 ${isOnline ? 'bg-neon-cyan border-neon-cyan/60' : 'bg-red-500 border-red-500/60'}`} />
          <div className="min-w-0">
            <div className="font-bold uppercase text-sm text-white truncate group-hover:text-neon-pink transition-colors">
              {node.hostname || node.id?.substring(0, 16)}
            </div>
            <div className="font-mono text-[10px] text-white/25 truncate">
              {node.system_info?.os?.distro || '—'}
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div className="col-span-2">
          <span className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border-2 ${
            isOnline
              ? 'border-neon-cyan/40 text-neon-cyan bg-neon-cyan/10'
              : 'border-red-500/40 text-red-400 bg-red-500/10'
          }`}>
            {isOnline ? '● ONLINE' : '● OFFLINE'}
          </span>
        </div>

        {/* CPU */}
        <div className="col-span-2">
          <BarCell value={cpu} color="var(--neon-pink)" />
        </div>

        {/* RAM */}
        <div className="col-span-2">
          <BarCell value={mem} color="var(--neon-cyan)" />
        </div>

        {/* Disk */}
        <div className="col-span-1">
          <span className="font-mono font-bold text-xs text-neon-purple">{disk.toFixed(0)}%</span>
        </div>

        {/* Arrow */}
        <div className="col-span-1 text-right">
          <ArrowUpRight className="w-4 h-4 text-white/15 group-hover:text-neon-pink transition-colors inline-block" />
        </div>
      </Link>
    </motion.div>
  );
};

/* ─── Agents List Page ─── */
function AgentsList({ socket }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
    if (socket) {
      socket.on('nodes:update', (updatedNodes) => setAgents(updatedNodes));
    }
    return () => { if (socket) socket.off('nodes:update'); };
  }, [socket]);

  const fetchAgents = async () => {
    try {
      const response = await axios.get('/api/nodes');
      setAgents(response.data.nodes || []);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-8 flex items-end justify-between border-b-[3px] border-neon-pink/20 pb-6">
        <div>
          <h1 className="text-5xl font-black uppercase tracking-tighter leading-[0.9]">
            <span className="text-white">All</span>{' '}
            <span className="text-neon-pink" style={{ textShadow: '0 0 25px rgba(255,45,149,0.3)' }}>Nodes</span>
          </h1>
          <div className="font-mono text-[10px] text-white/30 mt-2 tracking-wider uppercase">
            {agents.length} registered · {agents.filter(a => a.status === 'online').length} online
          </div>
        </div>
        <button
          onClick={fetchAgents}
          className="flex items-center gap-2 px-4 py-2 border-2 border-neon-pink/40 text-neon-pink font-bold uppercase text-[10px] tracking-widest hover:bg-neon-pink hover:text-white transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </header>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-[3px] border-neon-pink/20 bg-brutal-card shadow-brutal"
      >
        {/* Table header */}
        <div className="grid grid-cols-12 gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-widest border-b-[3px] border-neon-pink/20 bg-neon-pink/[0.05] text-white/30">
          <div className="col-span-4">Node</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">CPU</div>
          <div className="col-span-2">Memory</div>
          <div className="col-span-1">Disk</div>
          <div className="col-span-1"></div>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="p-12 text-center font-mono text-white/30 text-sm">
            Scanning network...
          </div>
        ) : agents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="font-bold text-xl text-white/20 uppercase mb-2">No Nodes Found</div>
            <div className="font-mono text-[10px] text-white/15">
              Run `nexus --mode=node` on target machines to register
            </div>
          </div>
        ) : (
          agents.map((node, i) => <NodeRow key={node.id} node={node} index={i} />)
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t-2 border-neon-pink/10 text-center font-mono text-[10px] text-white/20 uppercase tracking-widest">
          Total: {agents.length} nodes /// Nexus Fleet Monitor
        </div>
      </motion.div>
    </div>
  );
}

export default AgentsList;
