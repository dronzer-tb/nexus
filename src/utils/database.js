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
        expires_at INTEGER
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
    `);

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
        role TEXT DEFAULT 'viewer',
        must_change_password INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);
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

      // Check if api_key has a UNIQUE constraint (old schema)
      const tableInfo = this.db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='nodes'").get();
      if (!tableInfo || !tableInfo.sql.includes('api_key TEXT NOT NULL UNIQUE')) return; // Already migrated

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
      try { this.db.exec('ROLLBACK'); } catch (_) {}
      logger.error('Nodes table migration failed:', error);
    }
  }

  // Node operations
  createNode(nodeData) {
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
      INSERT INTO api_keys (id, name, key_hash, key_preview, permissions, last_used, expires_at)
      VALUES (?, ?, ?, ?, ?, NULL, ?)
    `);
    return stmt.run(
      keyData.id,
      keyData.name,
      keyData.keyHash,
      keyData.keyPreview,
      keyData.permissions || 'read',
      keyData.expiresAt || null
    );
  }

  getApiKeyByHash(keyHash) {
    const stmt = this.db.prepare('SELECT * FROM api_keys WHERE key_hash = ?');
    return stmt.get(keyHash);
  }

  getAllApiKeys() {
    const stmt = this.db.prepare('SELECT id, name, key_preview, permissions, created_at, last_used, expires_at FROM api_keys ORDER BY created_at DESC');
    return stmt.all();
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
    const stmt = this.db.prepare('SELECT id, username, role, must_change_password, created_at, updated_at FROM users ORDER BY created_at DESC');
    return stmt.all();
  }

  updateUser(id, userData) {
    const fields = [];
    const values = [];

    if (userData.password) {
      fields.push('password = ?');
      values.push(userData.password);
    }
    if (userData.role) {
      fields.push('role = ?');
      values.push(userData.role);
    }
    if (typeof userData.mustChangePassword !== 'undefined') {
      fields.push('must_change_password = ?');
      values.push(userData.mustChangePassword ? 1 : 0);
    }

    if (fields.length === 0) return null;

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = this.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
    return stmt.run(...values);
  }

  deleteUser(id) {
    const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
    return stmt.run(id);
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = new DatabaseManager();
