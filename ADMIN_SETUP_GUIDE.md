# Admin Account Setup Guide

## Overview

Starting from the latest version, Nexus now prompts you to create a secure admin account during installation for Combine and Server modes. This replaces the old default `admin/admin123` credentials with your own custom username and password.

## During Installation

### When You'll Be Prompted

The admin account setup happens during installation if you select:
- **Combine Mode** - Needs dashboard access
- **Server Mode** - Needs dashboard access

**Node Mode** skips this step as it doesn't include a dashboard.

### The Setup Process

```
═══════════════════════════════════════════════════════
   ADMIN ACCOUNT SETUP
═══════════════════════════════════════════════════════

Create your admin account for the Nexus dashboard.
This account will have full access to the system.

Enter admin username (min 3 characters): yourusername
Enter admin password (min 8 characters): ********
Confirm admin password: ********

[INFO] Hashing password...
[✓] Admin account created successfully!
[✓] Username: yourusername
```

### Requirements

**Username:**
- Minimum 3 characters
- Can contain letters, numbers, and underscores
- Case-sensitive

**Password:**
- Minimum 8 characters
- Should be strong and unique
- Will be hashed with bcrypt (10 rounds)
- Stored securely in `data/admin-credentials.json`

## Security Features

### 1. Password Hashing
- Passwords are hashed using bcrypt with 10 salt rounds
- Original password is never stored
- Resistant to rainbow table attacks

### 2. Secure Storage
- Admin credentials stored in `data/admin-credentials.json`
- File permissions set to `0600` (owner read/write only)
- Git-ignored by default

### 3. Random JWT Secret
- Installation generates a unique 128-character JWT secret
- Stored in `config/config.json`
- Used for token signing and verification

### 4. No Default Credentials
- No more `admin/admin123` default account
- Forces secure credential creation
- Reduces security risks

## File Locations

### Admin Credentials
```
data/admin-credentials.json
```

**Format:**
```json
{
  "id": 1,
  "username": "yourusername",
  "password": "$2b$10$...(bcrypt hash)...",
  "createdAt": "2025-10-14T19:55:45.123Z"
}
```

### Configuration
```
config/config.json
```

**JWT Secret:**
```json
{
  "server": {
    "port": 8080,
    "host": "0.0.0.0",
    "jwtSecret": "randomly-generated-128-char-secret"
  }
}
```

## Manual Admin Creation

If you need to create or reset the admin account manually:

### Method 1: Using Node.js

```bash
cd nexus
node -e "
const { setupAdminInteractive } = require('./src/utils/setup-admin');
setupAdminInteractive().then(() => process.exit(0));
"
```

### Method 2: Using bcrypt CLI

```bash
# Generate password hash
node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('your-new-password', 10).then(hash => {
  console.log('Hash:', hash);
  process.exit(0);
});
"

# Create admin-credentials.json manually
cat > data/admin-credentials.json << EOF
{
  "id": 1,
  "username": "admin",
  "password": "PASTE_HASH_HERE",
  "createdAt": "$(date -Iseconds)"
}
EOF

# Set proper permissions
chmod 600 data/admin-credentials.json
```

## Changing Your Password

### Through Dashboard (Recommended)

1. Login to dashboard at `http://localhost:8080`
2. Go to Settings or Profile page
3. Use "Change Password" feature
4. Enter current password and new password
5. Password is updated and rehashed automatically

### Through API

```bash
# Get auth token first
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"current-password"}' \
  | jq -r '.token')

# Change password
curl -X POST http://localhost:8080/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "currentPassword": "current-password",
    "newPassword": "new-secure-password"
  }'
```

### Manual Reset

```bash
# Delete existing admin account
rm data/admin-credentials.json

# Run setup again
node -e "
const { setupAdminInteractive } = require('./src/utils/setup-admin');
setupAdminInteractive().then(() => process.exit(0));
"

# Or recreate during full reinstall
./install.sh
```

## Troubleshooting

### Issue: "secretOrPrivateKey must have a value"

**Cause:** JWT secret not set in configuration.

**Solution:**
```bash
# Generate new JWT secret
node -e "
const fs = require('fs');
const crypto = require('crypto');
const config = JSON.parse(fs.readFileSync('config/config.json', 'utf8'));
config.server.jwtSecret = crypto.randomBytes(64).toString('hex');
fs.writeFileSync('config/config.json', JSON.stringify(config, null, 2));
console.log('JWT secret generated');
"

# Restart server
npm run start:combine
```

### Issue: Cannot login with created credentials

**Check 1: Verify admin file exists**
```bash
ls -la data/admin-credentials.json
```

**Check 2: Verify file contents**
```bash
cat data/admin-credentials.json
```

**Check 3: Check server logs**
```bash
tail -f data/nexus.log
```

**Check 4: Recreate admin account**
```bash
rm data/admin-credentials.json
node -e "const {setupAdminInteractive} = require('./src/utils/setup-admin'); setupAdminInteractive();"
```

### Issue: Password doesn't meet requirements

**Solution:** Ensure password is:
- At least 8 characters long
- Not empty
- Matches confirmation

**Example strong password:**
```
MySecureP@ssw0rd2025!
```

### Issue: Username already exists

This shouldn't happen in single-admin setup, but if using custom user management:

```bash
# Remove existing admin
rm data/admin-credentials.json

# Create new one
./install.sh
```

## Migration from Old Defaults

If you had the old default `admin/admin123` credentials:

### Option 1: Keep Using Old Credentials

The system will automatically create a fallback admin with the old hash if no `admin-credentials.json` exists.

### Option 2: Migrate to New System

```bash
# Remove old hardcoded references
rm -f data/admin-credentials.json

# Create new secure account
node -e "
const { setupAdminInteractive } = require('./src/utils/setup-admin');
setupAdminInteractive().then(() => process.exit(0));
"

# Restart server
npm run start:combine
```

## Best Practices

### 1. Use Strong Passwords
- At least 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- Not based on dictionary words
- Not used elsewhere

### 2. Change Default Immediately
If you somehow end up with default credentials, change them immediately after first login.

### 3. Backup Credentials Securely
```bash
# Backup admin credentials (encrypted)
gpg -c data/admin-credentials.json

# Restore when needed
gpg -d data/admin-credentials.json.gpg > data/admin-credentials.json
chmod 600 data/admin-credentials.json
```

### 4. Regular Password Rotation
Change passwords every 90 days for better security.

### 5. Secure the JWT Secret
Never commit `config/config.json` with production JWT secret to version control.

## Security Considerations

### ⚠️ Important Notes

1. **File Permissions**: `admin-credentials.json` is set to `0600` (owner-only access)
2. **Never Share**: Don't share your admin credentials or JWT secret
3. **HTTPS in Production**: Always use HTTPS in production environments
4. **Firewall Rules**: Restrict port 8080 access to trusted networks
5. **Regular Updates**: Keep Nexus updated for security patches

### Production Deployment

For production, consider:

1. **Database Integration**: Move from file-based to database-based user management
2. **Multi-User Support**: Implement proper user roles and permissions
3. **2FA**: Add two-factor authentication
4. **Audit Logging**: Track all login attempts and admin actions
5. **Session Management**: Implement session timeout and refresh tokens

---

**Made with ❤️ by Dronzer Studios**
