const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const logger = require('./logger');

class DatabaseManager {
  constructor() {
    this.db = null;
  }

  init() {
    try {
      const dbPath = config.get('database.path') || './data/nexus.db';
      const dbDir = path.dirname(dbPath);

      // Ensure database directory exists
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');

      this.createTables();
      logger.info(`Database initialized at ${dbPath}`);

      return this.db;
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  createTables() {
    // Migrate nodes table if it has the old UNIQUE constraint on api_key
    this.migrateNodesTable();

    // Nodes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        hostname TEXT NOT NULL,
        api_key TEXT NOT NULL DEFAULT '***REDACTED***',
        api_key_hash TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'offline',
        last_seen INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        system_info TEXT
      )
    `);

    // Metrics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        cpu_usage REAL,
        memory_usage REAL,
        swap_usage REAL,
        disk_usage TEXT,
        network_stats TEXT,
        process_count INTEGER,
        data TEXT,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_metrics_node_id ON metrics(node_id);
      CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
    `);

    // Dashboard API keys table (for mobile app / external access)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        key_preview TEXT NOT NULL,
        permissions TEXT DEFAULT 'read',
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        last_used INTEGER,
        expires_at INTEGER,
        metadata TEXT
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
    `);

    // Migrate api_keys table to add metadata column if it doesn't exist
    this.migrateApiKeysTable();

    // Settings table for server configuration
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Users table for multi-user support
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT,
        role TEXT DEFAULT 'viewer',
        must_change_password INTEGER DEFAULT 0,
        totp_secret TEXT,
        totp_enabled INTEGER DEFAULT 0,
        recovery_codes TEXT,
        reset_token TEXT,
        reset_token_expires INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);

    // Migrate existing users table to add 2FA columns if they don't exist
    this.migrate2FAColumns();

    // Sessions table for authentication
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        last_activity INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    `);
  }

  /**
   * Migrate users table to add 2FA columns if they don't exist
   */
  migrate2FAColumns() {
    try {
      const tableInfo = this.db.pragma('table_info(users)');
      const hasTotp = tableInfo.some(col => col.name === 'totp_secret');
      const hasEmail = tableInfo.some(col => col.name === 'email');
      const hasResetToken = tableInfo.some(col => col.name === 'reset_token');

      this.db.exec('BEGIN TRANSACTION');

      if (!hasTotp) {
        logger.info('Migrating users table: adding 2FA columns...');
        this.db.exec(`ALTER TABLE users ADD COLUMN totp_secret TEXT;`);
        this.db.exec(`ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0;`);
        this.db.exec(`ALTER TABLE users ADD COLUMN recovery_codes TEXT;`);
        logger.info('Users table 2FA migration complete');
      }

      if (!hasEmail) {
        logger.info('Migrating users table: adding email and password reset columns...');
        this.db.exec(`ALTER TABLE users ADD COLUMN email TEXT;`);
        this.db.exec(`ALTER TABLE users ADD COLUMN reset_token TEXT;`);
        this.db.exec(`ALTER TABLE users ADD COLUMN reset_token_expires INTEGER;`);
        logger.info('Users table password reset migration complete');
      }

      this.db.exec('COMMIT');
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch (_) { }
      logger.error('Users table migration failed:', error);
    }
  }

  /**
   * Migrate api_keys table to add metadata column if it doesn't exist
   */
  migrateApiKeysTable() {
    try {
      const tableInfo = this.db.pragma('table_info(api_keys)');
      const hasMetadata = tableInfo.some(col => col.name === 'metadata');

      if (!hasMetadata) {
        logger.info('Migrating api_keys table: adding metadata column...');
        this.db.exec(`ALTER TABLE api_keys ADD COLUMN metadata TEXT;`);
        logger.info('api_keys table metadata migration complete');
      }
    } catch (error) {
      logger.error('api_keys table migration failed:', error);
    }
  }

  /**
   * Migrate nodes table: remove UNIQUE from api_key, add UNIQUE to api_key_hash.
   * The api_key column stored '***REDACTED***' for every node, so UNIQUE on it
   * prevented registering more than one node. This fixes that.
   */
  migrateNodesTable() {
    try {
      // Check if nodes table exists
      const tableExists = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'"
      ).get();
      if (!tableExists) return; // Fresh install, createTables() will handle it

      // Use PRAGMA to reliably detect if api_key has a UNIQUE index
      // (string matching on sqlite_master.sql is fragile and can miss due to whitespace)
      const indexes = this.db.pragma('index_list(nodes)');
      let needsMigration = false;
      for (const idx of indexes) {
        if (!idx.unique) continue;
        const cols = this.db.pragma(`index_info("${idx.name}")`);
        if (cols.some(c => c.name === 'api_key')) {
          needsMigration = true;
          break;
        }
      }
      if (!needsMigration) return; // Already migrated or never had the issue

      logger.info('Migrating nodes table: removing UNIQUE from api_key, adding UNIQUE to api_key_hash...');

      this.db.exec('BEGIN TRANSACTION');
      this.db.exec(`
        CREATE TABLE nodes_new (
          id TEXT PRIMARY KEY,
          hostname TEXT NOT NULL,
          api_key TEXT NOT NULL DEFAULT '***REDACTED***',
          api_key_hash TEXT NOT NULL UNIQUE,
          status TEXT DEFAULT 'offline',
          last_seen INTEGER,
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          system_info TEXT
        )
      `);
      this.db.exec('INSERT OR IGNORE INTO nodes_new SELECT * FROM nodes');
      this.db.exec('DROP TABLE nodes');
      this.db.exec('ALTER TABLE nodes_new RENAME TO nodes');
      this.db.exec('COMMIT');

      logger.info('Nodes table migration complete');
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch (_) { }
      logger.error('Nodes table migration failed:', error);
    }
  }

  // Node operations
  createNode(nodeData) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO nodes (id, hostname, api_key, api_key_hash, status, last_seen, system_info)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      return stmt.run(
        nodeData.id,
        nodeData.hostname,
        '***REDACTED***',
        nodeData.apiKeyHash,
        nodeData.status || 'online',
        Date.now(),
        JSON.stringify(nodeData.systemInfo || {})
      );
    } catch (error) {
      // Handle UNIQUE constraint failure on api_key (old schema not yet migrated)
      if (error.message && error.message.includes('UNIQUE constraint failed: nodes.api_key')) {
        logger.warn('UNIQUE constraint on api_key detected — using unique placeholder for this node');
        const stmt = this.db.prepare(`
          INSERT INTO nodes (id, hostname, api_key, api_key_hash, status, last_seen, system_info)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
          nodeData.id,
          nodeData.hostname,
          `***REDACTED_${nodeData.id}***`,
          nodeData.apiKeyHash,
          nodeData.status || 'online',
          Date.now(),
          JSON.stringify(nodeData.systemInfo || {})
        );
      }
      throw error; // Re-throw if it's a different error
    }
  }

  getNode(nodeId) {
    const stmt = this.db.prepare('SELECT * FROM nodes WHERE id = ?');
    const node = stmt.get(nodeId);

    if (node && node.system_info) {
      node.system_info = JSON.parse(node.system_info);
    }

    return node;
  }

  // Deprecated: Use api_key_hash lookups instead of plaintext
  getNodeByApiKeyHash(apiKeyHash) {
    const stmt = this.db.prepare('SELECT * FROM nodes WHERE api_key_hash = ?');
    const node = stmt.get(apiKeyHash);

    if (node && node.system_info) {
      node.system_info = JSON.parse(node.system_info);
    }

    return node;
  }

  getAllNodes() {
    const stmt = this.db.prepare('SELECT * FROM nodes ORDER BY last_seen DESC');
    const nodes = stmt.all();

    return nodes.map(node => {
      if (node.system_info) {
        node.system_info = JSON.parse(node.system_info);
      }
      return node;
    });
  }

  updateNodeStatus(nodeId, status) {
    const stmt = this.db.prepare(`
      UPDATE nodes SET status = ?, last_seen = ? WHERE id = ?
    `);
    return stmt.run(status, Date.now(), nodeId);
  }

  updateNodeLastSeen(nodeId) {
    const stmt = this.db.prepare(`
      UPDATE nodes SET last_seen = ? WHERE id = ?
    `);
    return stmt.run(Date.now(), nodeId);
  }

  updateNodeSystemInfo(nodeId, systemInfo) {
    const stmt = this.db.prepare(`
      UPDATE nodes SET system_info = ? WHERE id = ?
    `);
    return stmt.run(JSON.stringify(systemInfo), nodeId);
  }

  deleteNode(nodeId) {
    const stmt = this.db.prepare('DELETE FROM nodes WHERE id = ?');
    return stmt.run(nodeId);
  }

  // Metrics operations
  saveMetrics(nodeId, metrics) {
    const stmt = this.db.prepare(`
      INSERT INTO metrics (
        node_id, timestamp, cpu_usage, memory_usage, swap_usage,
        disk_usage, network_stats, process_count, data
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      nodeId,
      metrics.timestamp,
      metrics.cpu?.usage || 0,
      metrics.memory?.usagePercent || 0,
      metrics.swap?.usagePercent || 0,
      JSON.stringify(metrics.disk || []),
      JSON.stringify(metrics.network || []),
      metrics.processes?.all || 0,
      JSON.stringify(metrics)
    );
  }

  getLatestMetrics(nodeId, limit = 100) {
    const stmt = this.db.prepare(`
      SELECT * FROM metrics 
      WHERE node_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

    const metrics = stmt.all(nodeId, limit);

    return metrics.map(m => {
      if (m.data) {
        m.data = JSON.parse(m.data);
      }
      if (m.disk_usage) {
        m.disk_usage = JSON.parse(m.disk_usage);
      }
      if (m.network_stats) {
        m.network_stats = JSON.parse(m.network_stats);
      }
      return m;
    });
  }

  getMetricsInTimeRange(nodeId, startTime, endTime) {
    const stmt = this.db.prepare(`
      SELECT * FROM metrics 
      WHERE node_id = ? AND timestamp BETWEEN ? AND ?
      ORDER BY timestamp DESC
    `);

    return stmt.all(nodeId, startTime, endTime);
  }

  cleanOldMetrics(olderThanDays = 7) {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const stmt = this.db.prepare('DELETE FROM metrics WHERE timestamp < ?');
    return stmt.run(cutoffTime);
  }

  // Settings operations
  getSetting(key) {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get(key);
    return result ? result.value : null;
  }

  setSetting(key, value) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
    `);
    return stmt.run(key, value, Date.now());
  }

  // API Key operations
  createApiKey(keyData) {
    const stmt = this.db.prepare(`
      INSERT INTO api_keys (id, name, key_hash, key_preview, permissions, last_used, expires_at, metadata)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
    `);
    return stmt.run(
      keyData.id,
      keyData.name,
      keyData.keyHash,
      keyData.keyPreview,
      keyData.permissions || 'read',
      keyData.expiresAt || null,
      keyData.metadata || null
    );
  }

  getApiKeyByHash(keyHash) {
    const stmt = this.db.prepare('SELECT * FROM api_keys WHERE key_hash = ?');
    return stmt.get(keyHash);
  }

  getAllApiKeys() {
    const stmt = this.db.prepare('SELECT id, name, key_preview, permissions, created_at, last_used, expires_at, metadata FROM api_keys ORDER BY created_at DESC');
    return stmt.all();
  }

  getApiKeyById(keyId) {
    const stmt = this.db.prepare('SELECT * FROM api_keys WHERE id = ?');
    return stmt.get(keyId);
  }

  deleteApiKey(keyId) {
    const stmt = this.db.prepare('DELETE FROM api_keys WHERE id = ?');
    return stmt.run(keyId);
  }

  updateApiKeyLastUsed(keyId) {
    const stmt = this.db.prepare('UPDATE api_keys SET last_used = ? WHERE id = ?');
    return stmt.run(Date.now(), keyId);
  }

  // User operations
  createUser(userData) {
    const stmt = this.db.prepare(`
      INSERT INTO users (username, password, role, must_change_password)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(
      userData.username,
      userData.password,
      userData.role || 'viewer',
      userData.mustChangePassword ? 1 : 0
    );
  }

  getUserByUsername(username) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  }

  getUserById(id) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  }

  getAllUsers() {
    const stmt = this.db.prepare('SELECT id, username, role, must_change_password, totp_enabled, created_at, updated_at FROM users ORDER BY created_at DESC');
    return stmt.all();
  }

  updateUser(id, userData) {
    const fields = [];
    const values = [];

    if (userData.password) {
      fields.push('password = ?');
      values.push(userData.password);
    }
    if (userData.email !== undefined) {
      fields.push('email = ?');
      values.push(userData.email);
    }
    if (userData.role) {
      fields.push('role = ?');
      values.push(userData.role);
    }
    if (typeof userData.mustChangePassword !== 'undefined') {
      fields.push('must_change_password = ?');
      values.push(userData.mustChangePassword ? 1 : 0);
    }
    if (userData.totpSecret !== undefined) {
      fields.push('totp_secret = ?');
      values.push(userData.totpSecret);
    }
    if (typeof userData.totpEnabled !== 'undefined') {
      fields.push('totp_enabled = ?');
      values.push(userData.totpEnabled ? 1 : 0);
    }
    if (userData.recoveryCodes !== undefined) {
      fields.push('recovery_codes = ?');
      values.push(userData.recoveryCodes);
    }
    if (userData.resetToken !== undefined) {
      fields.push('reset_token = ?');
      values.push(userData.resetToken);
    }
    if (userData.resetTokenExpires !== undefined) {
      fields.push('reset_token_expires = ?');
      values.push(userData.resetTokenExpires);
    }

    if (fields.length === 0) return null;

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = this.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
    return stmt.run(...values);
  }

  getUserByEmail(email) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  }

  getUserByResetToken(token) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?');
    return stmt.get(token, Date.now());
  }

  deleteUser(id) {
    const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
    return stmt.run(id);
  }

  // Session operations
  createSession(sessionData) {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (user_id, token, created_at, expires_at, last_activity, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      sessionData.userId,
      sessionData.token,
      sessionData.createdAt || Date.now(),
      sessionData.expiresAt,
      sessionData.lastActivity || Date.now(),
      sessionData.ipAddress || null,
      sessionData.userAgent || null
    );
  }

  getSessionByToken(token) {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?');
    return stmt.get(token, Date.now());
  }

  updateSessionActivity(token) {
    const stmt = this.db.prepare('UPDATE sessions SET last_activity = ? WHERE token = ?');
    return stmt.run(Date.now(), token);
  }

  deleteSession(token) {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE token = ?');
    return stmt.run(token);
  }

  deleteUserSessions(userId) {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE user_id = ?');
    return stmt.run(userId);
  }

  cleanExpiredSessions() {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE expires_at < ?');
    return stmt.run(Date.now());
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = new DatabaseManager();
