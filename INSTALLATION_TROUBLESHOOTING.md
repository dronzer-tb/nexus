# Installation Troubleshooting Guide

## Interactive Input Issues

### Problem: Installer exits when trying to select mode

**Symptom:**
```
Enter your choice [1-3]: 
kasniya@kasniya-Alienware-13-R2:~$ 1
1: command not found
```

**Cause:** When using `curl | bash`, stdin is not properly connected to the terminal.

**Solutions:**

#### Solution 1: Two-Step Install (Recommended)
```bash
# Download the installer first
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/nexus/main/quick-install.sh -o /tmp/nexus-install.sh

# Then run it
bash /tmp/nexus-install.sh
```

#### Solution 2: Manual Clone
```bash
git clone https://github.com/dronzer-tb/nexus.git
cd nexus
./install.sh
```

#### Solution 3: Use wget
```bash
wget -qO- https://raw.githubusercontent.com/dronzer-tb/nexus/main/quick-install.sh | bash
```

---

## Common Installation Issues

### Issue: "Node.js version 18+ required"

**Solution:**
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew install node@18

# Or download from
# https://nodejs.org/
```

### Issue: "Git is not installed"

**Solution:**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install git

# macOS
brew install git

# Verify
git --version
```

### Issue: "Directory 'nexus' already exists"

**Solutions:**

1. **Remove existing directory:**
```bash
rm -rf nexus
```

2. **Update existing installation:**
```bash
cd nexus
git pull origin main
./install.sh
```

3. **Choose different location:**
```bash
mkdir ~/projects
cd ~/projects
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/nexus/main/quick-install.sh | bash
```

---

## Dashboard Build Issues

### Issue: "Dashboard not found"

**Symptom:**
```
Dashboard not found. Please build the dashboard first with: npm run build:dashboard
```

**Solution:**
```bash
cd nexus
npm run build:dashboard
npm run start:combine
```

### Issue: Build fails with "EACCES" permission errors

**Solution:**
```bash
# Fix npm permissions
sudo chown -R $USER:$USER ~/.npm
sudo chown -R $USER:$USER node_modules/

# Or use npm with --unsafe-perm
npm install --unsafe-perm
```

### Issue: "JavaScript heap out of memory"

**Solution:**
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build:dashboard
```

---

## Module Not Found Errors

### Issue: "Cannot find module '../utils/logger'"

**Solution:**
```bash
# Pull latest fixes
git pull origin main

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Restart
npm run start:combine
```

---

## Port Already in Use

### Issue: "Port 8080 is already in use"

**Solution 1: Use different port**
```bash
# Edit config/config.json
{
  "server": {
    "port": 8081,
    "host": "0.0.0.0"
  }
}
```

**Solution 2: Kill existing process**
```bash
# Find process using port 8080
sudo lsof -i :8080

# Kill it
sudo kill -9 <PID>
```

---

## Network Issues

### Issue: Cannot connect to dashboard at localhost:8080

**Check 1: Is the server running?**
```bash
ps aux | grep node
```

**Check 2: Is the port open?**
```bash
netstat -tuln | grep 8080
```

**Check 3: Check firewall**
```bash
# Ubuntu
sudo ufw allow 8080

# Or check if firewall is blocking
sudo ufw status
```

**Check 4: Try different browser or incognito mode**

---

## Permission Issues

### Issue: "EACCES: permission denied"

**Solution 1: Fix ownership**
```bash
sudo chown -R $USER:$USER .
```

**Solution 2: Don't run as root**
```bash
# If you ran with sudo, reinstall as regular user
rm -rf node_modules
npm install
```

---

## Mode Selection Issues

### Issue: Installer doesn't wait for input

**Quick Fix:**
```bash
# Clone manually and run installer directly
git clone https://github.com/dronzer-tb/nexus.git
cd nexus
./install.sh
```

### Issue: Wrong mode installed

**Solution: Rebuild for different mode**

If you want to switch from Node mode to Combine/Server mode:
```bash
cd dashboard
npm install
npm run build
cd ..
npm run start:combine  # or start:server
```

If you want to switch from Combine/Server to Node mode:
```bash
# Just run in node mode (dashboard is ignored)
npm run start:node
```

---

## Database Issues

### Issue: "SQLITE_CANTOPEN: unable to open database file"

**Solution:**
```bash
# Create data directory
mkdir -p data

# Fix permissions
chmod 755 data
```

---

## WebSocket Connection Issues

### Issue: "WebSocket connection failed"

**Check 1: Server is running**
```bash
curl http://localhost:8080/health
```

**Check 2: Check browser console**
- Open browser DevTools (F12)
- Look for WebSocket errors
- Check Network tab for failed connections

**Check 3: CORS issues**
```bash
# Check config/config.json
{
  "server": {
    "cors": {
      "enabled": true,
      "origin": "*"
    }
  }
}
```

---

## Development Issues

### Issue: "Cannot find module 'vite'"

**Solution:**
```bash
cd dashboard
npm install
cd ..
```

### Issue: Hot reload not working

**Solution:**
```bash
# Use development mode
npm run dev

# If still not working, check if port 3000 is available
lsof -i :3000
```

---

## Getting More Help

### Check Logs
```bash
# Server logs
tail -f data/nexus.log

# Or run with verbose logging
DEBUG=* npm run start:combine
```

### Verify Installation
```bash
# Check versions
node -v
npm -v
git --version

# Check directory structure
ls -la
```

### Clean Reinstall
```bash
# Full cleanup
rm -rf node_modules dashboard/node_modules
rm -rf dashboard/dist dashboard/build
rm package-lock.json dashboard/package-lock.json

# Reinstall
./install.sh
```

### Report an Issue

If none of these solutions work:

1. **Gather information:**
   ```bash
   node -v > debug-info.txt
   npm -v >> debug-info.txt
   uname -a >> debug-info.txt
   cat data/nexus.log >> debug-info.txt
   ```

2. **Create an issue on GitHub:**
   - Go to: https://github.com/dronzer-tb/nexus/issues
   - Include the debug info
   - Describe what you were trying to do
   - Include error messages

---

## Quick Reference

| Problem | Quick Fix |
|---------|-----------|
| Installer exits on input | Use: `git clone ... && cd nexus && ./install.sh` |
| Dashboard not found | Run: `npm run build:dashboard` |
| Port in use | Change port in `config/config.json` |
| Module not found | Run: `git pull && npm install` |
| Permission denied | Run: `sudo chown -R $USER:$USER .` |
| Can't connect | Check: `curl http://localhost:8080/health` |

---

**Made with ❤️ by Dronzer Studios**
