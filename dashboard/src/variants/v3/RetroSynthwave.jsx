import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNexusData, useNodeMetrics, formatBytes, formatUptime } from '../../hooks/useNexusData';
import { useAuth } from '../../context/AuthContext';

/* ─────────── V3 RETRO SYNTHWAVE ───────────
   80s neon paradise. Perspective grid.
   Hot pink & electric cyan. Chrome text.
   VHS tracking. CRT glow on everything. */

const PINK = '#ff2d95';
const CYAN = '#00f0ff';
const PURPLE = '#b026ff';
const YELLOW = '#ffd319';
const BG_TOP = '#0a001a';
const BG_BOT = '#1a0030';
const DIM = '#ff2d9560';

// Perspective grid floor
function SynthGrid() {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-[40vh] z-0 overflow-hidden pointer-events-none" style={{ perspective: '500px' }}>
      <div className="w-full h-full origin-bottom" style={{
        transform: 'rotateX(60deg)',
        backgroundImage: `
          linear-gradient(to right, ${PINK}20 1px, transparent 1px),
          linear-gradient(to bottom, ${PINK}20 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }}>
        <motion.div
          className="absolute inset-0"
          animate={{ backgroundPositionY: ['0px', '60px'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          style={{
            backgroundImage: `linear-gradient(to bottom, ${PINK}20 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>
      {/* Horizon glow */}
      <div className="absolute top-0 left-0 right-0 h-16" style={{
        background: `linear-gradient(to top, transparent, ${PINK}15, ${PURPLE}10, transparent)`
      }} />
    </div>
  );
}

// Neon border card
function NeonCard({ children, className = '', color = PINK, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-lg p-5 relative ${className}`}
      style={{
        backgroundColor: 'rgba(10, 0, 26, 0.8)',
        border: `1px solid ${color}40`,
        boxShadow: `0 0 20px ${color}15, inset 0 0 20px ${color}05`,
      }}
    >
      {children}
    </motion.div>
  );
}

// Neon text
function NeonText({ children, color = PINK, className = '', size = 'text-3xl' }) {
  return (
    <span className={`font-black ${size} ${className}`} style={{
      color: color,
      textShadow: `0 0 10px ${color}, 0 0 30px ${color}80, 0 0 60px ${color}40`,
    }}>
      {children}
    </span>
  );
}

// VHS tracking line
function VHSTracking() {
  const [top, setTop] = useState(-100);
  useEffect(() => {
    const interval = setInterval(() => {
      setTop(Math.random() * 100);
      setTimeout(() => setTop(-100), 200);
    }, 4000 + Math.random() * 6000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="pointer-events-none fixed left-0 right-0 h-[3px] z-[999] opacity-30"
      style={{ top: `${top}%`, backgroundColor: 'white', boxShadow: '0 0 10px white' }} />
  );
}

// Neon progress bar
function NeonBar({ value, color = PINK, height = 6 }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, backgroundColor: `${color}15` }}>
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        style={{
          backgroundColor: color,
          boxShadow: `0 0 10px ${color}, 0 0 5px ${color}80`,
        }}
      />
    </div>
  );
}

function SynthSidebar({ active }) {
  const { logout } = useAuth();
  const links = [
    { path: '/v3', label: 'DASHBOARD', icon: '◈' },
    { path: '/v3/nodes', label: 'NODES', icon: '◇' },
  ];

  return (
    <div className="w-64 flex flex-col justify-between p-5 z-10 relative"
      style={{
        background: `linear-gradient(180deg, ${BG_TOP}, ${BG_BOT})`,
        borderRight: `1px solid ${PINK}20`,
      }}>
      <div>
        <div className="mb-10 text-center">
          <NeonText size="text-2xl" color={PINK}>NEXUS</NeonText>
          <div className="text-[9px] tracking-[0.6em] mt-2" style={{ color: CYAN }}>
            ★ SYNTHWAVE ★
          </div>
          <div className="mt-3 h-px" style={{ background: `linear-gradient(to right, transparent, ${PINK}, transparent)` }} />
        </div>

        <nav className="space-y-2">
          {links.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all duration-300"
              style={{
                color: active === link.path ? PINK : `${PINK}80`,
                backgroundColor: active === link.path ? `${PINK}10` : 'transparent',
                borderLeft: active === link.path ? `3px solid ${PINK}` : '3px solid transparent',
                textShadow: active === link.path ? `0 0 10px ${PINK}` : 'none',
              }}
            >
              <span>{link.icon}</span>
              <span className="tracking-wider">{link.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div>
        <button onClick={logout}
          className="w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition-all duration-300"
          style={{ color: `${YELLOW}80` }}>
          ⏻ LOGOUT
        </button>
        <div className="h-px mt-3" style={{ background: `linear-gradient(to right, transparent, ${PURPLE}, transparent)` }} />
        <div className="text-center text-[8px] mt-3 tracking-[0.4em] font-bold" style={{ color: `${PURPLE}60` }}>
          DRONZER STUDIOS
        </div>
      </div>
    </div>
  );
}

function OverviewV3({ socket }) {
  const { nodes, stats, loading } = useNexusData(socket);
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  return (
    <div className="flex min-h-screen" style={{
      background: `linear-gradient(180deg, ${BG_TOP}, ${BG_BOT})`,
      color: '#ffffff',
      fontFamily: "'Rajdhani', 'Orbitron', sans-serif",
    }}>
      <SynthGrid />
      <VHSTracking />
      <SynthSidebar active="/v3" />

      <div className="flex-1 p-8 overflow-y-auto relative z-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-8">
          <div className="flex justify-between items-end">
            <div>
              <div className="text-xs font-bold tracking-[0.3em] mb-1" style={{ color: CYAN }}>
                ◇ SYSTEM MONITOR ◇
              </div>
              <NeonText color={PINK} size="text-4xl">FLEET STATUS</NeonText>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black" style={{
                color: CYAN,
                textShadow: `0 0 10px ${CYAN}, 0 0 30px ${CYAN}60`,
                fontFamily: "'Rajdhani', monospace",
              }}>
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          </div>
          <div className="h-px mt-4" style={{ background: `linear-gradient(to right, ${PINK}, ${PURPLE}, ${CYAN})` }} />
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'TOTAL', value: stats.total, color: PINK },
            { label: 'ONLINE', value: stats.online, color: CYAN },
            { label: 'OFFLINE', value: stats.offline, color: YELLOW },
            { label: 'AVG CPU', value: `${stats.avgCpu.toFixed(0)}%`, color: PURPLE },
          ].map((s, i) => (
            <NeonCard key={i} color={s.color} delay={0.1 * i + 0.2}>
              <div className="text-[10px] font-bold tracking-[0.3em] mb-2" style={{ color: `${s.color}80` }}>{s.label}</div>
              <div className="text-4xl font-black" style={{
                color: s.color,
                textShadow: `0 0 15px ${s.color}80`,
              }}>{s.value}</div>
            </NeonCard>
          ))}
        </div>

        {/* Avg bars */}
        <NeonCard color={PURPLE} delay={0.4} className="mb-8">
          <div className="text-[10px] font-bold tracking-[0.3em] mb-4" style={{ color: `${CYAN}80` }}>
            ◈ FLEET AVERAGES
          </div>
          <div className="space-y-4">
            {[
              { label: 'CPU', value: stats.avgCpu, color: PINK },
              { label: 'MEMORY', value: stats.avgMem, color: CYAN },
              { label: 'DISK', value: stats.avgDisk, color: PURPLE },
            ].map((m, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span style={{ color: `${m.color}cc` }}>{m.label}</span>
                  <span style={{ color: m.color, textShadow: `0 0 5px ${m.color}` }}>{m.value.toFixed(1)}%</span>
                </div>
                <NeonBar value={m.value} color={m.color} />
              </div>
            ))}
          </div>
        </NeonCard>

        {/* Node cards */}
        <div className="text-[10px] font-bold tracking-[0.3em] mb-4" style={{ color: `${PINK}80` }}>
          ◇ CONNECTED NODES
        </div>

        {loading ? (
          <NeonCard color={PINK} className="text-center py-12">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
              <NeonText color={PINK} size="text-xl">SCANNING...</NeonText>
            </motion.div>
          </NeonCard>
        ) : nodes.length === 0 ? (
          <NeonCard color={CYAN} className="text-center py-12">
            <NeonText color={CYAN} size="text-xl">NO NODES DETECTED</NeonText>
          </NeonCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {nodes.map((node, i) => (
                <motion.div key={node.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i + 0.5 }}>
                  <Link to={`/v3/nodes/${node.id}`}>
                    <NeonCard color={node.status === 'online' ? PINK : YELLOW} delay={0}
                      className="cursor-pointer hover:scale-[1.02] transition-transform duration-300">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="font-black text-lg" style={{
                            color: node.status === 'online' ? PINK : YELLOW,
                            textShadow: `0 0 8px ${node.status === 'online' ? PINK : YELLOW}60`,
                          }}>
                            {node.hostname || 'UNKNOWN'}
                          </div>
                          <div className="text-[10px] font-bold tracking-wider" style={{ color: `${CYAN}60` }}>
                            {node.system_info?.os?.distro || '—'}
                          </div>
                        </div>
                        <div className="px-2 py-1 rounded text-[9px] font-black tracking-wider"
                          style={{
                            backgroundColor: node.status === 'online' ? `${CYAN}20` : `${YELLOW}20`,
                            color: node.status === 'online' ? CYAN : YELLOW,
                            border: `1px solid ${node.status === 'online' ? CYAN : YELLOW}40`,
                          }}>
                          {node.status.toUpperCase()}
                        </div>
                      </div>
                      <div className="space-y-3">
                        {[
                          { l: 'CPU', v: node.metrics?.cpu || 0, c: PINK },
                          { l: 'RAM', v: node.metrics?.memory || 0, c: CYAN },
                          { l: 'DISK', v: node.metrics?.disk || 0, c: PURPLE },
                        ].map((m, j) => (
                          <div key={j}>
                            <div className="flex justify-between text-[10px] font-bold mb-1">
                              <span style={{ color: `${m.c}80` }}>{m.l}</span>
                              <span style={{ color: m.c }}>{m.v.toFixed(1)}%</span>
                            </div>
                            <NeonBar value={m.v} color={m.c} height={4} />
                          </div>
                        ))}
                      </div>
                    </NeonCard>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function NodeDetailV3({ socket }) {
  const { agentId } = useParams();
  const { node, metrics, latest, loading, error } = useNodeMetrics(agentId);
  const data = latest?.data || null;

  if (loading) return (
    <div className="flex min-h-screen" style={{ background: `linear-gradient(180deg, ${BG_TOP}, ${BG_BOT})`, color: '#fff' }}>
      <SynthGrid /><VHSTracking />
      <SynthSidebar active="/v3/nodes" />
      <div className="flex-1 flex items-center justify-center relative z-10">
        <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
          <NeonText color={PINK} size="text-2xl">LOADING</NeonText>
        </motion.div>
      </div>
    </div>
  );

  if (error || !node) return (
    <div className="flex min-h-screen" style={{ background: `linear-gradient(180deg, ${BG_TOP}, ${BG_BOT})`, color: '#fff' }}>
      <SynthGrid /><VHSTracking />
      <SynthSidebar active="/v3/nodes" />
      <div className="flex-1 flex flex-col items-center justify-center gap-4 relative z-10">
        <NeonText color={YELLOW} size="text-xl">{error || 'NODE NOT FOUND'}</NeonText>
        <Link to="/v3" style={{ color: `${CYAN}80` }}>← Back to dashboard</Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen" style={{
      background: `linear-gradient(180deg, ${BG_TOP}, ${BG_BOT})`,
      color: '#ffffff',
      fontFamily: "'Rajdhani', sans-serif",
    }}>
      <SynthGrid />
      <VHSTracking />
      <SynthSidebar active="/v3/nodes" />
      <div className="flex-1 p-8 overflow-y-auto relative z-10">
        <Link to="/v3" className="text-xs font-bold tracking-wider inline-block mb-6 transition-colors"
          style={{ color: `${CYAN}80` }}>
          ← DASHBOARD
        </Link>

        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-8">
          <NeonText color={PINK} size="text-3xl">{node.hostname}</NeonText>
          <div className="flex gap-4 mt-2 text-xs font-bold tracking-wider" style={{ color: `${CYAN}60` }}>
            <span>STATUS: <span style={{ color: node.status === 'online' ? CYAN : YELLOW,
              textShadow: `0 0 8px ${node.status === 'online' ? CYAN : YELLOW}` }}>
              {node.status.toUpperCase()}</span></span>
            <span>{node.system_info?.os?.distro}</span>
            {node.system_info?.uptime && <span>UPTIME: {formatUptime(node.system_info.uptime)}</span>}
          </div>
          <div className="h-px mt-4" style={{ background: `linear-gradient(to right, ${PINK}, ${PURPLE}, ${CYAN})` }} />
        </motion.div>

        {data ? (
          <>
            {/* Main gauges */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: 'CPU', value: data.cpu?.usage || 0, color: PINK },
                { label: 'MEMORY', value: data.memory?.usagePercent || 0, color: CYAN, sub: `${formatBytes(data.memory?.used)} / ${formatBytes(data.memory?.total)}` },
                { label: 'SWAP', value: data.swap?.usagePercent || 0, color: PURPLE },
              ].map((g, i) => (
                <NeonCard key={i} color={g.color} delay={0.1 * i + 0.2}>
                  <div className="text-[10px] font-bold tracking-[0.3em] mb-2" style={{ color: `${g.color}80` }}>{g.label}</div>
                  <div className="text-5xl font-black mb-3" style={{
                    color: g.color, textShadow: `0 0 20px ${g.color}80, 0 0 40px ${g.color}40`
                  }}>{g.value.toFixed(1)}%</div>
                  <NeonBar value={g.value} color={g.color} />
                  {g.sub && <div className="text-[10px] mt-2 font-bold" style={{ color: `${g.color}60` }}>{g.sub}</div>}
                </NeonCard>
              ))}
            </div>

            {/* Processes */}
            <NeonCard color={CYAN} delay={0.5} className="mb-6">
              <div className="text-[10px] font-bold tracking-[0.3em] mb-3" style={{ color: `${CYAN}80` }}>
                ◈ PROCESSES
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-3xl font-black" style={{ color: CYAN }}>{data.processes?.all || 0}</div>
                  <div className="text-[10px] font-bold" style={{ color: `${CYAN}60` }}>TOTAL</div>
                </div>
                <div>
                  <div className="text-3xl font-black" style={{ color: PINK }}>{data.processes?.running || 0}</div>
                  <div className="text-[10px] font-bold" style={{ color: `${PINK}60` }}>RUNNING</div>
                </div>
                <div>
                  <div className="text-3xl font-black" style={{ color: PURPLE }}>{data.processes?.sleeping || 0}</div>
                  <div className="text-[10px] font-bold" style={{ color: `${PURPLE}60` }}>SLEEPING</div>
                </div>
              </div>
            </NeonCard>

            {/* Disks */}
            {data.disk && data.disk.length > 0 && (
              <NeonCard color={PURPLE} delay={0.6}>
                <div className="text-[10px] font-bold tracking-[0.3em] mb-4" style={{ color: `${PURPLE}80` }}>
                  ◇ STORAGE
                </div>
                <div className="space-y-4">
                  {data.disk.map((d, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span style={{ color: `${PURPLE}cc` }}>{d.mount}</span>
                        <span style={{ color: PURPLE }}>{formatBytes(d.used)} / {formatBytes(d.size)}</span>
                      </div>
                      <NeonBar value={d.usagePercent || 0} color={d.usagePercent > 90 ? YELLOW : PURPLE} />
                    </div>
                  ))}
                </div>
              </NeonCard>
            )}
          </>
        ) : (
          <NeonCard color={PINK} className="text-center py-12">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
              <NeonText color={PINK} size="text-xl">AWAITING SIGNAL...</NeonText>
            </motion.div>
          </NeonCard>
        )}
      </div>
    </div>
  );
}

export { OverviewV3, NodeDetailV3 };
