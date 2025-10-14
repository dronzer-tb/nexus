import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import MetricCard from '../components/MetricCard';
import ProcessTable from '../components/ProcessTable';

function AgentDetails({ socket }) {
  const { agentId } = useParams();
  const [agent, setAgent] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgentDetails();
    fetchProcesses();

    if (socket) {
      socket.on('agent:metrics', ({ agentId: id, metrics }) => {
        if (id === agentId) {
          setAgent(prev => ({ ...prev, metrics }));
        }
      });

      socket.on('agent:processes', ({ agentId: id, processes: procs }) => {
        if (id === agentId) {
          setProcesses(procs);
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('agent:metrics');
        socket.off('agent:processes');
      }
    };
  }, [agentId, socket]);

  const fetchAgentDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/nodes/${agentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAgent(response.data);
    } catch (error) {
      console.error('Failed to fetch agent details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProcesses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/nodes/${agentId}/processes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProcesses(response.data);
    } catch (error) {
      console.error('Failed to fetch processes:', error);
    }
  };

  const handleKillProcess = async (pid) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/nodes/${agentId}/processes/${pid}/kill`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchProcesses();
    } catch (error) {
      console.error('Failed to kill process:', error);
      alert('Failed to kill process');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-xl">Agent not found</div>
      </div>
    );
  }

  return (
    <main className="flex-1 p-8">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-white">Agent Details</h2>
        <p className="text-white/60">Monitor and manage individual agent performance</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="CPU Usage"
          value={`${agent.metrics?.cpu?.toFixed(0) || 0}%`}
          change={agent.metrics?.cpuChange || 0}
        />
        <MetricCard
          title="Memory Usage"
          value={`${agent.metrics?.memory?.toFixed(0) || 0}%`}
          change={agent.metrics?.memoryChange || 0}
        />
        <MetricCard
          title="Disk I/O"
          value={agent.metrics?.diskIO ? `${(agent.metrics.diskIO / 1024 / 1024).toFixed(0)} MB/s` : 'N/A'}
          change={agent.metrics?.diskIOChange || 0}
        />
        <MetricCard
          title="Network Throughput"
          value={agent.metrics?.network ? `${(agent.metrics.network / 1024 / 1024).toFixed(0)} Mbps` : 'N/A'}
          change={agent.metrics?.networkChange || 0}
        />
      </div>

      <div className="bg-background-light/10 rounded-xl border border-white/10">
        <h3 className="text-xl font-bold text-white p-6">Running Processes</h3>
        <ProcessTable processes={processes} onKillProcess={handleKillProcess} />
      </div>

      <div className="mt-8 bg-background-light/10 rounded-xl border border-white/10 p-6">
        <h3 className="text-xl font-bold text-white mb-4">Command Console</h3>
        <div className="flex gap-4">
          <input
            className="flex-grow bg-background-dark/70 border-white/20 rounded-lg p-3 text-white/90 focus:ring-2 focus:ring-primary focus:outline-none transition-shadow duration-200 border"
            placeholder="> Enter command..."
            type="text"
          />
          <button className="bg-primary text-white font-bold py-3 px-6 rounded-lg hover:bg-primary/90 transition-colors duration-200 glow">
            Execute
          </button>
        </div>
      </div>
    </main>
  );
}

export default AgentDetails;
