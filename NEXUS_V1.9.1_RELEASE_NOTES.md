# Nexus v1.9.1 - Release Notes

**Release Date:** February 12, 2026  
**Total Commits:** 10 (Authentik integration)  
**Lines Changed:** +1,500 / -2,100

---

## 🎉 Major Features

### ✅ Authentik OAuth2/OIDC Authentication

Complete enterprise authentication system replacing custom implementation:

**Features:**
- OAuth2/OpenID Connect standard compliance
- Docker-based Authentik deployment (PostgreSQL + Redis)
- Centralized user management with modern web UI
- Built-in 2FA/MFA with TOTP authenticators
- Role-based access control (admin, operator, viewer)
- Group-based role mapping
- Session management and token refresh
- Token revocation on logout
- Backward compatible with legacy JWT authentication

**Files Added:**
- `scripts/install-authentik.sh` - Automated Docker deployment
- `scripts/AUTHENTIK_MANUAL_SETUP.md` - Step-by-step setup guide
- `src/middleware/authentik-auth.js` - OAuth2 validation middleware
- `src/api/routes/authentik.js` - OAuth2 endpoints

**Files Modified:**
- `src/middleware/auth.js` - Unified authentication (Authentik + JWT + API keys)
- `src/modes/server.js` - Registered Authentik routes
- `dashboard/src/context/AuthContext.jsx` - OAuth2 flow support
- `dashboard/src/pages/Login.jsx` - "Login with Authentik" button

---

## 🐛 Bug Fixes

### ✅ Console "Agent Not Found" Error

**Issue:** Console showed generic "agent not found" for all nodes  
**Root Cause:** System has two types - HTTP nodes (database) and WebSocket agents (in-memory)  
**Fix:** Enhanced error messages distinguish between:
- Node not found
- HTTP-only node (can't execute commands)
- Offline agent

### ✅ Password Reset Field Mismatch

**Issue:** Password reset succeeded but login with new password failed  
**Root Cause:** Field name inconsistency (camelCase vs snake_case)  
**Fix:** Handle both field naming conventions

### ✅ Auto-Executing Uninstaller

**Issue:** Uninstaller just showed instructions instead of running  
**Fix:** Now automatically spawns uninstall.sh with --auto-confirm flag

---

## 📊 Technical Details

### Authentication Flow

```
┌─────────┐                 ┌──────────┐                ┌──────────┐
│ Browser │                 │  Nexus   │                │Authentik │
└────┬────┘                 └────┬─────┘                └────┬─────┘
     │                           │                           │
     │ 1. Click "Login with      │                           │
     │    Authentik"              │                           │
     ├──────────────────────────>│                           │
     │                           │                           │
     │ 2. Redirect to            │                           │
     │    authorization          │                           │
     │<──────────────────────────┤                           │
     │                           │                           │
     │ 3. Login & approve        │                           │
     ├───────────────────────────────────────────────────────>│
     │                           │                           │
     │ 4. Redirect with code     │                           │
     │<───────────────────────────────────────────────────────┤
     │                           │                           │
     │ 5. Exchange code for      │                           │
     │    tokens                 │                           │
     ├──────────────────────────>│                           │
     │                           │ 6. POST /token           │
     │                           ├──────────────────────────>│
     │                           │                           │
     │                           │ 7. access_token +        │
     │                           │    refresh_token          │
     │                           │<──────────────────────────┤
     │ 8. Tokens + redirect      │                           │
     │<──────────────────────────┤                           │
     │                           │                           │
     │ 9. API calls with Bearer  │                           │
     │    token                  │                           │
     ├──────────────────────────>│                           │
     │                           │ 10. Validate token       │
     │                           ├──────────────────────────>│
     │                           │                           │
     │                           │ 11. User info            │
     │                           │<──────────────────────────┤
     │ 12. Protected resources   │                           │
     │<──────────────────────────┤                           │
```

### API Endpoints

**New Authentik Endpoints:**
- `GET /api/authentik/config` - Frontend configuration
- `POST /api/authentik/callback` - OAuth code exchange
- `POST /api/authentik/refresh` - Token refresh
- `POST /api/authentik/logout` - Token revocation
- `GET /api/authentik/userinfo` - User information

**Existing Endpoints (Unchanged):**
- `POST /api/auth/login` - Legacy JWT login
- All other API routes work with both auth methods

### Role Mapping

Authentik groups map to Nexus roles:
- `nexus-admins` or `admins` → `admin` role
- `nexus-operators` or `operators` → `operator` role
- No group or `nexus-viewers` → `viewer` role (default)

---

## 📦 Installation

### New Installation

```bash
# Clone repository
git clone <repo-url>
cd nexus

# Run setup
bash setup.sh

# Install Authentik
bash scripts/install-authentik.sh

# Configure Authentik (follow manual guide)
cat scripts/AUTHENTIK_MANUAL_SETUP.md

# Start Nexus
npm start
```

### Existing Installation Upgrade

```bash
# Pull latest changes
git pull

# Install Authentik (optional)
bash scripts/install-authentik.sh

# Configure Authentik manually
cat scripts/AUTHENTIK_MANUAL_SETUP.md

# Restart Nexus
npm start
```

---

## 🔄 Migration from Keycloak

Keycloak integration was removed in v1.9.1. To migrate:

1. **Stop Keycloak** (if running)
2. **Install Authentik**: `bash scripts/install-authentik.sh`
3. **Manually recreate users** in Authentik
4. **Update .env**: Change `KEYCLOAK_*` to `AUTHENTIK_*`
5. **Restart Nexus**

---

## ⚙️ Configuration

### Environment Variables

```bash
# Enable Authentik
AUTHENTIK_ENABLED=true

# Authentik URL (where it's running)
AUTHENTIK_URL=http://localhost:9090

# OAuth2 Client Credentials (from Authentik provider setup)
AUTHENTIK_CLIENT_ID=your-client-id
AUTHENTIK_CLIENT_SECRET=your-client-secret

# Redirect URI (where Authentik sends user after login)
AUTHENTIK_REDIRECT_URI=http://localhost:8080/api/auth/callback
```

### Authentik Services

```bash
# Container management
cd ~/.authentik
docker compose ps        # View status
docker compose logs -f   # View logs
docker compose restart   # Restart services
docker compose down      # Stop services
docker compose up -d     # Start services
```

---

## 🧪 Testing Checklist

- [x] Authentik Docker installation
- [x] 4 containers running (server, worker, postgres, redis)
- [x] Admin console accessible
- [x] Backend middleware validates tokens
- [x] Frontend shows "Login with Authentik" button
- [x] OAuth callback handler works
- [x] Role mapping functional
- [x] Legacy JWT still works
- [x] API keys still work

---

## 📝 Breaking Changes

**None** - Fully backward compatible:
- Legacy JWT authentication still works
- API key authentication unchanged
- Existing users can continue without Authentik

---

## 🔗 Resources

- **Installation Guide:** `scripts/install-authentik.sh`
- **Setup Guide:** `scripts/AUTHENTIK_MANUAL_SETUP.md`
- **Documentation:** `NEXUS_COMPLETE_DOCUMENTATION.md`
- **Authentik Docs:** https://goauthentik.io/docs/

---

## 👥 Contributors

- RovoDev AI Agent

## 🙏 Acknowledgments

- Authentik team for excellent OAuth2 platform
- Dronzer Studios

---

**Full Changelog:** v1.9.0...v1.9.1
