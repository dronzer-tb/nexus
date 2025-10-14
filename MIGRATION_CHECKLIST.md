# Migration Checklist - New Nexus UI

Use this checklist to migrate from the old UI to the new UI implementation.

## Pre-Migration

- [ ] Backup your current Nexus installation
- [ ] Note down your current configuration
- [ ] Check Node.js version (must be 18+)
- [ ] Review `config/config.default.json` settings

## Installation Steps

### 1. Install Dependencies

- [ ] Run `npm install` in project root
- [ ] Run `cd dashboard && npm install` for dashboard
- [ ] Verify no npm errors occurred

### 2. Build Dashboard

- [ ] Run `cd dashboard && npm run build`
- [ ] Verify `dashboard/dist` directory is created
- [ ] Check for build errors in console

### 3. Backup Old Server Mode

- [ ] Copy `src/modes/server.js` to `src/modes/server-old.js`
- [ ] Verify backup file exists
- [ ] Note any custom modifications you made

### 4. Install New Server Mode

- [ ] Rename `src/modes/server-new.js` to `src/modes/server.js`
- [ ] Verify the new file is in place
- [ ] If you had custom modifications, merge them carefully

## Configuration

### 1. JWT Configuration

- [ ] Open `config/config.default.json`
- [ ] Add JWT section if not exists:
  ```json
  {
    "jwt": {
      "secret": "change-this-to-a-secure-random-string",
      "expiresIn": "24h"
    }
  }
  ```
- [ ] Generate a secure random string for production
- [ ] Save the configuration file

### 2. Server Settings

- [ ] Verify `server.port` is set (default: 8080)
- [ ] Verify `server.host` is set (default: 0.0.0.0)
- [ ] Check if these conflict with any existing services

## Testing

### 1. Start Server

