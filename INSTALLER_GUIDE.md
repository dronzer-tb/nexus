# Nexus Installer Guide

## Quick Installation

### One-Command Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/nexus/main/quick-install.sh | bash
```

This will:
1. Clone the Nexus repository
2. Run the automated installer
3. Ask you to choose your installation mode
4. Install only what's needed for your chosen mode

### Manual Installation

If you already have the repository:

```bash
git clone https://github.com/dronzer-tb/nexus.git
cd nexus
./install.sh
```

## Installation Modes

During installation, you'll be asked to choose one of three modes:

### 1. Combine Mode (Recommended for Testing)

**What it does:**
- Monitors the local machine (agent)
- Runs the web dashboard (server)
- Perfect for testing or single-machine monitoring

**Installs:**
- ✅ Backend dependencies
- ✅ Frontend dependencies
- ✅ Builds dashboard
- ✅ Creates configuration

**Start Command:**
```bash
npm run start:combine
```

**Access Dashboard:**
- URL: `http://localhost:8080`
- Default credentials: `admin` / `admin123`

---

### 2. Server Mode (For Central Management)

**What it does:**
- Runs the web dashboard only
- Receives data from remote agents
- Perfect for central monitoring server

**Installs:**
- ✅ Backend dependencies
- ✅ Frontend dependencies
- ✅ Builds dashboard
- ✅ Creates configuration

**Start Command:**
```bash
npm run start:server
```

**Access Dashboard:**
- URL: `http://localhost:8080`
- Default credentials: `admin` / `admin123`

---

### 3. Node Mode (Agent Only)

**What it does:**
- Monitors the local machine only
- Sends data to a remote server
- No web interface
- Perfect for lightweight monitoring agents

**Installs:**
- ✅ Backend dependencies only
- ❌ Skips frontend (saves time!)
- ❌ Skips dashboard build (saves time!)
- ✅ Creates configuration

**Start Command:**
```bash
npm run start:node
```

**Configuration Required:**
Edit `config/config.json` to set the server URL:
```json
{
  "node": {
    "serverUrl": "http://your-server:8080"
  }
}
```

---

## Installation Process

1. **Prerequisites Check**
   - Verifies Node.js 18+ is installed
   - Verifies npm is available
   - Checks for Docker (optional)

2. **Mode Selection**
   - Interactive prompt to choose mode
   - Determines what to install

3. **Backend Installation**
   - Installs Node.js dependencies
   - Always installed for all modes

4. **Frontend Installation** (Conditional)
   - Only for Combine & Server modes
   - Skipped for Node mode

5. **Dashboard Build** (Conditional)
   - Only for Combine & Server modes
   - Skipped for Node mode
   - Takes 1-2 minutes

6. **Configuration**
   - Creates data directories
   - Generates default config file

7. **Summary & Start**
   - Shows mode-specific instructions
   - Option to start immediately

## Time Savings

### Node Mode Installation:
- **Without optimization:** ~5-7 minutes
- **With optimization:** ~2-3 minutes
- **Saves:** ~3-4 minutes (skips 200+ frontend packages + build)

### Combine/Server Mode:
- **Full installation:** ~5-7 minutes
- Includes everything needed for the dashboard

## Post-Installation

### Switching Modes

You can run any mode at any time:

```bash
# Combine mode
npm run start:combine

# Server mode
npm run start:server

# Node mode
npm run start:node
```

### Installing Dashboard Later

If you installed in Node mode but want to add the dashboard:

```bash
cd dashboard
npm install
npm run build
cd ..
npm run start:combine  # or start:server
```

## Troubleshooting

### Dashboard Not Found

If you see "Dashboard not found" error:

```bash
# Rebuild the dashboard
npm run build:dashboard

# Then restart
npm run start:combine
```

### Import Path Errors

If you see "MODULE_NOT_FOUND" errors:

```bash
# Pull latest fixes
git pull origin main

# Reinstall dependencies
npm install

# Restart
npm run start:combine
```

## System Requirements

### Minimum:
- **OS:** Linux, macOS, or Windows
- **Node.js:** 18.0.0 or higher
- **RAM:** 512MB
- **Disk:** 500MB free space

### Recommended:
- **OS:** Ubuntu 20.04+, macOS 12+, Windows 10+
- **Node.js:** 18.20.0 or higher
- **RAM:** 1GB
- **Disk:** 1GB free space

## Default Ports

- **Dashboard/API:** 8080
- **WebSocket:** 8080 (same port)

To change ports, edit `config/config.json`:
```json
{
  "server": {
    "port": 8080,
    "host": "0.0.0.0"
  }
}
```

## Security Notes

### Default Credentials

⚠️ **Change the default password immediately!**

Default credentials:
- Username: `admin`
- Password: `admin123`

Change password after first login through the dashboard settings.

### API Keys

Each node generates a unique API key on first run. Keep this safe!

Location: `data/node-credentials.json`

## Getting Help

- **Documentation:** See `README.md` and `QUICK_REFERENCE.md`
- **Issues:** https://github.com/dronzer-tb/nexus/issues
- **Development:** See `DEVELOPMENT.md`

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run start:combine` | Start combine mode |
| `npm run start:server` | Start server mode |
| `npm run start:node` | Start node mode |
| `npm run build:dashboard` | Rebuild dashboard |
| `npm run dev` | Development mode |

---

**Made with ❤️ by Dronzer Studios**
