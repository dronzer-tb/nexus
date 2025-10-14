import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import AgentCard from '../components/AgentCard';

function Overview({ socket }) {
  const [agents, setAgents] = useState([]);
  const [stats, setStats] = useState({ online: 0, offline: 0, total: 0 });
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    // Only fetch agents if authenticated
    if (!isAuthenticated) {
      console.log('Overview: Not authenticated, skipping fetch');
      return;
    }
    
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
  }, [socket, isAuthenticated]);

  const fetchAgents = async () => {
    try {
      const response = await axios.get('/api/agents');
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

  const handleAddAgent = async () => {
    if (!agentName || !apiKey) {
      setError('Agent name and API key are required');
      return;
    }

    setConnecting(true);
    setError('');

    try {
      const response = await axios.post('/api/agents/connect', 
        { name: agentName, apiKey }
      );

      if (response.data.success) {
        setShowAddAgent(false);
        setAgentName('');
        setApiKey('');
        fetchAgents();
      } else {
        setError(response.data.message || 'Failed to connect agent');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to connect agent');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <header className="p-8">
        <h2 className="text-4xl font-bold text-white">
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
          <div 
            onClick={() => setShowAddAgent(true)}
            className="bg-background-dark/70 p-6 rounded-xl border border-dashed border-primary/40 backdrop-blur-sm flex flex-col gap-4 items-center justify-center text-center hover:bg-primary/10 transition-colors duration-300 cursor-pointer"
          >
            <svg className="w-12 h-12 text-primary/60" fill="currentColor" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
              <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"></path>
            </svg>
            <h4 className="text-lg font-bold text-white/80">Add New Agent</h4>
            <p className="text-sm text-white/60">Click to connect a new agent</p>
          </div>
        </div>
      </div>

      {/* Add Agent Modal */}
      {showAddAgent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background-light border border-primary/20 rounded-xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Add New Agent</h3>
              <button
                onClick={() => {
                  setShowAddAgent(false);
                  setAgentName('');
                  setApiKey('');
                  setError('');
                }}
                className="text-white/60 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
                  <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path>
                </svg>
              </button>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g., Production Server 1"
                  className="w-full px-4 py-3 bg-background-dark border border-primary/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={connecting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Agent API Key
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter the agent's API key"
                  className="w-full px-4 py-3 bg-background-dark border border-primary/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                  disabled={connecting}
                />
                <p className="text-xs text-white/50 mt-2">
                  You can find this key in the agent's console output or in data/node-credentials.json
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleAddAgent}
                  disabled={connecting || !agentName || !apiKey}
                  className="flex-1 py-3 px-4 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {connecting ? 'Connecting...' : 'Add Agent'}
                </button>
                <button
                  onClick={() => {
                    setShowAddAgent(false);
                    setAgentName('');
                    setApiKey('');
                    setError('');
                  }}
                  disabled={connecting}
                  className="px-6 py-3 bg-background-dark text-white/80 font-medium rounded-lg hover:bg-background-dark/80 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <footer className="p-6 text-center">
        <p className="text-sm text-white/50">Powered by Dronzer Studios</p>
      </footer>
    </div>
  );
}

export default Overview;
