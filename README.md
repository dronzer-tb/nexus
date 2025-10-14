# 🚀 Nexus

<div align="center">

**Unified, Self-Hosted Remote Resource Monitoring and Management Platform**

*by Dronzer Studios*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://www.docker.com/)

</div>

---

## 📋 Overview

**Nexus** is a powerful, self-hosted monitoring solution that enables you to track and manage multiple servers, VPSs, and local systems from a single, centralized web dashboard. Built with Node.js and React, Nexus provides real-time system metrics, process management, and intuitive visualizations.

### ✨ Key Features

- 🖥️ **Real-time System Monitoring** - CPU, RAM, Disk, Swap, Network metrics
- 📊 **Live Charts & Graphs** - Beautiful visualizations powered by Chart.js
- 🔄 **WebSocket Updates** - Instant metric updates without page refresh
- 🎯 **Multiple Operating Modes** - Node, Server, or Combine
- 🐳 **Docker Ready** - Full containerization support
- 🔒 **Secure API** - API key authentication for node communication
- 💻 **Modern UI** - Dark-themed dashboard with TailwindCSS
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile

---

## 🧩 Operating Modes

Nexus can run in three distinct modes depending on your deployment needs:

### 1️⃣ **Node Mode** (`--mode=node`)

Deploy on remote machines to collect and report system metrics to a Nexus server.

**Features:**
- Collects system metrics every 5 seconds
- Reports to configured Nexus server via HTTPS
- Generates unique API key on first run
- Lightweight and minimal resource usage
- Auto-reconnects if server is temporarily unavailable

**Use Case:** Install on VPSs, remote servers, or any machine you want to monitor.

```bash
# Start in node mode
npm run start:node

# Or with Docker
docker run -d dronzer/nexus --mode=node
```

---

### 2️⃣ **Server Mode** (`--mode=server`)

Hosts the web dashboard and receives metrics from connected nodes.

**Features:**
- Web dashboard on port 8080
- REST API for node registration and metrics
- WebSocket server for real-time updates
- SQLite database for persistent storage
- Node management and monitoring

**Use Case:** Central monitoring server that aggregates data from all nodes.

```bash
# Start in server mode
npm run start:server

# Or with Docker
docker run -d -p 8080:8080 dronzer/nexus --mode=server
```

---

### 3️⃣ **Combine Mode** (`--mode=combine`)

Runs both Node and Server components together in a single instance.

**Features:**
- All server features
- Monitors the local machine
- Perfect for single-machine monitoring
- Simplest setup

**Use Case:** Monitor a single machine with its own dashboard.

```bash
# Start in combine mode
npm run start:combine

# Or with Docker
docker run -d -p 8080:8080 dronzer/nexus --mode=combine
```

---

## 🚀 Quick Start

### ⚡ Fastest Way to Install (One-Liner)

```bash
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/nexus/main/quick-install.sh | bash
```

This will automatically clone, install, and set up everything for you!

---

### Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** or **yarn**
- **Docker** (optional, for containerized deployment)

### Installation

#### Option 1: Automated Installation Script ⚡ (Recommended)

```bash
# Clone and install everything automatically
git clone https://github.com/dronzer-tb/nexus.git
cd nexus
./install.sh
```

The installer will:
- ✅ Check prerequisites
- ✅ Install all dependencies
- ✅ Build the dashboard
- ✅ Configure the system
- ✅ Optionally start Nexus immediately

**That's it!** Visit `http://localhost:8080` to access the dashboard.

#### Option 2: Manual Installation

```bash
# Clone the repository
git clone https://github.com/dronzer-tb/nexus.git
cd nexus

# Install dependencies (backend + frontend)
npm run setup

# Start in combine mode (easiest for testing)
npm run start:combine
```

Visit `http://localhost:8080` to access the dashboard.

#### Option 3: Docker

```bash
# Clone the repository
git clone https://github.com/dronzer-tb/nexus.git
cd nexus

# Build the Docker image
docker build -t nexus .

# Run in combine mode
docker run -d -p 8080:8080 --name nexus nexus

# Or use docker-compose
docker-compose -f docker-compose.simple.yml up -d
```

---

## 📖 Configuration

### Configuration File

The main configuration is in `config/config.json` (auto-created from `config.default.json`):

```json
{
  "server": {
    "port": 8080,
    "host": "0.0.0.0",
    "jwtSecret": "change-this-secret-in-production"
  },
  "node": {
    "serverUrl": "http://localhost:8080",
    "reportInterval": 5000,
    "hostname": ""
  },
  "database": {
    "path": "./data/nexus.db"
  },
  "logging": {
    "level": "info",
    "file": "./data/nexus.log"
  }
}
```

### Environment Variables

You can override configuration with environment variables:

- `SERVER_PORT` - Server port (default: 8080)
- `SERVER_URL` - Server URL for nodes to connect to
- `NODE_ENV` - Environment (production/development)

---

## 🏗️ Architecture

```
nexus/
├── src/
│   ├── modes/              # Operating mode implementations
│   │   ├── node.js         # Node mode - metrics collection
│   │   ├── server.js       # Server mode - API & dashboard
│   │   └── combine.js      # Combine mode - both together
│   ├── api/
│   │   ├── routes/         # API route handlers
│   │   │   ├── nodes.js    # Node registration & management
│   │   │   └── metrics.js  # Metrics endpoints
│   │   └── websocket.js    # WebSocket handler
│   ├── utils/
│   │   ├── logger.js       # Winston logging
│   │   ├── metrics.js      # System metrics collector
│   │   ├── auth.js         # Authentication utilities
│   │   ├── config.js       # Configuration loader
│   │   └── database.js     # SQLite database manager
│   └── index.js            # Main entry point
├── dashboard/              # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── App.jsx         # Main app component
│   │   └── main.jsx        # React entry point
│   └── package.json
├── config/
│   └── config.default.json # Default configuration
├── Dockerfile              # Multi-stage Docker build
├── docker-compose.yml      # Docker Compose configuration
└── package.json
```

