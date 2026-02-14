import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ViewGrid, Server, Page, LogOut, Settings as SettingsIcon,
  NavArrowLeft, NavArrowRight, NavArrowDown, Terminal, List,
  Palette, ArrowUpCircle, Key, Group, Computer, SmartphoneDevice
} from 'iconoir-react';
import clsx from 'clsx';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

import Overview from './Overview';
import AgentsList from './AgentsList';
import AgentDetails from './AgentDetails';
import Logs from './Logs';
import Settings from './Settings';
import Console from './Console';
import NodeProcesses from './NodeProcesses';
import MobilePairing from './MobilePairing';

/* ─── Sidebar Item ─── */
const SidebarItem = ({ icon: Icon, label, path, active, collapsed, onClick }) => {
  const content = (
    <div className={clsx(
      "flex items-center gap-3 px-4 py-3 border-2 transition-all duration-100 font-bold text-sm uppercase tracking-tight",
      collapsed && "justify-center px-0",
      active
        ? "bg-neon-pink translate-x-[-3px] translate-y-[-3px] shadow-brutal border-neon-pink"
        : "bg-brutal-card text-tx/60 border-tx/[0.06] hover:border-neon-pink/40 hover:text-tx"
    )}
      style={active ? { color: 'var(--on-neon-pink)' } : undefined}
      title={collapsed ? label : undefined}
    >
      <Icon className="w-5 h-5 shrink-0" strokeWidth={2.5} />
      {!collapsed && <span className="truncate">{label}</span>}
    </div>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="block w-full mb-[-2px] relative z-10 group text-left">
        {content}
      </button>
    );
  }

  return (
    <Link to={path} className="block mb-[-2px] relative z-10 group">
      {content}
    </Link>
  );
};

/* ─── Sub-item for dropdowns ─── */
const SubItem = ({ icon: Icon, label, path, active, collapsed }) => (
  <Link to={path} className="block group" title={collapsed ? label : undefined}>
    <div className={clsx(
      "flex items-center gap-2.5 py-2 border-l-2 transition-all text-xs font-bold uppercase tracking-wider",
      collapsed ? "justify-center px-2 border-l-0" : "pl-10 pr-4",
      active
        ? "border-neon-cyan text-neon-cyan bg-neon-cyan/5"
        : "border-tx/5 text-tx/35 hover:text-neon-cyan hover:border-neon-cyan/40"
    )}>
      <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
      {!collapsed && <span>{label}</span>}
    </div>
  </Link>
);

