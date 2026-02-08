import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNexusData, useNodeMetrics, formatBytes, formatUptime } from '../../hooks/useNexusData';
import { useAuth } from '../../context/AuthContext';

/* ─────────── V2 CELESTIAL OBSERVATORY ───────────
   Deep space. Star fields. Orbital rings.
   Constellation data lines. Cosmic gradients.
   A space observatory monitoring distant systems. */

const ACCENT = '#818cf8';
const ACCENT2 = '#6366f1';
const DIM = '#64748b';
const TEXT = '#e2e8f0';
const BG = '#020617';

// Star field background
function StarField() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 1.5 + 0.3,
      speed: Math.random() * 0.3 + 0.05,
      opacity: Math.random() * 0.8 + 0.2,
      twinkle: Math.random() * Math.PI * 2,
    }));

    let animId;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const t = Date.now() * 0.001;
      stars.forEach(s => {
        const o = s.opacity * (0.5 + 0.5 * Math.sin(t * s.speed + s.twinkle));
        ctx.fillStyle = `rgba(200, 210, 255, ${o})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />;
}

// Orbital ring gauge
function OrbitalGauge({ value, label, size = 120, color = ACCENT }) {
  const r = (size - 12) / 2;
  const c = Math.PI * 2 * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}15`} strokeWidth="3" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        {/* Glow orbit dot */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={3} fill={color}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: `${size / 2}px ${size / 2}px`, filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-2xl font-bold" style={{ color }}>{value.toFixed(1)}%</span>
      </div>
      <span className="text-xs mt-2 tracking-widest uppercase" style={{ color: DIM }}>{label}</span>
    </div>
  );
}

// Nebula gradient mesh
function NebulaGradient() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <div className="absolute -top-1/4 -right-1/4 w-[800px] h-[800px] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />
      <div className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] rounded-full opacity-8"
        style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)' }} />
      <div className="absolute top-1/3 left-1/2 w-[500px] h-[500px] rounded-full opacity-5"
        style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />
    </div>
  );
}

