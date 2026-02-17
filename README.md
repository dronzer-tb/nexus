# 🚀 Nexus

<div align="center">

**Unified, Self-Hosted Remote Resource Monitoring and Management Platform**

*by Dronzer Studios*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Version](https://img.shields.io/badge/version-2.1.0--beta-purple)](https://github.com/dronzer-tb/nexus/releases)

</div>

---

## 📋 Overview

**Nexus** is a self-hosted monitoring platform that lets you track and manage multiple servers, VPSs, and local systems from one centralized web dashboard. Built with Node.js and React, it provides real-time system metrics, process monitoring, SSH terminal access, and live visualizations — with a companion mobile app for monitoring on the go.

### ✨ Features

- 🖥️ **Real-time Monitoring** — CPU, RAM, Disk, Swap, Network metrics
- 📊 **Live Charts** — Visualizations powered by Chart.js
- 🔄 **WebSocket Updates** — Instant metrics without page refresh
- 🎯 **Three Modes** — Node, Server, or Combine
- 🔒 **Mandatory 2FA** — TOTP-based two-factor authentication with recovery codes
- 📋 **Audit Logging** — Comprehensive security audit trail with 90-day retention
- 💻 **SSH Terminal** — Built-in web terminal for remote command execution
- 🌐 **Reverse SSH Tunnels** — Access nodes behind NAT/firewalls
- 📱 **Mobile App** — React Native companion app with QR pairing
- 🎨 **Modern UI** — Dark-themed React dashboard with TailwindCSS (brutal theme)
- 👥 **User Management** — Role-based access control (admin, viewer, operator)
- 🛡️ **Console 2FA Gate** — Mandatory 2FA verification before remote command execution
- 🔑 **API Key Auth** — Secure node-to-server communication
- 🐳 **Docker Support** — Run Nexus in containers with Docker Compose
- 🔗 **Native Tailscale** — Zero-config networking as an alternative to nginx
- 🤖 **Discord Bot Alerts** — Direct DM notifications via a Discord bot
- ⚙️ **Per-Node Alert Thresholds** — Independent CPU/memory/disk thresholds per node
- 🔔 **Interactive Alert Actions** — False Alarm & Tail buttons on Discord alert notifications
- 📡 **Live Tail** — Real-time process & metrics stream direct to Discord DMs
- 📱 **Responsive Dashboard** — Fully adaptive layout with mobile drawer navigation

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **npm**
- **OpenSSH** (for SSH terminal features)

### Interactive Setup (Recommended)

```bash
git clone https://github.com/dronzer-tb/nexus.git
cd nexus
./setup.sh
```

The TUI setup wizard walks you through dependency installation, dashboard build, admin account creation, 2FA setup, and mode selection — all in one step. All options are presented inside styled boxes with back-button navigation and a progress bar.

Use `./setup.sh --bypass-mode` to run the installer in bypass mode (red-themed TUI).

### Manual Setup

```bash
npm run setup              # install deps + build frontend
npm run start:combine      # start server + local monitoring
```

Visit **http://localhost:8080** and log in with the admin credentials created during setup.

### Docker

```bash
# Build and run with Docker Compose
docker compose up -d

# Or build manually
docker build -t nexus .
docker run -d -p 8080:8080 -v nexus-data:/app/data -v nexus-config:/app/config nexus
```

Environment variables for Docker: `NEXUS_MODE`, `NEXUS_PORT`, `DISCORD_BOT_TOKEN`, `DISCORD_USER_ID`, `TAILSCALE_API_KEY`, `TAILSCALE_TAILNET`.

---

## 🧩 Operating Modes

| Mode | Command | Description |
|------|---------|-------------|
| **Combine** | `npm run start:combine` | Server + monitors the local machine. Best for single-machine setups. |
| **Server** | `npm run start:server` | Dashboard & API only. Receives metrics from remote nodes. |
| **Node** | `npm run start:node` | Lightweight reporter. Sends metrics to a Nexus server. |
| **Dev** | `npm run dev` | Combine mode with auto-restart via nodemon. |

---

## 🔗 Tailscale Integration

Nexus natively supports **Tailscale** as an alternative to nginx for accessing your dashboard securely without port forwarding or reverse proxies.

- Automatically detects if Tailscale is installed and connected
- Uses Tailscale IP for dashboard access across your tailnet
- Optional Tailscale API integration for device management
- Configure during setup (Step 4) or via the API at `/api/tailscale`

---

## 🤖 Discord Bot Alerts

Nexus sends alert notifications directly to your Discord DMs via a bot — no webhooks needed.

### Setup
1. Create a bot at [Discord Developer Portal](https://discord.com/developers/applications)
2. Enable **Message Content Intent** under Privileged Gateway Intents
3. Invite the bot to a server you share
4. Enter the bot token and your Discord User ID during onboarding or in Settings

### Per-Node Alert Thresholds

Each node can have its own alert settings (CPU, memory, disk thresholds) that override the global defaults. Nodes without custom settings fall back to global thresholds.

Manage per-node alerts via the API:
```
GET    /api/alerts/node/:nodeId     — Get node alert settings
POST   /api/alerts/node/:nodeId     — Set node alert settings
DELETE /api/alerts/node/:nodeId     — Reset to global defaults
GET    /api/alerts/nodes/all        — List all per-node overrides
```

---

## 📱 Mobile App

Nexus includes a **React Native (Expo)** companion app for iOS and Android.

### Features
- QR code pairing with your Nexus server
- Real-time node monitoring and metrics
- Push notifications for alerts
- Secure 2FA authentication flow

### Setup
```bash
cd nexus-mobile
npm install
npx expo start
```

Pair your device by scanning the QR code displayed on the server's **Mobile Pairing** page.

See [nexus-mobile/README.md](nexus-mobile/README.md) for full details.

---

## 🔐 Security

### Two-Factor Authentication (2FA)
- **Mandatory TOTP** — All users must configure an authenticator app (Google Authenticator, Authy, etc.)
- **Recovery codes** — One-time backup codes generated at setup
- **Console 2FA Gate** — Additional verification required before executing remote commands
- **Rate limiting** — Max 3 failed 2FA attempts before lockout

### Audit Logging
- All security events (logins, 2FA verifications, command executions) are logged
- Query logs via `GET /api/audit/logs` with filters by event type, user, or time range
- Automatic 90-day retention with manual cleanup via `POST /api/audit/clean`

### SSH Terminal
- Auto-generated SSH keypairs for secure connections
- Web-based terminal with xterm.js
- Command execution logging and audit trail

### Reverse SSH Tunnels
- Access nodes behind NAT, firewalls, or CGNAT
- Automatic tunnel establishment and reconnection

### General
- Change the default `jwtSecret` before deploying publicly
- Use HTTPS for internet-facing servers
- Keep node API keys secure; rotate them periodically
- Firewall your server port if not public

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
│   ├── index.js              # Entry point
│   ├── modes/                # node.js, server.js, combine.js
│   ├── api/
│   │   ├── routes/           # auth, nodes, metrics, console, mobile,
│   │   │                     # audit, alerts, onboarding, tailscale
│   │   ├── ssh-terminal.js   # SSH terminal handler
│   │   └── websocket.js      # WebSocket handler
│   ├── middleware/            # JWT auth middleware
│   └── utils/                # config, database, logger, metrics, auth,
│                             # audit, totp, alerts, discord-bot, tailscale,
│                             # reverse-ssh-tunnel, etc.
├── dashboard/                # React + Vite + TailwindCSS frontend
│   ├── src/
│   │   ├── pages/            # Overview, Console, Settings, MobilePairing,
│   │   │                     # Onboarding, AgentDetails, Logs, etc.
│   │   ├── components/       # TerminalWidget, TwoFactorSettings, etc.
│   │   └── context/          # AuthContext, ThemeContext
│   └── package.json
├── nexus-mobile/             # React Native (Expo) mobile app
│   ├── src/
│   │   ├── screens/          # Login, Dashboard, NodeDetails, TwoFactor, etc.
│   │   ├── api.js            # Server communication
│   │   └── theme.js          # App theming
│   └── package.json
├── config/
│   └── config.default.json
├── Dockerfile                # Multi-stage Docker build
├── docker-compose.yml        # Docker Compose config
├── docker-entrypoint.sh      # Container entrypoint
├── setup.sh                  # TUI setup wizard
└── package.json
```

---

## 📡 API Reference

### Authentication
```
POST /api/auth/login          — Login with username/password
POST /api/auth/verify-2fa     — Verify TOTP code (with purpose tracking)
POST /api/auth/setup-2fa      — Initialize 2FA for a user
```

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

### Alerts & Discord Bot
```
GET  /api/alerts/discord/status    — Discord bot connection status
POST /api/alerts/discord/settings  — Update bot token & user ID
POST /api/alerts/discord/test      — Send a test DM
GET  /api/alerts/active            — List active alerts
GET  /api/alerts/node/:nodeId      — Get per-node alert settings
POST /api/alerts/node/:nodeId      — Set per-node alert thresholds
DELETE /api/alerts/node/:nodeId    — Reset node to global defaults
GET  /api/alerts/nodes/all         — List all per-node overrides
```

### Tailscale
```
GET  /api/tailscale/status         — Tailscale connection status & IP
POST /api/tailscale/settings       — Save Tailscale API config
POST /api/tailscale/connect        — Start Tailscale
POST /api/tailscale/disconnect     — Stop Tailscale
GET  /api/tailscale/devices        — List tailnet devices
POST /api/tailscale/auth-key       — Generate auth key
GET  /api/tailscale/nexus-url      — Get Nexus URL via Tailscale IP
```

### Console
```
POST /api/console/execute     — Execute command on a node (requires 2FA)
```

### Mobile Pairing
```
POST /api/mobile/pair         — Initiate device pairing via QR code
POST /api/mobile/complete     — Complete pairing with 2FA verification
```

### Audit
```
GET  /api/audit/logs          — Query audit logs (with filters)
POST /api/audit/clean         — Clean old audit logs (admin only)
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

# Mobile app
cd nexus-mobile
npm install
npx expo start             # Expo dev server
```

---

## 📊 System Requirements

| Role | CPU | RAM | Disk |
|------|-----|-----|------|
| **Node** (reporter) | Minimal (~1-2%) | 50–100 MB | 10 MB |
| **Server / Combine** | 1 core | 256 MB+ | 100 MB+ |

Supported on Linux, macOS, and Windows.

---

## 🐛 Troubleshooting

| Problem | Fix |
|---------|-----|
| Node can't connect | Check `serverUrl` in config, verify server is reachable |
| Bash `event not found` | Use single quotes around `node -e '...'` commands (double quotes trigger `!` history expansion) |
| Dashboard blank | Run `npm run build:dashboard`, check browser console |
| Database errors | Ensure `data/` directory is writable |
| 2FA not working | Ensure system clock is synchronized (TOTP is time-based) |
| SSH terminal won't connect | Check OpenSSH is installed, verify SSH keys in `data/` |
| Mobile app can't pair | Ensure phone and server are on same network, check firewall |

---

## 📝 Changelog

- **v2.1.0-beta** — Fully responsive dashboard (mobile drawer, adaptive grids, responsive typography), interactive Discord alert buttons (False Alarm / Tail), live tail metrics stream to DMs, top-process info in alert notifications
- **v2.0.0-pre-release** — Native Tailscale support, Docker image, TUI revamp (box layout, back button, progress bar, `--bypass-mode`), per-node alert thresholds, Discord bot replaces webhooks in onboarding, repo cleanup
- **v1.9.6** — SSH terminal, TUI setup script, reverse SSH tunnels, mobile app pairing, console fixes for combine mode
- **v1.9.5** — Mandatory 2FA, audit logging, console 2FA gate, enhanced auth system
- **v1.9.1** — API key authentication, role-based access control

---

## 📄 License

AGPL — see [LICENSE](LICENSE).

---

<div align="center">

**Made with ❤️ by Dronzer Studios**

</div>
