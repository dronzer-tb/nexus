const express = require('express');
const router = express.Router();
const os = require('os');
const logger = require('../../utils/logger');
const config = require('../../utils/config');
const database = require('../../utils/database');
const authenticate = require('../../middleware/auth');
const sshTerminal = require('../ssh-terminal');
const revTunnelManager = require('../../utils/reverse-ssh-tunnel');

// All routes require authentication
router.use(authenticate);

// ─── Global Console Status ─────────────────
router.get('/status', (req, res) => {
  try {
    const consoleConfig = sshTerminal.getConsoleConfig();
    res.json({
      success: true,
      enabled: consoleConfig.enabled,
      allowSudo: consoleConfig.allowSudo,
      blockedCommands: consoleConfig.blockedCommands.length,
      blockedPaths: consoleConfig.blockedPaths.length,
      activeSessions: sshTerminal.getSessionCount(),
    });
  } catch (error) {
    logger.error('Error fetching console status:', error);
    res.status(500).json({ success: false, message: 'Failed to get console status' });
  }
});

// ─── Console Config (for frontend) ─────────
router.get('/config', (req, res) => {
  try {
    const consoleConfig = sshTerminal.getConsoleConfig();
    res.json({ success: true, config: consoleConfig });
  } catch (error) {
    logger.error('Error fetching console config:', error);
    res.status(500).json({ success: false, message: 'Failed to get console config' });
  }
});

// ─── Toggle Global Console ─────────────────
router.post('/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    config.set('console.enabled', enabled !== false);
    logger.info(`Console globally ${enabled !== false ? 'enabled' : 'disabled'}`);
    res.json({ success: true, enabled: enabled !== false });
  } catch (error) {
    logger.error('Error toggling console:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle console' });
  }
});

// ─── SSH Public Key ────────────────────────
router.get('/ssh-key', (req, res) => {
  try {
    const publicKey = sshTerminal.getPublicKey();
    res.json({ success: true, publicKey });
  } catch (error) {
    logger.error('Error getting SSH key:', error);
    res.status(500).json({ success: false, message: 'Failed to get SSH key' });
  }
});

// ─── Regenerate SSH Keypair ────────────────
router.post('/ssh-key/regenerate', (req, res) => {
  try {
    const keyPair = sshTerminal.regenerateKeyPair();
    logger.info('SSH keypair regenerated');
    res.json({ success: true, publicKey: keyPair.publicKey });
  } catch (error) {
    logger.error('Error regenerating SSH key:', error);
    res.status(500).json({ success: false, message: 'Failed to regenerate SSH key' });
  }
});

// ─── Validate Command ──────────────────────
router.post('/validate', (req, res) => {
  try {
    const { command } = req.body;
    if (!command) {
      return res.status(400).json({ success: false, message: 'Command is required' });
    }
    const result = sshTerminal.validateCommand(command);
    res.json({ success: true, allowed: result.allowed, reason: result.reason || null });
  } catch (error) {
    logger.error('Error validating command:', error);
    res.status(500).json({ success: false, message: 'Validation failed' });
  }
});

// ─── Active Sessions ───────────────────────
router.get('/sessions', (req, res) => {
  try {
    res.json({ success: true, count: sshTerminal.getSessionCount() });
  } catch (error) {
    logger.error('Error getting sessions:', error);
    res.status(500).json({ success: false, message: 'Failed to get session count' });
  }
});

// ─── Console-enabled Nodes ─────────────────
router.get('/nodes', (req, res) => {
  try {
    const nodes = database.getAllNodes();
    const localHostname = os.hostname();
    const mode = config.get('mode') || 'combine';

    // Get local machine's IP for combine-mode self-node
    let localIp = '127.0.0.1';
    try {
      const nets = os.networkInterfaces();
      for (const ifaces of Object.values(nets)) {
        for (const iface of ifaces) {
          if (!iface.internal && iface.family === 'IPv4') {
            localIp = iface.address;
            break;
          }
        }
        if (localIp !== '127.0.0.1') break;
      }
    } catch {}

    const consoleNodes = nodes.map(node => {
      // Detect if this node is running on the same machine (combine mode)
      const isLocal = (mode === 'combine') &&
        (node.hostname === localHostname ||
         node.system_info?.os?.hostname === localHostname);

      // Resolve IP: prefer system_info network data, fall back to 127.0.0.1 for local
      let ip = null;
      if (node.system_info?.network?.[0]?.ip4) {
        ip = node.system_info.network[0].ip4;
      } else if (node.system_info?.ip) {
        ip = node.system_info.ip;
      } else if (isLocal) {
        ip = localIp;
      }

      // Check reverse SSH tunnel status
      const tunnelInfo = revTunnelManager.getTunnelInfo(node.id);
      const reverseTunnelActive = revTunnelManager.isTunnelActive(node.id);

      return {
        id: node.id,
        hostname: node.hostname,
        status: node.status,
        last_seen: node.last_seen,
        console_enabled: node.console_enabled !== 0,
        ip,
        isLocal,
        ssh_user: isLocal ? (process.env.USER || 'root') : (node.ssh_user || null),
        reverseTunnel: {
          active: reverseTunnelActive,
          localPort: tunnelInfo?.localPort,
          uptime: tunnelInfo ? Date.now() - tunnelInfo.startTime : null,
        },
      };
    });
    res.json({ success: true, nodes: consoleNodes });
  } catch (error) {
    logger.error('Error fetching console nodes:', error);
    res.status(500).json({ success: false, message: 'Failed to get nodes' });
  }
});

