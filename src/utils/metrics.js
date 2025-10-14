const si = require('systeminformation');
const os = require('os');

class MetricsCollector {
  async getCPUMetrics() {
    try {
      const cpuData = await si.currentLoad();
      const cpuTemp = await si.cpuTemperature();
      
      return {
        usage: parseFloat(cpuData.currentLoad.toFixed(2)),
        cores: cpuData.cpus.map(cpu => ({
          load: parseFloat(cpu.load.toFixed(2))
        })),
        temperature: cpuTemp.main || null
      };
    } catch (error) {
      return { usage: 0, cores: [], temperature: null };
    }
  }

  async getMemoryMetrics() {
    try {
      const mem = await si.mem();
      
      return {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        active: mem.active,
        available: mem.available,
        usagePercent: parseFloat(((mem.used / mem.total) * 100).toFixed(2))
      };
    } catch (error) {
      return { total: 0, used: 0, free: 0, active: 0, available: 0, usagePercent: 0 };
    }
  }

  async getSwapMetrics() {
    try {
      const mem = await si.mem();
      
      return {
        total: mem.swaptotal,
        used: mem.swapused,
        free: mem.swapfree,
        usagePercent: mem.swaptotal > 0 ? parseFloat(((mem.swapused / mem.swaptotal) * 100).toFixed(2)) : 0
      };
    } catch (error) {
      return { total: 0, used: 0, free: 0, usagePercent: 0 };
    }
  }

  async getDiskMetrics() {
    try {
      const disks = await si.fsSize();
      
      return disks.map(disk => ({
        fs: disk.fs,
        type: disk.type,
        size: disk.size,
        used: disk.used,
        available: disk.available,
        usagePercent: parseFloat(disk.use.toFixed(2)),
        mount: disk.mount
      }));
    } catch (error) {
      return [];
    }
  }

  async getNetworkMetrics() {
    try {
      const networkStats = await si.networkStats();
      const interfaces = await si.networkInterfaces();
      
      return networkStats.map((stat, index) => ({
        iface: stat.iface,
        rx_sec: stat.rx_sec,
        tx_sec: stat.tx_sec,
        rx_bytes: stat.rx_bytes,
        tx_bytes: stat.tx_bytes,
        rx_dropped: stat.rx_dropped,
        tx_dropped: stat.tx_dropped,
        rx_errors: stat.rx_errors,
        tx_errors: stat.tx_errors
      }));
    } catch (error) {
      return [];
    }
  }

  async getProcessMetrics(limit = 10) {
    try {
      const processes = await si.processes();
      
      // Sort by CPU usage and get top processes
      const topProcesses = processes.list
        .sort((a, b) => b.cpu - a.cpu)
        .slice(0, limit)
        .map(proc => ({
          pid: proc.pid,
          name: proc.name,
          cpu: parseFloat(proc.cpu.toFixed(2)),
          mem: parseFloat(proc.mem.toFixed(2)),
          memVsz: proc.memVsz,
          memRss: proc.memRss,
          command: proc.command
        }));

      return {
        all: processes.all,
        running: processes.running,
        blocked: processes.blocked,
        sleeping: processes.sleeping,
        list: topProcesses
      };
    } catch (error) {
      return { all: 0, running: 0, blocked: 0, sleeping: 0, list: [] };
    }
  }

  async getSystemInfo() {
    try {
      const [system, cpu, osInfo, time] = await Promise.all([
        si.system(),
        si.cpu(),
        si.osInfo(),
        si.time()
      ]);

      return {
        manufacturer: system.manufacturer,
        model: system.model,
        version: system.version,
        serial: system.serial,
        uuid: system.uuid,
        cpu: {
          manufacturer: cpu.manufacturer,
          brand: cpu.brand,
          speed: cpu.speed,
          cores: cpu.cores,
          physicalCores: cpu.physicalCores,
          processors: cpu.processors
        },
        os: {
          platform: osInfo.platform,
          distro: osInfo.distro,
          release: osInfo.release,
          arch: osInfo.arch,
          hostname: osInfo.hostname,
          kernel: osInfo.kernel
        },
        uptime: time.uptime
      };
    } catch (error) {
      return null;
    }
  }

  async getAllMetrics() {
    try {
      const [cpu, memory, swap, disk, network, processes, systemInfo] = await Promise.all([
        this.getCPUMetrics(),
        this.getMemoryMetrics(),
        this.getSwapMetrics(),
        this.getDiskMetrics(),
        this.getNetworkMetrics(),
        this.getProcessMetrics(),
        this.getSystemInfo()
      ]);

      return {
        timestamp: Date.now(),
        cpu,
        memory,
        swap,
        disk,
        network,
        processes,
        system: systemInfo
      };
    } catch (error) {
      throw error;
    }
  }

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

module.exports = new MetricsCollector();