- [ ] Run `npm run start:server`
- [ ] Check console for startup messages
- [ ] Verify no error messages appear
- [ ] Note the URL shown (e.g., http://localhost:8080)

### 2. Access Dashboard

- [ ] Open browser to the server URL
- [ ] Verify login page loads correctly
- [ ] Check browser console for errors
- [ ] Verify styling looks correct

### 3. Test Authentication

- [ ] Try logging in with:
  - Username: `admin`
  - Password: `admin123`
- [ ] Verify successful login redirects to overview
- [ ] Check that token is stored in localStorage
- [ ] Try refreshing the page (should stay logged in)

### 4. Test Pages

- [ ] Navigate to Overview page
  - [ ] Verify page loads without errors
  - [ ] Check layout matches design
- [ ] Navigate to Agents List
  - [ ] Verify table displays
  - [ ] Check if any agents are shown (may be empty initially)
- [ ] Navigate to Process Manager
  - [ ] Verify page loads
  - [ ] Check agent selector works
- [ ] Navigate to Command Console
  - [ ] Verify terminal-like interface
  - [ ] Check agent selector works
- [ ] Navigate to Logs page
  - [ ] Verify logs display
  - [ ] Check filtering works

### 5. Test Functionality

- [ ] Test logout button
- [ ] Test navigation between pages
- [ ] Test responsive design (resize browser)
- [ ] Test WebSocket connection (check browser console)

## Connect Agents

### 1. Start Agent Node

- [ ] Start a node in agent mode: `npm run start:node`
- [ ] Check server console for "Agent connected" message
- [ ] Verify agent appears in dashboard

### 2. Verify Agent Display

- [ ] Check Overview page shows agent card
- [ ] Check Agents List shows agent in table
- [ ] Click on agent to view details
- [ ] Verify metrics are updating

### 3. Test Agent Features

- [ ] View agent processes
- [ ] Try killing a test process
- [ ] Execute a simple command (e.g., `echo test`)
- [ ] Verify command output displays

## Security

### 1. Change Default Password

- [ ] Log in to dashboard
- [ ] Navigate to settings (if implemented) OR
- [ ] Manually update password hash in `src/api/routes/auth.js`:
  ```javascript
  // Generate new hash with:
  const bcrypt = require('bcrypt');
  bcrypt.hash('your-new-password', 10, (err, hash) => {
    console.log(hash);
  });
  ```
- [ ] Update the password hash in the users array
- [ ] Test login with new password
- [ ] Document the new password securely

### 2. Secure JWT Secret

- [ ] Generate a strong random secret (32+ characters)
- [ ] Update in `config/config.default.json`
- [ ] Restart server
- [ ] Test that authentication still works

### 3. Review CORS Settings

- [ ] Check CORS configuration in `src/modes/server.js`
- [ ] Update `origin` if needed for production
- [ ] Restart and test

## Production Deployment

### 1. Environment Variables

- [ ] Set `NODE_ENV=production`
- [ ] Set JWT secret via environment variable
- [ ] Configure any other environment-specific settings

### 2. SSL/TLS

- [ ] Obtain SSL certificate
- [ ] Configure HTTPS in server
- [ ] Update URLs to use https://
- [ ] Test secure connection

### 3. Firewall

- [ ] Open required ports (e.g., 8080)
- [ ] Configure firewall rules
- [ ] Test remote access

### 4. Process Management

- [ ] Set up PM2 or systemd service
- [ ] Configure auto-restart on failure
- [ ] Set up log rotation
- [ ] Test service start/stop

## Rollback Plan

If issues occur, you can rollback:

### Quick Rollback

- [ ] Stop the server: `Ctrl+C`
- [ ] Restore old server: `mv src/modes/server-old.js src/modes/server.js`
- [ ] Delete new server: `rm src/modes/server-new.js`
- [ ] Restart server: `npm run start:server`

### Full Rollback

- [ ] Restore from your backup
- [ ] Remove dashboard/dist directory
- [ ] Revert any configuration changes
- [ ] Test that old version works

## Post-Migration

### 1. Documentation

- [ ] Update your internal documentation
- [ ] Document any custom changes made
- [ ] Update user guides if needed

### 2. User Training

- [ ] Inform users of UI changes
- [ ] Provide new credentials if changed
- [ ] Share new user guide

### 3. Monitoring

- [ ] Monitor server logs for errors
- [ ] Monitor resource usage
- [ ] Check for user feedback

### 4. Optimization

- [ ] Review performance metrics
- [ ] Optimize if needed
- [ ] Consider enabling gzip compression
- [ ] Set up caching headers

## Troubleshooting

### Dashboard Not Loading

- [ ] Verify `dashboard/dist` exists and has files
- [ ] Check server console for errors
- [ ] Try rebuilding: `cd dashboard && npm run build`
- [ ] Clear browser cache

### Authentication Failing

- [ ] Check JWT secret is set
- [ ] Verify password hash is correct
- [ ] Check browser console for errors
- [ ] Verify token expiration time

### WebSocket Not Connecting

- [ ] Check browser console for connection errors
- [ ] Verify token is being sent
- [ ] Check server WebSocket configuration
- [ ] Test with simpler WebSocket client

### Agents Not Showing

- [ ] Verify agents are connecting to server
- [ ] Check server logs for "Agent connected"
- [ ] Verify WebSocket namespace is correct
- [ ] Check firewall/network settings

## Support

If you encounter issues:

1. Check the logs in browser console and server console
2. Review `NEW_UI_GUIDE.md` for detailed information
3. Check `QUICK_START_NEW_UI.md` for basic setup
4. Review `IMPLEMENTATION_SUMMARY.md` for architecture

## Completion

- [ ] All tests passed
- [ ] Documentation updated
- [ ] Users notified
- [ ] Backup created
- [ ] Migration complete!

---

**Migration Date**: _______________  
**Migrated By**: _______________  
**Notes**: _______________

---

**Nexus by Dronzer Studios**
