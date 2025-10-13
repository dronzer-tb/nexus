import * as si from 'systeminformation';
import axios, { AxiosError } from 'axios';
import { Config } from './config';
import * as os from 'os';

interface Metrics {
  hostname: string;
  cpu_percent: number;
  memory: any;
  disk: any;
  network: any;
  processes: any[];
}

async function collectMetrics(): Promise<Metrics> {
  try {
    const [cpu, mem, disk, net, processes] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.processes()
    ]);

    return {
      hostname: os.hostname(),
      cpu_percent: Math.round(cpu.currentLoad),
      memory: {
        total: mem.total,
        available: mem.available,
        used: mem.used,
        percent: Math.round((mem.used / mem.total) * 100)
      },
      disk: disk.map(d => ({
        fs: d.fs,
        type: d.type,
        size: d.size,
        used: d.used,
        available: d.available,
        use_percent: d.use
      })),
      network: net.map(n => ({
        iface: n.iface,
        rx_bytes: n.rx_bytes,
        tx_bytes: n.tx_bytes
      })),
      processes: processes.list.slice(0, 10).map(p => ({
        pid: p.pid,
        name: p.name,
        cpu: p.cpu,
        mem: p.mem
      }))
    };
  } catch (err) {
    console.error('Failed to collect metrics:', err);
    return {
      hostname: os.hostname(),
      cpu_percent: 0,
      memory: {},
      disk: [],
      network: [],
      processes: []
    };
  }
}

async function postWithRetries(url: string, payload: any, retries: number = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(url, payload, { timeout: 5000 });
      console.log(`Agent posted metrics: ${response.status}`);
      return true;
    } catch (err) {
      const error = err as AxiosError;
      console.error(`Attempt ${attempt}: Failed to send metrics`, error.message);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1500));
      }
    }
  }
  return false;
}

export async function startAgent(config: Config): Promise<void> {
  console.log(`Agent mode | Server: ${config.serverUrl}`);
  console.log(`Heartbeat interval: ${config.heartbeatInterval}s`);

  const agentLoop = async () => {
    const metrics = await collectMetrics();
    const payload = {
      api_key: config.apiKey,
      metrics
    };

    const url = `${config.serverUrl}/api/agent/update`;
    const success = await postWithRetries(url, payload, 3);
    
    if (!success) {
      console.warn('Failed to deliver metrics after retries');
    }
  };

  // Initial send
  await agentLoop();

  // Periodic sends
  setInterval(agentLoop, config.heartbeatInterval * 1000);
}
