"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const fs = __importStar(require("fs"));
const DEFAULT_CONFIG = {
    mode: 'agent',
    serverUrl: 'http://localhost:8000',
    apiKey: '',
    dbPath: 'db/nexus.db',
    heartbeatInterval: 10,
    port: 8000
};
function loadConfig(configPath = 'config.json') {
    let config = { ...DEFAULT_CONFIG };
    // Load from environment
    if (process.env.NEXUS_MODE)
        config.mode = process.env.NEXUS_MODE;
    if (process.env.NEXUS_SERVER_URL)
        config.serverUrl = process.env.NEXUS_SERVER_URL;
    if (process.env.NEXUS_API_KEY)
        config.apiKey = process.env.NEXUS_API_KEY;
    if (process.env.NEXUS_DB_PATH)
        config.dbPath = process.env.NEXUS_DB_PATH;
    if (process.env.NEXUS_HEARTBEAT_INTERVAL)
        config.heartbeatInterval = parseInt(process.env.NEXUS_HEARTBEAT_INTERVAL);
    if (process.env.NEXUS_PORT)
        config.port = parseInt(process.env.NEXUS_PORT);
    // Override with config file if exists
    if (fs.existsSync(configPath)) {
        try {
            const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            config = { ...config, ...fileConfig };
        }
        catch (err) {
            console.error('Failed to load config file:', err);
        }
    }
    return config;
}
