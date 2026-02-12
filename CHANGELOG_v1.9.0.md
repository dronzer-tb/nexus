# Nexus v1.9.0 - Release Notes

**Release Date:** February 12, 2026

## 🎉 Major Features

### ✅ Systemd Service Support
- Added automated systemd service installation during setup
- Interactive setup wizard now includes systemd configuration option
- Service auto-starts on boot with proper restart policies
- Easy management via `systemctl` commands

### 🗑️ Node Deletion
- Added delete functionality to the Nodes page
- Confirmation dialog prevents accidental deletions
- Nodes can re-register automatically if they reconnect
- Clean deletion of node and all associated metrics

### 🎨 New Theme: Ready Player One
- Added vibrant "Ready Player One" theme preset
- Orange (#ff6b35), gold (#f7931e), yellow (#ffd23f), cyan (#00d9ff) accents
- Perfect for 80s/retro aesthetic lovers

### 🔄 Auto-Save Imported Themes
- Imported themes are now automatically saved as user presets
- No need to manually save after importing
- Themes are immediately available in your preset library

## 🐛 Bug Fixes

### Console Command Execution
- **Fixed:** Console commands returning 404 errors
- **Root Cause:** Route mismatch between `/api/nodes/` and `/api/agents/`
- **Solution:** Updated frontend to use correct `/api/agents/:id/execute` endpoint

### Auto-Restart After Updates
- Server now automatically restarts after applying updates
- Supports PM2, systemd, and generic process managers
- 3-second grace period before restart

### Sidebar Navigation Optimization
- Removed individual node dropdowns from sidebar
- All nodes now accessible only via the "Nodes" section
- Cleaner, more streamlined navigation experience
- Faster loading with many nodes

## 🔧 Improvements

### User Authentication
- Verified bcrypt password hashing is working correctly
- Database users and file-based admin both supported
- JWT tokens properly generated and verified

### Version Updates
- Updated to v1.9.0 across all files
- VERSION file and package.json synchronized

## 📝 Technical Changes

### Backend
- `setup.sh`: Added `setup_systemd()` and `install_systemd_service()` functions
- `/api/nodes/:nodeId`: DELETE endpoint already existed and working
- `/api/update/apply`: Auto-restart after successful update

### Frontend
- `ThemeContext.jsx`: Added "Ready Player One" preset
- `ThemeContext.jsx`: Auto-save imported themes to user presets
- `AgentsList.jsx`: Added delete button with confirmation dialog
- `NodeConsole.jsx`: Fixed execute route to `/api/agents/:id/execute`
- `Dashboard.jsx`: Removed node dropdown navigation from sidebar

## 🚀 Upgrade Instructions

```bash
cd nexus
git pull origin main
npm install
cd dashboard && npm install && npm run build
```

For systemd service:
```bash
sudo systemctl restart nexus
```

## ⚠️ Breaking Changes

None - this is a backwards-compatible release.

## 📋 Notes

### Android App
- No changes needed for mobile app
- Existing API key authentication continues to work
- Nodes endpoint remains compatible

### Process Display
- Process/service detection works as designed
- Shows running processes via `systeminformation` library
- Systemd service detection depends on system configuration

---

**Full Changelog:** https://github.com/dronzer-tb/nexus/compare/v1.8.0...v1.9.0

**Made with ❤️ by Dronzer Studios**
