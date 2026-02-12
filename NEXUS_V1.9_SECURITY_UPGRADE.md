# Nexus v1.9.0 - Major Security & UX Upgrade

**Release Date:** February 12, 2026

---

## 🔐 **MAJOR FEATURES**

### ✅ **Two-Factor Authentication (2FA)**
**Complete TOTP-based 2FA implementation with enterprise-grade security**

#### Backend Implementation:
- ✅ **TOTP Secret Generation** - Using speakeasy library with 32-character secrets
- ✅ **QR Code Generation** - Automatic QR code creation for easy authenticator setup
- ✅ **Recovery Codes** - 8 single-use recovery codes (SHA-256 hashed)
- ✅ **Database Schema** - Added `totp_secret`, `totp_enabled`, `recovery_codes` columns
- ✅ **Auto Migration** - Existing databases automatically upgraded
- ✅ **Login Flow Integration** - Seamless 2FA verification during login
- ✅ **API Endpoints**:
  - `POST /api/2fa/setup` - Generate TOTP secret & QR code
  - `POST /api/2fa/verify` - Enable 2FA with code verification
  - `POST /api/2fa/disable` - Disable 2FA (requires TOTP/recovery code)
  - `GET /api/2fa/status` - Check 2FA status
  - `POST /api/2fa/regenerate-codes` - Regenerate recovery codes

#### Frontend Implementation:
- ✅ **Login Page 2FA Support** - Dynamic UI for TOTP/recovery code entry
- ✅ **Security Settings Tab** - Dedicated 2FA management interface
- ✅ **QR Code Display** - Interactive setup wizard with QR code
- ✅ **Proton Pass Recommendation** - Built-in recommendation for Proton Pass Authenticator
- ✅ **Recovery Code Management** - Display, copy, and download recovery codes
- ✅ **Visual Feedback** - Clear enabled/disabled status indicators

#### Security Features:
- ✅ **Time-Based Codes** - Standard TOTP with 30-second windows
- ✅ **Clock Drift Tolerance** - ±2 time steps (60 seconds) for reliability
- ✅ **Recovery Code Hashing** - SHA-256 hashed, single-use codes
- ✅ **Code Consumption** - Used recovery codes automatically removed
- ✅ **Rate Limiting** - Existing rate limiting protects 2FA endpoints

---

### 🖥️ **Console Access Button**
- ✅ Added prominent "Console" button to node details page header
- ✅ Added "Processes" button alongside console for quick access
- ✅ Brutalist design with neon cyan/purple accent colors
- ✅ Hover animations and shadow effects

---

### 🗑️ **Node Deletion**
- ✅ Delete button on each node in the Nodes list
- ✅ Confirmation dialog prevents accidental deletion
- ✅ Deletes node and all associated metrics from database
- ✅ Nodes can automatically re-register if they reconnect
- ✅ Trash icon with red accent on hover

---

### 🎨 **Ready Player One Theme**
- ✅ New built-in theme preset inspired by 80s retro aesthetics
- ✅ Color palette:
  - Primary: `#ff6b35` (vibrant orange)
  - Accent 2: `#f7931e` (gold)
  - Accent 3: `#ffd23f` (yellow)
  - Accent 4: `#00d9ff` (cyan)
  - Success: `#00ff88` (neon green)
  - Danger: `#ff3864` (hot pink)

---

### 🔄 **Auto-Save Imported Themes**
- ✅ Imported themes automatically saved to user preset library
- ✅ No manual save required after import
- ✅ Checks preset limit before auto-saving

---

### 🧭 **Simplified Sidebar Navigation**
- ✅ Removed individual node dropdowns from sidebar
- ✅ All nodes accessible via single "Nodes" menu item
- ✅ Cleaner, faster navigation with many nodes
- ✅ Reduced sidebar clutter

---

### 🐛 **Critical Bug Fixes**

#### Console Command Execution (404 Error)
**Issue:** Console commands returning 404 errors  
**Root Cause:** Route mismatch - frontend calling `/api/nodes/:id/execute` but backend using `/api/agents/:id/execute`  
**Fix:** Updated `NodeConsole.jsx` to use correct `/api/agents/:id/execute` route

#### CORS Policy Blocking Legitimate Requests
**Issue:** CORS errors blocking dashboard access  
**Root Cause:** Overly restrictive CORS policy  
**Fix:** 
- Development mode now allows all origins
- Added support for `localhost`, `127.0.0.1` variations
- Better logging for debugging
- Production mode still enforces strict CORS

---

### ⚙️ **Systemd Service Support**

#### Installation Script Enhancement
- ✅ Added interactive systemd service installation
- ✅ Prompts user during setup with yes/no option
- ✅ Automatically detects Node.js path and installation directory
- ✅ Creates `/etc/systemd/system/nexus.service`
- ✅ Enables auto-start on boot
- ✅ Configures automatic restart on failure

