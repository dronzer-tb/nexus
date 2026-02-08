import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNexusData, useNodeMetrics, formatBytes, formatUptime } from '../../hooks/useNexusData';
import { useAuth } from '../../context/AuthContext';

/* ─────────── V1 TERMINAL NOIR ───────────
   Phosphor green on black. CRT scanlines.
   Glitch effects. Monospace everything.
   A hacker's command center. */

const G = '#00ff41';
const DIM = '#00ff4180';
const BG = '#000000';
const LINE = '#00ff4115';

// Scanline overlay
function Scanlines() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[999]" style={{
      background: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)`,
      mixBlendMode: 'multiply',
    }} />
  );
}

// CRT vignette
function CRTVignette() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[998]" style={{
      background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.7) 100%)',
    }} />
  );
}

// Blinking cursor
function Cursor() {
  return <span className="inline-block w-[10px] h-[18px] ml-1 animate-pulse" style={{ backgroundColor: G }} />;
}

// ASCII bar
function AsciiBar({ value, width = 20, color = G }) {
  const filled = Math.round((value / 100) * width);
  const empty = width - filled;
  return (
    <span style={{ color }}>
      [{'█'.repeat(filled)}{'░'.repeat(empty)}] {value.toFixed(1)}%
    </span>
  );
}

// Glitch text effect
function GlitchText({ children, className = '' }) {
  const [glitch, setGlitch] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 100);
    }, 3000 + Math.random() * 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className={`relative inline-block ${className}`}>
      {glitch && (
        <>
          <span className="absolute top-0 left-[2px] opacity-80" style={{ color: '#ff0040', clipPath: 'polygon(0 0, 100% 0, 100% 45%, 0 45%)' }}>{children}</span>
          <span className="absolute top-0 left-[-2px] opacity-80" style={{ color: '#00ffff', clipPath: 'polygon(0 55%, 100% 55%, 100% 100%, 0 100%)' }}>{children}</span>
        </>
      )}
      {children}
    </span>
  );
}

// Typing animation for text
function TypeWriter({ text, speed = 30, delay = 0 }) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        setDisplayed(text.slice(0, i + 1));
        i++;
        if (i >= text.length) clearInterval(interval);
      }, speed);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text, speed, delay]);
  return <>{displayed}<Cursor /></>;
}

function TerminalSidebar({ active }) {
  const { logout } = useAuth();
  const links = [
    { path: '/v1', label: 'OVERVIEW', cmd: 'nexus --status' },
    { path: '/v1/nodes', label: 'NODES', cmd: 'nexus --list-nodes' },
  ];

  return (
    <div className="w-72 border-r flex flex-col justify-between p-4 font-mono text-sm" style={{ borderColor: LINE, backgroundColor: '#000000' }}>
      <div>
        <div className="mb-8 p-3 border" style={{ borderColor: LINE }}>
          <pre style={{ color: G, fontSize: '10px', lineHeight: '12px' }}>{`
 ███╗   ██╗██╗  ██╗
 ████╗  ██║╚██╗██╔╝
 ██╔██╗ ██║ ╚███╔╝ 
 ██║╚██╗██║ ██╔██╗ 
 ██║ ╚████║██╔╝ ██╗
 ╚═╝  ╚═══╝╚═╝  ╚═╝`.trim()}</pre>
          <div className="mt-2 text-xs" style={{ color: DIM }}>NEXUS TERMINAL v1.2.1</div>
        </div>

        <div className="space-y-1">
          {links.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className="block px-3 py-2 transition-all duration-150"
              style={{
                color: active === link.path ? '#000' : G,
                backgroundColor: active === link.path ? G : 'transparent',
                border: `1px solid ${active === link.path ? G : 'transparent'}`,
              }}
            >
              <span className="opacity-50">$</span> {link.cmd}
            </Link>
          ))}
        </div>

        <div className="mt-6 p-3 border text-xs space-y-1" style={{ borderColor: LINE, color: DIM }}>
          <div>SESSION: active</div>
          <div>UPTIME: {new Date().toLocaleTimeString()}</div>
          <div>PROTO: WSS/HTTPS</div>
        </div>
      </div>

      <div>
        <button
          onClick={logout}
          className="w-full text-left px-3 py-2 border transition-all duration-150 hover:bg-red-900/30"
          style={{ borderColor: '#ff004040', color: '#ff0040' }}
        >
          <span className="opacity-50">$</span> exit --force
        </button>
        <div className="mt-3 text-center text-[10px]" style={{ color: DIM }}>
          DRONZER STUDIOS © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}

function OverviewV1({ socket }) {
  const { nodes, stats, loading } = useNexusData(socket);
  const { user } = useAuth();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex min-h-screen font-mono" style={{ backgroundColor: BG, color: G }}>
      <Scanlines />
      <CRTVignette />
      <TerminalSidebar active="/v1" />

      <div className="flex-1 p-6 overflow-y-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-6 border-b pb-4"
          style={{ borderColor: LINE }}
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs mb-1" style={{ color: DIM }}>
                {time.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <h1 className="text-2xl font-bold">
                <GlitchText>SYSTEM STATUS MONITOR</GlitchText>
              </h1>
              <div className="text-xs mt-1" style={{ color: DIM }}>
                root@nexus:~# Logged in as <span style={{ color: G }}>{user?.username || 'admin'}</span>
              </div>
            </div>
            <div className="text-right text-xs" style={{ color: DIM }}>
              <div className="text-lg font-bold" style={{ color: G }}>{time.toLocaleTimeString()}</div>
              <div>UTC {time.toISOString().slice(11, 19)}</div>
            </div>
          </div>
        </motion.div>

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-4 gap-4 mb-6"
        >
          {[
            { label: 'TOTAL NODES', value: stats.total, icon: '◉' },
            { label: 'ONLINE', value: stats.online, color: G },
            { label: 'OFFLINE', value: stats.offline, color: '#ff0040' },
            { label: 'AVG CPU', value: `${stats.avgCpu.toFixed(1)}%`, icon: '▓' },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * i + 0.3 }}
              className="p-4 border"
              style={{ borderColor: LINE }}
            >
              <div className="text-xs mb-2" style={{ color: DIM }}>{item.label}</div>
              <div className="text-3xl font-bold" style={{ color: item.color || G }}>
                {item.icon && <span className="text-sm mr-1">{item.icon}</span>}
                {item.value}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Nodes table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="mb-3 flex items-center gap-2 text-xs" style={{ color: DIM }}>
            <span style={{ color: G }}>▶</span> CONNECTED NODES — {loading ? 'SCANNING...' : `${nodes.length} FOUND`}
          </div>
          
          <div className="border" style={{ borderColor: LINE }}>
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs border-b" style={{ borderColor: LINE, color: DIM, backgroundColor: '#00ff4108' }}>
              <div className="col-span-1">STATUS</div>
              <div className="col-span-3">HOSTNAME</div>
              <div className="col-span-2">OS</div>
              <div className="col-span-2">CPU</div>
              <div className="col-span-2">MEMORY</div>
              <div className="col-span-2">DISK</div>
            </div>

            {loading ? (
              <div className="px-4 py-8 text-center text-xs" style={{ color: DIM }}>
                Scanning network... <Cursor />
              </div>
            ) : nodes.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs" style={{ color: DIM }}>
                [WARN] No nodes detected. Run `nexus --mode=node` on target machines.
              </div>
            ) : (
              <AnimatePresence>
                {nodes.map((node, i) => (
                  <motion.div
                    key={node.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link
                      to={`/v1/nodes/${node.id}`}
                      className="grid grid-cols-12 gap-2 px-4 py-3 text-xs border-b transition-all duration-100 hover:bg-[#00ff4108]"
                      style={{ borderColor: LINE }}
                    >
                      <div className="col-span-1">
                        <span className={`inline-block w-2 h-2 rounded-full ${node.status === 'online' ? 'animate-pulse' : ''}`}
                          style={{ backgroundColor: node.status === 'online' ? G : '#ff0040' }} />
                      </div>
                      <div className="col-span-3 truncate font-bold">{node.hostname || node.id}</div>
                      <div className="col-span-2 truncate" style={{ color: DIM }}>
                        {node.system_info?.os?.distro || '—'}
                      </div>
                      <div className="col-span-2">
                        <AsciiBar value={node.metrics?.cpu || 0} width={10} />
                      </div>
                      <div className="col-span-2">
                        <AsciiBar value={node.metrics?.memory || 0} width={10} />
                      </div>
                      <div className="col-span-2">
                        <AsciiBar value={node.metrics?.disk || 0} width={10} />
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>

        {/* System log footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 p-3 border text-[10px] space-y-1"
          style={{ borderColor: LINE, color: DIM }}
        >
          <div>[{time.toISOString()}] System monitor active</div>
          <div>[{time.toISOString()}] WebSocket connection: ESTABLISHED</div>
          <div>[{time.toISOString()}] Metrics broadcast interval: 5000ms</div>
        </motion.div>
      </div>
    </div>
  );
}

function NodeDetailV1({ socket }) {
  const { agentId } = useParams();
  const { node, metrics, latest, loading, error } = useNodeMetrics(agentId);
  const data = latest?.data || null;

  if (loading) return (
    <div className="flex min-h-screen font-mono" style={{ backgroundColor: BG, color: G }}>
      <Scanlines /><CRTVignette />
      <TerminalSidebar active="/v1/nodes" />
      <div className="flex-1 flex items-center justify-center text-xs">
        Loading node data... <Cursor />
      </div>
    </div>
  );

  if (error || !node) return (
    <div className="flex min-h-screen font-mono" style={{ backgroundColor: BG, color: G }}>
      <Scanlines /><CRTVignette />
      <TerminalSidebar active="/v1/nodes" />
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-xs">
        <div style={{ color: '#ff0040' }}>[ERROR] {error || 'Node not found'}</div>
        <Link to="/v1" style={{ color: DIM }}>← Return to overview</Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen font-mono" style={{ backgroundColor: BG, color: G }}>
      <Scanlines />
      <CRTVignette />
      <TerminalSidebar active="/v1/nodes" />
      <div className="flex-1 p-6 overflow-y-auto relative z-10">
        <Link to="/v1" className="text-xs mb-4 inline-block transition-colors hover:underline" style={{ color: DIM }}>
          ← nexus --status
        </Link>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
          <h1 className="text-2xl font-bold mb-1">
            <GlitchText>NODE: {node.hostname}</GlitchText>
          </h1>
          <div className="text-xs space-x-4" style={{ color: DIM }}>
            <span>ID: {node.id.substring(0, 24)}...</span>
            <span>STATUS: <span style={{ color: node.status === 'online' ? G : '#ff0040' }}>{node.status.toUpperCase()}</span></span>
            {node.system_info?.uptime && <span>UPTIME: {formatUptime(node.system_info.uptime)}</span>}
          </div>
        </motion.div>

        {data && (
          <>
            {/* Resource meters */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-4 mb-8">
              <div className="border p-4" style={{ borderColor: LINE }}>
                <div className="text-xs mb-2" style={{ color: DIM }}>CPU UTILIZATION</div>
                <div className="text-xl font-bold mb-1">{data.cpu?.usage?.toFixed(1)}%</div>
                <AsciiBar value={data.cpu?.usage || 0} width={50} />
                {data.cpu?.cores && (
                  <div className="mt-3 grid grid-cols-4 gap-1 text-[10px]">
                    {data.cpu.cores.map((c, i) => (
                      <div key={i}><span style={{ color: DIM }}>core{i}:</span> <AsciiBar value={c.load || 0} width={8} /></div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="border p-4" style={{ borderColor: LINE }}>
                  <div className="text-xs mb-2" style={{ color: DIM }}>MEMORY</div>
                  <div className="text-xl font-bold mb-1">{data.memory?.usagePercent?.toFixed(1)}%</div>
                  <AsciiBar value={data.memory?.usagePercent || 0} width={15} />
                  <div className="text-[10px] mt-2" style={{ color: DIM }}>
                    {formatBytes(data.memory?.used)} / {formatBytes(data.memory?.total)}
                  </div>
                </div>
                <div className="border p-4" style={{ borderColor: LINE }}>
                  <div className="text-xs mb-2" style={{ color: DIM }}>SWAP</div>
                  <div className="text-xl font-bold mb-1">{data.swap?.usagePercent?.toFixed(1)}%</div>
                  <AsciiBar value={data.swap?.usagePercent || 0} width={15} />
                </div>
                <div className="border p-4" style={{ borderColor: LINE }}>
                  <div className="text-xs mb-2" style={{ color: DIM }}>PROCESSES</div>
                  <div className="text-xl font-bold mb-1">{data.processes?.all || 0}</div>
                  <div className="text-[10px]" style={{ color: DIM }}>
                    {data.processes?.running || 0} running / {data.processes?.sleeping || 0} sleeping
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Disk */}
            {data.disk && data.disk.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                className="border p-4 mb-6" style={{ borderColor: LINE }}>
                <div className="text-xs mb-3" style={{ color: DIM }}>DISK PARTITIONS</div>
                {data.disk.map((d, i) => (
                  <div key={i} className="flex items-center gap-4 text-xs mb-2">
                    <span className="w-24 truncate" style={{ color: DIM }}>{d.mount}</span>
                    <AsciiBar value={d.usagePercent || 0} width={30} color={d.usagePercent > 90 ? '#ff0040' : G} />
                    <span style={{ color: DIM }}>{formatBytes(d.used)}/{formatBytes(d.size)}</span>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Top processes */}
            {data.processes?.list && data.processes.list.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="border p-4" style={{ borderColor: LINE }}>
                <div className="text-xs mb-3" style={{ color: DIM }}>TOP PROCESSES (by CPU)</div>
                <div className="grid grid-cols-12 text-[10px] mb-2 px-1" style={{ color: DIM }}>
                  <div className="col-span-2">PID</div>
                  <div className="col-span-5">NAME</div>
                  <div className="col-span-2 text-right">CPU%</div>
                  <div className="col-span-3 text-right">MEM%</div>
                </div>
                {data.processes.list.slice(0, 8).map((p, i) => (
                  <div key={i} className="grid grid-cols-12 text-xs px-1 py-1 border-t" style={{ borderColor: LINE }}>
                    <div className="col-span-2" style={{ color: DIM }}>{p.pid}</div>
                    <div className="col-span-5 truncate">{p.name}</div>
                    <div className="col-span-2 text-right" style={{ color: p.cpu > 50 ? '#ff0040' : G }}>{p.cpu?.toFixed(1)}</div>
                    <div className="col-span-3 text-right" style={{ color: DIM }}>{p.mem?.toFixed(1)}</div>
                  </div>
                ))}
              </motion.div>
            )}
          </>
        )}

        {!data && (
          <div className="border p-8 text-center text-xs" style={{ borderColor: LINE, color: DIM }}>
            [WAIT] Awaiting metrics stream from node... <Cursor />
          </div>
        )}
      </div>
    </div>
  );
}

export { OverviewV1, NodeDetailV1 };
