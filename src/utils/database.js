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
    // Nodes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        hostname TEXT NOT NULL,
        api_key TEXT NOT NULL UNIQUE,
        api_key_hash TEXT NOT NULL,
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

    // Settings table for server configuration
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);
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

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = new DatabaseManager();
