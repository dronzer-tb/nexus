#!/usr/bin/env node
/**
 * Nexus Setup Wizard — Interactive nginx / domain / SSL configuration
 * Dronzer Studios
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ─── Colors ──────────────────────────────────
const C = {
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  reset:  '\x1b[0m',
};

const info = (msg) => console.log(`  ${C.green}✓${C.reset} ${msg}`);
const warn = (msg) => console.log(`  ${C.yellow}!${C.reset} ${msg}`);
const fail = (msg) => { console.log(`  ${C.red}✗${C.reset} ${msg}`); };
const step = (msg) => console.log(`\n  ${C.cyan}→${C.reset} ${C.bold}${msg}${C.reset}`);
const dim  = (msg) => console.log(`  ${C.dim}${msg}${C.reset}`);

// ─── Readline helper ─────────────────────────
function createRL() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl, question, defaultVal = '') {
  const suffix = defaultVal ? ` ${C.dim}[${defaultVal}]${C.reset}` : '';
  return new Promise((resolve) => {
    rl.question(`  ${C.cyan}?${C.reset} ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultVal);
    });
  });
}

function confirm(rl, question, defaultYes = true) {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  return new Promise((resolve) => {
    rl.question(`  ${C.cyan}?${C.reset} ${question} ${C.dim}[${hint}]${C.reset}: `, (answer) => {
      const a = answer.trim().toLowerCase();
      if (a === '') resolve(defaultYes);
      else resolve(a === 'y' || a === 'yes');
    });
  });
}

function choose(rl, question, options) {
  return new Promise((resolve) => {
    console.log(`\n  ${C.cyan}?${C.reset} ${question}`);
    options.forEach((opt, i) => {
      console.log(`    ${C.bold}${i + 1})${C.reset} ${opt.label}`);
    });
    const tryAsk = () => {
      rl.question(`  ${C.cyan}>${C.reset} Choice [1-${options.length}]: `, (answer) => {
        const num = parseInt(answer.trim(), 10);
        if (num >= 1 && num <= options.length) {
          resolve(options[num - 1].value);
        } else {
          warn(`Enter a number between 1 and ${options.length}`);
          tryAsk();
        }
      });
    };
    tryAsk();
  });
}

// ─── Nginx detection ─────────────────────────
function detectNginx() {
  try {
    const nginxPath = execSync('which nginx', { encoding: 'utf8' }).trim();
    return nginxPath;
  } catch {
    return null;
  }
}

function detectNginxConfigDir() {
  const candidates = [
    '/etc/nginx/sites-available',
    '/etc/nginx/conf.d',
    '/usr/local/etc/nginx/servers',   // macOS Homebrew
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

function detectNginxEnabledDir() {
  const candidates = [
    '/etc/nginx/sites-enabled',
    '/etc/nginx/conf.d',             // conf.d auto-loads
    '/usr/local/etc/nginx/servers',
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

// ─── Nginx config generation ─────────────────
function generateNginxConfig(domain, port, ssl) {
  const serverName = domain;

  if (ssl.type === 'certbot') {
    // Initial HTTP-only config; certbot will modify it
    return `# Nexus — Managed by Nexus Setup Wizard
# Domain: ${domain}

server {
    listen 80;
    listen [::]:80;
    server_name ${serverName};

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
`;
  }

  if (ssl.type === 'custom') {
    return `# Nexus — Managed by Nexus Setup Wizard
# Domain: ${domain}

server {
    listen 80;
    listen [::]:80;
    server_name ${serverName};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${serverName};

    ssl_certificate     ${ssl.certPath};
    ssl_certificate_key ${ssl.keyPath};
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
`;
  }

  if (ssl.type === 'none') {
    return `# Nexus — Managed by Nexus Setup Wizard
# Domain: ${domain}

server {
    listen 80;
    listen [::]:80;
    server_name ${serverName};

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
`;
  }
}

// ─── Certbot runner ──────────────────────────
function hasCertbot() {
  try {
    execSync('which certbot', { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

function runCertbot(domain, email) {
  console.log('');
  step('Running Certbot to obtain SSL certificate...');
  dim(`  certbot --nginx -d ${domain} --non-interactive --agree-tos -m ${email}`);
  console.log('');

  try {
    const result = spawnSync('certbot', [
      '--nginx',
      '-d', domain,
      '--non-interactive',
      '--agree-tos',
      '-m', email,
    ], { stdio: 'inherit' });

    if (result.status === 0) {
      info('SSL certificate obtained and nginx configured by Certbot');
      return true;
    } else {
      fail('Certbot failed. You may need to run it manually:');
      dim(`  sudo certbot --nginx -d ${domain}`);
      return false;
    }
  } catch (error) {
    fail(`Certbot error: ${error.message}`);
    return false;
  }
}

// ─── Write nginx config & enable ─────────────
function writeNginxConfig(configDir, enabledDir, domain, configContent) {
  const configFile = path.join(configDir, `nexus-${domain.replace(/\./g, '_')}`);
  
  try {
    fs.writeFileSync(configFile, configContent, 'utf8');
    info(`Nginx config written to ${configFile}`);
  } catch (error) {
    if (error.code === 'EACCES') {
      fail('Permission denied. Try running with sudo:');
      dim(`  sudo node src/setup/wizard.js`);
      return false;
    }
    throw error;
  }

  // Create symlink in sites-enabled if separate dirs
  if (configDir !== enabledDir) {
    const enabledLink = path.join(enabledDir, path.basename(configFile));
    try {
      if (fs.existsSync(enabledLink)) fs.unlinkSync(enabledLink);
      fs.symlinkSync(configFile, enabledLink);
      info(`Enabled site → ${enabledLink}`);
    } catch (error) {
      warn(`Could not create symlink: ${error.message}`);
      dim(`  Manually create: ln -s ${configFile} ${enabledLink}`);
    }
  }

  // Test nginx config
  try {
    execSync('nginx -t 2>&1', { encoding: 'utf8' });
    info('Nginx configuration test passed');
  } catch (error) {
    fail('Nginx configuration test failed:');
    console.log(error.stdout || error.stderr || error.message);
    return false;
  }

  // Reload nginx
  try {
    execSync('systemctl reload nginx 2>&1 || nginx -s reload 2>&1', { encoding: 'utf8' });
    info('Nginx reloaded successfully');
  } catch (error) {
    warn('Could not reload nginx automatically');
    dim('  Run: sudo systemctl reload nginx');
  }

  return true;
}

// ─── Save setup state ────────────────────────
function saveSetupConfig(setupData) {
  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  
  const setupFile = path.join(dataDir, 'setup.json');
  fs.writeFileSync(setupFile, JSON.stringify(setupData, null, 2), 'utf8');
  info(`Setup configuration saved to ${setupFile}`);
}

function loadSetupConfig() {
  const setupFile = path.join(__dirname, '../../data/setup.json');
  if (fs.existsSync(setupFile)) {
    try {
      return JSON.parse(fs.readFileSync(setupFile, 'utf8'));
    } catch { return null; }
  }
  return null;
}

// ─── Update main config ─────────────────────
function updateMainConfig(domain, ssl, port) {
  const configPath = path.join(__dirname, '../../config/config.json');
  const defaultConfigPath = path.join(__dirname, '../../config/config.default.json');
  
  let config;
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } else {
      config = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'));
    }
  } catch {
    config = {};
  }

  // Server should bind to localhost when behind nginx
  config.server = config.server || {};
  config.server.host = '127.0.0.1';
  config.server.port = parseInt(port, 10) || 8080;

  // Update node serverUrl to match the actual server port
  config.node = config.node || {};
  config.node.serverUrl = `http://127.0.0.1:${config.server.port}`;

  // Store nginx/domain info
  config.nginx = {
    enabled: true,
    domain: domain,
    ssl: ssl.type !== 'none',
    sslType: ssl.type,
  };

  // Store CORS origins for the domain
  config.server.corsOrigins = [
    `https://${domain}`,
    `http://${domain}`,
  ];

  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  info('Updated config.json — server will bind to 127.0.0.1 (behind nginx)');
}

// ─── Banner ──────────────────────────────────
function banner() {
  console.log(`${C.cyan}`);
  console.log('  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗');
  console.log('  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝');
  console.log('  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗');
  console.log('  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║');
  console.log('  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║');
  console.log('  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝');
  console.log(`${C.reset}`);
  console.log(`  ${C.bold}Dronzer Studios${C.reset} — Nginx & Domain Setup Wizard`);
  console.log('');
}

// ─── Parse CLI arguments ─────────────────────
function parseCliArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (const arg of args) {
    const match = arg.match(/^--([\w-]+)=(.*)$/);
    if (match) result[match[1]] = match[2];
  }
  return result;
}

// ═══════════════════════════════════════════════
//  MAIN WIZARD
// ═══════════════════════════════════════════════
async function runWizard() {
  banner();
  const rl = createRL();
  const cliArgs = parseCliArgs();

  try {
    // ─── Check existing setup ────────────────
    const existingSetup = loadSetupConfig();
    if (existingSetup && existingSetup.completed) {
      warn(`Nexus is already configured for ${C.bold}${existingSetup.domain}${C.reset}`);
      const rerun = await confirm(rl, 'Do you want to reconfigure?', false);
      if (!rerun) {
        info('Keeping existing configuration');
        rl.close();
        return existingSetup;
      }
    }

    // ─── Step 1: Check nginx ─────────────────
    step('Checking for nginx');

    const nginxPath = detectNginx();
    if (!nginxPath) {
      fail('nginx is not installed!');
      console.log('');
      console.log(`  ${C.bold}Please install nginx first:${C.reset}`);
      console.log('');
      console.log(`  ${C.dim}Ubuntu/Debian:${C.reset}  sudo apt install nginx`);
      console.log(`  ${C.dim}CentOS/RHEL:${C.reset}    sudo yum install nginx`);
      console.log(`  ${C.dim}Arch:${C.reset}           sudo pacman -S nginx`);
      console.log(`  ${C.dim}macOS:${C.reset}          brew install nginx`);
      console.log('');
      fail('Setup cannot continue without nginx. Exiting.');
      rl.close();
      process.exit(1);
    }

    // Get nginx version
    let nginxVersion = '';
    try {
      nginxVersion = execSync('nginx -v 2>&1', { encoding: 'utf8' }).trim();
    } catch (e) {
      nginxVersion = e.stderr?.trim() || 'unknown';
    }
    info(`Found nginx: ${nginxVersion}`);

    // ─── Step 2: Detect config directory ─────
    step('Detecting nginx configuration directory');

    let configDir = detectNginxConfigDir();
    let enabledDir = detectNginxEnabledDir();

    if (configDir) {
      info(`Detected config directory: ${configDir}`);
      const useDefault = await confirm(rl, `Use ${configDir}?`, true);
      if (!useDefault) {
        configDir = await ask(rl, 'Enter nginx sites-available path');
      }
    } else {
      warn('Could not auto-detect nginx config directory');
      configDir = await ask(rl, 'Enter nginx sites-available path', '/etc/nginx/sites-available');
    }

    if (!enabledDir || enabledDir === configDir) {
      enabledDir = configDir;
    } else {
      const useDefaultEnabled = await confirm(rl, `Use ${enabledDir} for sites-enabled?`, true);
      if (!useDefaultEnabled) {
        enabledDir = await ask(rl, 'Enter nginx sites-enabled path');
      }
    }

    // Verify directory exists
    if (!fs.existsSync(configDir)) {
      fail(`Directory does not exist: ${configDir}`);
      const createDir = await confirm(rl, 'Create it?', true);
      if (createDir) {
        try {
          fs.mkdirSync(configDir, { recursive: true });
          info(`Created ${configDir}`);
        } catch (error) {
          fail(`Cannot create directory: ${error.message}`);
          rl.close();
          process.exit(1);
        }
      } else {
        rl.close();
        process.exit(1);
      }
    }

    // ─── Step 3: Domain setup ────────────────
    step('Domain configuration');
    console.log('');
    dim('  Example: monitor.example.com');
    dim('  The subdomain should already have an A/CNAME record');
    dim('  pointing to this server\'s IP address.');
    console.log('');

    const subdomain = await ask(rl, 'Subdomain (e.g., monitor, nexus, dash)');
    const mainDomain = await ask(rl, 'Main domain (e.g., example.com)');

    if (!subdomain || !mainDomain) {
      fail('Both subdomain and domain are required');
      rl.close();
      process.exit(1);
    }

    const fullDomain = `${subdomain}.${mainDomain}`;
    info(`Full domain: ${C.bold}${fullDomain}${C.reset}`);

    // ─── Step 4: Port ────────────────────────
    let port;
    if (cliArgs.port) {
      port = cliArgs.port;
      info(`Using backend port from setup: ${port}`);
    } else {
      // Read current port from config.json if available
      let defaultPort = '8080';
      try {
        const cfgPath = path.join(__dirname, '../../config/config.json');
        if (fs.existsSync(cfgPath)) {
          const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
          if (cfg.server && cfg.server.port) defaultPort = String(cfg.server.port);
        }
      } catch {}
      port = await ask(rl, 'Nexus backend port', defaultPort);
    }
    info(`Backend port: ${port}`);

    // ─── Step 5: SSL setup ───────────────────
    step('SSL / HTTPS configuration');

    const sslChoice = await choose(rl, 'How would you like to set up SSL?', [
      { label: `${C.green}Certbot (Let\'s Encrypt)${C.reset} — Auto-generate free SSL certificate`, value: 'certbot' },
      { label: `${C.yellow}Custom SSL${C.reset} — Provide your own certificate and key files`, value: 'custom' },
      { label: `${C.dim}No SSL${C.reset} — HTTP only (not recommended for production)`, value: 'none' },
    ]);

    let ssl = { type: sslChoice };
    let certbotEmail = '';

    if (sslChoice === 'certbot') {
      if (!hasCertbot()) {
        warn('Certbot is not installed!');
        console.log('');
        console.log(`  ${C.bold}Install certbot:${C.reset}`);
        console.log(`  ${C.dim}Ubuntu/Debian:${C.reset}  sudo apt install certbot python3-certbot-nginx`);
        console.log(`  ${C.dim}CentOS/RHEL:${C.reset}    sudo yum install certbot python3-certbot-nginx`);
        console.log('');
        const continueAnyway = await confirm(rl, 'Continue without SSL for now? (You can run certbot later)', true);
        if (continueAnyway) {
          ssl.type = 'none';
          warn('Proceeding without SSL. Run certbot later to enable HTTPS.');
        } else {
          rl.close();
          process.exit(1);
        }
      } else {
        info('Certbot found');
        certbotEmail = await ask(rl, 'Email for Let\'s Encrypt notifications');
        if (!certbotEmail) {
          warn('Email is required for Certbot');
          rl.close();
          process.exit(1);
        }
        ssl.email = certbotEmail;
      }
    } else if (sslChoice === 'custom') {
      ssl.certPath = await ask(rl, 'Path to SSL certificate (.pem or .crt)');
      ssl.keyPath = await ask(rl, 'Path to SSL private key (.pem or .key)');

      if (!ssl.certPath || !ssl.keyPath) {
        fail('Both certificate and key paths are required');
        rl.close();
        process.exit(1);
      }

      if (!fs.existsSync(ssl.certPath)) {
        fail(`Certificate file not found: ${ssl.certPath}`);
        rl.close();
        process.exit(1);
      }
      if (!fs.existsSync(ssl.keyPath)) {
        fail(`Key file not found: ${ssl.keyPath}`);
        rl.close();
        process.exit(1);
      }

      info('SSL certificate and key verified');
    }

    // ─── Step 6: Confirmation ────────────────
    step('Configuration Summary');
    console.log('');
    console.log(`  ${C.bold}Domain:${C.reset}       ${fullDomain}`);
    console.log(`  ${C.bold}Backend:${C.reset}      127.0.0.1:${port}`);
    console.log(`  ${C.bold}Nginx dir:${C.reset}    ${configDir}`);
    console.log(`  ${C.bold}SSL:${C.reset}          ${sslChoice === 'certbot' ? 'Let\'s Encrypt (Certbot)' : sslChoice === 'custom' ? 'Custom certificate' : 'None (HTTP only)'}`);
    if (ssl.certPath) console.log(`  ${C.bold}Cert:${C.reset}         ${ssl.certPath}`);
    if (ssl.keyPath)  console.log(`  ${C.bold}Key:${C.reset}          ${ssl.keyPath}`);
    console.log('');

    const proceed = await confirm(rl, 'Apply this configuration?', true);
    if (!proceed) {
      warn('Setup cancelled');
      rl.close();
      return null;
    }

    // ─── Step 7: Apply ──────────────────────
    step('Applying configuration');

    // Generate and write nginx config
    const nginxConfig = generateNginxConfig(fullDomain, port, ssl);
    const writeResult = writeNginxConfig(configDir, enabledDir, fullDomain, nginxConfig);

    if (!writeResult) {
      fail('Failed to write nginx config. Please check permissions.');
      rl.close();
      process.exit(1);
    }

    // Update main Nexus config
    updateMainConfig(fullDomain, ssl, port);

    // Run certbot if selected
    if (ssl.type === 'certbot' && certbotEmail) {
      runCertbot(fullDomain, certbotEmail);
    }

    // Save setup state
    const setupData = {
      completed: true,
      domain: fullDomain,
      subdomain,
      mainDomain,
      port: parseInt(port, 10),
      ssl: ssl.type,
      sslCertPath: ssl.certPath || null,
      sslKeyPath: ssl.keyPath || null,
      nginxConfigDir: configDir,
      nginxEnabledDir: enabledDir,
      configuredAt: new Date().toISOString(),
    };
    saveSetupConfig(setupData);

    // ─── Done ────────────────────────────────
    console.log('');
    console.log(`  ${C.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
    console.log(`  ${C.green}${C.bold}  ✓ Nexus setup complete!${C.reset}`);
    console.log(`  ${C.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
    console.log('');
    if (ssl.type !== 'none') {
      console.log(`  ${C.bold}Dashboard:${C.reset}  https://${fullDomain}`);
    } else {
      console.log(`  ${C.bold}Dashboard:${C.reset}  http://${fullDomain}`);
    }
    console.log(`  ${C.bold}Login:${C.reset}      admin / admin123`);
    console.log('');
    console.log(`  ${C.dim}Start Nexus:${C.reset}  npm run start:server`);
    console.log(`  ${C.dim}Or with PM2:${C.reset}  pm2 start src/index.js --name nexus -- --mode=server`);
    console.log('');

    rl.close();
    return setupData;

  } catch (error) {
    rl.close();
    fail(`Setup error: ${error.message}`);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════
module.exports = { runWizard, loadSetupConfig };

// Run directly if called as script
if (require.main === module) {
  runWizard().catch((err) => {
    fail(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}
