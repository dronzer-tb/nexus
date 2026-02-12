# Keycloak Migration Guide

This guide helps you migrate from Nexus legacy authentication to Keycloak authentication.

## Overview

Nexus v1.9.1 introduces Keycloak as an optional authentication provider, offering enterprise-grade security features while maintaining backward compatibility with legacy authentication.

## Why Migrate to Keycloak?

### Benefits

✅ **Enterprise Security** - Industry-standard OAuth2/OpenID Connect  
✅ **Built-in 2FA/MFA** - TOTP support without custom implementation  
✅ **Centralized User Management** - Single admin console for all users  
✅ **Password Policies** - Enforce complexity, history, expiration  
✅ **Social Login** - Optional integration with Google, GitHub, etc.  
✅ **Audit Logging** - Complete authentication event tracking  
✅ **Session Management** - Advanced session controls and monitoring  
✅ **Scalability** - Proven to handle thousands of users  

### Legacy Authentication Issues (Fixed in Keycloak)

❌ Password reset bugs (field name mismatches)  
❌ 2FA only works for database users, not file admin  
❌ No centralized user management  
❌ Limited password policies  
❌ No audit logging  

## Migration Steps

### Step 1: Backup Current System

Before migrating, create backups of your current setup:

```bash
# Backup Nexus database
cp -r data data-backup-$(date +%Y%m%d)

# Backup admin credentials
cp data/admin-credentials.json data/admin-credentials.json.backup

# Backup configuration
cp .env .env.backup
cp config.json config.json.backup
```

### Step 2: Install Keycloak

#### Option A: Automated Installation (Recommended)

```bash
# Install Keycloak
bash scripts/install-keycloak.sh

# Setup Nexus realm
bash scripts/setup-keycloak-realm.sh
```

#### Option B: Manual Installation

