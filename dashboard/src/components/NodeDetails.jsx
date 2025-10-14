import React, { useState, useEffect } from 'react';
import MetricsChart from './MetricsChart';
import SystemInfo from './SystemInfo';
import ProcessList from './ProcessList';

function NodeDetails({ node, socket }) {
  const [metrics, setMetrics] = useState([]);
  const [latestMetrics, setLatestMetrics] = useState(null);

  useEffect(() => {
    if (!socket || !node) return;

    // Subscribe to this node's metrics
    socket.emit('subscribe:node', node.id);

    // Request latest metrics
    socket.emit('request:metrics', { nodeId: node.id, limit: 50 });

    // Listen for metrics updates
    const handleMetricsUpdate = ({ nodeId, metrics: newMetrics }) => {
      if (nodeId === node.id) {
        setMetrics(prevMetrics => {
          const combined = [...newMetrics, ...prevMetrics];
          // Keep only last 100 data points
          return combined.slice(0, 100);
        });
        
        if (newMetrics.length > 0) {
          setLatestMetrics(newMetrics[0]);
        }
      }
    };

    const handleNewMetrics = ({ nodeId, metrics: newMetric }) => {
      if (nodeId === node.id) {
        setMetrics(prevMetrics => [newMetric, ...prevMetrics].slice(0, 100));
        setLatestMetrics(newMetric);
      }
    };

    socket.on('metrics:update', handleMetricsUpdate);
    socket.on('metrics:new', handleNewMetrics);

    // Cleanup
    return () => {
      socket.emit('unsubscribe:node', node.id);
      socket.off('metrics:update', handleMetricsUpdate);
      socket.off('metrics:new', handleNewMetrics);
    };
  }, [socket, node]);

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

  const currentMetrics = latestMetrics?.data || metrics[0]?.data;

  return (
    <div className="space-y-6">
      {/* Node Header */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">{node.hostname}</h2>
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <span className="flex items-center">
                <span className={`status-dot ${node.status === 'online' ? 'status-online' : 'status-offline'}`} />
                {node.status}
              </span>
              {node.system_info?.uptime && (
                <>
                  <span>•</span>
                  <span>Uptime: {formatUptime(node.system_info.uptime)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      {currentMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-xs text-gray-400 mb-1">CPU Usage</p>
            <p className="text-2xl font-bold text-blue-400">
              {currentMetrics.cpu?.usage?.toFixed(1) || 0}%
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-400 mb-1">Memory Usage</p>
            <p className="text-2xl font-bold text-green-400">
              {currentMetrics.memory?.usagePercent?.toFixed(1) || 0}%
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-400 mb-1">Swap Usage</p>
            <p className="text-2xl font-bold text-yellow-400">
              {currentMetrics.swap?.usagePercent?.toFixed(1) || 0}%
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-400 mb-1">Processes</p>
            <p className="text-2xl font-bold text-purple-400">
              {currentMetrics.processes?.all || 0}
            </p>
          </div>
        </div>
      )}

      {/* Charts */}
      <MetricsChart metrics={metrics} />

      {/* System Info and Processes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SystemInfo node={node} currentMetrics={currentMetrics} formatBytes={formatBytes} />
        <ProcessList currentMetrics={currentMetrics} />
      </div>
    </div>
  );
}

export default NodeDetails;
