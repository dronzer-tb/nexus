const { Client } = require('ssh2');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../utils/config');

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

  connect(socket, connectionInfo) {
    const { host, port, username } = connectionInfo;
    const socketId = socket.id;

    this.disconnect(socketId);

    // Ensure we have keys
    const keyPair = this.ensureKeyPair();
    const conn = new Client();

    conn.on('ready', () => {
      logger.info(`SSH connected to ${host}:${port} as ${username} (socket: ${socketId})`);

      conn.shell({ term: 'xterm-256color', cols: 120, rows: 30 }, (err, stream) => {
        if (err) {
          logger.error('SSH shell error:', err);
          socket.emit('terminal:error', { message: 'Failed to open shell' });
          return;
        }

        this.sessions.set(socketId, {
          conn, stream, host, username, nodeId: connectionInfo.nodeId,
        });

        stream.on('data', (data) => socket.emit('terminal:data', data.toString('utf8')));
        stream.stderr.on('data', (data) => socket.emit('terminal:data', data.toString('utf8')));
        stream.on('close', () => {
          logger.info(`SSH session closed for socket ${socketId}`);
          socket.emit('terminal:closed');
          this.sessions.delete(socketId);
        });

        socket.emit('terminal:connected', {
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

      socket.emit('terminal:error', { message: userMessage });
      this.sessions.delete(socketId);
    });

    conn.on('close', () => {
      this.sessions.delete(socketId);
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
      socket.emit('terminal:error', { message: `Connection failed: ${err.message}` });
    }
  }

  /* ─── Local PTY Connection ────────────────── */

  connectLocal(socket) {
    const socketId = socket.id;
    this.disconnect(socketId);

    try {
      const pty = require('node-pty');
      const shell = process.env.SHELL || '/bin/bash';

      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: process.env.HOME,
        env: { ...process.env, TERM: 'xterm-256color' },
      });

      this.sessions.set(socketId, {
        pty: ptyProcess, host: 'localhost',
        username: process.env.USER || 'local',
        isLocal: true,
      });

      ptyProcess.onData((data) => socket.emit('terminal:data', data));
      ptyProcess.onExit(({ exitCode }) => {
        logger.info(`Local PTY exited with code ${exitCode} (socket: ${socketId})`);
        socket.emit('terminal:closed');
        this.sessions.delete(socketId);
      });

      socket.emit('terminal:connected', {
        host: 'localhost',
        username: process.env.USER || 'local',
        message: 'Connected to local shell',
      });

      logger.info(`Local PTY started for socket ${socketId}`);
    } catch (err) {
      logger.error('Failed to start local PTY:', err);
      socket.emit('terminal:error', { message: `Local terminal failed: ${err.message}` });
    }
  }

  /* ─── Session I/O ─────────────────────────── */

  write(socketId, data) {
    const session = this.sessions.get(socketId);
    if (!session) return;
    if (session.stream) session.stream.write(data);
    else if (session.pty) session.pty.write(data);
  }

  resize(socketId, cols, rows) {
    const session = this.sessions.get(socketId);
    if (!session) return;
    if (session.stream) session.stream.setWindow(rows, cols, 0, 0);
    else if (session.pty) session.pty.resize(cols, rows);
  }

  disconnect(socketId) {
    const session = this.sessions.get(socketId);
    if (!session) return;
    try {
      if (session.stream) session.stream.end();
      if (session.conn) session.conn.end();
      if (session.pty) session.pty.kill();
    } catch (err) {
      logger.debug('Error cleaning up session:', err.message);
    }
    this.sessions.delete(socketId);
  }

  getSessionCount() { return this.sessions.size; }

  cleanup() {
    for (const [socketId] of this.sessions) this.disconnect(socketId);
  }
}

const sshManager = new SSHTerminalManager();
module.exports = sshManager;
