import * as fs from 'fs';
import * as path from 'path';

export interface Config {
  mode?: string;
  serverUrl: string;
  apiKey?: string;
  dbPath: string;
  heartbeatInterval: number;
  port: number;
}

const DEFAULT_CONFIG: Config = {
  mode: 'agent',
  serverUrl: 'http://localhost:8000',
  apiKey: '',
  dbPath: 'db/nexus.db',
  heartbeatInterval: 10,
  port: 8000
};

export function loadConfig(configPath: string = 'config.json'): Config {
  let config = { ...DEFAULT_CONFIG };

  // Load from environment
  if (process.env.NEXUS_MODE) config.mode = process.env.NEXUS_MODE;
  if (process.env.NEXUS_SERVER_URL) config.serverUrl = process.env.NEXUS_SERVER_URL;
  if (process.env.NEXUS_API_KEY) config.apiKey = process.env.NEXUS_API_KEY;
  if (process.env.NEXUS_DB_PATH) config.dbPath = process.env.NEXUS_DB_PATH;
  if (process.env.NEXUS_HEARTBEAT_INTERVAL) config.heartbeatInterval = parseInt(process.env.NEXUS_HEARTBEAT_INTERVAL);
  if (process.env.NEXUS_PORT) config.port = parseInt(process.env.NEXUS_PORT);

  // Override with config file if exists
  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config = { ...config, ...fileConfig };
    } catch (err) {
      console.error('Failed to load config file:', err);
    }
  }

  return config;
}
