import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNexusData, useNodeMetrics, formatBytes, formatUptime } from '../../hooks/useNexusData';
import { useAuth } from '../../context/AuthContext';

/* ─────────── V5 NEO BRUTALIST ───────────
   Raw. Chunky. Loud. Intentionally chaotic.
   Thick black borders. Clashing colors.
   Newspaper grid. Rotated elements.
   Exposed structure. Anti-design. */

const BLACK = '#000000';
const YELLOW = '#facc15';
const LIME = '#a3e635';
const BLUE = '#3b82f6';
const RED = '#ef4444';
const ORANGE = '#f97316';
const WHITE = '#ffffff';
const PINK = '#ec4899';

// Random rotation within range
const tilt = (max = 2) => `rotate(${(Math.random() - 0.5) * max * 2}deg)`;

// Chunky card
function BrutalCard({ children, className = '', bg = WHITE, border = BLACK, rotate = 0, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: rotate - 2 }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`p-5 ${className}`}
      style={{
        backgroundColor: bg,
        border: `3px solid ${border}`,
        boxShadow: `6px 6px 0 ${BLACK}`,
      }}
    >
      {children}
    </motion.div>
  );
}

// Chunky progress bar
function BrutalBar({ value, color = BLUE, bg = `${BLACK}10`, height = 16 }) {
  return (
    <div className="w-full overflow-hidden" style={{ height, backgroundColor: bg, border: `2px solid ${BLACK}` }}>
      <motion.div
        className="h-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  );
}

// Sticker/badge element
function Sticker({ children, bg = YELLOW, rotate = -3, className = '' }) {
  return (
    <span className={`inline-block px-3 py-1 font-black text-xs uppercase tracking-wider ${className}`}
      style={{
        backgroundColor: bg,
        border: `2px solid ${BLACK}`,
        boxShadow: `3px 3px 0 ${BLACK}`,
        transform: `rotate(${rotate}deg)`,
        color: BLACK,
      }}>
      {children}
    </span>
  );
}

// Marquee ticker
function Ticker({ text, speed = 20 }) {
  return (
    <div className="overflow-hidden whitespace-nowrap py-2" style={{
      backgroundColor: BLACK, color: YELLOW, borderTop: `3px solid ${BLACK}`, borderBottom: `3px solid ${BLACK}`
    }}>
      <motion.div
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: speed, repeat: Infinity, ease: 'linear' }}
        className="inline-block text-xs font-black tracking-widest"
      >
        {text} {text}
      </motion.div>
    </div>
  );
}

