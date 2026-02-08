import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import MetricsChart from '../components/MetricsChart';
import SystemInfo from '../components/SystemInfo';
import ProcessList from '../components/ProcessList';

function AgentDetails({ socket }) {
  const { agentId } = useParams();
  const [node, setNode] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [latestMetrics, setLatestMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchNodeData();
    fetchMetrics();

    // Poll for fresh metrics every 5 seconds
    const metricsInterval = setInterval(() => {
      fetchMetrics();
    }, 5000);

    // Listen for real-time node updates via WebSocket
    if (socket) {
      socket.on('nodes:update', (nodes) => {
        const currentNode = nodes.find(n => n.id === agentId);
        if (currentNode) {
          setNode(prev => prev ? { ...prev, status: currentNode.status, last_seen: currentNode.last_seen } : prev);
        }
      });
    }

    return () => {
      clearInterval(metricsInterval);
      if (socket) {
        socket.off('nodes:update');
      }
    };
  }, [agentId, socket]);

  const fetchNodeData = async () => {
    try {
      const response = await axios.get(`/api/nodes/${agentId}`);
      if (response.data.success) {
        setNode(response.data.node);
      } else {
        setError('Node not found');
      }
    } catch (err) {
      console.error('Failed to fetch node:', err);
      setError('Failed to load node details');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await axios.get(`/api/metrics/${agentId}/latest?limit=50`);
      if (response.data.success && response.data.metrics) {
        setMetrics(response.data.metrics);
        if (response.data.metrics.length > 0) {
          setLatestMetrics(response.data.metrics[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds) => {
    if (!seconds) return 'Unknown';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-xl">Loading node details...</div>
      </div>
    );
  }

  if (error || !node) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="text-white text-xl">{error || 'Node not found'}</div>
        <Link to="/nodes" className="text-primary hover:text-primary/80 transition-colors">
          ← Back to Nodes List
        </Link>
      </div>
    );
  }

  const currentMetrics = latestMetrics?.data || null;

  return (
    <main className="flex-1 p-8 overflow-y-auto">
      {/* Back navigation */}
      <Link to="/nodes" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Nodes
      </Link>

      {/* Node Header */}
      <div className="bg-background-dark/70 rounded-xl border border-primary/20 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">{node.hostname}</h2>
            <div className="flex items-center gap-4 text-sm text-white/60">
              <span className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${node.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                {node.status === 'online' ? 'Online' : 'Offline'}
              </span>
              <span className="text-white/40">|</span>
              <span>ID: {node.id.substring(0, 20)}...</span>
              {node.system_info?.uptime && (
                <>
                  <span className="text-white/40">|</span>
                  <span>Uptime: {formatUptime(node.system_info.uptime)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      {currentMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-background-dark/70 rounded-xl border border-primary/20 p-5">
            <p className="text-xs text-white/60 mb-1">CPU Usage</p>
            <p className="text-3xl font-bold text-blue-400">
              {currentMetrics.cpu?.usage?.toFixed(1) || 0}%
            </p>
          </div>
          <div className="bg-background-dark/70 rounded-xl border border-primary/20 p-5">
            <p className="text-xs text-white/60 mb-1">Memory Usage</p>
            <p className="text-3xl font-bold text-green-400">
              {currentMetrics.memory?.usagePercent?.toFixed(1) || 0}%
            </p>
            <p className="text-xs text-white/40 mt-1">
              {formatBytes(currentMetrics.memory?.used)} / {formatBytes(currentMetrics.memory?.total)}
            </p>
          </div>
          <div className="bg-background-dark/70 rounded-xl border border-primary/20 p-5">
            <p className="text-xs text-white/60 mb-1">Swap Usage</p>
            <p className="text-3xl font-bold text-yellow-400">
              {currentMetrics.swap?.usagePercent?.toFixed(1) || 0}%
            </p>
          </div>
          <div className="bg-background-dark/70 rounded-xl border border-primary/20 p-5">
            <p className="text-xs text-white/60 mb-1">Processes</p>
            <p className="text-3xl font-bold text-purple-400">
              {currentMetrics.processes?.all || 0}
            </p>
            <p className="text-xs text-white/40 mt-1">
              {currentMetrics.processes?.running || 0} running
            </p>
          </div>
        </div>
      )}

      {!currentMetrics && (
        <div className="bg-background-dark/70 rounded-xl border border-primary/20 p-8 mb-6 text-center">
          <p className="text-white/60">Waiting for metrics data...</p>
          <p className="text-white/40 text-sm mt-2">Metrics will appear once the node starts reporting.</p>
        </div>
      )}

      {/* Metrics Chart */}
      <div className="mb-6">
        <MetricsChart metrics={metrics} />
      </div>

      {/* System Info + Process List side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SystemInfo node={node} currentMetrics={currentMetrics} formatBytes={formatBytes} />
        <ProcessList currentMetrics={currentMetrics} />
      </div>

      {/* Disk Usage */}
      {currentMetrics?.disk && currentMetrics.disk.length > 0 && (
        <div className="bg-dark-lighter rounded-lg shadow-lg p-6 border border-dark-lightest">
          <h3 className="text-lg font-semibold mb-4 text-gray-100">Disk Usage</h3>
          <div className="space-y-4">
            {currentMetrics.disk.map((disk, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-24 text-sm text-white/60 truncate" title={disk.mount}>
                  {disk.mount}
                </div>
                <div className="flex-1">
                  <div className="w-full bg-dark-lightest rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        disk.usagePercent > 90 ? 'bg-red-500' :
                        disk.usagePercent > 75 ? 'bg-yellow-500' :
                        'bg-primary'
                      }`}
                      style={{ width: `${disk.usagePercent}%` }}
                    />
                  </div>
                </div>
                <div className="text-sm text-white/80 w-16 text-right">
                  {disk.usagePercent?.toFixed(1)}%
                </div>
                <div className="text-xs text-white/40 w-40 text-right">
                  {formatBytes(disk.used)} / {formatBytes(disk.size)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Network Stats */}
      {currentMetrics?.network && currentMetrics.network.length > 0 && (
        <div className="bg-dark-lighter rounded-lg shadow-lg p-6 border border-dark-lightest mt-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-100">Network Interfaces</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-lightest">
                  <th className="text-left py-2 px-3 text-gray-400">Interface</th>
                  <th className="text-right py-2 px-3 text-gray-400">RX/s</th>
                  <th className="text-right py-2 px-3 text-gray-400">TX/s</th>
                  <th className="text-right py-2 px-3 text-gray-400">Total RX</th>
                  <th className="text-right py-2 px-3 text-gray-400">Total TX</th>
                </tr>
              </thead>
              <tbody>
                {currentMetrics.network.map((iface, index) => (
                  <tr key={index} className="border-b border-dark-lightest last:border-0">
                    <td className="py-2 px-3 text-white">{iface.iface}</td>
                    <td className="py-2 px-3 text-right text-green-400">{formatBytes(iface.rx_sec || 0)}/s</td>
                    <td className="py-2 px-3 text-right text-blue-400">{formatBytes(iface.tx_sec || 0)}/s</td>
                    <td className="py-2 px-3 text-right text-white/60">{formatBytes(iface.rx_bytes || 0)}</td>
                    <td className="py-2 px-3 text-right text-white/60">{formatBytes(iface.tx_bytes || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}

export default AgentDetails;
