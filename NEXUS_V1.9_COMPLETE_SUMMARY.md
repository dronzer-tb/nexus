# Nexus v1.9.0 - Complete Feature Summary

**Release Date:** February 12, 2026  
**Major Update:** Enterprise Security & Password Reset

---

## 🎉 **All Features Implemented**

### **1. Two-Factor Authentication (2FA)**
- ✅ TOTP-based authentication (30-second codes)
- ✅ QR code generation for authenticator apps
- ✅ 8 SHA-256 hashed recovery codes
- ✅ Proton Pass recommended
- ✅ Session-based verification
- ✅ Login integration
- ✅ Settings UI with full management

### **2. Console-Based Password Reset**
- ✅ 6-digit code generation
- ✅ Displayed in server console with chalk colors
- ✅ 10-minute expiration
- ✅ Single-use codes
- ✅ Database users only (not file-based admin)
- ✅ 2-step reset form on login page

### **3. 2FA-Protected Console**
- ✅ Session-based verification for command execution
- ✅ Visual status indicators (2FA VERIFIED / 2FA REQUIRED)
- ✅ Modal-based authentication
- ✅ One-time verification per session

### **4. 2FA-Protected Uninstallation**
- ✅ Safe uninstallation script (`uninstall.sh`)
- ✅ Web UI with 2FA verification required
- ✅ Multiple confirmation steps
- ✅ Optional data backup
- ✅ Complete cleanup (systemd, PM2, files)

### **5. Reorganized Security Settings**
```
Settings
├── Themes
├── Security (NESTED TABS)
│   ├── Two-Factor Auth
│   ├── API Keys
│   ├── Users
│   └── Uninstall
└── Updates
```

### **6. Node Management**
- ✅ Delete nodes from web UI
- ✅ Confirmation dialog
- ✅ Console access button on node details
- ✅ Processes button on node details

### **7. UI/UX Improvements**
- ✅ Simplified sidebar (removed node dropdowns)
- ✅ Ready Player One theme preset
- ✅ Auto-save imported themes
- ✅ Console bug fix (route mismatch)
- ✅ CORS policy improvements

### **8. Systemd Service**
- ✅ Interactive installation during setup
- ✅ Auto-start on boot
- ✅ Automatic restart on failure
- ✅ Easy management commands

---

## 🔐 **Security Features**

### **Authentication:**
- JWT tokens with expiration
- bcrypt password hashing (10 salt rounds)
- Rate limiting (10 attempts / 15 min)
- 2FA with TOTP
- Recovery codes

### **Protected Actions:**
- ✅ Login (2FA if enabled)
- ✅ Console commands (2FA if enabled)
- ✅ System uninstallation (2FA if enabled)
- ✅ 2FA disable (requires current code)
- ✅ Recovery code regeneration (requires TOTP)

### **Password Reset:**
- Console-based (no email needed)
- Database users only
- 6-digit codes
- 10-minute expiration
- Single-use
- Admin-controlled

---

## 📁 **Files Created/Modified**

### **New Files (Backend):**
- `src/api/routes/2fa.js` - 2FA endpoints
- `src/api/routes/system.js` - Uninstall endpoints
- `src/api/routes/password-reset.js` - Console code reset
- `uninstall.sh` - Safe uninstallation script

### **New Files (Frontend):**
- `dashboard/src/components/TwoFactorSettings.jsx`
- `dashboard/src/components/TwoFactorVerifyModal.jsx`
- `dashboard/src/components/UninstallSettings.jsx`

### **Modified Files:**
- `src/utils/database.js` - 2FA & reset columns + migration
- `src/api/routes/auth.js` - 2FA login support
- `src/modes/server.js` - Routes & CORS fixes
- `dashboard/src/pages/Login.jsx` - 2FA + password reset
- `dashboard/src/pages/Settings.jsx` - Nested Security tabs
- `dashboard/src/pages/NodeConsole.jsx` - 2FA protection
- `dashboard/src/pages/AgentDetails.jsx` - Console button
- `dashboard/src/pages/AgentsList.jsx` - Delete nodes
- `dashboard/src/pages/Dashboard.jsx` - Simplified sidebar
- `dashboard/src/context/ThemeContext.jsx` - RPO theme
- `dashboard/src/context/AuthContext.jsx` - 2FA support
- `setup.sh` - Systemd installation

---

## 🚀 **Quick Start**

### **Enable 2FA:**
1. Settings → Security → Two-Factor Auth
2. Click "Enable Two-Factor Authentication"
3. Scan QR with Proton Pass
4. Enter verification code
5. Download recovery codes ⚠️

