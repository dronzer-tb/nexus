const fs = require('fs');
const path = require('path');

class Config {
  constructor() {
    this.configPath = path.join(__dirname, '../../config/config.json');
    this.defaultConfigPath = path.join(__dirname, '../../config/config.default.json');
    this.config = null;
  }

  load() {
    try {
      // Check if custom config exists, otherwise use default
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        this.config = JSON.parse(configData);
      } else {
        // Copy default config to config.json
        const defaultData = fs.readFileSync(this.defaultConfigPath, 'utf8');
        this.config = JSON.parse(defaultData);
        
        // Create config directory if it doesn't exist
        const configDir = path.dirname(this.configPath);
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }
        
        // Write default config
        fs.writeFileSync(this.configPath, defaultData);
      }

      // Ensure data directory exists
      const dataDir = path.dirname(this.config.database.path);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      return this.config;
    } catch (error) {
      console.error('Failed to load configuration:', error);
      process.exit(1);
    }
  }

  get(key, defaultValue = undefined) {
    if (!this.config) {
      this.load();
    }

    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  set(key, value) {
    if (!this.config) {
      this.load();
    }

    const keys = key.split('.');
    let current = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    this.save();
  }

  save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  }

  getAll() {
    if (!this.config) {
      this.load();
    }
    return this.config;
  }
}

module.exports = new Config();
