# 📦 Nexus Installation Guide

Complete installation instructions for all deployment scenarios.

---

## ⚡ Quick Install (Recommended)

### Method 1: One-Liner Install

The fastest way to get started:

```bash
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/nexus/main/quick-install.sh | bash
```

**What it does:**
1. Clones the repository
2. Runs the automated installer
3. Installs all dependencies
4. Builds the dashboard
5. Asks if you want to start immediately

**Time:** ~3-5 minutes (depending on internet speed)

---

### Method 2: Automated Installer Script

If you prefer to clone first:

```bash
# Clone repository
git clone https://github.com/dronzer-tb/nexus.git
cd nexus

# Run automated installer
./install.sh
```

The installer performs:
- ✅ Prerequisites check (Node.js, npm)
- ✅ Backend dependency installation
- ✅ Frontend dependency installation
- ✅ Dashboard build
- ✅ Directory creation
- ✅ Configuration generation
- ✅ Optional Docker check
- ✅ Interactive start prompt

---

## 📋 Prerequisites

Before installing, ensure you have:

### Required
- **Node.js** 18.0.0 or higher ([Download](https://nodejs.org/))
- **npm** 8.0.0 or higher (comes with Node.js)
- **Git** (for cloning)

### Optional
- **Docker** 20.10+ (for containerized deployment)
- **docker-compose** 1.29+ (for orchestration)

### Check Versions
```bash
node --version    # Should be v18.0.0 or higher
npm --version     # Should be 8.0.0 or higher
git --version     # Any recent version
docker --version  # Optional
```

---

## 🔧 Manual Installation

If you prefer manual control:

### Step 1: Clone Repository
```bash
git clone https://github.com/dronzer-tb/nexus.git
cd nexus
```

### Step 2: Install Backend Dependencies
```bash
npm install
```

### Step 3: Install Frontend Dependencies
```bash
cd dashboard
npm install
cd ..
```

### Step 4: Build Dashboard
```bash
cd dashboard
npm run build
cd ..
```

### Step 5: Create Data Directories
```bash
mkdir -p data
mkdir -p config
```

### Step 6: Start Nexus
```bash
npm run start:combine
```

Visit `http://localhost:8080`

---

## 🐳 Docker Installation

### Quick Start with Docker

```bash
# Clone repository
git clone https://github.com/dronzer-tb/nexus.git
cd nexus

# Start with docker-compose (simplest)
docker-compose -f docker-compose.simple.yml up -d
```

Dashboard available at `http://localhost:8080`

### Build Docker Image Manually

```bash
# Build image
docker build -t dronzer/nexus .

# Run in combine mode
docker run -d \
  --name nexus \
  -p 8080:8080 \
  -v nexus-data:/app/data \
  dronzer/nexus --mode=combine

# View logs
docker logs -f nexus
```

### Docker Compose Options

**Simple Setup (Combine Mode):**
```bash
docker-compose -f docker-compose.simple.yml up -d
```

**Full Setup (Server + Multiple Nodes):**
```bash
docker-compose up -d
```

**Stop Services:**
```bash
docker-compose down
```

**View Logs:**
```bash
docker-compose logs -f
```

---

## 🖥️ Platform-Specific Installation

### Linux (Ubuntu/Debian)

```bash
# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Nexus
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/nexus/main/quick-install.sh | bash
```

### Linux (CentOS/RHEL)

```bash
# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install Nexus
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/nexus/main/quick-install.sh | bash
```

### macOS

```bash
# Install Node.js with Homebrew
brew install node@18

# Install Nexus
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/nexus/main/quick-install.sh | bash
```

### Windows (PowerShell)

```powershell
# Install Node.js from https://nodejs.org/

# Clone and install
git clone https://github.com/dronzer-tb/nexus.git
cd nexus
npm run setup
npm run start:combine
```

---

## 🚀 Post-Installation

### 1. Verify Installation

```bash
# Check if Nexus is running
curl http://localhost:8080/health

# Should return:
# {"status":"healthy","uptime":X,"timestamp":X}
```

### 2. Access Dashboard

Open browser to:
```
http://localhost:8080
```

You should see the Nexus dashboard with your local node.

### 3. Configure (Optional)

Edit `config/config.json`:
```json
{
  "server": {
    "port": 8080,
    "host": "0.0.0.0"
  },
  "node": {
    "serverUrl": "http://localhost:8080",
    "reportInterval": 5000
  }
}
```

### 4. Set Up Remote Nodes

On remote servers:
```bash
# Install Nexus
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/nexus/main/quick-install.sh | bash

# Edit config to point to your server
nano config/config.json
# Change serverUrl to: "http://your-server-ip:8080"

# Start in node mode
npm run start:node
```

---

## 🔄 Updating Nexus

### Update to Latest Version

```bash
cd nexus

# Pull latest changes
git pull origin main

# Reinstall dependencies
npm install
cd dashboard && npm install && cd ..

# Rebuild dashboard
npm run build:dashboard

# Restart Nexus
npm run start:combine
```

### Docker Update

```bash
# Pull latest code
git pull origin main

# Rebuild image
docker-compose build

# Restart services
docker-compose down
docker-compose up -d
```

---

## 🗑️ Uninstallation

### Remove Nexus

```bash
# Stop Nexus if running
# Ctrl+C or:
pkill -f "node src/index.js"

# Remove directory
cd ..
rm -rf nexus
```

### Docker Uninstall

```bash
# Stop and remove containers
docker-compose down -v

# Remove images
docker rmi dronzer/nexus

# Remove volumes (WARNING: deletes data)
docker volume rm nexus-data
```

---

## 🐛 Troubleshooting Installation

### Node.js Version Error

**Problem:** "Node.js version 18+ required"

**Solution:**
```bash
# Update Node.js
# On Linux with nvm:
nvm install 18
nvm use 18

# On macOS:
brew upgrade node

# On Windows: Download from nodejs.org
```

### npm Install Fails

**Problem:** "EACCES: permission denied"

**Solution:**
```bash
# Fix npm permissions (Linux/Mac)
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or install with --unsafe-perm
npm install --unsafe-perm
```

### Dashboard Build Fails

**Problem:** "Cannot find module" during build

**Solution:**
```bash
# Clear cache and reinstall
cd dashboard
rm -rf node_modules package-lock.json
npm install
npm run build
cd ..
```

### Port Already in Use

**Problem:** "EADDRINUSE: Port 8080 already in use"

**Solution:**
```bash
# Find and kill process on port 8080
# Linux/Mac:
lsof -ti:8080 | xargs kill -9

# Windows:
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# Or change port in config/config.json
```

### Docker Build Fails

**Problem:** "Cannot connect to Docker daemon"

**Solution:**
```bash
# Start Docker service
# Linux:
sudo systemctl start docker

# Mac/Windows: Start Docker Desktop
```

---

## 📊 Installation Verification

After installation, verify everything works:

```bash
# 1. Check Node.js
node --version  # v18+

# 2. Check npm
npm --version   # 8+

# 3. Check Nexus files
ls -la          # Should see package.json, src/, dashboard/

# 4. Check dashboard build
ls dashboard/build  # Should contain index.html, assets/

# 5. Start and test
npm run start:combine

# 6. In another terminal, test API
curl http://localhost:8080/health
curl http://localhost:8080/api/nodes

# 7. Open browser
# Navigate to http://localhost:8080
```

---

## 🎯 Next Steps

After successful installation:

1. **Read Documentation**
   - `README.md` - Full documentation
   - `QUICK_REFERENCE.md` - Command reference
   - `DEVELOPMENT.md` - Development guide

2. **Configure Your Setup**
   - Edit `config/config.json`
   - Set up remote nodes
   - Configure logging

3. **Deploy to Production**
   - Use Docker for deployment
   - Set up reverse proxy (nginx)
   - Enable HTTPS
   - Configure firewall

4. **Monitor Your Infrastructure**
   - Add more nodes
   - Watch metrics in real-time
   - Set up alerts (future feature)

---

## 📞 Support

If you encounter issues:

1. Check [Troubleshooting](#-troubleshooting-installation) section
2. Review logs: `data/nexus.log`
3. Check GitHub Issues: https://github.com/dronzer-tb/nexus/issues
4. Create new issue with:
   - Your OS and Node.js version
   - Complete error message
   - Steps to reproduce

---

## 🎉 Success!

You should now have Nexus running!

```
Dashboard: http://localhost:8080
API: http://localhost:8080/api
Health: http://localhost:8080/health
```

**Happy Monitoring! 🚀**

*Dronzer Studios*
