const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const readline = require('readline');
const crypto = require('crypto');

const ADMIN_FILE = path.join(__dirname, '../../data/admin-credentials.json');

// Create readline interface
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

// Prompt for input
function prompt(question) {
  const rl = createInterface();
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Prompt for password (hidden input)
function promptPassword(question) {
  const rl = createInterface();
  return new Promise((resolve) => {
    rl.question(question, (password) => {
      rl.close();
      resolve(password);
    });
    // Note: For true hidden input, would need a library like 'readline-sync' or 'prompt'
    // This is a simple version
  });
}

// Check if admin account exists
function adminExists() {
  return fs.existsSync(ADMIN_FILE);
}

// Load admin credentials
function loadAdmin() {
  if (!adminExists()) {
    return null;
  }
  try {
    const data = fs.readFileSync(ADMIN_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading admin credentials:', error);
    return null;
  }
}

// Save admin credentials
function saveAdmin(admin) {
  try {
    const dataDir = path.dirname(ADMIN_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(ADMIN_FILE, JSON.stringify(admin, null, 2));
    fs.chmodSync(ADMIN_FILE, 0o600); // Make file readable/writable only by owner
    return true;
  } catch (error) {
    console.error('Error saving admin credentials:', error);
    return false;
  }
}

// Generate random JWT secret
function generateJwtSecret() {
  return crypto.randomBytes(64).toString('hex');
}

// Setup admin account interactively
async function setupAdminInteractive() {
  console.log('\n\x1b[36m═══════════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[36m   ADMIN ACCOUNT SETUP\x1b[0m');
  console.log('\x1b[36m═══════════════════════════════════════════════════════\x1b[0m\n');
  
  console.log('\x1b[33mCreate your admin account for the Nexus dashboard.\x1b[0m');
  console.log('\x1b[33mThis account will have full access to the system.\x1b[0m\n');

  let username = '';
  while (!username || username.length < 3) {
    username = await prompt('\x1b[32mEnter admin username (min 3 characters): \x1b[0m');
    if (!username || username.length < 3) {
      console.log('\x1b[31m✗ Username must be at least 3 characters long.\x1b[0m');
    }
  }

  let password = '';
  let confirmPassword = '';
  while (!password || password.length < 8 || password !== confirmPassword) {
    password = await promptPassword('\x1b[32mEnter admin password (min 8 characters): \x1b[0m');
    if (!password || password.length < 8) {
      console.log('\x1b[31m✗ Password must be at least 8 characters long.\x1b[0m');
      continue;
    }
    confirmPassword = await promptPassword('\x1b[32mConfirm admin password: \x1b[0m');
    if (password !== confirmPassword) {
      console.log('\x1b[31m✗ Passwords do not match. Please try again.\x1b[0m');
      password = '';
    }
  }

  console.log('\n\x1b[34m[INFO]\x1b[0m Hashing password...');
  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = {
    id: 1,
    username: username,
    password: hashedPassword,
    createdAt: new Date().toISOString()
  };

  if (saveAdmin(admin)) {
    console.log('\x1b[32m[✓]\x1b[0m Admin account created successfully!');
    console.log(`\x1b[32m[✓]\x1b[0m Username: \x1b[33m${username}\x1b[0m\n`);
    return admin;
  } else {
    console.error('\x1b[31m[✗]\x1b[0m Failed to save admin credentials.');
    return null;
  }
}

// Setup default admin account (for non-interactive use)
async function setupDefaultAdmin() {
  console.log('\x1b[33m[!]\x1b[0m Creating default admin account...');
  
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = {
    id: 1,
    username: 'admin',
    password: hashedPassword,
    createdAt: new Date().toISOString()
  };

  if (saveAdmin(admin)) {
    console.log('\x1b[32m[✓]\x1b[0m Default admin account created');
    console.log('\x1b[33m[!]\x1b[0m Default credentials: admin / admin123\x1b[0m');
    console.log('\x1b[33m[!]\x1b[0m Please change the password after first login!\x1b[0m\n');
    return admin;
  }
  return null;
}

module.exports = {
  adminExists,
  loadAdmin,
  saveAdmin,
  setupAdminInteractive,
  setupDefaultAdmin,
  generateJwtSecret
};
