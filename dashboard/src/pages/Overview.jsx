import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import AgentCard from '../components/AgentCard';

function Overview({ socket }) {
  const [agents, setAgents] = useState([]);
  const [stats, setStats] = useState({ online: 0, offline: 0, total: 0 });
  const { user } = useAuth();

  useEffect(() => {
    fetchAgents();

    if (socket) {
      socket.on('agents:update', (updatedAgents) => {
        setAgents(updatedAgents);
        updateStats(updatedAgents);
      });

      socket.on('agent:status', ({ agentId, status }) => {
        setAgents(prevAgents =>
          prevAgents.map(agent =>
            agent.id === agentId ? { ...agent, status } : agent
          )
        );
      });
    }

    return () => {
      if (socket) {
        socket.off('agents:update');
        socket.off('agent:status');
      }
    };
  }, [socket]);

  const fetchAgents = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/agents', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAgents(response.data);
      updateStats(response.data);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  };

  const updateStats = (agentsList) => {
    const online = agentsList.filter(a => a.status === 'online').length;
    const offline = agentsList.filter(a => a.status === 'offline').length;
    setStats({ online, offline, total: agentsList.length });
  };

  return (
    <div className="flex-1 flex flex-col">
      <header className="p-8">
        <h2 className="text-4xl font-bold text-white glow">
          Welcome back, {user?.username || 'User'}
        </h2>
        <p className="text-base text-white/70">Here's a look at your connected agents.</p>
      </header>
      
      <div className="flex-1 p-8">
        <h3 className="text-2xl font-bold text-white mb-6">At a Glance</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
          
          {/* Add New Agent Card */}
          <div className="bg-background-dark/70 p-6 rounded-xl border border-dashed border-primary/40 backdrop-blur-sm flex flex-col gap-4 items-center justify-center text-center hover:bg-primary/10 transition-colors duration-300 cursor-pointer">
            <svg className="w-12 h-12 text-primary/60" fill="currentColor" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
              <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"></path>
            </svg>
            <h4 className="text-lg font-bold text-white/80">Add New Agent</h4>
            <p className="text-sm text-white/60">A new card will be added for each detected agent.</p>
          </div>
        </div>
      </div>
      
      <footer className="p-6 text-center">
        <p className="text-sm text-white/50">Powered by Dronzer Studios</p>
      </footer>
    </div>
  );
}

export default Overview;