/* ─────── BRUTALIST DASHBOARD ─────── */
function Dashboard({ socket }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('nexus-sidebar') === 'collapsed'; } catch { return false; }
  });

  const [nodes, setNodes] = useState([]);
  const [expandedNode, setExpandedNode] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Fetch nodes for sidebar
  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const res = await axios.get('/api/nodes');
        setNodes(res.data.nodes || []);
      } catch { /* ignore */ }
    };
    fetchNodes();
    const interval = setInterval(fetchNodes, 15000);

    if (socket) {
      socket.on('nodes:update', (updatedNodes) => setNodes(updatedNodes));
    }

    return () => {
      clearInterval(interval);
      if (socket) socket.off('nodes:update');
    };
  }, [socket]);

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem('nexus-sidebar', collapsed ? 'collapsed' : 'expanded');
  }, [collapsed]);

  // Auto-open settings submenu when on a settings route
  useEffect(() => {
    if (location.pathname.startsWith('/settings')) setSettingsOpen(true);
  }, [location.pathname]);

  // Auto-expand node dropdown when navigating to a node's processes
  useEffect(() => {
    const match = location.pathname.match(/^\/nodes\/([^/]+)\/processes/);
    if (match) setExpandedNode(match[1]);
  }, [location.pathname]);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const isNodeSubActive = (nodeId, sub) => location.pathname === `/nodes/${nodeId}/${sub}`;

  const settingsSubItems = [
    { icon: Palette, label: 'Themes', path: '/settings/themes' },
    { icon: ArrowUpCircle, label: 'Updates', path: '/settings/updates' },
    { icon: Key, label: 'API Keys', path: '/settings/api-keys' },
    { icon: Group, label: 'Users', path: '/settings/users' },
  ];

  const toggleNode = (nodeId) => {
    setExpandedNode(prev => prev === nodeId ? null : nodeId);
  };

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-72';

  return (
    <div className="min-h-screen bg-brutal-bg text-tx font-brutal selection:bg-neon-pink selection:text-white">
      <div className="flex h-screen overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className={clsx(
          "border-r-[3px] border-neon-pink/20 flex flex-col bg-brutal-surface transition-all duration-200 shrink-0",
          sidebarWidth
        )}>
          {/* Logo block */}
          <div className={clsx(
            "border-b-[3px] border-neon-pink/20 bg-gradient-to-br from-neon-pink/10 to-neon-purple/10",
            collapsed ? "p-3 flex items-center justify-center" : "p-6"
          )}>
            {collapsed ? (
              <h1 className="text-xl font-black tracking-tighter italic text-neon-pink"
                style={{ textShadow: '0 0 20px var(--neon-pink)' }}>N</h1>
            ) : (
              <>
                <h1 className="text-4xl font-black tracking-tighter italic text-neon-pink"
                  style={{ textShadow: '0 0 30px var(--neon-pink)' }}>NEXUS</h1>
                <p className="text-[9px] font-bold uppercase mt-2 border border-neon-cyan/30 inline-block px-2 py-1 bg-brutal-bg/60 text-neon-cyan tracking-[0.25em]">
                  SYS_MONITOR // RAW
                </p>
              </>
            )}
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
            <div className="space-y-3">
              {/* Collapse toggle */}
              <button
                onClick={() => setCollapsed(c => !c)}
                className={clsx(
                  "w-full flex items-center gap-2 px-3 py-2 border-2 border-tx/[0.06] bg-brutal-card text-tx/30 hover:text-neon-pink hover:border-neon-pink/30 transition-all text-[10px] font-bold uppercase tracking-widest",
                  collapsed && "justify-center"
                )}
              >
                {collapsed ? <NavArrowRight className="w-4 h-4" /> : <><NavArrowLeft className="w-4 h-4" /><span>Collapse</span></>}
              </button>

              {!collapsed && (
                <div className="bg-neon-pink px-2 py-1 text-[10px] font-bold uppercase inline-block rotate-[-2deg] tracking-widest"
                  style={{ color: 'var(--on-neon-pink)' }}>
                  Navigation
                </div>
              )}

              {/* Main nav items */}
              <SidebarItem icon={ViewGrid} label="Overview" path="/" active={isActive('/')} collapsed={collapsed} />

              {/* Nodes section */}
              <SidebarItem icon={Server} label="Nodes" path="/nodes" active={location.pathname.startsWith('/nodes')} collapsed={collapsed} />

              <SidebarItem icon={Page} label="Logs" path="/logs" active={isActive('/logs')} collapsed={collapsed} />

              <SidebarItem icon={Terminal} label="Console" path="/console" active={isActive('/console')} collapsed={collapsed} />

              <SidebarItem icon={SmartphoneDevice} label="Mobile" path="/mobile-pairing" active={isActive('/mobile-pairing')} collapsed={collapsed} />

              {/* Settings with submenu */}
              <div>
                <SidebarItem
                  icon={SettingsIcon}
                  label="Settings"
                  active={location.pathname.startsWith('/settings')}
                  collapsed={collapsed}
                  onClick={() => {
                    if (collapsed) {
                      navigate('/settings/themes');
                    } else {
                      setSettingsOpen(o => !o);
                      if (!settingsOpen) navigate('/settings/themes');
                    }
                  }}
                />
                <AnimatePresence>
                  {settingsOpen && !collapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      {settingsSubItems.map(item => (
                        <SubItem
                          key={item.path}
                          icon={item.icon}
                          label={item.label}
                          path={item.path}
                          active={isActive(item.path)}
                          collapsed={collapsed}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* System status block */}
            {!collapsed && (
              <div className="mt-10 space-y-3">
                <div className="bg-neon-cyan/80 px-2 py-1 text-[10px] font-bold uppercase inline-block rotate-[1deg] tracking-widest"
                  style={{ color: 'var(--on-neon-cyan)' }}>
                  System
                </div>
                <div className="border-[3px] border-neon-cyan/20 p-4 bg-brutal-card shadow-brutal-cyan">
                  <div className="flex items-center gap-2 mb-2 font-bold uppercase text-xs text-neon-cyan">
                    <div className="w-2.5 h-2.5 bg-neon-cyan border border-neon-cyan/60 rounded-none animate-pulse" />
                    Online
                  </div>
                  <div className="text-[10px] uppercase leading-relaxed text-tx/40 font-mono">
                    Nodes: {nodes.filter(n => n.status === 'online').length}/{nodes.length}<br />
                    Stream: 5s interval<br />
                    Auth: JWT secured
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Logout */}
          <div className="p-3 border-t-[3px] border-neon-pink/20 bg-brutal-surface">
            <button
              onClick={logout}
              className={clsx(
                "w-full py-2.5 border-2 border-red-500/50 bg-red-500/10 text-red-400 font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-red-500/20 hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-brutal-sm active:shadow-none transition-all",
                collapsed && "px-0"
              )}
            >
              <LogOut className="w-4 h-4" />
              {!collapsed && 'Disconnect'}
            </button>
            {!collapsed && (
              <div className="text-center text-[8px] mt-2 tracking-[0.4em] text-tx/15 font-bold uppercase">
                Dronzer Studios
              </div>
            )}
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
                <Route path="/nodes/:agentId/processes" element={<NodeProcesses socket={socket} />} />
                <Route path="/console" element={<Console socket={socket} />} />
                <Route path="/logs" element={<Logs socket={socket} />} />
                <Route path="/mobile-pairing" element={<MobilePairing />} />
                <Route path="/settings" element={<Navigate to="/settings/themes" replace />} />
                <Route path="/settings/:tab" element={<Settings />} />
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
