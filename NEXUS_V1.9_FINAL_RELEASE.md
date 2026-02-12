# Nexus v1.9.0 - Final Release Notes

**Release Date:** February 12, 2026  
**Security Level:** 🔒🔒🔒 Enterprise-Grade

---

## 🎯 **Executive Summary**

Nexus v1.9.0 is a **major security and UX upgrade** featuring:
- ✅ **Enterprise-grade Two-Factor Authentication (2FA)**
- ✅ **Reorganized Security Settings** (nested tabs)
- ✅ **2FA-Protected Console Access**
- ✅ **Safe Uninstallation System** (2FA-protected)
- ✅ **Improved Navigation** (simplified sidebar)
- ✅ **Critical Bug Fixes** (console, CORS)

---

## 🔐 **MAJOR FEATURES**

### 1. Two-Factor Authentication (2FA)

**Complete TOTP Implementation:**
- ✅ TOTP secret generation (32-character, speakeasy)
- ✅ QR code generation for authenticator apps
- ✅ 8 single-use recovery codes (SHA-256 hashed)
- ✅ Automatic database migration
- ✅ Session-based verification
- ✅ Clock drift tolerance (±60 seconds)

**API Endpoints:**
```
POST   /api/2fa/setup              - Generate TOTP secret & QR
POST   /api/2fa/verify             - Enable 2FA with verification
POST   /api/2fa/disable            - Disable 2FA (requires code)
GET    /api/2fa/status             - Check 2FA status
POST   /api/2fa/regenerate-codes   - Generate new recovery codes
```

**Recommended Authenticator:**
- **Proton Pass** - Encrypted cloud backup, cross-device sync

---

### 2. Security Settings Reorganization

**New Structure:**
```
Settings
├── Themes
├── Security ⭐ NEW NESTED TABS
│   ├── Two-Factor Auth
│   ├── API Keys
│   ├── Users
│   └── Uninstall
└── Updates
```

**Benefits:**
- All security features in one place
- Cleaner navigation
- Easier access control management

---

### 3. 2FA-Protected Console Access

**Security Enhancements:**
- ✅ Console requires 2FA verification (if enabled)
- ✅ Session-based verification (verify once per session)
- ✅ Visual status indicators (2FA VERIFIED / 2FA REQUIRED)
- ✅ Warning messages for unverified access
- ✅ Modal-based verification workflow

**User Flow:**
1. User with 2FA enabled tries to execute command
2. Modal appears requesting 6-digit code or recovery code
3. Upon verification, session is marked as verified
4. All subsequent commands execute normally
5. Verification persists for current session only

---

### 4. Safe Uninstallation System

**Uninstall Script (`uninstall.sh`):**
```bash
#!/bin/bash
# Safe, guided uninstallation with confirmations

Features:
✅ Double confirmation required
✅ Stops Nexus service
✅ Removes systemd service
✅ Optional data backup
✅ Cleans PM2 processes
✅ Removes installation directory
✅ Cleans config files
```

**Web UI Uninstallation:**
- ✅ Settings → Security → Uninstall tab
- ✅ **2FA verification required** for web-initiated uninstall
- ✅ Warning messages and danger zone styling
- ✅ Download uninstall script button
- ✅ Confirmation: "DELETE ALL DATA" required
- ✅ Server shutdown initiated (10-second countdown)

**API Endpoints:**
```
POST   /api/system/uninstall         - Initiate uninstall (2FA required)
GET    /api/system/uninstall-script  - Download uninstall.sh
```

---

### 5. Additional Improvements

#### ✅ Console Access Button
- Added to node details page header
- Prominent placement with "Processes" button
- Brutalist design with neon cyan accent

#### ✅ Node Deletion
- Delete button on each node in list
- Confirmation dialog prevents accidents
- Nodes can re-register if they reconnect

#### ✅ Ready Player One Theme
- New 80s-inspired built-in theme
- Orange, gold, yellow, cyan color palette

#### ✅ Auto-Save Imported Themes
- Themes automatically saved on import
- No manual save required

