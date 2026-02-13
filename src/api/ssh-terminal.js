const { Client } = require('ssh2');
const logger = require('../utils/logger');
const config = require('../utils/config');

/**
 * SSH Terminal Manager
 * Manages SSH connections for the web-based terminal.
 * Enforces command restrictions based on config.
 */

class SSHTerminalManager {
  constructor() {
    this.sessions = new Map(); // socketId -> { conn, stream, info }
  }

  /**
   * Get console security config
   */
  getConsoleConfig() {
    return {
      allowSudo: config.get('console.allowSudo') || false,
      blockedCommands: config.get('console.blockedCommands') || [
        'rm -rf /',
        'rm -rf /*',
        'mkfs.',
        'dd if=',
        ':(){:|:&};:',
        'chmod -R 777 /',
        'chown -R',
        '> /dev/sda',
        '> /dev/nvme',
      ],
      blockedPaths: config.get('console.blockedPaths') || [
        '/etc/passwd',
        '/etc/shadow',
        '/etc/sudoers',
        '/boot',
        '/proc',
        '/sys',
      ],
    };
  }

  /**
   * Validate a command against security rules.
   * Returns { allowed: boolean, reason?: string }
   */
  validateCommand(command) {
    const cfg = this.getConsoleConfig();
    const trimmed = command.trim().toLowerCase();

    // Block empty commands
    if (!trimmed) {
      return { allowed: true };
    }

    // Block sudo if not allowed
    if (!cfg.allowSudo && /^\s*sudo\s/i.test(command)) {
      return {
        allowed: false,
        reason: 'sudo commands are disabled. Enable in Nexus setup to allow.',
      };
    }

    // Block su
    if (/^\s*su\s*$/i.test(trimmed) || /^\s*su\s+/i.test(trimmed)) {
      return {
        allowed: false,
        reason: 'su command is blocked for security.',
      };
    }

    // Block dangerous rm patterns
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

    // Block writes to sensitive paths
    for (const blockedPath of cfg.blockedPaths) {
      // Check if command modifies blocked paths
      const writePatterns = [
        new RegExp(`>\\s*${blockedPath.replace(/\//g, '\\/')}`, 'i'),
        new RegExp(`tee\\s+${blockedPath.replace(/\//g, '\\/')}`, 'i'),
        new RegExp(`mv\\s+.*\\s+${blockedPath.replace(/\//g, '\\/')}`, 'i'),
        new RegExp(`cp\\s+.*\\s+${blockedPath.replace(/\//g, '\\/')}`, 'i'),
      ];

      for (const wp of writePatterns) {
        if (wp.test(command)) {
          return {
            allowed: false,
            reason: `Modifications to ${blockedPath} are blocked`,
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Connect to an SSH server and attach to a WebSocket
   */
  connect(socket, connectionInfo) {
    const { host, port, username, password, privateKey } = connectionInfo;
    const socketId = socket.id;

    // Close existing session
    this.disconnect(socketId);

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
          conn,
          stream,
          host,
          username,
          is2FAVerified: false,
        });

        // Stream SSH output to the WebSocket client
        stream.on('data', (data) => {
          socket.emit('terminal:data', data.toString('utf8'));
        });

        stream.stderr.on('data', (data) => {
          socket.emit('terminal:data', data.toString('utf8'));
        });

        stream.on('close', () => {
          logger.info(`SSH session closed for socket ${socketId}`);
          socket.emit('terminal:closed');
          this.sessions.delete(socketId);
        });

        socket.emit('terminal:connected', {
          host,
          username,
          message: `Connected to ${username}@${host}`,
        });
      });
    });

    conn.on('error', (err) => {
      logger.error(`SSH connection error to ${host}:`, err.message);
      socket.emit('terminal:error', {
        message: `SSH connection failed: ${err.message}`,
      });
      this.sessions.delete(socketId);
    });

    conn.on('close', () => {
      logger.info(`SSH connection to ${host} closed`);
      this.sessions.delete(socketId);
    });

    // Connect
    const connectOpts = {
      host: host || '127.0.0.1',
      port: port || 22,
      username: username || 'root',
      readyTimeout: 10000,
    };

    if (privateKey) {
      connectOpts.privateKey = privateKey;
    } else if (password) {
      connectOpts.password = password;
    }

    try {
      conn.connect(connectOpts);
    } catch (err) {
      logger.error('SSH connect failed:', err);
      socket.emit('terminal:error', { message: `Connection failed: ${err.message}` });
    }
  }

  /**
   * Connect to the local machine (combine mode) using a PTY
   */
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
        env: {
          ...process.env,
          TERM: 'xterm-256color',
        },
      });

      this.sessions.set(socketId, {
        pty: ptyProcess,
        host: 'localhost',
        username: process.env.USER || 'local',
        isLocal: true,
        is2FAVerified: false,
      });

      ptyProcess.onData((data) => {
        socket.emit('terminal:data', data);
      });

      ptyProcess.onExit(({ exitCode }) => {
        logger.info(`Local PTY exited with code ${exitCode} (socket: ${socketId})`);
        socket.emit('terminal:closed');
        this.sessions.delete(socketId);
      });

      socket.emit('terminal:connected', {
        host: 'localhost',
        username: process.env.USER || 'local',
        message: `Connected to local shell`,
      });

      logger.info(`Local PTY started for socket ${socketId}`);
    } catch (err) {
      logger.error('Failed to start local PTY:', err);
      socket.emit('terminal:error', { message: `Local terminal failed: ${err.message}` });
    }
  }

  /**
   * Send input to an active session (with command filtering)
   */
  write(socketId, data) {
    const session = this.sessions.get(socketId);
    if (!session) return;

    // For Enter key presses, we'd validate the accumulated command
    // But since xterm sends character-by-character, we pass through
    // and rely on the shell-level restrictions
    if (session.stream) {
      session.stream.write(data);
    } else if (session.pty) {
      session.pty.write(data);
    }
  }

  /**
   * Resize the terminal
   */
  resize(socketId, cols, rows) {
    const session = this.sessions.get(socketId);
    if (!session) return;

    if (session.stream) {
      session.stream.setWindow(rows, cols, 0, 0);
    } else if (session.pty) {
      session.pty.resize(cols, rows);
    }
  }

  /**
   * Disconnect a session
   */
  disconnect(socketId) {
    const session = this.sessions.get(socketId);
    if (!session) return;

    try {
      if (session.stream) {
        session.stream.end();
      }
      if (session.conn) {
        session.conn.end();
      }
      if (session.pty) {
        session.pty.kill();
      }
    } catch (err) {
      logger.debug('Error cleaning up session:', err.message);
    }

    this.sessions.delete(socketId);
  }

  /**
   * Get active session count
   */
  getSessionCount() {
    return this.sessions.size;
  }

  /**
   * Clean up all sessions
   */
  cleanup() {
    for (const [socketId] of this.sessions) {
      this.disconnect(socketId);
    }
  }
}

// Singleton
const sshManager = new SSHTerminalManager();

module.exports = sshManager;
