import express, { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import { Config } from './config';
import { loadAdmin, AdminUser } from './db/admin';
import { loadTokens, saveToken, TokenStore } from './db/tokens';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

interface AgentMetrics {
  hostname?: string;
  cpu_percent?: number;
  memory?: any;
  disk?: any;
  network?: any;
  processes?: any[];
}

interface AgentData {
  metrics: AgentMetrics;
  token?: string;
  connected?: boolean;
}

const AGENTS: Map<string, AgentData> = new Map();
const LIVE_WS: Set<WebSocket> = new Set();
let adminSession: string | null = null;

export async function startServer(config: Config): Promise<void> {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/api/live' });

  // WebSocket connection handler
  wss.on('connection', (ws: WebSocket) => {
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
  function broadcast(event: any) {
    const payload = JSON.stringify(event);
    const toRemove: WebSocket[] = [];
    
    LIVE_WS.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(payload);
        } catch (err) {
          toRemove.push(ws);
        }
      } else {
        toRemove.push(ws);
      }
    });

    toRemove.forEach(ws => LIVE_WS.delete(ws));
  }

  // Load tokens
  const tokens: TokenStore = loadTokens();

  // API Routes
  app.post('/api/agent/update', (req: Request, res: Response) => {
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

  app.get('/api/agent/list', (req: Request, res: Response) => {
    res.json({ agents: Array.from(AGENTS.keys()) });
  });

  app.get('/api/agent/:id', (req: Request, res: Response) => {
    const agent = AGENTS.get(req.params.id);
    if (!agent) {
      return res.json({ error: 'not_found' });
    }
    res.json(agent);
  });

  app.post('/api/agent/connect', (req: Request, res: Response) => {
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

  app.post('/api/agent/command', (req: Request, res: Response) => {
    res.json({ status: 'queued', payload: req.body });
  });

  app.post('/api/admin/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const admin: AdminUser | null = loadAdmin();

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
    } catch (err) {
      console.error('Login error:', err);
    }

    res.json({ error: 'invalid_credentials' });
  });

  app.post('/api/admin/token', (req: Request, res: Response) => {
    const { session, name } = req.body;

    if (!session || session !== adminSession) {
      return res.json({ error: 'unauthorized' });
    }

    const tokenName = name || 'node';
    const token = crypto.randomBytes(16).toString('hex');
    tokens[tokenName] = token;
    saveToken(tokens);

    res.json({ status: 'created', name: tokenName, token });
  });

  // Serve static files from public/
  const publicDir = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  // Start server
  server.listen(config.port, () => {
    console.log(`Server listening on http://0.0.0.0:${config.port}`);
    console.log(`WebSocket available at ws://0.0.0.0:${config.port}/api/live`);
  });
}
