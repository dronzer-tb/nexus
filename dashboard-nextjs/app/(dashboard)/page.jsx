'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import axios from 'axios'
import MetricCard from '@/components/MetricCard'
import MetricsChart from '@/components/MetricsChart'
import NodesList from '@/components/NodesList'
import Stats from '@/components/Stats'
import { getSocket } from '@/lib/socket'

export default function OverviewPage() {
  const { data: session } = useSession()
  const [nodes, setNodes] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
    const socket = getSocket()
    
    if (socket) {
      socket.on('metrics:update', handleMetricsUpdate)
      socket.on('nodes:update', (updatedNodes) => setNodes(updatedNodes))
    }

    const interval = setInterval(fetchData, 30000) // Refresh every 30s

    return () => {
      clearInterval(interval)
      if (socket) {
        socket.off('metrics:update', handleMetricsUpdate)
        socket.off('nodes:update')
      }
    }
  }, [])

  const fetchData = async () => {
    try {
      const [nodesRes, metricsRes] = await Promise.all([
        axios.get('/api/proxy/nodes'),
        axios.get('/api/proxy/metrics/latest')
      ])
      setNodes(nodesRes.data.nodes || [])
      setMetrics(metricsRes.data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching data:', error)
      setLoading(false)
    }
  }

  const handleMetricsUpdate = (data) => {
    setMetrics(data)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neon-pink font-mono animate-pulse">Loading metrics...</div>
      </div>
    )
  }

  const onlineNodes = nodes.filter(n => n.status === 'online').length
  const totalNodes = nodes.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-neon-pink uppercase font-mono">
          System Overview
        </h1>
        <div className="text-sm text-tx/60 font-mono">
          {onlineNodes}/{totalNodes} Nodes Online
        </div>
      </div>

      {/* Stats */}
      <Stats metrics={metrics} nodes={nodes} />

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            title="CPU Usage"
            value={`${metrics.cpu?.usage?.toFixed(1) || 0}%`}
            icon="cpu"
            color="neon-pink"
          />
          <MetricCard
            title="Memory Usage"
            value={`${metrics.memory?.usedPercentage?.toFixed(1) || 0}%`}
            icon="memory"
            color="neon-cyan"
          />
          <MetricCard
            title="Disk Usage"
            value={`${metrics.disk?.[0]?.usedPercentage?.toFixed(1) || 0}%`}
            icon="disk"
            color="neon-purple"
          />
        </div>
      )}

      {/* Charts */}
      {metrics && <MetricsChart metrics={metrics} />}

      {/* Nodes List */}
      <NodesList nodes={nodes} />
    </div>
  )
}