// ─── Reverse SSH Tunnel Management ────────
router.get('/reverse-ssh/status', (req, res) => {
  try {
    const tunnels = revTunnelManager.getAllTunnels();
    res.json({
      success: true,
      tunnels: tunnels.map(t => ({
        nodeId: t.nodeId,
        localPort: t.localPort,
        active: revTunnelManager.isTunnelActive(t.nodeId),
        startTime: t.startTime,
        uptime: Date.now() - t.startTime,
      })),
      totalTunnels: tunnels.length,
    });
  } catch (error) {
    logger.error('Error getting reverse SSH tunnel status:', error);
    res.status(500).json({ success: false, message: 'Failed to get tunnel status' });
  }
});

router.get('/reverse-ssh/tunnels/:nodeId', (req, res) => {
  try {
    const { nodeId } = req.params;
    const tunnelInfo = revTunnelManager.getTunnelInfo(nodeId);

    if (!tunnelInfo) {
      return res.json({
        success: true,
        active: false,
        nodeId,
        message: 'No tunnel active for this node',
      });
    }

    res.json({
      success: true,
      active: revTunnelManager.isTunnelActive(nodeId),
      nodeId,
      localPort: tunnelInfo.localPort,
      remoteHost: tunnelInfo.remoteHost,
      remotePort: tunnelInfo.remotePort,
      startTime: tunnelInfo.startTime,
      uptime: Date.now() - tunnelInfo.startTime,
    });
  } catch (error) {
    logger.error('Error getting tunnel info for node:', error);
    res.status(500).json({ success: false, message: 'Failed to get tunnel info' });
  }
});

router.post('/reverse-ssh/start/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { serverHost, serverPort, username, password, localPort } = req.body;

    const tunnelInfo = await revTunnelManager.startReverseTunnel(nodeId, {
      serverHost: serverHost || 'localhost',
      serverPort: serverPort || 22,
      username: username || 'nexus',
      password: password || 'nexus-tunnel-123',
      reversePort: localPort,
    });

    logger.info(`Reverse SSH tunnel started for node ${nodeId}`);

    res.json({
      success: true,
      message: `Reverse SSH tunnel started for node ${nodeId}`,
      tunnelInfo,
    });
  } catch (error) {
    logger.error('Error starting reverse SSH tunnel:', error);
    res.status(500).json({ success: false, message: 'Failed to start tunnel' });
  }
});

router.post('/reverse-ssh/stop/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const stopped = await revTunnelManager.stopReverseTunnel(nodeId);

    res.json({
      success: true,
      message: stopped ? `Tunnel stopped for node ${nodeId}` : 'No tunnel was active',
      stopped,
    });
  } catch (error) {
    logger.error('Error stopping reverse SSH tunnel:', error);
    res.status(500).json({ success: false, message: 'Failed to stop tunnel' });
  }
});

// ─── Reverse SSH Download Instructions ─────
router.get('/reverse-ssh/download-instructions', (req, res) => {
  try {
    const platform = os.platform();
    const arch = os.arch();

    const instructions = {
      success: true,
      platform,
      arch,
      message: 'Download reverse-ssh binary from GitHub and place in /usr/local/bin or ./bin',
      downloads: {
        linux_x64: 'https://github.com/Fahrj/reverse-ssh/releases/latest',
        linux_x86: 'https://github.com/Fahrj/reverse-ssh/releases/latest',
        windows_x64: 'https://github.com/Fahrj/reverse-ssh/releases/latest',
        windows_x86: 'https://github.com/Fahrj/reverse-ssh/releases/latest',
      },
      setupInstructions: {
        linux: [
          'Download the reverse-ssh binary for your architecture',
          'chmod +x ./reverse-ssh',
          'Run with: ./reverse-ssh -v -b 9000 nexus@nexus-server.com',
        ],
        windows: [
          'Download the reverse-ssh.exe binary',
          'Run with: reverse-ssh.exe -v -b 9000 nexus@nexus-server.com',
        ],
      },
      config: {
        username: config.get('node.reverseUsername') || 'nexus',
        serverHost: config.get('node.serverHost') || 'localhost',
        serverPort: config.get('node.serverSSHPort') || 22,
        localPort: config.get('node.reverseLocalPort') || 9000,
      },
    };

    res.json(instructions);
  } catch (error) {
    logger.error('Error getting download instructions:', error);
    res.status(500).json({ success: false, message: 'Failed to get instructions' });
  }
});

module.exports = router;

