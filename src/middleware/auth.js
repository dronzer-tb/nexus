const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const config = require('../utils/config');

function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, config.get('jwt.secret', 'nexus-secret-key'));
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    logger.error('Authentication error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = authenticate;
