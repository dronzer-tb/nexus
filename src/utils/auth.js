const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('./config');

class Auth {
  generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateJWT(payload, expiresIn = '24h') {
    const secret = config.get('server.jwtSecret') || 'default-secret-change-me';
    return jwt.sign(payload, secret, { expiresIn });
  }

  verifyJWT(token) {
    try {
      const secret = config.get('server.jwtSecret') || 'default-secret-change-me';
      return jwt.verify(token, secret);
    } catch (error) {
      return null;
    }
  }

  hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  verifyApiKey(apiKey, hashedKey) {
    const hash = this.hashApiKey(apiKey);
    return hash === hashedKey;
  }

  middleware() {
    return (req, res, next) => {
      const apiKey = req.headers['x-api-key'];
      const authHeader = req.headers['authorization'];

      if (apiKey) {
        // API Key authentication
        req.apiKey = apiKey;
        next();
      } else if (authHeader && authHeader.startsWith('Bearer ')) {
        // JWT authentication
        const token = authHeader.substring(7);
        const decoded = this.verifyJWT(token);
        
        if (decoded) {
          req.user = decoded;
          next();
        } else {
          res.status(401).json({ error: 'Invalid or expired token' });
        }
      } else {
        res.status(401).json({ error: 'No authentication credentials provided' });
      }
    };
  }

  generateNodeId() {
    return `node_${crypto.randomBytes(16).toString('hex')}`;
  }
}

module.exports = new Auth();
