# Nexus v1.9.5 - Custom Auth & Onboarding System
## Planning Document

**Target Version:** 1.9.5  
**Status:** Planning Phase  
**Estimated Effort:** Large (15-20 hours development)  
**Breaking Changes:** Yes - Complete auth overhaul

---

## 🎯 Overview

Complete transformation of Nexus with:
1. **First-Time Onboarding Flow** - Guide users through setup
2. **Custom In-House Authentication** - No external dependencies
3. **Mandatory 2FA** - TOTP built-in from day one
4. **Alert System** - Webhook-based (Telegram/Discord)
5. **QR Code Pairing** - Secure mobile app connection
6. **Mobile App Overhaul** - Match dashboard UI/UX
7. **Console 2FA Protection** - Extra security for command execution

---

## 📋 Phase 1: Onboarding Flow

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    First Launch Detection                   │
│  Check: ~/.nexus-initialized or database flag               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               STEP 1: Welcome Screen                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🎯 Welcome to Nexus                                │   │
│  │                                                      │   │
│  │  • Real-time system monitoring                      │   │
│  │  • Remote command execution                         │   │
│  │  • Multi-node management                            │   │
│  │  • Secure mobile access                             │   │
│  │                                                      │   │
│  │              [Continue to Setup →]                  │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            STEP 2: Create Admin Account                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  👤 Administrator Setup                             │   │
│  │                                                      │   │
│  │  Username: [________________]                       │   │
│  │  Password: [________________]                       │   │
│  │  Confirm:  [________________]                       │   │
│  │                                                      │   │
│  │  Requirements:                                      │   │
│  │  ✓ 8+ characters                                    │   │
│  │  ✓ Uppercase & lowercase                            │   │
│  │  ✓ Numbers                                          │   │
│  │  ✓ Special characters                               │   │
│  │                                                      │   │
│  │              [Continue to 2FA Setup →]              │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            STEP 3: Setup 2FA (MANDATORY)                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🔐 Two-Factor Authentication                       │   │
│  │                                                      │   │
│  │  Scan this QR code with your authenticator app:    │   │
│  │                                                      │   │
│  │      ┌─────────────────────┐                        │   │
│  │      │   [QR CODE HERE]    │                        │   │
│  │      └─────────────────────┘                        │   │
│  │                                                      │   │
│  │  Or enter manually:                                 │   │
│  │  Secret: JBSWY3DPEHPK3PXP                          │   │
│  │                                                      │   │
│  │  Recommended apps:                                  │   │
│  │  • Google Authenticator                             │   │
│  │  • Authy                                            │   │
│  │  • Microsoft Authenticator                          │   │
│  │                                                      │   │
│  │  Enter 6-digit code to verify:                      │   │
│  │  Code: [___][___][___][___][___][___]              │   │
│  │                                                      │   │
│  │  ⚠️ 2FA is required and cannot be skipped           │   │
│  │                                                      │   │
│  │              [Verify & Continue →]                  │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            STEP 4: Configure Alerts                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🔔 Alert Notifications                             │   │
│  │                                                      │   │
│  │  Get notified when metrics exceed thresholds       │   │
│  │                                                      │   │
│  │  ☑ Enable Alerts                                    │   │
│  │                                                      │   │
│  │  Alert Method:                                      │   │
│  │  ⦿ Webhook (Telegram/Discord)                      │   │
│  │  ○ Email (Coming Soon)                              │   │
│  │  ○ SMS (Coming Soon)                                │   │
│  │  ○ Push Notification (Coming Soon)                  │   │
│  │                                                      │   │
│  │  Webhook URL:                                       │   │
│  │  [https://api.telegram.org/bot.../sendMessage]     │   │
│  │                                                      │   │
│  │  Test webhook: [Send Test Alert]                   │   │
│  │                                                      │   │
│  │  Alert Thresholds:                                  │   │
│  │  CPU Usage:    [__80__] %                          │   │
│  │  Memory Usage: [__85__] %                          │   │
│  │  Disk Usage:   [__90__] %                          │   │
│  │                                                      │   │
│  │     [Skip for Now]  [Save & Continue →]            │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         STEP 5: Metrics Refresh Interval                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ⏱️ Data Collection Settings                         │   │
│  │                                                      │   │
│  │  How often should metrics be collected?            │   │
│  │                                                      │   │
│  │  Refresh Interval:                                  │   │
│  │  ⦿ 5 seconds  (High CPU usage, real-time)         │   │
│  │  ○ 15 seconds (Recommended)                         │   │
│  │  ○ 30 seconds (Balanced)                            │   │
│  │  ○ 60 seconds (Low overhead)                        │   │
│  │                                                      │   │
│  │  ℹ️ Lower intervals provide real-time data but      │   │
│  │     increase CPU usage                              │   │
│  │                                                      │   │
│  │              [Complete Setup →]                     │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               STEP 6: Setup Complete                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ✅ Nexus is Ready!                                  │   │
│  │                                                      │   │
│  │  Your dashboard is now configured:                  │   │
│  │                                                      │   │
│  │  ✓ Admin account created                            │   │
│  │  ✓ 2FA enabled                                      │   │
│  │  ✓ Alerts configured                                │   │
│  │  ✓ Metrics collection set                           │   │
│  │                                                      │   │
│  │  Next Steps:                                        │   │
│  │  1. Add your first node                             │   │
│  │  2. Download mobile app (optional)                  │   │
│  │  3. Scan pairing QR code                            │   │
│  │                                                      │   │
│  │              [Open Dashboard →]                     │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
                  Dashboard Loads
```

### Implementation Details

**Backend:**
- New route: `GET /api/onboarding/status` - Check if initialized
- New route: `POST /api/onboarding/step1` - Save admin account
- New route: `POST /api/onboarding/step2` - Verify 2FA setup
- New route: `POST /api/onboarding/step3` - Save alert config
- New route: `POST /api/onboarding/step4` - Save refresh interval
- New route: `POST /api/onboarding/complete` - Finalize setup

**Frontend:**
- New component: `Onboarding.jsx` - Multi-step wizard
- Persists across page reloads using localStorage
- Cannot be skipped or bypassed
- Creates initialization flag in database

**Database:**
- New table: `settings` (store refresh interval, alert config)
- Flag: `onboarding_completed` in settings
- Store: admin credentials with bcrypt hash
- Store: 2FA secret encrypted

---

## 🔐 Phase 2: Custom Authentication System

### Architecture

```
┌──────────────┐
│   Browser    │
└──────┬───────┘
       │
       │ 1. POST /api/auth/login
       │    { username, password, totp_code }
       │
       ▼
┌──────────────────────────────────────────┐
│           Auth Middleware                │
│  ┌────────────────────────────────────┐  │
│  │ 1. Validate username exists        │  │
│  │ 2. Verify password (bcrypt)        │  │
│  │ 3. Verify TOTP code (mandatory)    │  │
│  │ 4. Generate session token          │  │
│  │ 5. Store in sessions table         │  │
│  │ 6. Return token + user info        │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Components

**Password Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (@$!%*?&)

**Session Management:**
- Token: Secure random 64-character string
- Expiry: 24 hours (configurable)
- Refresh: Auto-refresh on activity
- Storage: SQLite sessions table

**2FA Implementation:**
- Library: speakeasy (already in package.json)
- Type: Time-based OTP (TOTP)
- Algorithm: SHA1
- Digits: 6
- Period: 30 seconds
- Backup codes: 10 single-use recovery codes

### Database Schema

```sql
-- Users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  totp_secret TEXT NOT NULL, -- Encrypted
  backup_codes TEXT, -- JSON array of hashed codes
  created_at INTEGER NOT NULL,
  last_login INTEGER,
  failed_attempts INTEGER DEFAULT 0,
  locked_until INTEGER
);

-- Sessions table
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_activity INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Settings table
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

---

## 🔔 Phase 3: Alert System

### Webhook Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Metrics   │────────>│ Alert Engine │────────>│  Webhook    │
│  Collector  │         │   (Checks)   │         │  Delivery   │
└─────────────┘         └──────────────┘         └─────────────┘
                                │                        │
                                │                        ▼
                                │                ┌───────────────┐
                                │                │   Telegram    │
                                │                │   /Discord    │
                                │                └───────────────┘
                                ▼
                        ┌──────────────┐
                        │ Alert Log    │
                        │  (History)   │
                        └──────────────┘
```

### Alert Conditions

```javascript
{
  "cpu": { "threshold": 80, "enabled": true },
  "memory": { "threshold": 85, "enabled": true },
  "disk": { "threshold": 90, "enabled": true },
  "node_offline": { "enabled": true },
  "high_process_count": { "threshold": 200, "enabled": false }
}
```

### Webhook Payload Format

```json
{
  "alert_type": "cpu_high",
  "severity": "warning",
  "node_name": "web-server-01",
  "node_id": "node_abc123",
  "metric": "CPU Usage",
  "current_value": 85.3,
  "threshold": 80,
  "timestamp": "2026-02-12T20:00:00Z",
  "message": "CPU usage on web-server-01 is at 85.3% (threshold: 80%)"
}
```

### Telegram Bot Integration Example

Users can create a Telegram bot and get webhook URL:
```
https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>&text={message}
```

---

## 📱 Phase 4: QR Code Pairing System

### Pairing Flow

```
Dashboard                          Mobile App
    │                                  │
    │ 1. Click "Pair Mobile App"       │
    ├─────────────────────────────────>│
    │                                  │
    │ 2. Generate pairing token        │
    │    (valid for 5 minutes)         │
    │                                  │
    │ 3. Display QR code               │
    │    ┌───────────────┐             │
    │    │  [QR CODE]    │             │
    │    │  Contains:    │             │
    │    │  - Server URL │             │
    │    │  - Pairing ID │             │
    │    │  - Token      │             │
    │    └───────────────┘             │
    │                                  │
    │                              4. Scan QR
    │<─────────────────────────────────┤
    │                                  │
    │ 5. POST /api/mobile/pair         │
    │    { pairing_id, token }         │
    │<─────────────────────────────────┤
    │                                  │
    │ 6. Validate & create API key     │
    │                                  │
    │ 7. Return credentials            │
    ├─────────────────────────────────>│
    │   { api_key, server_url }        │
    │                                  │
    │                              8. Store securely
    │                                  │
    │ 9. App is now paired! ✓          │
```

### QR Code Data Format

```json
{
  "version": "1.9.5",
  "server_url": "http://192.168.1.100:8080",
  "pairing_id": "pair_abc123xyz",
  "token": "secure_random_token_64_chars",
  "expires_at": 1707772800
}
```

---

## 📲 Phase 5: Mobile App Overhaul

### Current Issues
- Manual API URL entry (poor UX)
- Doesn't match dashboard design
- Limited functionality
- No push notifications

### New Design Principles
1. **Mirror Dashboard UI** - Same brutal/neon theme
2. **QR Pairing** - One-tap setup
3. **Push Notifications** - Alert delivery
4. **Offline Support** - Cache last known state
5. **Touch Optimized** - Mobile-first interactions

### Screens Redesign

**Login Screen → Pairing Screen**
```
┌─────────────────────────────────┐
│                                 │
│       🎯 Nexus Mobile           │
│                                 │
│  [Scan QR Code to Pair]         │
│                                 │
│  Or enter pairing code:         │
│  [____-____-____]               │
│                                 │
│  Already paired?                │
│  [Sign In]                      │
│                                 │
└─────────────────────────────────┘
```

**Dashboard**
- Same cards as web dashboard
- Swipeable node list
- Real-time metric graphs
- Pull to refresh

**Notifications**
- Push alerts from webhook system
- Notification history
- Quick actions (acknowledge, view node)

---

## 🔐 Phase 6: Console 2FA Protection

### Flow

```
User clicks "Console" on node
       │
       ▼
┌─────────────────────────┐
│   2FA Challenge Modal   │
│                         │
│  🔐 Security Check      │
│                         │
│  Enter 2FA code to      │
│  access console:        │
│                         │
│  [___][___][___]       │
│  [___][___][___]       │
│                         │
│  [Cancel] [Verify]      │
└─────────────────────────┘
       │
       │ Valid code?
       ▼
  Console Opens
```

### Implementation
- Verify current session + fresh 2FA code
- Time window: Code must be current (not old codes)
- Rate limit: 3 attempts, then lockout for 5 minutes
- Audit log: Log all console access attempts

---

## 📊 Implementation Roadmap

### Phase 1: Foundation (Days 1-2)
- [ ] Database schema updates
- [ ] Onboarding route handlers
- [ ] Password validation utilities
- [ ] 2FA library integration

### Phase 2: Onboarding UI (Days 3-4)
- [ ] Multi-step wizard component
- [ ] Welcome screen
- [ ] Admin account creation
- [ ] 2FA setup with QR code
- [ ] Alert configuration
- [ ] Metrics interval selection

### Phase 3: Authentication (Days 5-6)
- [ ] Login endpoint with 2FA
- [ ] Session management
- [ ] Auth middleware update
- [ ] Logout functionality
- [ ] Password change functionality

### Phase 4: Alert System (Days 7-8)
- [ ] Webhook delivery system
- [ ] Alert condition checker
- [ ] Alert history/logs
- [ ] Test alert functionality
- [ ] Telegram/Discord examples

### Phase 5: Mobile Pairing (Days 9-10)
- [ ] QR code generation
- [ ] Pairing token system
- [ ] Mobile pairing API
- [ ] API key generation for mobile
- [ ] Pairing UI in dashboard

### Phase 6: Mobile App (Days 11-13)
- [ ] QR scanner implementation
- [ ] UI overhaul to match dashboard
- [ ] Push notification setup
- [ ] Offline caching
- [ ] Testing on Android

### Phase 7: Console Protection (Day 14)
- [ ] 2FA challenge modal
- [ ] Console access verification
- [ ] Audit logging
- [ ] Rate limiting

### Phase 8: Testing & Polish (Days 15-16)
- [ ] End-to-end testing
- [ ] Documentation updates
- [ ] Migration guide
- [ ] Bug fixes

---

## 🚨 Breaking Changes

1. **Complete auth removal** - All existing auth deleted
2. **Mandatory onboarding** - First launch requires setup
3. **2FA required** - Cannot use system without it
4. **Mobile app incompatible** - Old app won't work
5. **API changes** - New endpoints, old ones removed

---

## 📝 Migration Strategy

**For New Installations:**
- Run onboarding flow on first launch
- No migration needed

**For Existing Installations:**
- Detect existing installation
- Force onboarding (treat as new)
- Option to import old API keys
- Alert users of breaking changes

---

## 🎯 Success Criteria

- [x] User completes onboarding in < 5 minutes
- [x] 2FA setup success rate > 95%
- [x] Mobile pairing works in < 30 seconds
- [x] Console 2FA adds < 2 seconds delay
- [x] Alert delivery < 5 seconds from threshold breach
- [x] Zero authentication bypass vulnerabilities

---

## 📦 New Dependencies Needed

```json
{
  "qrcode": "^1.5.3",           // QR code generation
  "speakeasy": "^2.0.0",        // Already have this
  "bcrypt": "^5.1.1",           // Already have this
  "rate-limiter-flexible": "^2.4.1"  // Advanced rate limiting
}
```

---

**Status:** Ready for approval to proceed with implementation

