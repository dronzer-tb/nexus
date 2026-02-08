const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const logger = require('../../utils/logger');
const auth = require('../../utils/auth');
const { loadAdmin } = require('../../utils/setup-admin');

// Rate limiter: max 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false }
});

// Helper function to get users (loads fresh each time to support dynamic changes)
function getUsers() {
  const admin = loadAdmin();
  if (admin) {
    return [admin];
  }
  
  // Fallback default admin if no file exists (backward compatibility)
  logger.warn('No admin account found, using default credentials');
  return [{
    id: 1,
    username: 'admin',
    password: '$2b$10$WgryAySWn0L4KAMvwYjRcORJS8VmNuPf2HDBFv2PL.cgqoUqvHPnG'
  }];
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
      }
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
    
    // Save updated admin credentials
    const { saveAdmin } = require('../../utils/setup-admin');
    saveAdmin(user);

    logger.info(`Password changed for user: ${user.username}`);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