#### Service Features:
```bash
# Service management commands
sudo systemctl start nexus
sudo systemctl stop nexus
sudo systemctl restart nexus
sudo systemctl status nexus
sudo journalctl -u nexus -f  # View logs
```

#### Service Configuration:
- Type: `simple`
- Restart: `always` with 10-second delay
- User: Current user (not root by default)
- Environment: `NODE_ENV=production`
- Logs: Sent to systemd journal

---

## 🔒 **Security Enhancements**

### Rate Limiting
- ✅ Already implemented: 10 login attempts per 15 minutes
- ✅ Protects all authentication endpoints including 2FA

### Password Security
- ✅ bcrypt hashing with salt rounds of 10
- ✅ Minimum 8-character passwords
- ✅ Password change enforcement for new users

### Session Management
- ✅ JWT tokens with expiration
- ✅ Secure token storage in localStorage
- ✅ Automatic token refresh interceptors

### HTTPS Support
- ✅ Nginx integration already configured
- ✅ SSL/TLS termination at reverse proxy
- ✅ Secure cookie support

---

## 📦 **Dependencies Added**

```json
{
  "speakeasy": "^2.0.0",   // TOTP implementation
  "qrcode": "^1.5.4"       // QR code generation
}
```

---

## 🗄️ **Database Changes**

### Users Table Migration
```sql
ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN recovery_codes TEXT;
```

### Automatic Migration
- ✅ Runs on first server start after upgrade
- ✅ Non-destructive (existing data preserved)
- ✅ Transaction-based for safety
- ✅ Logged to server logs

---

## 📝 **Version Updates**
- `package.json`: `1.8.0` → `1.9.0`
- `VERSION`: `1.8.0` → `1.9.0`

---

## 🚀 **Upgrade Instructions**

### For Existing Installations:

```bash
cd nexus
git pull origin main
npm install
cd dashboard && npm install && npm run build
cd ..

# If using systemd
sudo systemctl restart nexus

# If running manually
npm run start:combine
```

### First-Time Setup:

```bash
git clone https://github.com/dronzer-tb/nexus
cd nexus
./setup.sh
# Follow interactive prompts
# Choose to install systemd service when prompted
```

---

## 🎯 **2FA Setup Guide for Users**

### Step 1: Enable 2FA
1. Log into Nexus dashboard
2. Navigate to **Settings** → **Security** tab
3. Click **"Enable Two-Factor Authentication"**

### Step 2: Scan QR Code
1. Open your authenticator app (recommended: **Proton Pass**)
2. Scan the displayed QR code
3. Or manually enter the secret key shown

### Step 3: Verify Setup
1. Enter the 6-digit code from your authenticator
2. Click **"Enable 2FA"**

### Step 4: Save Recovery Codes
1. **IMPORTANT:** Download or copy all 8 recovery codes
2. Store them in a safe place
3. Each code can only be used once
4. Use them if you lose access to your authenticator

### Using 2FA:
- Enter username and password as usual
- When prompted, enter the 6-digit code from your authenticator
- Or use a recovery code if needed

---

## 🔧 **API Changes**

### New Endpoints:
- `POST /api/2fa/setup`
- `POST /api/2fa/verify`
- `POST /api/2fa/disable`
- `GET /api/2fa/status`
- `POST /api/2fa/regenerate-codes`

### Modified Endpoints:
- `POST /api/auth/login` - Now accepts optional `totpToken` and `recoveryCode` parameters

### Response Changes:
- Login response now includes `requires2FA: true` when 2FA is needed (HTTP 403)
- User object now includes `has2FA` boolean field

---

## ⚠️ **Breaking Changes**

**None** - This release is fully backward compatible.

Users without 2FA enabled will continue to log in normally. Existing sessions remain valid.

---

## 📊 **Testing Checklist**

- [x] 2FA setup with QR code
- [x] 2FA verification with valid code
- [x] 2FA verification with invalid code
- [x] Login with 2FA enabled
- [x] Login with recovery code
- [x] Recovery code consumption
- [x] 2FA disable functionality
- [x] Recovery code regeneration
- [x] Console command execution
- [x] Node deletion
- [x] Theme import auto-save
- [x] Systemd service installation
- [x] CORS policy fixes
- [x] Dashboard build without errors

---

## 🙏 **Recommended Authenticator Apps**

### **Proton Pass** (Recommended)
- ✅ End-to-end encrypted cloud backup
- ✅ Cross-device synchronization
- ✅ Open source
- ✅ Privacy-focused (Swiss company)
- ✅ Available on iOS, Android, Desktop

### Other Compatible Apps:
- Google Authenticator
- Microsoft Authenticator
- Authy
- 1Password
- Bitwarden

---

## 🐛 **Known Issues**

None at this time.

---

## 📞 **Support**

For issues or questions:
- Create an issue on GitHub
- Check documentation in `/docs`
- Review server logs: `sudo journalctl -u nexus -f`

---

**Made with ❤️ by Dronzer Studios**

**Security Level:** 🔒🔒🔒 Enterprise-Grade
