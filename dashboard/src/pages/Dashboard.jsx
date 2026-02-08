import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutGrid, Terminal, Server,
  FileText, ListTree, LogOut
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import Overview from './Overview';
import AgentsList from './AgentsList';
import AgentDetails from './AgentDetails';
import ProcessManager from './ProcessManager';
import CommandConsole from './CommandConsole';
import Logs from './Logs';

/* ─────── SYNTHWAVE BRUTALIST DASHBOARD ───────
   Brutalist structure + V3 Synthwave palette.
   Hot pink, electric cyan, deep purple.
   Hard shadows, thick borders, raw energy. */

const SidebarItem = ({ icon: Icon, label, path, active }) => (
  <Link to={path} className="block mb-[-2px] relative z-10 group">
    <div className={clsx(
      "flex items-center gap-3 px-5 py-3.5 border-2 transition-all duration-100 font-bold text-sm uppercase tracking-tight",
      active
        ? "bg-neon-pink text-white translate-x-[-4px] translate-y-[-4px] shadow-brutal border-neon-pink"
        : "bg-brutal-card text-white/60 border-white/[0.06] hover:border-neon-pink/40 hover:text-white"
    )}>
      <Icon className="w-5 h-5" strokeWidth={2.5} />
      <span>{label}</span>
    </div>
  </Link>
);

function Dashboard({ socket }) {
  const location = useLocation();
  const { logout } = useAuth();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const navItems = [
    { icon: LayoutGrid, label: 'Overview', path: '/' },
    { icon: Server, label: 'Nodes', path: '/nodes' },
    { icon: ListTree, label: 'Processes', path: '/processes' },
    { icon: Terminal, label: 'Console', path: '/console' },
    { icon: FileText, label: 'Logs', path: '/logs' },
  ];

  return (
    <div className="min-h-screen bg-brutal-bg text-white font-brutal selection:bg-neon-pink selection:text-white">
      <div className="flex h-screen overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className="w-72 border-r-[3px] border-neon-pink/20 flex flex-col bg-brutal-surface">
          {/* Logo block */}
          <div className="p-6 border-b-[3px] border-neon-pink/20 bg-gradient-to-br from-neon-pink/10 to-neon-purple/10">
            <h1
              className="text-4xl font-black tracking-tighter italic text-neon-pink"
              style={{ textShadow: '0 0 30px rgba(255,45,149,0.35)' }}
            >
              NEXUS
            </h1>
            <p className="text-[9px] font-bold uppercase mt-2 border border-neon-cyan/30 inline-block px-2 py-1 bg-brutal-bg/60 text-neon-cyan tracking-[0.25em]">
              SYS_MONITOR // RAW
            </p>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div className="space-y-4">
              <div className="bg-neon-pink text-white px-2 py-1 text-[10px] font-bold uppercase inline-block rotate-[-2deg] tracking-widest">
                Navigation
              </div>
              <div className="space-y-0">
                {navItems.map(item => (
                  <SidebarItem
                    key={item.path}
                    icon={item.icon}
                    label={item.label}
                    path={item.path}
                    active={isActive(item.path)}
                  />
                ))}
              </div>
            </div>

            {/* System status block */}
            <div className="mt-10 space-y-3">
              <div className="bg-neon-cyan/80 text-brutal-bg px-2 py-1 text-[10px] font-bold uppercase inline-block rotate-[1deg] tracking-widest">
                System
              </div>
              <div className="border-[3px] border-neon-cyan/20 p-4 bg-brutal-card shadow-brutal-cyan">
                <div className="flex items-center gap-2 mb-2 font-bold uppercase text-xs text-neon-cyan">
                  <div className="w-2.5 h-2.5 bg-neon-cyan border border-neon-cyan/60 rounded-none animate-pulse" />
                  Online
                </div>
                <div className="text-[10px] uppercase leading-relaxed text-white/40 font-mono">
                  Protocol: WSS/HTTPS<br />
                  Stream: 5s interval<br />
                  Auth: JWT secured
                </div>
              </div>
            </div>
          </div>

          {/* Logout */}
          <div className="p-4 border-t-[3px] border-neon-pink/20 bg-brutal-surface">
            <button
              onClick={logout}
              className="w-full py-3 border-2 border-red-500/50 bg-red-500/10 text-red-400 font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-red-500/20 hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-brutal-sm active:shadow-none transition-all"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
            <div className="text-center text-[8px] mt-3 tracking-[0.4em] text-white/15 font-bold uppercase">
              Dronzer Studios
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 flex flex-col min-w-0 bg-brutal-bg overflow-hidden relative">
          {/* Ticker tape */}
          <header className="h-11 border-b-[3px] border-neon-pink/20 bg-neon-pink/[0.07] flex items-center overflow-hidden whitespace-nowrap">
            <div className="animate-marquee flex items-center gap-12 font-bold font-mono text-[11px] uppercase tracking-widest text-neon-pink/50">
              <span>/// SYSTEM STATUS: OPERATIONAL</span>
              <span>/// NEXUS MONITORING ACTIVE</span>
              <span>/// REAL-TIME METRICS STREAM</span>
              <span>/// WEBSOCKET: CONNECTED</span>
              <span>/// PROTOCOL: SECURE</span>
              <span>/// SYSTEM STATUS: OPERATIONAL</span>
              <span>/// NEXUS MONITORING ACTIVE</span>
              <span>/// REAL-TIME METRICS STREAM</span>
              <span>/// WEBSOCKET: CONNECTED</span>
              <span>/// PROTOCOL: SECURE</span>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            >
              <Routes>
                <Route path="/" element={<Overview socket={socket} />} />
                <Route path="/nodes" element={<AgentsList socket={socket} />} />
                <Route path="/nodes/:agentId" element={<AgentDetails socket={socket} />} />
                <Route path="/processes" element={<ProcessManager socket={socket} />} />
                <Route path="/console" element={<CommandConsole socket={socket} />} />
                <Route path="/logs" element={<Logs socket={socket} />} />
              </Routes>
            </motion.div>
          </div>

          {/* Decorative corners */}
          <div className="absolute top-16 right-8 w-12 h-12 border-t-[3px] border-r-[3px] border-neon-pink/[0.08] pointer-events-none" />
          <div className="absolute bottom-8 right-8 w-12 h-12 border-b-[3px] border-r-[3px] border-neon-cyan/[0.08] pointer-events-none" />
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
