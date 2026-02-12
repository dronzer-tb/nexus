# 🚀 Nexus

<div align="center">

**Unified, Self-Hosted Remote Resource Monitoring and Management Platform**

*by Dronzer Studios*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

</div>

---

## 📋 Overview

**Nexus** is a self-hosted monitoring platform that lets you track and manage multiple servers, VPSs, and local systems from one centralized web dashboard. Built with Node.js and React, it provides real-time system metrics, process monitoring, and live visualizations.

### ✨ Features

- 🖥️ **Real-time Monitoring** — CPU, RAM, Disk, Swap, Network metrics
- 📊 **Live Charts** — Visualizations powered by Chart.js
- 🔄 **WebSocket Updates** — Instant metrics without page refresh
- 🎯 **Three Modes** — Node, Server, or Combine
- 🔒 **Simple Security** — API key authentication for nodes (v1.9.1+)
- 🔐 **Flexible Auth** — Legacy JWT + API keys for backward compatibility
- 💻 **Modern UI** — Dark-themed React dashboard with TailwindCSS
- 📱 **Responsive** — Desktop, tablet, and mobile
- 👥 **User Management** — Role-based access control (admin, viewer, operator)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **npm**

### Setup

```bash
git clone https://github.com/dronzer-tb/nexus.git
cd nexus
./setup.sh
```

The setup script will install all dependencies, build the dashboard, and let you pick a startup mode.

Or do it manually:

```bash
npm run setup              # install deps + build frontend
npm run start:combine      # start server + local monitoring
```

Visit **http://localhost:8080** — direct access to dashboard (no login required).

---

## 🧩 Operating Modes

| Mode | Command | Description |
|------|---------|-------------|
| **Combine** | `npm run start:combine` | Server + monitors the local machine. Best for single-machine setups. |
| **Server** | `npm run start:server` | Dashboard & API only. Receives metrics from remote nodes. |
| **Node** | `npm run start:node` | Lightweight reporter. Sends metrics to a Nexus server. |
| **Dev** | `npm run dev` | Combine mode with auto-restart via nodemon. |

---

## 📖 Configuration

Configuration lives in `config/config.json` (auto-created on first run from `config.default.json`):

```json
{
  "server": {
    "port": 8080,
    "host": "0.0.0.0",
    "jwtSecret": "change-this-secret-in-production"
  },
  "node": {
    "serverUrl": "http://localhost:8080",
    "reportInterval": 5000
  },
  "database": { "path": "./data/nexus.db" },
  "logging":  { "level": "info", "file": "./data/nexus.log" }
}
```

Environment variables (`SERVER_PORT`, `SERVER_URL`, `NODE_ENV`) can override config values.

---

## 🏗️ Project Structure

```
nexus/
├── src/
│   ├── index.js            # Entry point
│   ├── modes/              # node.js, server.js, combine.js
│   ├── api/
│   │   ├── routes/         # auth, nodes, metrics, agents, etc.
│   │   └── websocket.js    # WebSocket handler
│   ├── middleware/          # JWT auth middleware
│   └── utils/              # config, database, logger, metrics, auth
├── dashboard/              # React + Vite + TailwindCSS frontend
│   ├── src/
│   │   ├── pages/          # Overview, AgentDetails, Logs, etc.
│   │   ├── components/     # AgentCard, MetricsChart, Sidebar, etc.
│   │   └── context/        # AuthContext
│   └── package.json
├── config/
│   └── config.default.json
├── setup.sh                # One-command setup script
└── package.json
```

---

## 📡 API Reference

### Authentication

**API Key Only (v1.9.1+):**
```
All API requests require X-API-Key header
X-API-Key: your-api-key
```

No user login - Dashboard has direct access. API keys are for node-to-server communication only.

### Nodes
```
POST /api/nodes/register      X-API-Key header  — register/reconnect a node
GET  /api/nodes               — list all nodes (with latest metrics)
GET  /api/nodes/:nodeId       — single node details
DELETE /api/nodes/:nodeId     — remove a node
```

### Metrics
```
POST /api/metrics             X-API-Key header  — submit metrics from a node
GET  /api/metrics/:nodeId/latest?limit=100
GET  /api/metrics/:nodeId/range?start=<ts>&end=<ts>
```

### WebSocket Events

| Direction | Event | Description |
|-----------|-------|-------------|
| Server → Client | `nodes:update` | All nodes with current metrics |
| Server → Client | `node:status` | Online/offline status change |
| Server → Client | `metrics:update` | Metrics for a subscribed node |
| Server → Client | `metrics:new` | New metrics broadcast |

---

## 🔧 Development

```bash
# Backend
npm install
npm run dev                # combine mode with nodemon

# Frontend (separate terminal)
cd dashboard
npm install
npm run dev                # Vite dev server on :3000, proxies to :8080
```

---

## 📊 System Requirements

| Role | CPU | RAM | Disk |
|------|-----|-----|------|
| **Node** (reporter) | Minimal (~1-2%) | 50–100 MB | 10 MB |
| **Server / Combine** | 1 core | 256 MB+ | 100 MB+ |

Supported on Linux, macOS, and Windows.

---

## 🔒 Security Notes

- Change the default `jwtSecret` before deploying publicly
- Use HTTPS for internet-facing servers
- Keep node API keys secure; rotate them periodically
- Firewall your server port if not public

---

## 🐛 Troubleshooting

| Problem | Fix |
|---------|-----|
| Node can't connect | Check `serverUrl` in config, verify server is reachable |
| Dashboard blank | Run `npm run build:dashboard`, check browser console |
| Database errors | Ensure `data/` directory is writable |

---

## 📄 License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

**Made with ❤️ by Dronzer Studios**

</div>
