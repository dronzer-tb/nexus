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
import { useTheme } from '../context/ThemeContext';

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
  const { theme } = useTheme();
  const c = theme.colors;

  const chartData = useMemo(() => {
    if (!metrics || metrics.length === 0) return null;

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
          borderColor: c.accent1,
          backgroundColor: c.accent1 + '1a',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Memory Usage (%)',
          data: memoryData,
          borderColor: c.accent2,
          backgroundColor: c.accent2 + '1a',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Swap Usage (%)',
          data: swapData,
          borderColor: c.accent4,
          backgroundColor: c.accent4 + '1a',
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [metrics, c]);

  const options = useMemo(() => ({
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
          color: c.text,
          font: { size: 12, family: 'Space Mono' }
        }
      },
      title: { display: false },
      tooltip: {
        backgroundColor: c.bgCard + 'ee',
        titleColor: c.text,
        bodyColor: c.text,
        borderColor: c.textMuted,
        borderWidth: 1,
        titleFont: { family: 'Space Mono' },
        bodyFont: { family: 'Space Mono' },
      }
    },
    scales: {
      x: {
        grid: { color: c.textMuted + '30' },
        ticks: {
          color: c.textSecondary,
          maxTicksLimit: 10,
          font: { family: 'Space Mono', size: 10 }
        }
      },
      y: {
        min: 0,
        max: 100,
        grid: { color: c.textMuted + '30' },
        ticks: {
          color: c.textSecondary,
          font: { family: 'Space Mono', size: 10 },
          callback: (value) => value + '%'
        }
      },
    },
  }), [c]);

  if (!chartData) {
    return (
      <div className="card">
        <h3 className="card-header">Resource Usage</h3>
        <div className="h-64 flex items-center justify-center text-tx/40">
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
