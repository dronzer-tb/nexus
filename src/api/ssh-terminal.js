const { Client } = require('ssh2');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../utils/config');
const revTunnelManager = require('../utils/reverse-ssh-tunnel');

/**
 * SSH Terminal Manager v2
 * - Auto-generates SSH keypair for Nexus
 * - Per-node console enable/disable
 * - Global console enable/disable
 * - Command security restrictions
 */

const SSH_KEY_DIR = path.join(__dirname, '../../data/ssh');
const SSH_PRIVATE_KEY = path.join(SSH_KEY_DIR, 'nexus_rsa');
const SSH_PUBLIC_KEY = path.join(SSH_KEY_DIR, 'nexus_rsa.pub');

class SSHTerminalManager {
  constructor() {
    this.sessions = new Map(); // socketId -> session
    this._keyPair = null;
    this._connectCooldown = new Map(); // socketId -> timestamp, prevent rapid reconnects
  }

  /* ─── SSH Key Management ─────────────────── */

  /**
   * Ensure SSH keypair exists. Generate if missing.
   */
  ensureKeyPair() {
    if (this._keyPair) return this._keyPair;

    if (!fs.existsSync(SSH_KEY_DIR)) {
      fs.mkdirSync(SSH_KEY_DIR, { recursive: true, mode: 0o700 });
    }

    if (fs.existsSync(SSH_PRIVATE_KEY) && fs.existsSync(SSH_PUBLIC_KEY)) {
      this._keyPair = {
        privateKey: fs.readFileSync(SSH_PRIVATE_KEY, 'utf8'),
        publicKey: fs.readFileSync(SSH_PUBLIC_KEY, 'utf8'),
      };
      logger.debug('Loaded existing SSH keypair');
      return this._keyPair;
    }

    // Generate new RSA keypair
    logger.info('Generating new SSH keypair for Nexus console...');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    });

    // Convert public key to OpenSSH format for authorized_keys
    const pubKeyObj = crypto.createPublicKey(publicKey);
    const sshPubKey = pubKeyObj.export({ type: 'spki', format: 'der' });
    const sshPubKeyB64 = sshPubKey.toString('base64');
    const openSSHPub = `ssh-rsa ${sshPubKeyB64} nexus@console`;

    fs.writeFileSync(SSH_PRIVATE_KEY, privateKey, { mode: 0o600 });
    fs.writeFileSync(SSH_PUBLIC_KEY, openSSHPub, { mode: 0o644 });

    this._keyPair = { privateKey, publicKey: openSSHPub };
    logger.info('SSH keypair generated successfully');
    return this._keyPair;
  }

  /**
   * Get the public key for display / authorized_keys setup
   */
  getPublicKey() {
    const kp = this.ensureKeyPair();
    return kp.publicKey;
  }

  /**
   * Regenerate SSH keypair (invalidates all existing trust)
   */
  regenerateKeyPair() {
    if (fs.existsSync(SSH_PRIVATE_KEY)) fs.unlinkSync(SSH_PRIVATE_KEY);
    if (fs.existsSync(SSH_PUBLIC_KEY)) fs.unlinkSync(SSH_PUBLIC_KEY);
    this._keyPair = null;
    return this.ensureKeyPair();
  }

  /* ─── Console Config ─────────────────────── */

  /**
   * Check if console is globally enabled
   */
  isConsoleEnabled() {
    return config.get('console.enabled') !== false;
  }

  /**
   * Get console security config
   */
  getConsoleConfig() {
    return {
      enabled: this.isConsoleEnabled(),
      allowSudo: config.get('console.allowSudo') || false,
      blockedCommands: config.get('console.blockedCommands') || [
        'rm -rf /', 'rm -rf /*', 'mkfs.', 'dd if=',
        ':(){:|:&};:', 'chmod -R 777 /', 'chown -R',
        '> /dev/sda', '> /dev/nvme',
      ],
      blockedPaths: config.get('console.blockedPaths') || [
        '/etc/passwd', '/etc/shadow', '/etc/sudoers',
        '/boot', '/proc', '/sys',
      ],
    };
  }

  /* ─── Command Validation ─────────────────── */

  validateCommand(command) {
    const cfg = this.getConsoleConfig();
    const trimmed = command.trim().toLowerCase();

    if (!trimmed) return { allowed: true };

    // Block sudo if not allowed
    if (!cfg.allowSudo && /^\s*sudo\s/i.test(command)) {
      return { allowed: false, reason: 'sudo commands are disabled. Enable in Nexus setup to allow.' };
    }

    // Block su
    if (/^\s*su\s*$/i.test(trimmed) || /^\s*su\s+/i.test(trimmed)) {
      return { allowed: false, reason: 'su command is blocked for security.' };
    }

    const dangerousPatterns = [
      { pattern: /rm\s+(-[a-z]*f[a-z]*\s+)?\/($|\s)/i, reason: 'Deleting root directory is blocked' },
      { pattern: /rm\s+(-[a-z]*f[a-z]*\s+)?\/\*($|\s)/i, reason: 'Deleting all files in root is blocked' },
      { pattern: /rm\s+(-[a-z]*r[a-z]*f[a-z]*|-[a-z]*f[a-z]*r[a-z]*)\s+\//i, reason: 'Recursive force delete from root is blocked' },
      { pattern: /mkfs\./i, reason: 'Filesystem formatting commands are blocked' },
      { pattern: /dd\s+if=.*of=\/dev\//i, reason: 'Raw disk write commands are blocked' },
      { pattern: />(\/dev\/[sh]d|\/dev\/nvme)/i, reason: 'Direct device writes are blocked' },
      { pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/i, reason: 'Fork bombs are blocked' },
      { pattern: /chmod\s+-R\s+777\s+\//i, reason: 'Recursive chmod on root is blocked' },
      { pattern: /chown\s+-R\s+.*\s+\//i, reason: 'Recursive chown on root is blocked' },
      { pattern: /shutdown|reboot|poweroff|init\s+[06]/i, reason: 'System power commands are blocked from console' },
    ];

    for (const { pattern, reason } of dangerousPatterns) {
      if (pattern.test(command)) {
        logger.warn(`Blocked dangerous command: ${command.substring(0, 100)}`);
        return { allowed: false, reason };
      }
    }

    for (const blockedPath of cfg.blockedPaths) {
      const escaped = blockedPath.replace(/\//g, '\\/');
      const writePatterns = [
        new RegExp(`>\\s*${escaped}`, 'i'),
        new RegExp(`tee\\s+${escaped}`, 'i'),
        new RegExp(`mv\\s+.*\\s+${escaped}`, 'i'),
        new RegExp(`cp\\s+.*\\s+${escaped}`, 'i'),
      ];
      for (const wp of writePatterns) {
        if (wp.test(command)) {
          return { allowed: false, reason: `Modifications to ${blockedPath} are blocked` };
        }
      }
    }

    return { allowed: true };
  }

  /* ─── SSH Connection (uses Nexus keypair) ── */

  /**
   * Connect via reverse SSH tunnel (node connects back to server)
   */
  connectReverse(socket, connectionInfo, sessionKey, sessionId) {
    const { nodeId } = connectionInfo;
    // Use sessionKey if provided, otherwise fall back to socket.id
    const sKey = sessionKey || socket.id;
    const sId = sessionId || null;

    this.disconnect(sKey);

    try {
      const tunnelInfo = revTunnelManager.getTunnelInfo(nodeId);
      if (!tunnelInfo) {
        socket.emit('terminal:error', { 
          sessionId: sId,
          message: `No reverse SSH tunnel active for node ${nodeId}. Make sure the node has started with reverse-ssh enabled.` 
        });
        return;
      }

      const keyPair = this.ensureKeyPair();
      const conn = new Client();

      logger.info(`Connecting via reverse SSH tunnel to node ${nodeId} on localhost:${tunnelInfo.localPort}`);

      conn.on('ready', () => {
        logger.info(`Reverse tunnel connection established to node ${nodeId}`);

        conn.shell({ term: 'xterm-256color', cols: 120, rows: 30 }, (err, stream) => {
          if (err) {
            logger.error('Reverse SSH shell error:', err);
            socket.emit('terminal:error', { sessionId: sId, message: 'Failed to open shell' });
            return;
          }

          this.sessions.set(sKey, {
            conn, stream, host: `${nodeId} (reverse)`, username: 'root', nodeId, isReverse: true, sessionId: sId,
          });

          stream.on('data', (data) => socket.emit('terminal:data', { sessionId: sId, data: data.toString('utf8') }));
          stream.stderr.on('data', (data) => socket.emit('terminal:data', { sessionId: sId, data: data.toString('utf8') }));
          stream.on('close', () => {
            logger.info(`Reverse SSH session closed for key ${sKey}`);
            socket.emit('terminal:closed', { sessionId: sId });
            this.sessions.delete(sKey);
          });

          socket.emit('terminal:connected', {
            sessionId: sId,
            host: `${nodeId} (via reverse tunnel)`,
            username: 'root',
            message: `Connected to ${nodeId} via reverse SSH tunnel`,
          });
        });
      });

      conn.on('error', (err) => {
        logger.error(`Reverse tunnel connection error to node ${nodeId}:`, err.message);

        let userMessage = `Reverse tunnel failed: ${err.message}`;
        if (err.message.includes('Authentication') || err.message.includes('auth')) {
          userMessage = `Authentication failed on reverse tunnel. Check node log on node side.`;
        } else if (err.message.includes('ECONNREFUSED')) {
          userMessage = `Reverse tunnel not responding. Is reverse-ssh process running on the node?`;
        }

        socket.emit('terminal:error', { sessionId: sId, message: userMessage });
        this.sessions.delete(sKey);
      });

      conn.on('close', () => {
        this.sessions.delete(sKey);
      });

      const connectOpts = {
        host: '127.0.0.1',
        port: tunnelInfo.localPort,
        username: 'root',
        privateKey: keyPair.privateKey,
        readyTimeout: 10000,
      };

      try {
        conn.connect(connectOpts);
      } catch (err) {
        logger.error('Reverse tunnel connect failed:', err);
        socket.emit('terminal:error', { sessionId: sId, message: `Tunnel connection failed: ${err.message}` });
      }
    } catch (err) {
      logger.error(`Error setting up reverse tunnel for node ${nodeId}:`, err);
      socket.emit('terminal:error', { sessionId: sId, message: `Failed to establish reverse tunnel: ${err.message}` });
    }
  }

  /* ─── SSH Connection (uses Nexus keypair) ── */

  connect(socket, connectionInfo, sessionKey, sessionId) {
    const { host, port, username } = connectionInfo;
    const sKey = sessionKey || socket.id;
    const sId = sessionId || null;

    this.disconnect(sKey);

    // Ensure we have keys
    const keyPair = this.ensureKeyPair();
    const conn = new Client();

    conn.on('ready', () => {
      logger.info(`SSH connected to ${host}:${port} as ${username} (key: ${sKey})`);

      conn.shell({ term: 'xterm-256color', cols: 120, rows: 30 }, (err, stream) => {
        if (err) {
          logger.error('SSH shell error:', err);
          socket.emit('terminal:error', { sessionId: sId, message: 'Failed to open shell' });
          return;
        }

        this.sessions.set(sKey, {
          conn, stream, host, username, nodeId: connectionInfo.nodeId, sessionId: sId,
        });

        stream.on('data', (data) => socket.emit('terminal:data', { sessionId: sId, data: data.toString('utf8') }));
        stream.stderr.on('data', (data) => socket.emit('terminal:data', { sessionId: sId, data: data.toString('utf8') }));
        stream.on('close', () => {
          logger.info(`SSH session closed for key ${sKey}`);
          socket.emit('terminal:closed', { sessionId: sId });
          this.sessions.delete(sKey);
        });

        socket.emit('terminal:connected', {
          sessionId: sId,
          host, username,
          message: `Connected to ${username}@${host}`,
        });
      });
    });

    conn.on('error', (err) => {
      logger.error(`SSH connection error to ${host}:`, err.message);

      let userMessage = `SSH connection failed: ${err.message}`;
      if (err.message.includes('Authentication') || err.message.includes('auth')) {
        userMessage = `SSH authentication failed. Make sure the Nexus public key is in ~/.ssh/authorized_keys on ${host}.\n` +
          `Get the key from Settings > Console or the API: GET /api/console/ssh-key`;
      }

      socket.emit('terminal:error', { sessionId: sId, message: userMessage });
      this.sessions.delete(sKey);
    });

    conn.on('close', () => {
      this.sessions.delete(sKey);
    });

    const connectOpts = {
      host: host || '127.0.0.1',
      port: port || 22,
      username: username || process.env.USER || 'root',
      privateKey: keyPair.privateKey,
      readyTimeout: 10000,
    };

    try {
      conn.connect(connectOpts);
    } catch (err) {
      logger.error('SSH connect failed:', err);
      socket.emit('terminal:error', { sessionId: sId, message: `Connection failed: ${err.message}` });
    }
  }

  /* ─── Local PTY Connection ────────────────── */

  connectLocal(socket, sessionKey, sessionId) {
    const sKey = sessionKey || socket.id;
    const sId = sessionId || null;

    // If there's already an active healthy PTY session, just re-send connected event
    const existing = this.sessions.get(sKey);
    if (existing && existing.pty && existing.isLocal) {
      logger.debug(`Reusing existing local PTY for key ${sKey}`);
      socket.emit('terminal:connected', {
        sessionId: sId,
        host: 'localhost',
        username: process.env.USER || 'local',
        message: 'Already connected to local shell',
      });
      return;
    }

    // Prevent rapid reconnection (cooldown of 1 second)
    const now = Date.now();
    const lastConnect = this._connectCooldown.get(sKey);
    if (lastConnect && (now - lastConnect) < 1000) {
      logger.info(`Ignoring rapid reconnect for key ${sKey} (${now - lastConnect}ms since last)`);
      return;
    }
    this._connectCooldown.set(sKey, now);

    // Mark existing session as intentionally replaced (don't send terminal:closed)
    this.disconnect(sKey, true); // true = silent (being replaced)

    try {
      const pty = require('node-pty');
      const shell = process.env.SHELL || '/bin/bash';

      logger.info(`Starting local PTY with shell: ${shell} (key: ${sKey})`);

      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: process.env.HOME,
        env: { ...process.env, TERM: 'xterm-256color' },
      });

      // Store session immediately
      this.sessions.set(sKey, {
        pty: ptyProcess, host: 'localhost',
        username: process.env.USER || 'local',
        isLocal: true,
        sessionId: sId,
      });

      logger.info(`Local PTY spawned for key ${sKey}`);

      // Send connected message first
      socket.emit('terminal:connected', {
        sessionId: sId,
        host: 'localhost',
        username: process.env.USER || 'local',
        message: `Connected to local shell (${shell})`,
      });
      
      logger.info(`Sent terminal:connected event for key ${sKey}`);

      // Set up data handlers
      ptyProcess.onData((data) => {
        logger.debug(`PTY data (${data.length} bytes) for key ${sKey}`);
        socket.emit('terminal:data', { sessionId: sId, data });
      });

      ptyProcess.onExit(({ exitCode }) => {
        // Check if this PTY is still the active session (not replaced by a newer one)
        const currentSession = this.sessions.get(sKey);
        if (currentSession && currentSession.pty === ptyProcess) {
          // This PTY exited on its own (user typed exit, shell crashed, etc.)
          logger.info(`Local PTY exited with code ${exitCode} (key: ${sKey})`);
          socket.emit('terminal:closed', { sessionId: sId });
          this.sessions.delete(sKey);
        } else {
          // PTY was replaced by a newer connection, don't emit terminal:closed
          logger.debug(`Replaced PTY exited for key ${sKey} (suppressed terminal:closed)`);
        }
      });

      logger.info(`Local PTY ready for key ${sKey}`);
    } catch (err) {
      logger.error('Failed to start local PTY:', err);
      logger.error('Error stack:', err.stack);
      socket.emit('terminal:error', { sessionId: sId, message: `Local terminal failed: ${err.message}` });
    }
  }

  /* ─── Session I/O ─────────────────────────── */

  write(sessionKey, data) {
    const session = this.sessions.get(sessionKey);
    if (!session) {
      logger.warn(`Write attempted for unknown session: ${sessionKey}`);
      return;
    }
    
    try {
      if (session.stream) {
        logger.debug(`Writing to SSH stream for key ${sessionKey} (${data.length} bytes)`);
        session.stream.write(data);
      } else if (session.pty) {
        logger.debug(`Writing to PTY for key ${sessionKey} (${data.length} bytes)`);
        session.pty.write(data);
      } else {
        logger.warn(`No stream or PTY found for key ${sessionKey}`);
      }
    } catch (err) {
      logger.error(`Error writing to session ${sessionKey}:`, err);
    }
  }

  resize(sessionKey, cols, rows) {
    const session = this.sessions.get(sessionKey);
    if (!session) return;
    if (session.stream) session.stream.setWindow(rows, cols, 0, 0);
    else if (session.pty) session.pty.resize(cols, rows);
  }

  disconnect(sessionKey, silent = false) {
    const session = this.sessions.get(sessionKey);
    if (!session) return;
    // Mark as replaced so the onExit handler knows not to emit terminal:closed
    if (silent) {
      session._replaced = true;
    }
    try {
      if (session.stream) session.stream.end();
      if (session.conn) session.conn.end();
      if (session.pty) session.pty.kill();
    } catch (err) {
      logger.debug('Error cleaning up session:', err.message);
    }
    this.sessions.delete(sessionKey);
  }

  /**
   * Disconnect all sessions belonging to a socket (on socket disconnect)
   */
  disconnectAllForSocket(socketId) {
    const keysToRemove = [];
    for (const [key] of this.sessions) {
      if (key === socketId || key.startsWith(`${socketId}:`)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      this.disconnect(key);
    }
  }

  getSessionCount() { return this.sessions.size; }

  cleanup() {
    for (const [socketId] of this.sessions) this.disconnect(socketId);
  }
}

const sshManager = new SSHTerminalManager();
module.exports = sshManager;
