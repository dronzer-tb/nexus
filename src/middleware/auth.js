const logger = require('../utils/logger');
const auth = require('../utils/auth');

function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = auth.verifyJWT(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = authenticate;
