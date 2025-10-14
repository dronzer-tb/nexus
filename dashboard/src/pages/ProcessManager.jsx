import { useState, useEffect } from 'react';
import axios from 'axios';
import ProcessTable from '../components/ProcessTable';

function ProcessManager({ socket }) {
  const [processes, setProcesses] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
    fetchProcesses();

    if (socket) {
      socket.on('processes:update', (data) => {
        if (selectedAgent === 'all' || data.agentId === selectedAgent) {
          setProcesses(data.processes);
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('processes:update');
      }
    };
  }, [selectedAgent, socket]);

  const fetchAgents = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/agents', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAgents(response.data);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  };

  const fetchProcesses = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = selectedAgent === 'all' 
        ? '/api/processes' 
        : `/api/agents/${selectedAgent}/processes`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProcesses(response.data);
    } catch (error) {
      console.error('Failed to fetch processes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKillProcess = async (pid, agentId) => {
    if (!confirm('Are you sure you want to kill this process?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/agents/${agentId}/processes/${pid}/kill`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchProcesses();
    } catch (error) {
      console.error('Failed to kill process:', error);
      alert('Failed to kill process');
    }
  };

  return (
    <main className="flex-1 p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white">Process Manager</h2>
          <p className="text-white/60">Monitor and manage processes across all agents</p>
        </div>
        
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="bg-background-dark/70 border border-primary/30 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Agents</option>
          {agents.map(agent => (
            <option key={agent.id} value={agent.id}>
              {agent.hostname || agent.id}
            </option>
          ))}
        </select>
      </header>

      <div className="bg-background-light/10 rounded-xl border border-white/10">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading processes...</div>
        ) : (
          <ProcessTable 
            processes={processes} 
            onKillProcess={handleKillProcess}
            showAgent={selectedAgent === 'all'}
          />
        )}
      </div>
    </main>
  );
}

export default ProcessManager;
