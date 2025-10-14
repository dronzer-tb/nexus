# 🚀 Nexus One-Command Installation

## The Easiest Way to Install Nexus

Just run this single command:

```bash
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/nexus/main/quick-install.sh | bash
```

## What Happens?

```
┌─────────────────────────────────────────────────────┐
│  STEP 1: Clone Repository                           │
│  ✓ Downloads Nexus from GitHub                      │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  STEP 2: Check Prerequisites                        │
│  ✓ Verifies Node.js 18+                            │
│  ✓ Verifies npm                                     │
│  ✓ Checks for Docker (optional)                    │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  STEP 3: Install Backend                            │
│  ✓ npm install (backend dependencies)              │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  STEP 4: Install Frontend                           │
│  ✓ npm install (dashboard dependencies)            │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  STEP 5: Build Dashboard                            │
│  ✓ npm run build (compile React app)               │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  STEP 6: Create Directories                         │
│  ✓ Creates data/ folder                            │
│  ✓ Creates config/ folder                          │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  STEP 7: Generate Configuration                     │
│  ✓ Creates config/config.json                      │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  STEP 8: Display Summary                            │
│  ✓ Shows quick start commands                      │
│  ✓ Shows documentation links                       │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  STEP 9: Prompt to Start                            │
│  ? Would you like to start Nexus now? (y/n)        │
│                                                     │
│  y → Starts Nexus in Combine Mode                  │
│  n → Installation complete, start later            │
└─────────────────────────────────────────────────────┘
```

## Installation Time

- **Fast Internet:** 2-3 minutes
- **Average Internet:** 3-5 minutes
- **Slow Internet:** 5-8 minutes

## What You Get

After installation:

```
✓ Full Nexus installation
✓ Backend (Node.js + Express + SQLite)
✓ Frontend (React + TailwindCSS)
✓ Dashboard built and ready
✓ Configuration files created
✓ Data directories set up
✓ Optional: Nexus running on http://localhost:8080
```

## Requirements

- **Node.js** 18+ (installer checks automatically)
- **npm** (comes with Node.js)
- **Git** (to clone repository)
- **5 minutes** of your time ⏱️

## Alternative Installation Methods

### Method 2: Manual Clone + Automated Install

```bash
git clone https://github.com/dronzer-tb/nexus.git
cd nexus
./install.sh
```

### Method 3: NPM Script

```bash
git clone https://github.com/dronzer-tb/nexus.git
cd nexus
npm run setup
npm run start:combine
```

### Method 4: Docker One-Liner

```bash
git clone https://github.com/dronzer-tb/nexus.git
cd nexus
docker-compose -f docker-compose.simple.yml up -d
```

## What Gets Installed?

```
nexus/
├── node_modules/           ← Backend dependencies
├── dashboard/
│   ├── node_modules/      ← Frontend dependencies
│   └── build/             ← Compiled React app
├── data/
│   ├── nexus.db          ← SQLite database
│   ├── nexus.log         ← Application logs
│   └── node-info.json    ← Node credentials
├── config/
│   └── config.json       ← Configuration
└── src/                  ← Application code
```

## After Installation

### Start Nexus

```bash
# Combine mode (local monitoring + dashboard)
npm run start:combine

# Server mode (dashboard only)
npm run start:server

# Node mode (metrics collection only)
npm run start:node
```

### Access Dashboard

Open browser to:
```
http://localhost:8080
```

### View Logs

```bash
tail -f data/nexus.log
```

### Configuration

Edit `config/config.json` to customize:
- Port number
- Server URL for nodes
- Logging level
- Database path

## Verification

Check installation success:

```bash
# Check files exist
ls -la package.json src/ dashboard/build/

# Check health
curl http://localhost:8080/health

# Should return:
# {"status":"healthy","uptime":X,"timestamp":X}
```

## Troubleshooting

### If Installation Fails

1. **Check Node.js version:**
   ```bash
   node --version  # Should be v18.0.0+
   ```

2. **Check npm:**
   ```bash
   npm --version   # Should be 8.0.0+
   ```

3. **Check logs:**
   ```bash
   # Installation errors are shown in terminal
   ```

4. **Try manual installation:**
   ```bash
   git clone https://github.com/dronzer-tb/nexus.git
   cd nexus
   npm install
   cd dashboard && npm install && cd ..
   npm run build:dashboard
   npm run start:combine
   ```

### Common Issues

**"Node.js version 18+ required"**
```bash
# Install Node.js 18+
# Linux: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
# macOS: brew install node@18
# Windows: Download from nodejs.org
```

**"npm install failed"**
```bash
# Clear cache and retry
npm cache clean --force
npm install
```

**"Port 8080 already in use"**
```bash
# Change port in config/config.json
# Or kill process on port 8080:
lsof -ti:8080 | xargs kill -9  # Linux/Mac
```

## Next Steps

1. ✅ Installation complete
2. 🚀 Start Nexus
3. 🌐 Open dashboard
4. 📊 Monitor your system
5. ➕ Add more nodes
6. 🎉 Enjoy!

## Support

- 📖 **Documentation:** [README.md](README.md)
- 🔧 **Installation Guide:** [INSTALLATION.md](INSTALLATION.md)
- 📋 **Quick Reference:** [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- 💻 **Development:** [DEVELOPMENT.md](DEVELOPMENT.md)
- 🐛 **Issues:** [GitHub Issues](https://github.com/dronzer-tb/nexus/issues)

---

## Visual Installation Flow

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   curl -fsSL https://raw.githubusercontent...      │
│                                                     │
└──────────────────┬──────────────────────────────────┘
                   │
                   ├─ Clone Repository
                   │  └─ git clone https://github...
                   │
                   ├─ Run install.sh
                   │  ├─ Check Node.js ✓
                   │  ├─ Check npm ✓
                   │  ├─ npm install (backend) ✓
                   │  ├─ npm install (frontend) ✓
                   │  ├─ npm run build ✓
                   │  ├─ mkdir data/ config/ ✓
                   │  └─ Generate config.json ✓
                   │
                   └─ Start Nexus? (y/n)
                      ├─ y → npm run start:combine
                      │     └─ Dashboard: localhost:8080
                      │
                      └─ n → Setup complete!
```

---

**🎉 That's it! One command, full installation, ready to monitor!**

*Dronzer Studios - Making monitoring simple*
