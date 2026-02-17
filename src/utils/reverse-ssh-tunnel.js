const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const logger = require('./logger');
const config = require('./config');

/**
 * Reverse SSH Tunnel Manager v1
 * Manages reverse SSH connections from nodes back to Nexus server
 * - Node -> connects back to Nexus via SSH reverse tunnel
 * - Dashboard accesses node console through the tunnel
 */

class ReverseSSHTunnelManager {
  constructor() {
    this.tunnels = new Map(); // nodeId -> { process, localPort, remoteHost, remotePort }
    this.portMapping = new Map(); // localPort -> nodeId
    this.tunnelProcesses = new Map(); // pid -> { nodeId, process }
  }

  /**
   * Get reverse-ssh binary path for current platform
   */
  getReverseSshBinary() {
    const binaryDir = path.join(__dirname, '../../bin');
    const platform = os.platform();
    const arch = os.arch();

    let binaryName;
    if (platform === 'win32') {
      binaryName = arch === 'x64' ? 'reverse-ssh.exe' : 'reverse-ssh-x86.exe';
    } else {
      binaryName = arch === 'x64' ? 'reverse-ssh' : 'reverse-ssh-x86';
    }

    const binaryPath = path.join(binaryDir, binaryName);

    if (!fs.existsSync(binaryPath)) {
      logger.warn(`Reverse-SSH binary not found at ${binaryPath}`);
      return null;
    }

    return binaryPath;
  }

  /**
   * Start a reverse SSH tunnel for a node
   * Node will connect back to Nexus server via reverse SSH
   */
  startReverseTunnel(nodeId, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        // Check if already tunneling
        if (this.tunnels.has(nodeId)) {
          logger.warn(`Reverse tunnel already active for node ${nodeId}`);
          return resolve(this.tunnels.get(nodeId));
        }

        const serverHost = options.serverHost || 'localhost';
        const serverPort = options.serverPort || 22;
        const reversePort = options.reversePort || this.findAvailablePort();
        const username = options.username || 'nexus';
        const password = options.password || config.get('reverse-ssh.password') || 'nexus-tunnel-123';

        logger.info(`Starting reverse SSH tunnel for node ${nodeId} on port ${reversePort}`);

        // Tunnel info stored on this server
        const tunnelInfo = {
          nodeId,
          remoteHost: serverHost,
          remotePort: serverPort,
          localPort: reversePort,
          username,
          password,
          startTime: Date.now(),
        };

        this.tunnels.set(nodeId, tunnelInfo);
        this.portMapping.set(reversePort, nodeId);

        resolve(tunnelInfo);
      } catch (err) {
        logger.error(`Failed to start reverse tunnel for node ${nodeId}:`, err);
        reject(err);
      }
    });
  }

  /**
   * Execute reverse-ssh binary on remote node
   * This should be called during node setup or startup
   */
  executeReverseSSHOnNode(nodeId, nodeConnectionInfo, reversePort) {
    return new Promise((resolve, reject) => {
      try {
        const { host: nodeHost, port: nodePort = 22, username: nodeUsername = 'root' } = nodeConnectionInfo;
        const serverHost = config.get('server.host') || 'localhost';
        const serverPort = config.get('server.ssh-port') || 22;
        const nexusUsername = config.get('reverse-ssh.username') || 'nexus';

        logger.info(`Executing reverse-ssh on node ${nodeId} (${nodeHost}:${nodePort})`);

        // This would execute the reverse-ssh binary on the remote node
        // For now, we just log the command that should be executed
        const reverseSshCmd = [
          `reverse-ssh`,
          `-v`,
          `-b ${reversePort}`,
          `${nexusUsername}@${serverHost}:${serverPort}`,
        ].join(' ');

        logger.info(`[NODE ${nodeId}] Execute command: ${reverseSshCmd}`);
        logger.info(`[NODE ${nodeId}] Or download and run: ./reverse-ssh -v -b ${reversePort} ${nexusUsername}@${serverHost}:${serverPort}`);

        resolve({
          nodeId,
          command: reverseSshCmd,
          reversePort,
        });
      } catch (err) {
        logger.error(`Failed to execute reverse-ssh on node ${nodeId}:`, err);
        reject(err);
      }
    });
  }

  /**
   * Get tunnel info for a node
   */
  getTunnelInfo(nodeId) {
    return this.tunnels.get(nodeId);
  }

  /**
   * Get node ID from tunnel port
   */
  getNodeIdFromPort(port) {
    return this.portMapping.get(port);
  }

  /**
   * Get all active tunnels
   */
  getAllTunnels() {
    return Array.from(this.tunnels.values());
  }

  /**
   * Stop a reverse tunnel
   */
  stopReverseTunnel(nodeId) {
    return new Promise((resolve) => {
      try {
        const tunnelInfo = this.tunnels.get(nodeId);
        if (!tunnelInfo) {
          logger.debug(`No tunnel found for node ${nodeId}`);
          return resolve(false);
        }

        const { localPort } = tunnelInfo;

        if (this.tunnelProcesses.has(localPort)) {
          const { process } = this.tunnelProcesses.get(localPort);
          try {
            process.kill('SIGTERM');
            setTimeout(() => {
              if (!process.killed) process.kill('SIGKILL');
            }, 5000);
          } catch (err) {
            logger.debug(`Error killing tunnel process for node ${nodeId}:`, err.message);
          }
          this.tunnelProcesses.delete(localPort);
        }

        this.tunnels.delete(nodeId);
        this.portMapping.delete(localPort);

        logger.info(`Reverse tunnel stopped for node ${nodeId}`);
        resolve(true);
      } catch (err) {
        logger.error(`Error stopping tunnel for node ${nodeId}:`, err);
        resolve(false);
      }
    });
  }

  /**
   * Find available port
   */
  findAvailablePort(startPort = 9000) {
    // Simple algorithm - in production, use net.createServer() to find free port
    let port = startPort;
    while (this.portMapping.has(port)) {
      port++;
    }
    return port;
  }

  /**
   * Check if tunnel is active
   */
  isTunnelActive(nodeId) {
    const tunnel = this.tunnels.get(nodeId);
    return tunnel && Date.now() - tunnel.startTime < 3600000; // Assume max 1 hour tunnel
  }

  /**
   * Get connection options for SSH client to connect through tunnel
   */
  getReverseTunnelConnectionOptions(nodeId) {
    const tunnelInfo = this.tunnels.get(nodeId);
    if (!tunnelInfo) {
      return null;
    }

    return {
      host: '127.0.0.1',
      port: tunnelInfo.localPort,
      username: 'root', // User on the remote node
      useReverseTunnel: true,
      nodeId,
      reverseTunnelInfo: tunnelInfo,
    };
  }

  cleanup() {
    for (const [nodeId] of this.tunnels) {
      this.stopReverseTunnel(nodeId);
    }
  }
}

const revTunnelManager = new ReverseSSHTunnelManager();
module.exports = revTunnelManager;
