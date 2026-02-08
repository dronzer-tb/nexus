const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const logger = require('../../utils/logger');
const auth = require('../../utils/auth');
const database = require('../../utils/database');
const authenticate = require('../../middleware/auth');
const { loadAdmin } = require('../../utils/setup-admin');
const encryption = require('../../utils/encryption');

// Rate limiter: max 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false, xForwardedForHeader: false }
});

// Helper function to get users (loads fresh each time to support dynamic changes)
function getUsers() {
  const admin = loadAdmin();
  const users = [];
  
  if (admin) {
    users.push({ ...admin, role: 'admin', source: 'file' });
  } else {
    // Fallback default admin if no file exists (backward compatibility)
    logger.warn('No admin account found, using default credentials');
    users.push({
      id: 1,
      username: 'admin',
      password: '$2b$10$WgryAySWn0L4KAMvwYjRcORJS8VmNuPf2HDBFv2PL.cgqoUqvHPnG',
      role: 'admin',
      source: 'file'
    });
  }

  // Also load database users
  try {
    const dbUsers = database.getAllUsers();
    dbUsers.forEach(u => {
      users.push({
        id: `db_${u.id}`,
        dbId: u.id,
        username: u.username,
        password: u.password || '',
        role: u.role || 'viewer',
        mustChangePassword: u.must_change_password === 1,
        source: 'database'
      });
    });
  } catch {
    // Database may not have users table yet
  }

  return users;
}

