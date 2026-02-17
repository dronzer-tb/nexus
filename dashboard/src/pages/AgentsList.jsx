import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Refresh, Plus, Xmark, Terminal, Copy, Check, Server, Key, Trash } from 'iconoir-react';
import axios from 'axios';

/* ─── Brutalist Node Row ─── */
const NodeRow = ({ node, index, onDelete }) => {
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

  const handleDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(`Delete node "${node.hostname || node.id}"?\n\nThis will remove the node and all its metrics from the server. The node can re-register if it reconnects.`)) {
      onDelete(node.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 + 0.2 }}
    >
      <Link to={`/nodes/${node.id}`} className="block">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 md:px-5 py-3 md:py-4 border-b-2 border-neon-pink/[0.07] hover:bg-neon-pink/[0.03] transition-colors group">
          {/* Status + Name */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-4 h-4 border-2 flex-shrink-0 ${isOnline ? 'bg-neon-cyan border-neon-cyan/60' : 'bg-red-500 border-red-500/60'}`} />
            <div className="min-w-0 flex-1">
              <div className="font-bold uppercase text-sm text-tx truncate group-hover:text-neon-pink transition-colors">
                {node.hostname || node.id?.substring(0, 16)}
              </div>
              <div className="font-mono text-[10px] text-tx/25 truncate">
                {node.system_info?.os?.distro || '—'}
              </div>
            </div>
            <span className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border-2 sm:hidden ${
              isOnline ? 'border-neon-cyan/40 text-neon-cyan bg-neon-cyan/10' : 'border-red-500/40 text-red-400 bg-red-500/10'
            }`}>
              {isOnline ? '●' : '●'}
            </span>
          </div>

          {/* Status badge — desktop */}
          <span className={`hidden sm:inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border-2 shrink-0 ${
            isOnline ? 'border-neon-cyan/40 text-neon-cyan bg-neon-cyan/10' : 'border-red-500/40 text-red-400 bg-red-500/10'
          }`}>
            {isOnline ? '● ONLINE' : '● OFFLINE'}
          </span>

          {/* Metric bars */}
          <div className="flex items-center gap-3 sm:gap-4 pl-7 sm:pl-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-tx/25 uppercase hidden md:inline">CPU</span>
              <BarCell value={cpu} color="var(--neon-pink)" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-tx/25 uppercase hidden md:inline">MEM</span>
              <BarCell value={mem} color="var(--neon-cyan)" />
            </div>
            <span className="font-mono font-bold text-xs text-neon-purple hidden md:inline">{disk.toFixed(0)}%</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0 pl-7 sm:pl-0">
            <button
              onClick={handleDelete}
              className="p-1.5 border-2 border-transparent hover:border-red-500/40 hover:bg-red-500/10 text-tx/30 hover:text-red-400 transition-all"
              title="Delete node"
            >
              <Trash className="w-3.5 h-3.5" />
            </button>
            <ArrowUpRight className="w-4 h-4 text-tx/15 group-hover:text-neon-pink transition-colors" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

