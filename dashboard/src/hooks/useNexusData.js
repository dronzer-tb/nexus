import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export function useNexusData(socket) {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNodes = useCallback(async () => {
    try {
      const response = await axios.get('/api/nodes');
      const data = response.data.nodes || [];
      setNodes(data);
    } catch (err) {
      console.error('Failed to fetch nodes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNodes();
    if (socket) {
      socket.on('nodes:update', (updated) => setNodes(updated));
      return () => socket.off('nodes:update');
    }
  }, [socket, fetchNodes]);

  const stats = {
    total: nodes.length,
    online: nodes.filter(n => n.status === 'online').length,
    offline: nodes.filter(n => n.status === 'offline').length,
    avgCpu: nodes.length ? (nodes.reduce((s, n) => s + (n.metrics?.cpu || 0), 0) / nodes.length) : 0,
    avgMem: nodes.length ? (nodes.reduce((s, n) => s + (n.metrics?.memory || 0), 0) / nodes.length) : 0,
    avgDisk: nodes.length ? (nodes.reduce((s, n) => s + (n.metrics?.disk || 0), 0) / nodes.length) : 0,
  };

  return { nodes, stats, loading, refetch: fetchNodes };
}

export function useNodeMetrics(nodeId) {
  const [metrics, setMetrics] = useState([]);
  const [latest, setLatest] = useState(null);
  const [node, setNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!nodeId) return;
    const fetchAll = async () => {
      try {
        const [nodeRes, metricsRes] = await Promise.all([
          axios.get(`/api/nodes/${nodeId}`),
          axios.get(`/api/metrics/${nodeId}/latest?limit=50`),
        ]);
        if (nodeRes.data.success) setNode(nodeRes.data.node);
        else setError('Node not found');
        if (metricsRes.data.success && metricsRes.data.metrics) {
          setMetrics(metricsRes.data.metrics);
          if (metricsRes.data.metrics.length > 0) setLatest(metricsRes.data.metrics[0]);
        }
      } catch (err) {
        setError('Failed to load node');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`/api/metrics/${nodeId}/latest?limit=50`);
        if (res.data.success && res.data.metrics) {
          setMetrics(res.data.metrics);
          if (res.data.metrics.length > 0) setLatest(res.data.metrics[0]);
        }
      } catch (_) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [nodeId]);

  return { node, metrics, latest, loading, error };
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatUptime(seconds) {
  if (!seconds) return '--';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
