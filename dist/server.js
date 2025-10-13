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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const ws_1 = require("ws");
const http = __importStar(require("http"));
const admin_1 = require("./db/admin");
const tokens_1 = require("./db/tokens");
const bcrypt = __importStar(require("bcrypt"));
const crypto = __importStar(require("crypto"));
const AGENTS = new Map();
const LIVE_WS = new Set();
let adminSession = null;
async function startServer(config) {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    const server = http.createServer(app);
    const wss = new ws_1.WebSocketServer({ server, path: '/api/live' });
    // WebSocket connection handler
    wss.on('connection', (ws) => {
        console.log('WebSocket client connected');
        LIVE_WS.add(ws);
        ws.on('close', () => {
            LIVE_WS.delete(ws);
            console.log('WebSocket client disconnected');
        });
        ws.on('error', (err) => {
            console.error('WebSocket error:', err);
            LIVE_WS.delete(ws);
        });
    });
    // Broadcast helper
    function broadcast(event) {
        const payload = JSON.stringify(event);
        const toRemove = [];
        LIVE_WS.forEach(ws => {
            if (ws.readyState === ws_1.WebSocket.OPEN) {
                try {
                    ws.send(payload);
                }
                catch (err) {
                    toRemove.push(ws);
                }
            }
            else {
                toRemove.push(ws);
            }
        });
        toRemove.forEach(ws => LIVE_WS.delete(ws));
    }
    // Load tokens
    const tokens = (0, tokens_1.loadTokens)();
    // API Routes
    app.post('/api/agent/update', (req, res) => {
        const { api_key, metrics } = req.body;
        // Validate token
        const validToken = Object.values(tokens).includes(api_key);
        if (!validToken) {
            return res.json({ error: 'invalid_token' });
        }
        const agentId = metrics?.hostname || 'unknown';
        AGENTS.set(agentId, { metrics });
        // Broadcast update
        broadcast({ type: 'agent.update', agent: agentId, metrics });
        res.json({ status: 'ok', agent_id: agentId });
    });
    app.get('/api/agent/list', (req, res) => {
        res.json({ agents: Array.from(AGENTS.keys()) });
    });
    app.get('/api/agent/:id', (req, res) => {
        const agent = AGENTS.get(req.params.id);
        if (!agent) {
            return res.json({ error: 'not_found' });
        }
        res.json(agent);
    });
    app.post('/api/agent/connect', (req, res) => {
        const { api_token, hostname } = req.body;
        if (!api_token) {
            return res.json({ error: 'api_token_required' });
        }
        const validToken = Object.values(tokens).includes(api_token);
        if (!validToken) {
            return res.json({ error: 'invalid_token' });
        }
        const host = hostname || 'unknown';
        AGENTS.set(host, { metrics: {}, token: api_token, connected: true });
        res.json({ status: 'connected', agent: host });
    });
    app.post('/api/agent/command', (req, res) => {
        res.json({ status: 'queued', payload: req.body });
    });
    app.post('/api/admin/login', async (req, res) => {
        const { username, password } = req.body;
        const admin = (0, admin_1.loadAdmin)();
        if (!admin) {
            return res.json({ error: 'no_admin' });
        }
        try {
            const match = await bcrypt.compare(password, admin.password);
            if (match && username === admin.username) {
                // Create session
                adminSession = crypto.randomBytes(16).toString('hex');
                return res.json({ status: 'ok', session: adminSession });
            }
        }
        catch (err) {
            console.error('Login error:', err);
        }
        res.json({ error: 'invalid_credentials' });
    });
    app.post('/api/admin/token', (req, res) => {
        const { session, name } = req.body;
        if (!session || session !== adminSession) {
            return res.json({ error: 'unauthorized' });
        }
        const tokenName = name || 'node';
        const token = crypto.randomBytes(16).toString('hex');
        tokens[tokenName] = token;
        (0, tokens_1.saveToken)(tokens);
        res.json({ status: 'created', name: tokenName, token });
    });
    // Serve static files from public/
    const publicDir = path.join(process.cwd(), 'public');
    if (fs.existsSync(publicDir)) {
        app.use(express_1.default.static(publicDir));
    }
    // Start server
    server.listen(config.port, () => {
        console.log(`Server listening on http://0.0.0.0:${config.port}`);
        console.log(`WebSocket available at ws://0.0.0.0:${config.port}/api/live`);
    });
}
