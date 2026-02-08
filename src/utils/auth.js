const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('./config');

class Auth {
  constructor() {
    this._jwtSecret = null;
  }

  /**
   * Returns the JWT secret. If none is configured, generates a cryptographically
   * secure random secret and persists it to config so it survives restarts.
   */
  getJwtSecret() {
    if (this._jwtSecret) return this._jwtSecret;

    let secret = config.get('server.jwtSecret');

    // Reject known insecure defaults
    const insecureDefaults = [
      'change-this-secret-in-production',
      'default-secret-change-me',
      'nexus-secret-key',
      'nexus-secret-key-change-in-production',
      'your-super-secret-jwt-key-change-this-in-production'
    ];

    if (!secret || insecureDefaults.includes(secret)) {
      secret = crypto.randomBytes(64).toString('hex');
      config.set('server.jwtSecret', secret);
      const logger = require('./logger');
      logger.warn('JWT secret was missing or insecure — generated a new random secret and saved to config.');
    }

    this._jwtSecret = secret;
    return secret;
  }

  generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateJWT(payload, expiresIn = '24h') {
    return jwt.sign(payload, this.getJwtSecret(), { expiresIn });
  }

  verifyJWT(token) {
    try {
      return jwt.verify(token, this.getJwtSecret());
    } catch (error) {
      return null;
    }
  }

  hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  verifyApiKey(apiKey, hashedKey) {
    const hash = this.hashApiKey(apiKey);
    // Use constant-time comparison to prevent timing attacks
    if (hash.length !== hashedKey.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hashedKey));
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
