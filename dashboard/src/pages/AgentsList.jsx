import { useState, useEffect } from 'react';
import axios from 'axios';

function AgentsList({ socket }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();

    if (socket) {
      socket.on('agents:update', (updatedAgents) => {
        setAgents(updatedAgents);
      });

      socket.on('agent:metrics', ({ agentId, metrics }) => {
        setAgents(prevAgents =>
          prevAgents.map(agent =>
            agent.id === agentId ? { ...agent, metrics } : agent
          )
        );
      });
    }

    return () => {
      if (socket) {
        socket.off('agents:update');
        socket.off('agent:metrics');
      }
    };
  }, [socket]);

  const fetchAgents = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/nodes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Extract nodes array from response
      const nodes = response.data.nodes || [];
      setAgents(nodes);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      // Set empty array on error to prevent .map() error
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <header className="p-6">
        <h2 className="text-3xl font-bold text-white">Agents List</h2>
        <p className="text-white/60">Monitor and manage all connected agents</p>
      </header>
      
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="bg-background-light/10 rounded-xl shadow-lg" style={{ boxShadow: '0 0 25px rgba(13, 139, 242, 0.1)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-400">
              <thead className="text-xs text-gray-400 uppercase bg-primary/10">
                <tr>
                  <th scope="col" className="px-6 py-3">Hostname</th>
                  <th scope="col" className="px-6 py-3">IP Address</th>
                  <th scope="col" className="px-6 py-3">CPU %</th>
                  <th scope="col" className="px-6 py-3">RAM %</th>
                  <th scope="col" className="px-6 py-3">Network</th>
                  <th scope="col" className="px-6 py-3 text-center">Status</th>
                  <th scope="col" className="px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                      Loading agents...
                    </td>
                  </tr>
                ) : agents.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                      No agents connected
                    </td>
                  </tr>
                ) : (
                  agents.map((agent) => (
                    <tr key={agent.id} className="hover:bg-primary/5 transition-all duration-200">
                      <td className="px-6 py-4 font-medium text-white whitespace-nowrap">
                        {agent.hostname || agent.id}
                      </td>
                      <td className="px-6 py-4">{agent.ip || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded-full bg-primary/20">
                            <div
                              className="h-2 rounded-full bg-primary"
                              style={{ 
                                width: `${agent.metrics?.cpu || 0}%`,
                                boxShadow: '0 0 5px rgba(13, 139, 242, 0.7)'
                              }}
                            ></div>
                          </div>
                          <span>{agent.metrics?.cpu?.toFixed(0) || 0}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded-full bg-primary/20">
                            <div
                              className="h-2 rounded-full bg-primary"
                              style={{ 
                                width: `${agent.metrics?.memory || 0}%`,
                                boxShadow: '0 0 5px rgba(13, 139, 242, 0.7)'
                              }}
                            ></div>
                          </div>
                          <span>{agent.metrics?.memory?.toFixed(0) || 0}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {agent.metrics?.network ? `${(agent.metrics.network / 1024 / 1024).toFixed(0)} Mbps` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {agent.status === 'online' ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                            <span className="w-2 h-2 mr-2 bg-green-400 rounded-full animate-pulse"></span>
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                            <span className="w-2 h-2 mr-2 bg-red-400 rounded-full"></span>
                            Offline
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <a
                          href={`/agents/${agent.id}`}
                          className="text-primary hover:text-primary/80 font-medium transition-colors"
                        >
                          View Details
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <footer className="text-center p-4 text-xs text-gray-500">
        Powered by Dronzer Studios
      </footer>
    </div>
  );
}

export default AgentsList;