/* ─── Agents List Page ─── */
function AgentsList({ socket }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddNode, setShowAddNode] = useState(false);
  const [copied, setCopied] = useState(null);

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

  const handleDeleteNode = async (nodeId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/nodes/${nodeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAgents(agents.filter(a => a.id !== nodeId));
    } catch (err) {
      console.error('Failed to delete node:', err);
      alert('Failed to delete node: ' + (err.response?.data?.error || err.message));
    }
  };

  const serverUrl = window.location.origin;

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const CopyButton = ({ text, label }) => (
    <button
      onClick={() => copyToClipboard(text, label)}
      className="ml-2 p-1 text-tx/30 hover:text-neon-cyan transition-colors"
      title="Copy"
    >
      {copied === label ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b-[3px] border-neon-pink/20 pb-4 md:pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tighter leading-[0.9]">
            <span className="text-tx">All</span>{' '}
            <span className="text-neon-pink" style={{ textShadow: '0 0 25px var(--neon-pink)' }}>Nodes</span>
          </h1>
          <div className="font-mono text-[10px] text-tx/30 mt-2 tracking-wider uppercase">
            {agents.length} registered · {agents.filter(a => a.status === 'online').length} online
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowAddNode(true)}
            className="flex items-center gap-2 px-4 py-2 border-2 border-neon-cyan/40 text-neon-cyan font-bold uppercase text-[10px] tracking-widest hover:bg-neon-cyan transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px]"
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--on-neon-cyan)'}
            onMouseLeave={(e) => e.currentTarget.style.color = ''}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Node
          </button>
          <button
            onClick={fetchAgents}
            className="flex items-center gap-2 px-4 py-2 border-2 border-neon-pink/40 text-neon-pink font-bold uppercase text-[10px] tracking-widest hover:bg-neon-pink transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px]"
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--on-neon-pink)'}
            onMouseLeave={(e) => e.currentTarget.style.color = ''}
          >
            <Refresh className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </header>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-[3px] border-neon-pink/20 bg-brutal-card shadow-brutal"
      >
        {/* Table header */}
        <div className="hidden sm:flex items-center gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-widest border-b-[3px] border-neon-pink/20 bg-neon-pink/[0.05] text-tx/30">
          <div className="flex-1">Node</div>
          <div className="w-20 shrink-0">Status</div>
          <div className="w-36 shrink-0">CPU</div>
          <div className="w-36 shrink-0">MEM</div>
          <div className="w-12 shrink-0 hidden md:block">Disk</div>
          <div className="w-16 shrink-0"></div>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="p-12 text-center font-mono text-tx/30 text-sm">
            Scanning network...
          </div>
        ) : agents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="font-bold text-xl text-tx/20 uppercase mb-2">No Nodes Found</div>
            <div className="font-mono text-[10px] text-tx/15">
              Run `nexus --mode=node` on target machines to register
            </div>
          </div>
        ) : (
          agents.map((node, i) => <NodeRow key={node.id} node={node} index={i} onDelete={handleDeleteNode} />)
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t-2 border-neon-pink/10 text-center font-mono text-[10px] text-tx/20 uppercase tracking-widest">
          Total: {agents.length} nodes /// Nexus Fleet Monitor
        </div>
      </motion.div>

      {/* ─── Add Node Modal ─── */}
      <AnimatePresence>
        {showAddNode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowAddNode(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl bg-brutal-card border-[3px] border-neon-cyan/30 shadow-brutal max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b-[3px] border-neon-cyan/20 bg-neon-cyan/5">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-neon-cyan" />
                  <h3 className="font-black text-lg uppercase tracking-tight text-tx">
                    Add a <span className="text-neon-cyan">Node</span>
                  </h3>
                </div>
                <button onClick={() => setShowAddNode(false)} className="text-tx/30 hover:text-tx transition-colors">
                  <Xmark className="w-5 h-5" />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-6 space-y-6">
                {/* Single command — display only */}
                <div>
                  <div className="font-bold text-xs uppercase tracking-wider text-tx/60 mb-3">
                    Run this command on the target machine:
                  </div>
                  <div className="bg-brutal-bg border-2 border-tx/10 p-4 font-mono text-xs text-tx/80 flex items-start">
                    <Terminal className="w-4 h-4 text-neon-cyan/40 mr-2 mt-0.5 shrink-0" />
                    <code className="flex-1 break-all whitespace-pre-wrap">{`git clone https://github.com/dronzer-tb/nexus.git && cd nexus && npm install && node -e "const c=require('./src/utils/config');c.set('node.serverUrl','${serverUrl}');console.log('Configured!')" && node src/index.js --mode=node`}</code>
                    <CopyButton text={`git clone https://github.com/dronzer-tb/nexus.git && cd nexus && npm install && node -e "const c=require('./src/utils/config');c.set('node.serverUrl','${serverUrl}');console.log('Configured!')" && node src/index.js --mode=node`} label="command" />
                  </div>
                </div>

                {/* Systemctl setup */}
                <div className="border-[3px] border-neon-pink/20 bg-neon-pink/5 p-4">
                  <div className="font-bold text-xs uppercase tracking-wider text-neon-pink mb-2">⚡ Auto-start as a service</div>
                  <div className="font-mono text-[11px] text-tx/50 leading-relaxed mb-3">
                    After the node is running, set it up as a <span className="text-neon-pink">systemd service</span> so it auto-starts on boot:
                  </div>
                  <div className="bg-brutal-bg border-2 border-tx/10 p-3 font-mono text-xs text-tx/80 flex items-start">
                    <Terminal className="w-4 h-4 text-neon-pink/40 mr-2 mt-0.5 shrink-0" />
                    <code className="flex-1 break-all whitespace-pre-wrap">node src/index.js --mode=node --install-service</code>
                    <CopyButton text="node src/index.js --mode=node --install-service" label="service" />
                  </div>
                  <div className="font-mono text-[10px] text-tx/30 mt-2">
                    Creates a systemd unit, enables auto-start, and launches the node service.
                  </div>
                </div>

                {/* Info */}
                <div className="border-[3px] border-neon-cyan/10 bg-neon-cyan/5 p-4 space-y-2">
                  <div className="font-bold text-[10px] text-neon-cyan uppercase tracking-widest flex items-center gap-1">
                    <Key className="w-3 h-3" /> How it works
                  </div>
                  <div className="font-mono text-[11px] text-tx/50 leading-relaxed">
                    The node <span className="text-neon-cyan">auto-generates</span> its own unique API key on first run and registers itself with this server. No manual API key setup is needed — just clone, configure the URL, and start. The credentials are saved in <span className="text-neon-cyan">data/node-info.json</span> on the node machine.
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AgentsList;
