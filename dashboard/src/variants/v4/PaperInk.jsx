import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNexusData, useNodeMetrics, formatBytes, formatUptime } from '../../hooks/useNexusData';
import { useAuth } from '../../context/AuthContext';

/* ─────────── V4 PAPER & INK EDITORIAL ───────────
   Japanese editorial. Washi paper warmth.
   Ink brush strokes. Vertical type accents.
   Elegant minimalism. Serif typography. */

const INK = '#1a1a1a';
const STONE = '#f5f0eb';
const WARM = '#d4a574';
const RED = '#c53030';
const MUTED = '#8b8178';

// Ink wash texture overlay
function InkWash() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]" style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
    }} />
  );
}

// Horizontal rule like a brush stroke
function BrushStroke({ color = INK, className = '' }) {
  return (
    <div className={`relative h-[2px] ${className}`}>
      <div className="absolute inset-0" style={{
        background: color,
        maskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 30%, black 70%, black 95%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 30%, black 70%, black 95%, transparent 100%)',
        opacity: 0.6,
      }} />
    </div>
  );
}

// Vertical text accent
function VerticalText({ children, className = '' }) {
  return (
    <div className={`writing-vertical ${className}`} style={{
      writingMode: 'vertical-rl',
      textOrientation: 'mixed',
      color: MUTED,
      fontSize: '10px',
      letterSpacing: '0.3em',
      fontWeight: 300,
    }}>
      {children}
    </div>
  );
}

