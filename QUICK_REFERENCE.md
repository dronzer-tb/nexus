# 🚀 Nexus Quick Reference Card

## Installation

```bash
# ONE-LINER (Fastest) ⚡
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/nexus/main/quick-install.sh | bash

# Or automated installer
git clone https://github.com/dronzer-tb/nexus.git
cd nexus
./install.sh

# Or manual setup
npm run setup
```

## Running Modes

```bash
# Combine Mode (monitors local machine + dashboard)
npm run start:combine
# Dashboard: http://localhost:8080

# Server Mode (dashboard only)
npm run start:server

# Node Mode (metrics collection only)
npm run start:node
```

## Docker Quick Start

```bash
# Simple (Combine Mode)
docker-compose -f docker-compose.simple.yml up -d

# Full Setup (Server + Nodes)
docker-compose up -d

# Manual Run
docker build -t nexus .
docker run -d -p 8080:8080 nexus --mode=combine
```

## Configuration

Edit `config/config.json`:
```json
{
  "server": {
    "port": 8080,
    "host": "0.0.0.0"
  },
  "node": {
    "serverUrl": "http://your-server:8080",
    "reportInterval": 5000
  }
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/nodes/register` | POST | Register/update node |
| `/api/nodes` | GET | List all nodes |
| `/api/nodes/:id` | GET | Get specific node |
| `/api/nodes/:id` | DELETE | Delete node |
| `/api/metrics` | POST | Submit metrics |
| `/api/metrics/:id/latest` | GET | Get latest metrics |
| `/health` | GET | Health check |

## WebSocket Events

### Client → Server
- `subscribe:node` - Subscribe to node updates
- `unsubscribe:node` - Unsubscribe from node
- `request:nodes` - Request all nodes
- `request:metrics` - Request metrics

### Server → Client
- `nodes:update` - Node list update
- `node:status` - Node status change
- `metrics:update` - Metrics update
- `metrics:new` - New metrics broadcast

## Common Commands

```bash
# Development
npm run dev              # Backend with auto-reload
cd dashboard && npm run dev  # Frontend dev server

# Build
npm run build:dashboard  # Build React dashboard

# Logs
tail -f data/nexus.log   # View logs

# Docker
docker logs -f nexus     # View container logs
docker exec -it nexus sh # Shell into container
```

## File Locations

```
├── config/config.json        # Configuration
├── data/nexus.db            # SQLite database
├── data/nexus.log           # Log file
├── data/node-info.json      # Node credentials
└── dashboard/build/         # Built dashboard
```

## Environment Variables

```bash
SERVER_PORT=8080
SERVER_URL=http://localhost:8080
NODE_ENV=production
LOG_LEVEL=info
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Dashboard not loading | `npm run build:dashboard` |
| Node can't connect | Check `serverUrl` in config |
| Database locked | Close all connections, restart |
| Port in use | Change port in config |
| Docker build fails | Check Dockerfile, rebuild |

## Metrics Collected

- **CPU:** Usage %, per-core, temperature
- **Memory:** Total, used, free, available
- **Swap:** Total, used, free
- **Disk:** All filesystems, usage %
- **Network:** All interfaces, RX/TX
- **Processes:** Top 10 by CPU

## Security

```bash
# Change JWT secret
# Edit config/config.json
"jwtSecret": "your-secure-secret"

# API Key stored in
data/node-info.json

# Enable HTTPS
"security": {
  "enableHttps": true,
  "certPath": "/path/to/cert.pem",
  "keyPath": "/path/to/key.pem"
}
```

## Default Ports

- **Dashboard/API:** 8080
- **Frontend Dev:** 3000 (development only)

## Quick Health Check

```bash
# Backend
curl http://localhost:8080/health

# Get nodes
curl http://localhost:8080/api/nodes

# Test WebSocket
# Open browser console at http://localhost:8080
# Type: io().on('connect', () => console.log('Connected!'))
```

## Resources

- **Docs:** README.md, DEVELOPMENT.md
- **Summary:** PROJECT_SUMMARY.md
- **Checklist:** CHECKLIST.md
- **License:** MIT (see LICENSE)

## Support

- Open issue on GitHub
- Check troubleshooting section
- Review logs in `data/nexus.log`

---

**Nexus v1.0.0** | **Dronzer Studios** | **MIT License**

Dashboard: http://localhost:8080