function BrutalSidebar({ active }) {
  const { logout } = useAuth();
  const links = [
    { path: '/v5', label: 'OVERVIEW', emoji: '👁️' },
    { path: '/v5/nodes', label: 'NODES', emoji: '🖥️' },
  ];

  return (
    <div className="w-64 flex flex-col justify-between z-10 relative"
      style={{ backgroundColor: YELLOW, borderRight: `3px solid ${BLACK}` }}>
      <div>
        <div className="p-5 text-center" style={{ borderBottom: `3px solid ${BLACK}` }}>
          <motion.h2
            className="text-4xl font-black"
            style={{ color: BLACK }}
            animate={{ rotate: [-1, 1, -1] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            NEXUS
          </motion.h2>
          <Sticker bg={LIME} rotate={2} className="mt-2">BRUTAL MODE</Sticker>
        </div>

        <nav className="p-3 space-y-2">
          {links.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className="flex items-center gap-2 px-4 py-3 font-black text-sm transition-all duration-150"
              style={{
                backgroundColor: active === link.path ? BLACK : 'transparent',
                color: active === link.path ? YELLOW : BLACK,
                border: `2px solid ${BLACK}`,
                boxShadow: active === link.path ? 'none' : `4px 4px 0 ${BLACK}`,
                transform: active === link.path ? 'translate(4px, 4px)' : 'none',
              }}
            >
              <span>{link.emoji}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="p-3">
        <button onClick={logout}
          className="w-full px-4 py-3 font-black text-sm transition-all duration-150 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
          style={{ backgroundColor: RED, color: WHITE, border: `2px solid ${BLACK}`, boxShadow: `4px 4px 0 ${BLACK}` }}>
          🚪 LOGOUT
        </button>
        <div className="text-center text-[9px] font-black mt-4 tracking-widest" style={{ color: BLACK }}>
          DRONZER™
        </div>
      </div>
    </div>
  );
}

function OverviewV5({ socket }) {
  const { nodes, stats, loading } = useNexusData(socket);
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#f5f5f0', color: BLACK, fontFamily: "'Space Grotesk', 'Arial Black', sans-serif" }}>
      <BrutalSidebar active="/v5" />

      <div className="flex-1 overflow-y-auto">
        {/* Ticker */}
        <Ticker text="◈ NEXUS MONITORING SYSTEM ◈ ALL SYSTEMS OPERATIONAL ◈ REAL-TIME METRICS ◈ INFRASTRUCTURE MONITOR ◈ " />

        <div className="p-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-6xl font-black leading-none" style={{ color: BLACK }}>
                  SYSTEM
                  <br />
                  <span style={{ color: WHITE, WebkitTextStroke: `3px ${BLACK}` }}>STATUS</span>
                </h1>
                <div className="flex gap-2 mt-3">
                  <Sticker bg={LIME} rotate={-2}>LIVE</Sticker>
                  <Sticker bg={YELLOW} rotate={1}>{time.toLocaleTimeString()}</Sticker>
                </div>
              </div>
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="text-8xl font-black"
                style={{ WebkitTextStroke: `2px ${BLACK}`, color: 'transparent' }}
              >
                ◎
              </motion.div>
            </div>
          </motion.div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'TOTAL', value: stats.total, bg: WHITE, emoji: '📊' },
              { label: 'ONLINE', value: stats.online, bg: LIME, emoji: '🟢' },
              { label: 'OFFLINE', value: stats.offline, bg: RED, color: WHITE, emoji: '🔴' },
              { label: 'AVG CPU', value: `${stats.avgCpu.toFixed(0)}%`, bg: BLUE, color: WHITE, emoji: '⚡' },
            ].map((s, i) => (
              <BrutalCard key={i} bg={s.bg} delay={0.1 * i + 0.2} rotate={(Math.random() - 0.5) * 2}>
                <div className="text-xs font-black tracking-wider mb-1">{s.emoji} {s.label}</div>
                <div className="text-5xl font-black" style={{ color: s.color || BLACK }}>{s.value}</div>
              </BrutalCard>
            ))}
          </div>

          {/* Fleet avg bars */}
          <BrutalCard bg={WHITE} delay={0.5} className="mb-6" rotate={0.5}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">📈</span>
              <span className="font-black text-lg">FLEET AVERAGES</span>
            </div>
            <div className="space-y-4">
              {[
                { label: 'CPU', value: stats.avgCpu, color: RED },
                { label: 'MEMORY', value: stats.avgMem, color: BLUE },
                { label: 'DISK', value: stats.avgDisk, color: ORANGE },
              ].map((m, i) => (
                <div key={i}>
                  <div className="flex justify-between font-black text-sm mb-1">
                    <span>{m.label}</span>
                    <Sticker bg={m.color} rotate={0} className="!py-0 !text-[10px]">
                      <span style={{ color: WHITE }}>{m.value.toFixed(1)}%</span>
                    </Sticker>
                  </div>
                  <BrutalBar value={m.value} color={m.color} />
                </div>
              ))}
            </div>
          </BrutalCard>

          {/* Nodes */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">🖥️</span>
            <span className="font-black text-xl">CONNECTED NODES</span>
            <Sticker bg={YELLOW} rotate={3}>{nodes.length}</Sticker>
          </div>

          {loading ? (
            <BrutalCard bg={YELLOW} className="text-center py-12" rotate={-1}>
              <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="inline-block text-4xl mb-2">⏳</motion.div>
              <div className="font-black text-xl">LOADING...</div>
            </BrutalCard>
          ) : nodes.length === 0 ? (
            <BrutalCard bg={ORANGE} className="text-center py-12" rotate={1}>
              <div className="text-4xl mb-2">😴</div>
              <div className="font-black text-xl" style={{ color: WHITE }}>NO NODES YET</div>
            </BrutalCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence>
                {nodes.map((node, i) => {
                  const colors = [LIME, YELLOW, BLUE, PINK, ORANGE];
                  const c = colors[i % colors.length];
                  return (
                    <motion.div key={node.id} initial={{ opacity: 0, y: 20, rotate: -3 }}
                      animate={{ opacity: 1, y: 0, rotate: (i % 2 === 0 ? 1 : -1) * (Math.random() + 0.5) }}
                      transition={{ delay: 0.05 * i }}>
                      <Link to={`/v5/nodes/${node.id}`}>
                        <BrutalCard bg={WHITE} delay={0} rotate={0}
                          className="cursor-pointer hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all duration-150">
                          <div className="flex justify-between items-start mb-3">
                            <div className="font-black text-lg truncate pr-2">{node.hostname || 'UNKNOWN'}</div>
                            <Sticker
                              bg={node.status === 'online' ? LIME : RED}
                              rotate={node.status === 'online' ? -2 : 3}
                            >
                              {node.status === 'online' ? '● ON' : '● OFF'}
                            </Sticker>
                          </div>
                          <div className="text-[10px] font-bold mb-3" style={{ color: '#666' }}>
                            {node.system_info?.os?.distro || '—'}
                          </div>
                          <div className="space-y-2">
                            {[
                              { l: 'CPU', v: node.metrics?.cpu || 0, c: RED },
                              { l: 'RAM', v: node.metrics?.memory || 0, c: BLUE },
                              { l: 'DISK', v: node.metrics?.disk || 0, c: ORANGE },
                            ].map((m, j) => (
                              <div key={j}>
                                <div className="flex justify-between font-black text-xs mb-1">
                                  <span>{m.l}</span>
                                  <span>{m.v.toFixed(1)}%</span>
                                </div>
                                <BrutalBar value={m.v} color={m.c} height={10} />
                              </div>
                            ))}
                          </div>
                        </BrutalCard>
                      </Link>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Bottom ticker */}
        <div className="mt-6">
          <Ticker text="◈ BUILT WITH NEXUS ◈ INFRASTRUCTURE MONITORING ◈ DRONZER STUDIOS ◈ NEO BRUTALIST DESIGN ◈ " speed={25} />
        </div>
      </div>
    </div>
  );
}

function NodeDetailV5({ socket }) {
  const { agentId } = useParams();
  const { node, metrics, latest, loading, error } = useNodeMetrics(agentId);
  const data = latest?.data || null;

  if (loading) return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#f5f5f0', color: BLACK }}>
      <BrutalSidebar active="/v5/nodes" />
      <div className="flex-1 flex items-center justify-center">
        <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-6xl">⏳</motion.div>
      </div>
    </div>
  );

  if (error || !node) return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#f5f5f0', color: BLACK }}>
      <BrutalSidebar active="/v5/nodes" />
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <BrutalCard bg={RED}><span className="font-black text-xl" style={{ color: WHITE }}>{error || 'NOT FOUND'}</span></BrutalCard>
        <Link to="/v5" className="font-black underline">← BACK</Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#f5f5f0', color: BLACK, fontFamily: "'Space Grotesk', 'Arial Black', sans-serif" }}>
      <BrutalSidebar active="/v5/nodes" />

      <div className="flex-1 overflow-y-auto">
        <Ticker text={`◈ ${node.hostname?.toUpperCase() || 'NODE'} ◈ ${node.system_info?.os?.distro || 'SYSTEM'} ◈ STATUS: ${node.status?.toUpperCase()} ◈ `} />

        <div className="p-6">
          <Link to="/v5" className="font-black text-sm underline inline-block mb-6">← BACK TO OVERVIEW</Link>

          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="flex items-center gap-4 mb-3">
              <h1 className="text-5xl font-black">{node.hostname}</h1>
              <Sticker bg={node.status === 'online' ? LIME : RED} rotate={-3}>
                {node.status === 'online' ? '● ONLINE' : '● OFFLINE'}
              </Sticker>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Sticker bg={YELLOW} rotate={1}>{node.system_info?.os?.distro || '—'}</Sticker>
              {node.system_info?.uptime && <Sticker bg={BLUE} rotate={-1}><span style={{ color: WHITE }}>UP: {formatUptime(node.system_info.uptime)}</span></Sticker>}
            </div>
          </motion.div>

          {data ? (
            <>
              {/* Big metric cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'CPU', value: data.cpu?.usage || 0, emoji: '⚡', bg: YELLOW, color: RED },
                  { label: 'MEMORY', value: data.memory?.usagePercent || 0, emoji: '🧠', bg: LIME, color: BLUE,
                    sub: `${formatBytes(data.memory?.used)} / ${formatBytes(data.memory?.total)}` },
                  { label: 'SWAP', value: data.swap?.usagePercent || 0, emoji: '💾', bg: PINK, color: WHITE },
                ].map((m, i) => (
                  <BrutalCard key={i} bg={m.bg} delay={0.1 * i + 0.2} rotate={(i - 1) * 1.5}>
                    <div className="font-black text-xs tracking-wider mb-2">{m.emoji} {m.label}</div>
                    <div className="text-6xl font-black mb-2" style={{ color: m.color }}>
                      {m.value.toFixed(1)}%
                    </div>
                    <BrutalBar value={m.value} color={BLACK} height={12} />
                    {m.sub && <div className="text-xs font-bold mt-2" style={{ color: '#555' }}>{m.sub}</div>}
                  </BrutalCard>
                ))}
              </div>

              {/* Processes */}
              <BrutalCard bg={WHITE} delay={0.5} className="mb-6" rotate={-0.5}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">🔧</span>
                  <span className="font-black text-lg">PROCESSES</span>
                </div>
                <div className="flex gap-6">
                  {[
                    { label: 'TOTAL', value: data.processes?.all || 0, bg: YELLOW },
                    { label: 'RUNNING', value: data.processes?.running || 0, bg: LIME },
                    { label: 'SLEEPING', value: data.processes?.sleeping || 0, bg: BLUE },
                  ].map((p, i) => (
                    <BrutalCard key={i} bg={p.bg} rotate={(i - 1) * 2} delay={0}>
                      <div className="text-3xl font-black">{p.value}</div>
                      <div className="text-[10px] font-black tracking-wider">{p.label}</div>
                    </BrutalCard>
                  ))}
                </div>
              </BrutalCard>

              {/* Disks */}
              {data.disk && data.disk.length > 0 && (
                <BrutalCard bg={WHITE} delay={0.6} className="mb-6" rotate={0.5}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">💿</span>
                    <span className="font-black text-lg">STORAGE</span>
                  </div>
                  <div className="space-y-4">
                    {data.disk.map((d, i) => (
                      <div key={i}>
                        <div className="flex justify-between font-black text-sm mb-1">
                          <span>{d.mount}</span>
                          <Sticker bg={d.usagePercent > 90 ? RED : LIME} rotate={0} className="!py-0 !text-[10px]">
                            {d.usagePercent > 90 ? <span style={{ color: WHITE }}>{d.usagePercent?.toFixed(0)}%</span> : `${d.usagePercent?.toFixed(0)}%`}
                          </Sticker>
                        </div>
                        <BrutalBar value={d.usagePercent || 0} color={d.usagePercent > 90 ? RED : ORANGE} />
                        <div className="text-xs font-bold mt-1" style={{ color: '#666' }}>
                          {formatBytes(d.used)} / {formatBytes(d.size)}
                        </div>
                      </div>
                    ))}
                  </div>
                </BrutalCard>
              )}

              {/* Top processes */}
              {data.processes?.list && data.processes.list.length > 0 && (
                <BrutalCard bg={YELLOW} delay={0.7} rotate={-0.5}>
                  <div className="font-black text-lg mb-3">🏃 TOP PROCESSES</div>
                  <div style={{ border: `2px solid ${BLACK}` }}>
                    <div className="grid grid-cols-12 font-black text-xs px-3 py-2" style={{ backgroundColor: BLACK, color: YELLOW }}>
                      <div className="col-span-2">PID</div>
                      <div className="col-span-6">NAME</div>
                      <div className="col-span-2 text-right">CPU</div>
                      <div className="col-span-2 text-right">MEM</div>
                    </div>
                    {data.processes.list.slice(0, 6).map((p, i) => (
                      <div key={i} className="grid grid-cols-12 text-xs font-bold px-3 py-2"
                        style={{ backgroundColor: i % 2 === 0 ? WHITE : '#f5f5f0', borderTop: `1px solid ${BLACK}` }}>
                        <div className="col-span-2">{p.pid}</div>
                        <div className="col-span-6 truncate">{p.name}</div>
                        <div className="col-span-2 text-right" style={{ color: p.cpu > 50 ? RED : BLACK }}>{p.cpu?.toFixed(1)}%</div>
                        <div className="col-span-2 text-right">{p.mem?.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </BrutalCard>
              )}
            </>
          ) : (
            <BrutalCard bg={ORANGE} className="text-center py-12" rotate={2}>
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1, repeat: Infinity }}
                className="text-4xl mb-2">📡</motion.div>
              <div className="font-black text-xl" style={{ color: WHITE }}>WAITING FOR DATA...</div>
            </BrutalCard>
          )}
        </div>
      </div>
    </div>
  );
}

export { OverviewV5, NodeDetailV5 };