// Minimal progress indicator
function InkBar({ value, color = INK }) {
  return (
    <div className="w-full h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: `${color}10` }}>
      <motion.div
        className="h-full"
        style={{ backgroundColor: color, opacity: 0.7 }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

// Paper card
function PaperCard({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={`p-6 ${className}`}
      style={{
        backgroundColor: '#faf8f5',
        border: `1px solid ${INK}0a`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {children}
    </motion.div>
  );
}

function EditorialSidebar({ active }) {
  const { logout } = useAuth();
  const links = [
    { path: '/v4', label: 'Overview', jp: '概要' },
    { path: '/v4/nodes', label: 'Systems', jp: '系統' },
  ];

  return (
    <div className="w-56 flex flex-col justify-between py-8 px-6 border-r z-10 relative"
      style={{ backgroundColor: STONE, borderColor: `${INK}08` }}>
      <div>
        <div className="mb-12">
          <div className="text-xs tracking-[0.5em] uppercase mb-1" style={{ color: MUTED }}>
            ネクサス
          </div>
          <h2 className="text-2xl font-serif font-light" style={{ color: INK }}>Nexus</h2>
          <BrushStroke className="mt-3" />
        </div>

        <nav className="space-y-1">
          {links.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className="flex items-center justify-between px-3 py-3 transition-all duration-300"
              style={{
                color: active === link.path ? INK : MUTED,
                borderLeft: active === link.path ? `2px solid ${INK}` : '2px solid transparent',
                fontFamily: "'Libre Baskerville', 'Georgia', serif",
                fontSize: '14px',
              }}
            >
              <span>{link.label}</span>
              <span className="text-[10px] opacity-40">{link.jp}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div>
        <BrushStroke className="mb-4" />
        <button onClick={logout}
          className="w-full text-left px-3 py-2 text-sm transition-all duration-300"
          style={{ color: MUTED, fontFamily: "'Libre Baskerville', serif" }}>
          Sign out
        </button>
        <div className="text-center text-[9px] mt-6 tracking-[0.4em]" style={{ color: `${MUTED}80` }}>
          DRONZER
        </div>
      </div>
    </div>
  );
}

function OverviewV4({ socket }) {
  const { nodes, stats, loading } = useNexusData(socket);
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: STONE, color: INK }}>
      <InkWash />
      <EditorialSidebar active="/v4" />

      <div className="flex-1 overflow-y-auto relative z-10">
        {/* Main content with vertical accent */}
        <div className="flex">
          <div className="flex-1 px-10 py-8 max-w-5xl">
            {/* Header — editorial style */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-10">
              <div className="flex justify-between items-baseline">
                <div>
                  <div className="text-[10px] tracking-[0.5em] uppercase" style={{ color: MUTED }}>
                    {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                  <h1 className="text-5xl font-light mt-2" style={{ fontFamily: "'Libre Baskerville', 'Georgia', serif" }}>
                    System Overview
                  </h1>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-light" style={{ fontFamily: "'Libre Baskerville', serif", color: MUTED }}>
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              <BrushStroke className="mt-6" />
            </motion.div>

            {/* Stats — editorial numbers */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="grid grid-cols-4 gap-8 mb-12">
              {[
                { label: 'Total', value: stats.total },
                { label: 'Online', value: stats.online, accent: true },
                { label: 'Offline', value: stats.offline, warn: true },
                { label: 'Avg CPU', value: `${stats.avgCpu.toFixed(0)}%` },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 * i + 0.3 }}>
                  <div className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: MUTED }}>{s.label}</div>
                  <div className="text-5xl font-light" style={{
                    fontFamily: "'Libre Baskerville', serif",
                    color: s.warn ? RED : s.accent ? INK : INK,
                  }}>
                    {s.value}
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Average metrics */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mb-12">
              <div className="text-[10px] tracking-[0.3em] uppercase mb-6" style={{ color: MUTED }}>Fleet Health</div>
              <div className="space-y-6">
                {[
                  { label: 'Processor', value: stats.avgCpu },
                  { label: 'Memory', value: stats.avgMem },
                  { label: 'Storage', value: stats.avgDisk },
                ].map((m, i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm" style={{ fontFamily: "'Libre Baskerville', serif" }}>{m.label}</span>
                      <span className="text-sm" style={{ color: MUTED }}>{m.value.toFixed(1)}%</span>
                    </div>
                    <InkBar value={m.value} />
                  </div>
                ))}
              </div>
            </motion.div>

            <BrushStroke className="mb-8" />

            {/* Node list — editorial table */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
              <div className="text-[10px] tracking-[0.3em] uppercase mb-6" style={{ color: MUTED }}>Connected Systems</div>

              {loading ? (
                <div className="text-center py-16" style={{ color: MUTED, fontFamily: "'Libre Baskerville', serif" }}>
                  <div className="text-lg font-light">Gathering data...</div>
                </div>
              ) : nodes.length === 0 ? (
                <PaperCard className="text-center py-12">
                  <div className="text-lg font-light" style={{ fontFamily: "'Libre Baskerville', serif", color: MUTED }}>
                    No systems connected
                  </div>
                </PaperCard>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {nodes.map((node, i) => (
                      <motion.div key={node.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * i + 0.6 }}>
                        <Link to={`/v4/nodes/${node.id}`}>
                          <PaperCard className="hover:shadow-md transition-shadow duration-500 cursor-pointer" delay={0}>
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <h3 className="text-xl font-light" style={{ fontFamily: "'Libre Baskerville', serif" }}>
                                  {node.hostname || 'Unknown'}
                                </h3>
                                <div className="text-[10px] tracking-wider mt-1" style={{ color: MUTED }}>
                                  {node.system_info?.os?.distro || '—'}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${node.status === 'online' ? 'animate-pulse' : ''}`}
                                  style={{ backgroundColor: node.status === 'online' ? INK : RED }} />
                                <span className="text-[10px] tracking-wider" style={{ color: MUTED }}>
                                  {node.status}
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-6">
                              {[
                                { l: 'CPU', v: node.metrics?.cpu || 0 },
                                { l: 'Memory', v: node.metrics?.memory || 0 },
                                { l: 'Disk', v: node.metrics?.disk || 0 },
                              ].map((m, j) => (
                                <div key={j}>
                                  <div className="flex justify-between text-[10px] mb-1">
                                    <span style={{ color: MUTED }}>{m.l}</span>
                                    <span>{m.v.toFixed(1)}%</span>
                                  </div>
                                  <InkBar value={m.v} />
                                </div>
                              ))}
                            </div>
                          </PaperCard>
                        </Link>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </div>

          {/* Vertical accent bar */}
          <div className="w-12 py-8 flex justify-center">
            <VerticalText>
              NEXUS — INFRASTRUCTURE MONITOR — {new Date().getFullYear()}
            </VerticalText>
          </div>
        </div>
      </div>
    </div>
  );
}

function NodeDetailV4({ socket }) {
  const { agentId } = useParams();
  const { node, metrics, latest, loading, error } = useNodeMetrics(agentId);
  const data = latest?.data || null;

  if (loading) return (
    <div className="flex min-h-screen" style={{ backgroundColor: STONE, color: INK }}>
      <InkWash />
      <EditorialSidebar active="/v4/nodes" />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-lg font-light" style={{ fontFamily: "'Libre Baskerville', serif", color: MUTED }}>
          Loading...
        </div>
      </div>
    </div>
  );

  if (error || !node) return (
    <div className="flex min-h-screen" style={{ backgroundColor: STONE, color: INK }}>
      <InkWash />
      <EditorialSidebar active="/v4/nodes" />
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="text-lg" style={{ fontFamily: "'Libre Baskerville', serif", color: RED }}>{error || 'Not found'}</div>
        <Link to="/v4" className="text-sm" style={{ color: MUTED }}>← Return</Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: STONE, color: INK }}>
      <InkWash />
      <EditorialSidebar active="/v4/nodes" />

      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="flex">
          <div className="flex-1 px-10 py-8 max-w-5xl">
            <Link to="/v4" className="text-[10px] tracking-[0.3em] uppercase inline-block mb-8 transition-colors"
              style={{ color: MUTED }}>
              ← Overview
            </Link>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-2 h-2 rounded-full ${node.status === 'online' ? 'animate-pulse' : ''}`}
                  style={{ backgroundColor: node.status === 'online' ? INK : RED }} />
                <span className="text-[10px] tracking-wider uppercase" style={{ color: MUTED }}>{node.status}</span>
              </div>
              <h1 className="text-5xl font-light mb-2" style={{ fontFamily: "'Libre Baskerville', serif" }}>
                {node.hostname}
              </h1>
              <div className="text-sm" style={{ color: MUTED }}>
                {node.system_info?.os?.distro} · Uptime: {formatUptime(node.system_info?.uptime || 0)}
              </div>
              <BrushStroke className="mt-6 mb-10" />
            </motion.div>

            {data ? (
              <>
                {/* Main metrics */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="grid grid-cols-3 gap-8 mb-12">
                  {[
                    { label: 'Processor', value: data.cpu?.usage || 0, unit: '%' },
                    { label: 'Memory', value: data.memory?.usagePercent || 0, unit: '%', sub: `${formatBytes(data.memory?.used)} of ${formatBytes(data.memory?.total)}` },
                    { label: 'Swap', value: data.swap?.usagePercent || 0, unit: '%' },
                  ].map((m, i) => (
                    <div key={i}>
                      <div className="text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: MUTED }}>{m.label}</div>
                      <div className="text-6xl font-light mb-3" style={{ fontFamily: "'Libre Baskerville', serif" }}>
                        {m.value.toFixed(1)}<span className="text-2xl" style={{ color: MUTED }}>{m.unit}</span>
                      </div>
                      <InkBar value={m.value} />
                      {m.sub && <div className="text-[10px] mt-2" style={{ color: MUTED }}>{m.sub}</div>}
                    </div>
                  ))}
                </motion.div>

                {/* Processes */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mb-12">
                  <div className="text-[10px] tracking-[0.3em] uppercase mb-4" style={{ color: MUTED }}>Processes</div>
                  <div className="flex gap-12">
                    <div>
                      <div className="text-4xl font-light" style={{ fontFamily: "'Libre Baskerville', serif" }}>
                        {data.processes?.all || 0}
                      </div>
                      <div className="text-[10px] tracking-wider mt-1" style={{ color: MUTED }}>total</div>
                    </div>
                    <div>
                      <div className="text-4xl font-light" style={{ fontFamily: "'Libre Baskerville', serif" }}>
                        {data.processes?.running || 0}
                      </div>
                      <div className="text-[10px] tracking-wider mt-1" style={{ color: MUTED }}>active</div>
                    </div>
                    <div>
                      <div className="text-4xl font-light" style={{ fontFamily: "'Libre Baskerville', serif" }}>
                        {data.processes?.sleeping || 0}
                      </div>
                      <div className="text-[10px] tracking-wider mt-1" style={{ color: MUTED }}>sleeping</div>
                    </div>
                  </div>
                </motion.div>

                <BrushStroke className="mb-8" />

                {/* Disk */}
                {data.disk && data.disk.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mb-12">
                    <div className="text-[10px] tracking-[0.3em] uppercase mb-6" style={{ color: MUTED }}>Storage</div>
                    <div className="space-y-6">
                      {data.disk.map((d, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-sm mb-2">
                            <span style={{ fontFamily: "'Libre Baskerville', serif" }}>{d.mount}</span>
                            <span style={{ color: MUTED }}>{formatBytes(d.used)} / {formatBytes(d.size)}</span>
                          </div>
                          <InkBar value={d.usagePercent || 0} color={d.usagePercent > 90 ? RED : INK} />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Top processes table */}
                {data.processes?.list && data.processes.list.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                    <div className="text-[10px] tracking-[0.3em] uppercase mb-4" style={{ color: MUTED }}>Top Processes</div>
                    <div className="border-t" style={{ borderColor: `${INK}10` }}>
                      {data.processes.list.slice(0, 8).map((p, i) => (
                        <div key={i} className="flex justify-between py-3 border-b text-sm" style={{ borderColor: `${INK}08` }}>
                          <div className="flex gap-6">
                            <span className="w-16" style={{ color: MUTED }}>{p.pid}</span>
                            <span style={{ fontFamily: "'Libre Baskerville', serif" }}>{p.name}</span>
                          </div>
                          <div className="flex gap-6">
                            <span style={{ color: p.cpu > 50 ? RED : MUTED }}>{p.cpu?.toFixed(1)}%</span>
                            <span style={{ color: MUTED }}>{p.mem?.toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </>
            ) : (
              <PaperCard className="text-center py-16">
                <div className="text-lg font-light" style={{ fontFamily: "'Libre Baskerville', serif", color: MUTED }}>
                  Awaiting metrics...
                </div>
              </PaperCard>
            )}
          </div>

          <div className="w-12 py-8 flex justify-center">
            <VerticalText>{node.hostname} — {node.system_info?.os?.distro || ''}</VerticalText>
          </div>
        </div>
      </div>
    </div>
  );
}

export { OverviewV4, NodeDetailV4 };
