import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { format } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function MetricsChart({ metrics }) {
  const chartData = useMemo(() => {
    if (!metrics || metrics.length === 0) {
      return null;
    }

    // Reverse to show oldest to newest
    const sortedMetrics = [...metrics].reverse();

    const labels = sortedMetrics.map(m => {
      const data = m.data || m;
      return format(new Date(data.timestamp), 'HH:mm:ss');
    });

    const cpuData = sortedMetrics.map(m => {
      const data = m.data || m;
      return data.cpu?.usage || 0;
    });

    const memoryData = sortedMetrics.map(m => {
      const data = m.data || m;
      return data.memory?.usagePercent || 0;
    });

    const swapData = sortedMetrics.map(m => {
      const data = m.data || m;
      return data.swap?.usagePercent || 0;
    });

    return {
      labels,
      datasets: [
        {
          label: 'CPU Usage (%)',
          data: cpuData,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Memory Usage (%)',
          data: memoryData,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Swap Usage (%)',
          data: swapData,
          borderColor: 'rgb(234, 179, 8)',
          backgroundColor: 'rgba(234, 179, 8, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [metrics]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#e5e7eb',
          font: {
            size: 12
          }
        }
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#e5e7eb',
        bodyColor: '#e5e7eb',
        borderColor: '#334155',
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(51, 65, 85, 0.5)',
        },
        ticks: {
          color: '#9ca3af',
          maxTicksLimit: 10,
        }
      },
      y: {
        min: 0,
        max: 100,
        grid: {
          color: 'rgba(51, 65, 85, 0.5)',
        },
        ticks: {
          color: '#9ca3af',
          callback: function(value) {
            return value + '%';
          }
        }
      },
    },
  };

  if (!chartData) {
    return (
      <div className="card">
        <h3 className="card-header">Resource Usage</h3>
        <div className="h-64 flex items-center justify-center text-gray-500">
          <p>Waiting for metrics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-header">Resource Usage</h3>
      <div style={{ height: '300px' }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}

export default MetricsChart;