// Login endpoint (rate-limited)
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Find user
    const users = getUsers();
    const user = users.find(u => u.username === username);
    if (!user) {
      logger.warn(`Failed login attempt for user: ${username}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      logger.warn(`Failed login attempt for user: ${username}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = auth.generateJWT({ userId: user.id, username: user.username });

    logger.info(`User logged in: ${username}`);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username
      },
      mustChangePassword: user.mustChangePassword === true
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Verify token endpoint
router.get('/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = auth.verifyJWT(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    const users = getUsers();
    const user = users.find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    logger.error('Token verification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Change password endpoint
router.post('/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { currentPassword, newPassword } = req.body;

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' });
    }

    const decoded = auth.verifyJWT(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    const users = getUsers();
    const user = users.find(u => u.id === decoded.userId);

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password and save
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.mustChangePassword = false;
    
    // Save based on user source
    if (user.source === 'database') {
      database.updateUser(user.dbId, { password: hashedPassword, mustChangePassword: false });
    } else {
      // Save updated admin credentials
      const { saveAdmin } = require('../../utils/setup-admin');
      saveAdmin(user);
    }

    logger.info(`Password changed for user: ${user.username}`);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── User Management ───────────────────────────────────────────

// Create a new user (JWT auth required — admin only)
router.post('/users', authenticate, async (req, res) => {
  try {
    if (req.authMethod !== 'jwt') {
      return res.status(403).json({ message: 'User management requires dashboard login' });
    }

    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    if (username.length < 3 || username.length > 32) {
      return res.status(400).json({ message: 'Username must be 3-32 characters' });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ message: 'Username can only contain letters, numbers, underscores and hyphens' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const validRoles = ['admin', 'viewer'];
    const userRole = validRoles.includes(role) ? role : 'viewer';

    // Check for duplicate username (check both file admin and DB)
    const existingUsers = getUsers();
    if (existingUsers.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    database.createUser({
      username: username.trim(),
      password: hashedPassword,
      role: userRole,
      mustChangePassword: true
    });

    logger.info(`User created: ${username} (role: ${userRole})`);
    res.json({ success: true, message: `User '${username}' created successfully` });
  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// List all users (JWT auth required)
router.get('/users', authenticate, (req, res) => {
  try {
    if (req.authMethod !== 'jwt') {
      return res.status(403).json({ message: 'User management requires dashboard login' });
    }

    const admin = loadAdmin();
    const dbUsers = database.getAllUsers();

    const users = [];
    if (admin) {
      users.push({
        id: 'admin',
        username: admin.username,
        role: 'admin',
        source: 'file',
        createdAt: admin.createdAt || null
      });
    }

    dbUsers.forEach(u => {
      users.push({
        id: u.id,
        username: u.username,
        role: u.role,
        source: 'database',
        createdAt: u.created_at ? new Date(u.created_at * 1000).toISOString() : null
      });
    });

    res.json({ success: true, users });
  } catch (error) {
    logger.error('List users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a user (JWT auth required — cannot delete file admin)
router.delete('/users/:userId', authenticate, (req, res) => {
  try {
    if (req.authMethod !== 'jwt') {
      return res.status(403).json({ message: 'User management requires dashboard login' });
    }

    const { userId } = req.params;

    if (userId === 'admin') {
      return res.status(403).json({ message: 'Cannot delete the primary admin account' });
    }

    const parsedId = parseInt(userId);
    if (isNaN(parsedId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = database.getUserById(parsedId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    database.deleteUser(parsedId);
    logger.info(`User deleted: ${user.username} (id: ${parsedId})`);

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── Encryption Info ───────────────────────────────────────────

// Get encryption salt (requires valid API key — used by mobile app for E2E decryption)
router.get('/encryption-info', (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ success: false, message: 'API key required' });
    }

    // Verify the API key is valid
    const keyHash = auth.hashApiKey(apiKey);
    const keyRecord = database.getApiKeyByHash(keyHash);
    if (!keyRecord) {
      return res.status(401).json({ success: false, message: 'Invalid API key' });
    }

    res.json({
      success: true,
      encryption: {
        enabled: encryption.isEnabled(),
        salt: encryption.isEnabled() ? encryption.getInstallationSalt() : null,
        algorithm: encryption.ALGORITHM
      }
    });
  } catch (error) {
    logger.error('Encryption info error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── API Key Management ────────────────────────────────────────

// Create a new API key (JWT auth required — dashboard admin only)
router.post('/api-keys', authenticate, (req, res) => {
  try {
    if (req.authMethod !== 'jwt') {
      return res.status(403).json({ message: 'API key management requires dashboard login' });
    }

    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'A name for the API key is required' });
    }

    const keyId = `key_${crypto.randomBytes(8).toString('hex')}`;
    const rawKey = `nxk_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = auth.hashApiKey(rawKey);
    const keyPreview = rawKey.substring(0, 8) + '...' + rawKey.substring(rawKey.length - 4);

    database.createApiKey({
      id: keyId,
      name: name.trim().substring(0, 64),
      keyHash,
      keyPreview,
      permissions: 'read',
      expiresAt: null
    });

    logger.info(`API key created: ${name} (${keyId})`);

    // Return the raw key ONLY on creation — it cannot be retrieved later
    res.json({
      success: true,
      key: {
        id: keyId,
        name: name.trim(),
        rawKey,
        preview: keyPreview,
        permissions: 'read'
      }
    });
  } catch (error) {
    logger.error('Create API key error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// List all API keys (JWT auth required)
router.get('/api-keys', authenticate, (req, res) => {
  try {
    if (req.authMethod !== 'jwt') {
      return res.status(403).json({ message: 'API key management requires dashboard login' });
    }

    const keys = database.getAllApiKeys();
    res.json({ success: true, keys });
  } catch (error) {
    logger.error('List API keys error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Verify an API key (used by mobile app to test connection)
router.get('/api-keys/verify', (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ success: false, message: 'No API key provided' });
    }

    const keyHash = auth.hashApiKey(apiKey);
    const keyRecord = database.getApiKeyByHash(keyHash);

    if (!keyRecord) {
      return res.status(401).json({ success: false, message: 'Invalid API key' });
    }

    if (keyRecord.expires_at && Date.now() > keyRecord.expires_at) {
      return res.status(401).json({ success: false, message: 'API key expired' });
    }

    database.updateApiKeyLastUsed(keyRecord.id);

    res.json({
      success: true,
      name: keyRecord.name,
      permissions: keyRecord.permissions
    });
  } catch (error) {
    logger.error('Verify API key error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete an API key (JWT auth required)
router.delete('/api-keys/:keyId', authenticate, (req, res) => {
  try {
    if (req.authMethod !== 'jwt') {
      return res.status(403).json({ message: 'API key management requires dashboard login' });
    }

    const { keyId } = req.params;
    const result = database.deleteApiKey(keyId);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'API key not found' });
    }

    logger.info(`API key deleted: ${keyId}`);
    res.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    logger.error('Delete API key error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