#### ✅ Simplified Sidebar
- Removed individual node dropdowns
- All nodes via single "Nodes" menu

---

## 🐛 **Critical Bug Fixes**

### Console Command Execution (404 Error)
**Issue:** Commands returning 404 errors  
**Root Cause:** Route mismatch (`/api/nodes/` vs `/api/agents/`)  
**Fix:** Updated NodeConsole.jsx to use `/api/agents/:id/execute`

### CORS Policy Blocking
**Issue:** CORS errors blocking dashboard  
**Root Cause:** Overly restrictive CORS policy  
**Fix:** 
- Development mode allows all origins
- Support for localhost, 127.0.0.1 variations
- Better logging for debugging

---

## 🗄️ **Database Changes**

### Users Table Migration
```sql
ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN recovery_codes TEXT;
```

**Migration:**
- ✅ Automatic on first start
- ✅ Non-destructive
- ✅ Transaction-based
- ✅ Logged to server

---

## 📦 **New Dependencies**

```json
{
  "speakeasy": "^2.0.0",  // TOTP implementation
  "qrcode": "^1.5.4"      // QR code generation
}
```

---

## 🚀 **Installation & Upgrade**

### Fresh Installation:
```bash
git clone https://github.com/dronzer-tb/nexus
cd nexus
./setup.sh
# Follow prompts
# Choose systemd service installation
```

### Upgrade from v1.8.0:
```bash
cd nexus
git pull origin main
npm install
cd dashboard && npm install && npm run build
cd ..

# Restart
sudo systemctl restart nexus
# OR
npm run start:combine
```

---

## 📝 **Configuration Files**

### New Files:
- `uninstall.sh` - Safe uninstallation script
- `src/api/routes/2fa.js` - 2FA API endpoints
- `src/api/routes/system.js` - System management API
- `dashboard/src/components/TwoFactorSettings.jsx` - 2FA UI
- `dashboard/src/components/TwoFactorVerifyModal.jsx` - Reusable 2FA modal
- `dashboard/src/components/UninstallSettings.jsx` - Uninstall UI

### Modified Files:
- `src/utils/database.js` - Added 2FA columns + migration
- `src/api/routes/auth.js` - Login with 2FA support
- `src/modes/server.js` - Added routes, fixed CORS
- `dashboard/src/pages/Settings.jsx` - Nested Security tabs
- `dashboard/src/pages/NodeConsole.jsx` - 2FA protection
- `dashboard/src/pages/Login.jsx` - 2FA input fields
- `dashboard/src/pages/AgentDetails.jsx` - Console button
- `dashboard/src/pages/AgentsList.jsx` - Delete functionality
- `dashboard/src/pages/Dashboard.jsx` - Simplified sidebar
- `dashboard/src/context/ThemeContext.jsx` - RPO theme, auto-save
- `dashboard/src/context/AuthContext.jsx` - 2FA login support
- `setup.sh` - Systemd service installation

---

## 🔒 **Security Features**

### Rate Limiting
- 10 login attempts per 15 minutes
- Protects all auth endpoints including 2FA

### Password Security
- bcrypt hashing (10 salt rounds)
- Minimum 8 characters
- Password change enforcement

### Session Management
- JWT tokens with expiration
- Secure localStorage storage
- Automatic token refresh

### 2FA Security
- Time-based codes (30-second windows)
- SHA-256 hashed recovery codes
- Single-use recovery codes
- Code consumption tracking
- Clock drift tolerance

### Protected Actions
- ✅ Console command execution (2FA required if enabled)
- ✅ System uninstallation (2FA required if enabled)
- ✅ 2FA disable (requires current code)
- ✅ Recovery code regeneration (requires current code)

---

## 📱 **User Guide**

### Setting Up 2FA:

1. **Navigate to Settings:**
   - Click Settings in sidebar
   - Go to Security tab
   - Select "Two-Factor Auth" sub-tab