// Glass card
function GlassCard({ children, className = '', delay = 0, ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-2xl border p-5 backdrop-blur-xl ${className}`}
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderColor: 'rgba(129, 140, 248, 0.1)',
        boxShadow: '0 0 40px rgba(99, 102, 241, 0.05)',
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

function CelestialSidebar({ active }) {
  const { logout } = useAuth();
  const links = [
    { path: '/v2', label: 'Observatory', icon: '◎' },
    { path: '/v2/nodes', label: 'Star Map', icon: '✦' },
  ];

  return (
    <div className="w-64 flex flex-col justify-between p-5 backdrop-blur-xl border-r z-10 relative"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.8)', borderColor: 'rgba(129, 140, 248, 0.08)' }}>
      <div>
        <div className="mb-10 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            className="inline-block text-4xl mb-2"
          >
            ◎
          </motion.div>
          <h2 className="text-lg font-light tracking-[0.3em] uppercase" style={{ color: ACCENT }}>NEXUS</h2>
          <div className="text-[10px] tracking-[0.5em] mt-1" style={{ color: DIM }}>OBSERVATORY</div>
        </div>

        <nav className="space-y-2">
          {links.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-sm"
              style={{
                color: active === link.path ? ACCENT : DIM,
                backgroundColor: active === link.path ? 'rgba(129, 140, 248, 0.08)' : 'transparent',
              }}
            >
              <span className="text-lg">{link.icon}</span>
              <span className="tracking-wide">{link.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div>
        <button onClick={logout} className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all duration-300 hover:bg-red-500/10"
          style={{ color: '#f87171' }}>
          ⏻ Disconnect
        </button>
        <div className="text-center text-[9px] mt-4 tracking-widest" style={{ color: DIM }}>
          DRONZER STUDIOS
        </div>
      </div>
    </div>
  );
}

function OverviewV2({ socket }) {
  const { nodes, stats, loading } = useNexusData(socket);
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: BG, color: TEXT, fontFamily: "'DM Sans', sans-serif" }}>
      <StarField />
      <NebulaGradient />
      <CelestialSidebar active="/v2" />

      <div className="flex-1 p-8 overflow-y-auto relative z-10">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-light tracking-wide">
                <span style={{ color: ACCENT }}>Fleet</span> Observatory
              </h1>
              <p className="text-sm mt-1" style={{ color: DIM }}>
                Monitoring {stats.total} system{stats.total !== 1 ? 's' : ''} across the network
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-light tracking-wider" style={{ color: ACCENT }}>
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-[10px] tracking-widest" style={{ color: DIM }}>
                {time.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Orbital gauges */}
        <div className="flex justify-center gap-16 mb-12">
          {[
            { label: 'Avg CPU', value: stats.avgCpu, color: '#818cf8' },
            { label: 'Avg Memory', value: stats.avgMem, color: '#a78bfa' },
            { label: 'Avg Disk', value: stats.avgDisk, color: '#6366f1' },
          ].map((g, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.15 }}
              className="relative"
            >
              <OrbitalGauge value={g.value} label={g.label} size={140} color={g.color} />
            </motion.div>
          ))}
        </div>

        {/* Status pills */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex gap-4 mb-8 justify-center">
          {[
            { label: 'Total', value: stats.total, color: ACCENT },
            { label: 'Online', value: stats.online, color: '#34d399' },
            { label: 'Offline', value: stats.offline, color: '#f87171' },
          ].map((s, i) => (
            <div key={i} className="px-6 py-3 rounded-xl backdrop-blur-lg border text-center"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', borderColor: `${s.color}20` }}>
              <div className="text-2xl font-light" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] tracking-widest uppercase mt-1" style={{ color: DIM }}>{s.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Node cards */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          <div className="text-xs tracking-widest uppercase mb-4" style={{ color: DIM }}>
            ✦ Connected Systems
          </div>

          {loading ? (
            <div className="text-center py-12" style={{ color: DIM }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="inline-block text-3xl mb-3">◎</motion.div>
              <div className="text-sm">Scanning star systems...</div>
            </div>
          ) : nodes.length === 0 ? (
            <GlassCard className="text-center py-12">
              <div className="text-3xl mb-3">✦</div>
              <div style={{ color: DIM }}>No systems detected in this sector</div>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence>
                {nodes.map((node, i) => (
                  <motion.div
                    key={node.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i + 0.7 }}
                  >
                    <Link to={`/v2/nodes/${node.id}`}>
                      <GlassCard className="hover:border-indigo-400/30 transition-all duration-500 cursor-pointer group" delay={0}>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-medium text-lg group-hover:text-indigo-400 transition-colors">{node.hostname || 'Unknown'}</h3>
                            <div className="text-[10px] tracking-wider mt-1" style={{ color: DIM }}>
                              {node.system_info?.os?.distro || 'Unknown OS'}
                            </div>
                          </div>
                          <div className={`w-2 h-2 rounded-full mt-2 ${node.status === 'online' ? 'animate-pulse' : ''}`}
                            style={{
                              backgroundColor: node.status === 'online' ? '#34d399' : '#f87171',
                              boxShadow: node.status === 'online' ? '0 0 10px rgba(52, 211, 153, 0.5)' : 'none'
                            }} />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { l: 'CPU', v: node.metrics?.cpu || 0 },
                            { l: 'MEM', v: node.metrics?.memory || 0 },
                            { l: 'DISK', v: node.metrics?.disk || 0 },
                          ].map((m, j) => (
                            <div key={j}>
                              <div className="flex justify-between text-[10px] mb-1">
                                <span style={{ color: DIM }}>{m.l}</span>
                                <span style={{ color: ACCENT }}>{m.v.toFixed(1)}%</span>
                              </div>
                              <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${ACCENT}15` }}>
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{ backgroundColor: ACCENT }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${m.v}%` }}
                                  transition={{ duration: 1, delay: 0.5 }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </GlassCard>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function NodeDetailV2({ socket }) {
  const { agentId } = useParams();
  const { node, metrics, latest, loading, error } = useNodeMetrics(agentId);
  const data = latest?.data || null;

  if (loading) return (
    <div className="flex min-h-screen" style={{ backgroundColor: BG, color: TEXT }}>
      <StarField /><NebulaGradient />
      <CelestialSidebar active="/v2/nodes" />
      <div className="flex-1 flex items-center justify-center relative z-10">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="text-4xl" style={{ color: ACCENT }}>◎</motion.div>
      </div>
    </div>
  );

  if (error || !node) return (
    <div className="flex min-h-screen" style={{ backgroundColor: BG, color: TEXT }}>
      <StarField /><NebulaGradient />
      <CelestialSidebar active="/v2/nodes" />
      <div className="flex-1 flex flex-col items-center justify-center gap-4 relative z-10">
        <div style={{ color: '#f87171' }}>{error || 'System not found in this sector'}</div>
        <Link to="/v2" className="text-sm" style={{ color: DIM }}>← Return to observatory</Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: BG, color: TEXT, fontFamily: "'DM Sans', sans-serif" }}>
      <StarField />
      <NebulaGradient />
      <CelestialSidebar active="/v2/nodes" />
      <div className="flex-1 p-8 overflow-y-auto relative z-10">
        <Link to="/v2" className="text-xs tracking-wider inline-block mb-6 transition-colors hover:text-indigo-400" style={{ color: DIM }}>
          ← OBSERVATORY
        </Link>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-4 mb-8">
            <div className={`w-3 h-3 rounded-full ${node.status === 'online' ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: node.status === 'online' ? '#34d399' : '#f87171',
                boxShadow: node.status === 'online' ? '0 0 15px rgba(52, 211, 153, 0.5)' : 'none' }} />
            <div>
              <h1 className="text-3xl font-light">{node.hostname}</h1>
              <div className="text-xs tracking-wider" style={{ color: DIM }}>
                {node.system_info?.os?.distro} • Uptime: {formatUptime(node.system_info?.uptime || 0)}
              </div>
            </div>
          </div>
        </motion.div>

        {data ? (
          <>
            {/* Orbital gauges row */}
            <div className="flex justify-around mb-10 flex-wrap gap-8">
              {[
                { label: 'CPU', value: data.cpu?.usage || 0, color: '#818cf8' },
                { label: 'Memory', value: data.memory?.usagePercent || 0, color: '#a78bfa' },
                { label: 'Swap', value: data.swap?.usagePercent || 0, color: '#6366f1' },
              ].map((g, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.1 }} className="relative">
                  <OrbitalGauge value={g.value} label={g.label} size={160} color={g.color} />
                </motion.div>
              ))}
            </div>

            {/* Detail cards */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <GlassCard delay={0.4}>
                <div className="text-xs tracking-widest mb-3" style={{ color: DIM }}>MEMORY ALLOCATION</div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm">Used</span>
                  <span style={{ color: ACCENT }}>{formatBytes(data.memory?.used)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm">Total</span>
                  <span style={{ color: DIM }}>{formatBytes(data.memory?.total)}</span>
                </div>
                <div className="h-2 rounded-full mt-3 overflow-hidden" style={{ backgroundColor: `${ACCENT}15` }}>
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: ACCENT }}
                    initial={{ width: 0 }} animate={{ width: `${data.memory?.usagePercent || 0}%` }}
                    transition={{ duration: 1.2 }} />
                </div>
              </GlassCard>

              <GlassCard delay={0.5}>
                <div className="text-xs tracking-widest mb-3" style={{ color: DIM }}>PROCESS ACTIVITY</div>
                <div className="text-4xl font-light mb-2" style={{ color: ACCENT }}>{data.processes?.all || 0}</div>
                <div className="text-xs" style={{ color: DIM }}>
                  {data.processes?.running || 0} active · {data.processes?.sleeping || 0} sleeping
                </div>
              </GlassCard>
            </div>

            {/* Disks */}
            {data.disk && data.disk.length > 0 && (
              <GlassCard delay={0.6} className="mb-6">
                <div className="text-xs tracking-widest mb-4" style={{ color: DIM }}>STORAGE VOLUMES</div>
                <div className="space-y-4">
                  {data.disk.map((d, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{d.mount}</span>
                        <span style={{ color: ACCENT }}>{formatBytes(d.used)} / {formatBytes(d.size)}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${ACCENT}15` }}>
                        <motion.div className="h-full rounded-full"
                          style={{ backgroundColor: d.usagePercent > 90 ? '#f87171' : ACCENT }}
                          initial={{ width: 0 }} animate={{ width: `${d.usagePercent || 0}%` }}
                          transition={{ duration: 1, delay: 0.2 * i }} />
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </>
        ) : (
          <GlassCard className="text-center py-12">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
              className="inline-block text-3xl mb-3" style={{ color: ACCENT }}>◎</motion.div>
            <div style={{ color: DIM }}>Awaiting telemetry data...</div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

export { OverviewV2, NodeDetailV2 };