### **Reset Password (Database Users):**
1. Login page → "Forgot password?"
2. Enter username
3. Ask admin for code from console
4. Enter code + new password
5. Login with new password

### **Access Console:**
1. Navigate to node details
2. Click "Console" button in header
3. If 2FA enabled, verify on first command
4. Execute commands normally

### **Uninstall Nexus:**
1. Settings → Security → Uninstall
2. Download `uninstall.sh`
3. Click "Uninstall Nexus"
4. Type "DELETE ALL DATA"
5. Enter 2FA code
6. Run `bash uninstall.sh` on server

---

## 📊 **API Endpoints**

### **2FA:**
```
POST   /api/2fa/setup              - Generate TOTP
POST   /api/2fa/verify             - Enable 2FA
POST   /api/2fa/disable            - Disable 2FA
GET    /api/2fa/status             - Check status
POST   /api/2fa/regenerate-codes   - New recovery codes
```

### **Password Reset:**
```
POST   /api/password-reset/request - Generate console code
POST   /api/password-reset/verify  - Verify code
POST   /api/password-reset/reset   - Reset password
```

### **System:**
```
POST   /api/system/uninstall       - Initiate uninstall (2FA)
GET    /api/system/uninstall-script - Download script
```

---

## 🗄️ **Database Changes**

### **Users Table (Extended):**
```sql
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN recovery_codes TEXT;
ALTER TABLE users ADD COLUMN reset_token TEXT;
ALTER TABLE users ADD COLUMN reset_token_expires INTEGER;
```

**Automatic migration on first start** ✅

---

## 📦 **Dependencies Added**

```json
{
  "speakeasy": "^2.0.0",  // TOTP
  "qrcode": "^1.5.4",     // QR codes
  "chalk": "^5.3.0"       // Console colors
}
```

---

## ⚠️ **Important Notes**

### **Password Reset:**
- **Only works for database users**
- File-based admin (from `admin.json`) cannot use password reset
- Admin must have console access to provide codes
- Codes expire in 10 minutes

### **2FA:**
- **Required for sensitive actions** when enabled
- Save recovery codes immediately
- Use Proton Pass for best security
- Clock drift tolerance: ±60 seconds

### **Uninstallation:**
- **Irreversible** - all data deleted
- Requires 2FA if enabled
- Server shuts down after web uninstall
- Must run `uninstall.sh` to complete

---

## 🔧 **Troubleshooting**

### **Password Reset "User not found":**
- Username must be a database user (created in Settings → Security → Users)
- File-based admin cannot use password reset
- Check username spelling

### **2FA Code Not Working:**
- Check time synchronization on device
- Try recovery code instead
- Regenerate codes if lost

### **Console Code Not Appearing:**
- Check server console/terminal
- View logs: `sudo journalctl -u nexus -f`
- Verify user exists in database

---

## 📚 **Documentation**

- `PASSWORD_RESET_FEATURE.md` - Email-based (deprecated)
- `CONSOLE_PASSWORD_RESET.md` - Console-based (current)
- `NEXUS_V1.9_SECURITY_UPGRADE.md` - Initial release notes
- `NEXUS_V1.9_FINAL_RELEASE.md` - Complete guide

---

## 🎯 **Testing Checklist**

- [x] 2FA setup & verification
- [x] 2FA login
- [x] Recovery code usage
- [x] Console 2FA protection
- [x] Password reset for database users
- [x] Password reset rejection for file admin
- [x] Uninstallation with 2FA
- [x] Node deletion
- [x] Console command execution
- [x] Systemd service installation
- [x] Theme import auto-save
- [x] Sidebar simplification

---

## 🚀 **Production Deployment**

```bash
# Pull latest
cd nexus
git pull origin main

# Install dependencies
npm install

# Build dashboard
cd dashboard
npm install
npm run build
cd ..

# Restart server
sudo systemctl restart nexus
# OR
npm run start:combine
```

---

## 🔮 **Future Enhancements**

- WebAuthn/FIDO2 support
- Email-based password reset (optional)
- Admin notification webhooks
- Audit log dashboard
- Role-based access control (RBAC)
- Multi-admin approval workflows

---

**Made with ❤️ by Dronzer Studios**

**Version:** 1.9.0  
**Security Level:** 🔒🔒🔒 Enterprise-Grade  
**Production Ready:** ✅ Yes  
**Breaking Changes:** ❌ None