---

## 📡 API Reference

### Node Endpoints

#### Register/Update Node
```http
POST /api/nodes/register
Headers: X-API-Key: <api_key>
Body: {
  "nodeId": "node_xxx",
  "hostname": "my-server",
  "systemInfo": {...}
}
```

#### Get All Nodes
```http
GET /api/nodes
```

#### Get Specific Node
```http
GET /api/nodes/:nodeId
```

#### Delete Node
```http
DELETE /api/nodes/:nodeId
```

### Metrics Endpoints

#### Submit Metrics
```http
POST /api/metrics
Headers: X-API-Key: <api_key>
Body: {
  "nodeId": "node_xxx",
  "metrics": {...}
}
```

#### Get Latest Metrics
```http
GET /api/metrics/:nodeId/latest?limit=100
```

#### Get Metrics in Time Range
```http
GET /api/metrics/:nodeId/range?start=<timestamp>&end=<timestamp>
```

### WebSocket Events

**Client → Server:**
- `subscribe:node` - Subscribe to node updates
- `unsubscribe:node` - Unsubscribe from node
- `request:nodes` - Request all nodes
- `request:metrics` - Request node metrics

**Server → Client:**
- `nodes:update` - All nodes update
- `node:status` - Node status change
- `metrics:update` - Metrics update for subscribed node
- `metrics:new` - New metrics broadcast

---

## 🐳 Docker Deployment

### Build Image

```bash
docker build -t dronzer/nexus .
```

### Run Modes

**Combine Mode (Single Machine):**
```bash
docker run -d \
  --name nexus \
  -p 8080:8080 \
  -v nexus-data:/app/data \
  dronzer/nexus --mode=combine
```

**Server Mode:**
```bash
docker run -d \
  --name nexus-server \
  -p 8080:8080 \
  -v nexus-server-data:/app/data \
  dronzer/nexus --mode=server
```

**Node Mode:**
```bash
docker run -d \
  --name nexus-node \
  -v nexus-node-data:/app/data \
  -e SERVER_URL=http://nexus-server:8080 \
  dronzer/nexus --mode=node
```

### Docker Compose

**Simple Setup (Combine Mode):**
```bash
docker-compose -f docker-compose.simple.yml up -d
```

**Full Setup (Server + Nodes):**
```bash
docker-compose up -d
```

---

## 🎨 Dashboard Features

### Main Dashboard
- **Node Overview** - See all connected nodes at a glance
- **Status Indicators** - Real-time online/offline status
- **Quick Stats** - Total nodes, online/offline counts

### Node Details
- **Live Charts** - CPU, Memory, Swap usage over time
- **System Information** - OS, CPU, Memory details
- **Disk Usage** - All mounted filesystems
- **Process List** - Top processes by CPU usage
- **Network Stats** - Interface statistics

---

## 🔧 Development

### Setup Development Environment

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd dashboard
npm install
cd ..

# Start backend in development mode
npm run dev

# In another terminal, start frontend dev server
cd dashboard
npm run dev
```

The frontend dev server (port 3000) will proxy API calls to the backend (port 8080).

### Building

```bash
# Build frontend only
npm run build:dashboard

# Build Docker image
docker build -t nexus:dev .
```

---

## 📊 System Requirements

### Monitored Nodes (Node Mode)
- **CPU:** Any (minimal usage ~1-2%)
- **RAM:** 50-100 MB
- **Disk:** 10 MB
- **OS:** Linux, macOS, Windows

### Server (Server/Combine Mode)
- **CPU:** 1 core minimum
- **RAM:** 256 MB minimum (512 MB recommended)
- **Disk:** 100 MB + storage for metrics
- **OS:** Linux, macOS, Windows, or Docker

---

## 🔒 Security

- API key authentication for all node communications
- HTTPS support for encrypted transmission (configure in config)
- JWT tokens for future admin authentication
- API key hashing in database
- CORS and Helmet middleware for Express

### Best Practices
1. Change the default `jwtSecret` in production
2. Use HTTPS for public-facing deployments
3. Keep API keys secure and rotate regularly
4. Restrict server access with firewall rules
5. Run in Docker for isolation

---

## 🐛 Troubleshooting

### Node can't connect to server
- Check `serverUrl` in `config/config.json`
- Ensure server is running and accessible
- Check firewall rules
- Verify API key is correct

### Dashboard not loading
- Ensure dashboard was built: `npm run build:dashboard`
- Check browser console for errors
- Verify server is running on correct port

### Database errors
- Check write permissions for `data/` directory
- Ensure SQLite is installed (included with better-sqlite3)

### Docker issues
- Ensure ports are not already in use
- Check Docker logs: `docker logs nexus`
- Verify volume mounts have correct permissions

---

## 📝 Changelog

### Version 1.0.0
- Initial release
- Node, Server, and Combine modes
- Real-time metrics collection
- WebSocket live updates
- React + TailwindCSS dashboard
- Docker support
- SQLite storage

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [Node.js](https://nodejs.org/)
- Frontend powered by [React](https://reactjs.org/)
- Styling with [TailwindCSS](https://tailwindcss.com/)
- Charts by [Chart.js](https://www.chartjs.org/)
- System metrics via [systeminformation](https://github.com/sebhildebrandt/systeminformation)
- Real-time communication with [Socket.IO](https://socket.io/)

---

## 📧 Contact

**Dronzer Studios**

For questions, issues, or feature requests, please open an issue on GitHub.

---

<div align="center">

**Made with ❤️ by Dronzer Studios**

</div>
