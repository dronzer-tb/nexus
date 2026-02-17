/**
 * Tailscale Integration — Native Tailscale support for Nexus
 * Detects existing Tailscale installation, manages connections via API
 * Dronzer Studios — v2.0
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const config = require('./config');
const axios = require('axios');

class TailscaleManager {
  constructor() {
    this.installed = false;
    this.running = false;
    this.ip = null;
    this.hostname = null;
    this.apiKey = null;
    this.tailnet = null;
    this.socketPath = '/var/run/tailscale/tailscaled.sock';
  }

  /**
   * Check if Tailscale is installed on the system
   */
  isInstalled() {
    try {
      execSync('which tailscale', { encoding: 'utf8', stdio: 'pipe' });
      this.installed = true;
      return true;
    } catch {
      this.installed = false;
      return false;
    }
  }

  /**
   * Get Tailscale status
   */
  getStatus() {
    if (!this.isInstalled()) {
      return { installed: false, running: false, ip: null, hostname: null, peers: [] };
    }

    try {
      const statusJson = execSync('tailscale status --json', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });

      const status = JSON.parse(statusJson);
      const selfKey = status.Self?.PublicKey || Object.keys(status.Peer || {})[0];
      const self = status.Self || {};

      this.running = self.Online !== false;
      this.ip = self.TailscaleIPs?.[0] || null;
      this.hostname = self.HostName || null;

      // Build peer list
      const peers = [];
      if (status.Peer) {
        for (const [key, peer] of Object.entries(status.Peer)) {
          peers.push({
            id: key,
            hostname: peer.HostName,
            ip: peer.TailscaleIPs?.[0] || null,
            online: peer.Online,
            os: peer.OS,
            lastSeen: peer.LastSeen,
          });
        }
      }

      return {
        installed: true,
        running: this.running,
        ip: this.ip,
        hostname: this.hostname,
        version: status.Version || null,
        tailnetName: status.MagicDNSSuffix || null,
        authUrl: status.AuthURL || null,
        peers,
      };
    } catch (error) {
      // Tailscale installed but daemon not running
      return {
        installed: true,
        running: false,
        ip: null,
        hostname: null,
        error: error.message,
        peers: [],
      };
    }
  }

  /**
   * Get Tailscale IP address
   */
  getIP() {
    try {
      const ip = execSync('tailscale ip -4', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      }).trim();
      this.ip = ip;
      return ip;
    } catch {
      return null;
    }
  }

  /**
   * Start tailscale up (brings up the connection)
   */
  async start(options = {}) {
    if (!this.isInstalled()) {
      throw new Error('Tailscale is not installed');
    }

    const args = ['up'];

    if (options.authKey) {
      args.push('--authkey', options.authKey);
    }
    if (options.hostname) {
      args.push('--hostname', options.hostname);
    }
    if (options.acceptRoutes) {
      args.push('--accept-routes');
    }
    if (options.advertiseExitNode) {
      args.push('--advertise-exit-node');
    }

    try {
      const result = spawnSync('tailscale', args, {
        encoding: 'utf8',
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (result.status !== 0) {
        const errMsg = result.stderr || result.stdout || 'Unknown error';
        throw new Error(`Tailscale up failed: ${errMsg}`);
      }

      logger.info('Tailscale connection started successfully');
      return { success: true, output: result.stdout };
    } catch (error) {
      logger.error('Failed to start Tailscale:', error.message);
      throw error;
    }
  }

  /**
   * Stop tailscale connection
   */
  stop() {
    try {
      execSync('tailscale down', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
      });
      this.running = false;
      logger.info('Tailscale connection stopped');
      return true;
    } catch (error) {
      logger.error('Failed to stop Tailscale:', error.message);
      return false;
    }
  }

  /**
   * Use Tailscale API to list devices (requires API key)
   */
  async listDevices(apiKey, tailnet) {
    const key = apiKey || config.get('tailscale.apiKey');
    const net = tailnet || config.get('tailscale.tailnet');

    if (!key || !net) {
      throw new Error('Tailscale API key and tailnet name required');
    }

    try {
      const response = await axios.get(
        `https://api.tailscale.com/api/v2/tailnet/${net}/devices`,
        {
          headers: { Authorization: `Bearer ${key}` },
          timeout: 10000,
        }
      );

      return response.data.devices || [];
    } catch (error) {
      logger.error('Tailscale API error:', error.message);
      throw new Error(`Tailscale API error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get device details via Tailscale API
   */
  async getDevice(deviceId, apiKey) {
    const key = apiKey || config.get('tailscale.apiKey');

    if (!key) {
      throw new Error('Tailscale API key required');
    }

    try {
      const response = await axios.get(
        `https://api.tailscale.com/api/v2/device/${deviceId}`,
        {
          headers: { Authorization: `Bearer ${key}` },
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Tailscale API get device error:', error.message);
      throw error;
    }
  }

  /**
   * Generate a pre-auth key via Tailscale API
   */
  async generateAuthKey(apiKey, tailnet, options = {}) {
    const key = apiKey || config.get('tailscale.apiKey');
    const net = tailnet || config.get('tailscale.tailnet');

    if (!key || !net) {
      throw new Error('Tailscale API key and tailnet name required');
    }

    try {
      const response = await axios.post(
        `https://api.tailscale.com/api/v2/tailnet/${net}/keys`,
        {
          capabilities: {
            devices: {
              create: {
                reusable: options.reusable || false,
                ephemeral: options.ephemeral || false,
                preauthorized: true,
                tags: options.tags || [],
              },
            },
          },
          expirySeconds: options.expirySeconds || 86400,
          description: options.description || 'Nexus auto-generated key',
        },
        {
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Tailscale generate auth key error:', error.message);
      throw new Error(`Failed to generate auth key: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Save Tailscale configuration
   */
  saveConfig(settings) {
    const configPath = path.join(__dirname, '../../config/config.json');
    let cfg;
    try {
      cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      cfg = {};
    }

    cfg.tailscale = {
      enabled: settings.enabled || false,
      apiKey: settings.apiKey || '',
      tailnet: settings.tailnet || '',
      hostname: settings.hostname || '',
      useAsProxy: settings.useAsProxy || false,
    };

    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
    logger.info('Tailscale configuration saved');
  }

  /**
   * Get Nexus URL using Tailscale IP
   */
  getNexusUrl(port) {
    const ip = this.getIP();
    if (!ip) return null;
    return `http://${ip}:${port || config.get('server.port') || 8080}`;
  }

  /**
   * Get install instructions for different platforms
   */
  static getInstallInstructions() {
    return {
      linux: {
        debian: 'curl -fsSL https://tailscale.com/install.sh | sh',
        arch: 'sudo pacman -S tailscale && sudo systemctl enable --now tailscaled',
        fedora: 'sudo dnf install tailscale && sudo systemctl enable --now tailscaled',
      },
      macos: 'brew install tailscale',
      docker: 'Use --cap-add=NET_ADMIN --device=/dev/net/tun with tailscale image',
    };
  }
}

module.exports = new TailscaleManager();