See [NEXUS_COMPLETE_DOCUMENTATION.md](NEXUS_COMPLETE_DOCUMENTATION.md#-keycloak-authentication-v191) for detailed manual installation steps.

### Step 3: Verify Keycloak Installation

Check that Keycloak is running:

```bash
# Check service status
sudo systemctl status keycloak

# Test Keycloak endpoint
curl http://localhost:8080/realms/nexus

# Access admin console
# URL: http://localhost:8080/admin
# Credentials: ~/.keycloak-data/admin-credentials.txt
```

### Step 4: Migrate Users

Run the migration script to move existing users to Keycloak:

```bash
bash scripts/migrate-users-to-keycloak.sh
```

**Important Notes:**
- Temporary passwords are generated for all users
- Passwords are saved to `~/.keycloak-data/migrated-user-passwords.txt`
- Users must change password on first login
- User roles are preserved (admin, viewer, operator)

### Step 5: Distribute Temporary Passwords

Share temporary passwords with users securely:

```bash
# View migrated user passwords
cat ~/.keycloak-data/migrated-user-passwords.txt

# Send passwords to users via secure channel (encrypted email, password manager, etc.)

# DELETE the file after distribution
rm ~/.keycloak-data/migrated-user-passwords.txt
```

### Step 6: Enable Keycloak in Nexus

The setup scripts automatically update your `.env` file. Verify the settings:

```bash
cat .env | grep KEYCLOAK
```

You should see:

```
KEYCLOAK_ENABLED=true
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=nexus
KEYCLOAK_CLIENT_ID=nexus-web
KEYCLOAK_CLIENT_SECRET=<your-secret>
```

### Step 7: Restart Nexus

```bash
# If using systemd
sudo systemctl restart nexus

# If running manually
npm start
```

### Step 8: Test Authentication

1. **Access Nexus Dashboard**: http://localhost:8080
2. **Login with migrated user**:
   - Use existing username
   - Enter temporary password
   - You'll be prompted to change password
3. **Verify features**:
   - Check dashboard access
   - Verify role permissions
   - Test 2FA setup (optional)

## Testing Checklist

- [ ] Admin user can login with Keycloak
- [ ] Viewer user has read-only access
- [ ] Operator user can execute commands
- [ ] Password change on first login works
- [ ] 2FA enrollment works (via Keycloak account console)
- [ ] Token refresh works (stay logged in > 1 hour)
- [ ] Logout works correctly
- [ ] API keys still work for node agents

## Rollback Plan

If you encounter issues, you can rollback to legacy authentication:

### Temporary Rollback (Keep Keycloak Running)

```bash
# Edit .env file
nano .env

# Change this line:
KEYCLOAK_ENABLED=false

# Restart Nexus
sudo systemctl restart nexus
```

Users can now login with legacy authentication (old passwords still work).

### Complete Rollback (Remove Keycloak)

```bash
# Stop and disable Keycloak
sudo systemctl stop keycloak
sudo systemctl disable keycloak

# Restore backups
cp .env.backup .env
cp data-backup-$(date +%Y%m%d)/* data/

# Restart Nexus
sudo systemctl restart nexus

# Optionally uninstall Keycloak
sudo rm -rf /opt/keycloak
sudo rm /etc/systemd/system/keycloak.service
sudo systemctl daemon-reload
```

## Dual Authentication Mode (Transition Period)

Nexus supports both authentication methods simultaneously:

- **Keycloak users** - Login with Keycloak credentials
- **Legacy users** - Still works if `KEYCLOAK_ENABLED=true` but token validation fails

This allows a gradual migration where:
1. Enable Keycloak
2. Migrate users in batches
3. Test with small group first
4. Gradually add more users
5. Eventually disable legacy auth

## Common Issues

### Issue: Keycloak service won't start

**Solution:**
```bash
# Check Java installation
java -version

# View detailed logs
sudo journalctl -u keycloak -n 100 --no-pager

# Check port conflicts
sudo netstat -tlnp | grep 8080
```

### Issue: Users can't login after migration

**Solution:**
```bash
# Verify user exists in Keycloak
# Login to admin console: http://localhost:8080/admin
# Navigate to: Nexus realm → Users
# Search for username

# Check if user is enabled
# If not, enable and set temporary password
```

### Issue: Token validation fails

**Solution:**
```bash
# Test Keycloak userinfo endpoint
TOKEN="<access-token>"
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/realms/nexus/protocol/openid-connect/userinfo

# Check Nexus logs
sudo journalctl -u nexus -n 50
```

### Issue: 2FA not working

**Solution:**
- 2FA is now managed by Keycloak, not Nexus
- Users must set up 2FA in Keycloak Account Console
- Access: http://localhost:8080/realms/nexus/account
- Navigate to: Signing in → Authenticator Application

## Post-Migration Tasks

### 1. Update User Documentation

Notify users about:
- New login URL (if changed)
- Password change requirement
- 2FA setup via Keycloak
- Account management URL

### 2. Configure Password Policies

In Keycloak Admin Console:
1. Go to: Nexus realm → Authentication → Policies
2. Adjust policies as needed:
   - Minimum length
   - Special characters
   - Uppercase/lowercase requirements
   - Password history
   - Expiration

### 3. Enable Advanced Security Features

Consider enabling:
- **Account lockout** - After X failed attempts
- **Email verification** - Require email confirmation
- **Terms and conditions** - Users must accept
- **WebAuthn** - Hardware security key support

### 4. Monitor Authentication Events

1. Enable event logging in Keycloak
2. Go to: Nexus realm → Events → Config
3. Enable: Login events, Admin events
4. Set retention period

### 5. Plan for Production

For production deployment:
- [ ] Switch to PostgreSQL database (instead of H2)
- [ ] Enable HTTPS/TLS
- [ ] Configure reverse proxy (Nginx)
- [ ] Set up automated backups
- [ ] Configure external email server
- [ ] Plan high availability (if needed)

## Support

If you encounter issues during migration:

1. Check the [troubleshooting section](NEXUS_COMPLETE_DOCUMENTATION.md#troubleshooting) in main documentation
2. Review Keycloak logs: `sudo journalctl -u keycloak -f`
3. Review Nexus logs: `sudo journalctl -u nexus -f`
4. Open an issue on GitHub with:
   - Migration step where issue occurred
   - Error messages from logs
   - Keycloak version
   - Nexus version

## Migration Timeline Example

Here's a suggested timeline for enterprise deployments:

### Week 1: Preparation
- Install Keycloak on staging environment
- Test migration scripts
- Document custom configurations
- Train administrators

### Week 2: Pilot Deployment
- Migrate 5-10 test users
- Gather feedback
- Adjust configurations
- Fix any issues

### Week 3: Staged Rollout
- Migrate 25% of users
- Monitor for issues
- Provide user support
- Update documentation

### Week 4: Full Migration
- Migrate remaining users
- Monitor authentication metrics
- Disable legacy authentication
- Complete documentation

---

**Last Updated**: 2026-02-12  
**Nexus Version**: 1.9.1  
**Keycloak Version**: 23.0.4
