import React, { useMemo } from 'react';

function Stats({ nodes }) {
  const stats = useMemo(() => {
    const online = nodes.filter(n => n.status === 'online').length;
    const offline = nodes.filter(n => n.status === 'offline').length;
    const total = nodes.length;
    
    return { online, offline, total };
  }, [nodes]);

  const StatCard = ({ title, value, color, icon }) => (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
        </div>
        <div className={`text-4xl ${color} opacity-20`}>
          {icon}
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard 
        title="Total Nodes" 
        value={stats.total} 
        color="text-blue-400"
        icon="📊"
      />
      <StatCard 
        title="Online" 
        value={stats.online} 
        color="text-green-400"
        icon="✅"
      />
      <StatCard 
        title="Offline" 
        value={stats.offline} 
        color="text-red-400"
        icon="❌"
      />
    </div>
  );
}

export default Stats;