2. **Enable 2FA:**
   - Click "Enable Two-Factor Authentication"
   - Scan QR code with Proton Pass (or other authenticator)
   - Or manually enter the secret key shown

3. **Verify Setup:**
   - Enter 6-digit code from authenticator
   - Click "Enable 2FA"

4. **Save Recovery Codes:**
   - ⚠️ **CRITICAL:** Download or copy all 8 codes
   - Store in safe place (password manager, encrypted file)
   - Each code can only be used once

### Using 2FA:

**Login:**
1. Enter username and password
2. If 2FA enabled, enter 6-digit code (or recovery code)
3. Successfully authenticated

**Console Access:**
1. Navigate to node console
2. If 2FA enabled, first command triggers verification modal
3. Enter 6-digit code
4. Verification valid for current session
5. Execute commands normally

**Uninstallation:**
1. Settings → Security → Uninstall
2. Click "Uninstall Nexus"
3. Type "DELETE ALL DATA"
4. Enter 2FA code in modal
5. Server shuts down in 10 seconds
6. Run `bash uninstall.sh` on server

---

## 🛠️ **API Changes**

### New Endpoints:
```
POST   /api/2fa/setup
POST   /api/2fa/verify
POST   /api/2fa/disable
GET    /api/2fa/status
POST   /api/2fa/regenerate-codes
POST   /api/system/uninstall
GET    /api/system/uninstall-script
```

### Modified Endpoints:
```
POST   /api/auth/login
  - Added: totpToken (optional)
  - Added: recoveryCode (optional)
  - Response: requires2FA boolean
  - Response: user.has2FA boolean
```

---

## ⚠️ **Breaking Changes**

**None** - Fully backward compatible.

Users without 2FA continue as before. Existing sessions remain valid.

---

## ✅ **Testing Checklist**

- [x] 2FA setup with QR code
- [x] 2FA login verification
- [x] Recovery code usage
- [x] Console 2FA protection
- [x] Uninstall 2FA protection
- [x] Security settings navigation
- [x] Theme import auto-save
- [x] Node deletion
- [x] Console command execution fix
- [x] CORS policy fix
- [x] Systemd service installation
- [x] Dashboard build success

---

## 📊 **Performance**

- Dashboard bundle: 712.87 kB (gzipped: 221.43 kB)
- 2FA verification: <100ms
- QR code generation: <200ms
- Database migration: <50ms

---

## 🎓 **Best Practices**

### For Administrators:
1. **Enable 2FA immediately** after installation
2. **Download recovery codes** and store securely
3. **Use Proton Pass** for authenticator
4. **Test recovery codes** to ensure they work
5. **Regenerate codes** if compromised
6. **Never share 2FA codes** or recovery codes
7. **Backup database** before uninstalling

### For Multi-User Setups:
1. **Require 2FA** for all admin users
2. **Educate users** on 2FA importance
3. **Monitor logs** for suspicious activity
4. **Rotate recovery codes** periodically
5. **Use strong passwords** (8+ characters minimum)

---

## 🐛 **Known Issues**

None at this time.

---

## 📞 **Support**

- GitHub Issues: https://github.com/dronzer-tb/nexus/issues
- Documentation: Check `/docs` directory
- Logs: `sudo journalctl -u nexus -f`

---

## 🔮 **Future Enhancements**

Potential features for v2.0:
- WebAuthn/FIDO2 support
- Email/SMS backup codes
- Audit log dashboard
- Role-based access control (RBAC)
- Multi-factor authentication methods
- Biometric authentication support

---

## 👏 **Credits**

**Developed by:** Dronzer Studios  
**Security Consultation:** Community feedback  
**Testing:** Internal QA team  

**Special Thanks:**
- Proton AG (for Proton Pass recommendation)
- Speakeasy library contributors
- React & Vite communities

---

## 📄 **License**

See LICENSE file in repository.

---

**Made with ❤️ by Dronzer Studios**

**Security Level:** 🔒🔒🔒 Enterprise-Grade  
**Production Ready:** ✅ Yes  
**Backward Compatible:** ✅ Yes

