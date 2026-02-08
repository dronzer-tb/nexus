import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const variants = [
  {
    id: 'v1',
    name: 'Terminal Noir',
    desc: 'Phosphor green on black. CRT scanlines. Hacker command center.',
    gradient: 'from-green-900/40 to-black',
    accent: '#00ff41',
    font: 'monospace',
  },
  {
    id: 'v2',
    name: 'Celestial Observatory',
    desc: 'Deep space. Star fields. Orbital data rings. Cosmic gradients.',
    gradient: 'from-indigo-950 to-slate-950',
    accent: '#818cf8',
    font: 'serif',
  },
  {
    id: 'v3',
    name: 'Retro Synthwave',
    desc: 'Neon grid. Chrome text. Hot pink & cyan. VHS tracking lines.',
    gradient: 'from-purple-950 to-fuchsia-950',
    accent: '#ff2d95',
    font: 'sans-serif',
  },
  {
    id: 'v4',
    name: 'Paper & Ink',
    desc: 'Japanese editorial. Ink wash textures. Washi paper. Vertical flow.',
    gradient: 'from-stone-100 to-amber-50',
    accent: '#1a1a1a',
    font: 'serif',
  },
  {
    id: 'v5',
    name: 'Neo Brutalist',
    desc: 'Thick borders. Clashing colors. Raw type. Exposed structure.',
    gradient: 'from-yellow-300 to-lime-300',
    accent: '#000000',
    font: 'sans-serif',
  },
];

export default function VariantPicker() {
  return (
    <div className="min-h-screen bg-[#08080a] flex flex-col items-center justify-center p-8 overflow-hidden relative">
      {/* Background grain */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }} />

      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="text-center mb-16 relative z-10"
      >
        <h1 className="text-7xl font-black text-white tracking-tighter mb-4" style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>
          NEXUS
        </h1>
        <p className="text-white/40 text-lg tracking-[0.3em] uppercase">
          Choose your interface
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-[1400px] w-full relative z-10">
        {variants.map((v, i) => (
          <motion.div
            key={v.id}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link
              to={`/${v.id}`}
              className="group block relative overflow-hidden rounded-2xl border border-white/[0.06] hover:border-white/20 transition-all duration-500"
              style={{ aspectRatio: '3/4' }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${v.gradient} transition-all duration-500 group-hover:scale-110`} />
              
              {/* Hover glow */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-500 blur-2xl"
                style={{ backgroundColor: v.accent }}
              />

              <div className="relative h-full flex flex-col justify-between p-6">
                <div>
                  <span 
                    className="text-xs font-bold tracking-[0.25em] uppercase opacity-60"
                    style={{ color: v.accent, fontFamily: v.font }}
                  >
                    {v.id}
                  </span>
                </div>
                
                <div>
                  <h2 
                    className="text-2xl font-bold text-white mb-2 group-hover:translate-x-1 transition-transform duration-300"
                    style={{ fontFamily: v.font }}
                  >
                    {v.name}
                  </h2>
                  <p className="text-white/50 text-sm leading-relaxed">
                    {v.desc}
                  </p>
                  
                  <div className="mt-4 flex items-center gap-2 text-white/30 group-hover:text-white/60 transition-colors duration-300">
                    <span className="text-xs tracking-wider uppercase">Enter</span>
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
