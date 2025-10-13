#!/usr/bin/env node
import * as readline from 'readline';
import * as fs from 'fs';
import * as bcrypt from 'bcrypt';
import { saveAdmin } from './db/admin';

const ASCII = `
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝

Dronzer Studios - Nexus Installer (Node.js)
`;

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(prompt, answer => resolve(answer));
  });
}

async function main() {
  console.log(ASCII);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const mode = (await question(rl, 'Default mode (agent/server) [agent]: ')) || 'agent';
  const serverUrl = (await question(rl, 'Server URL [http://localhost:8000]: ')) || 'http://localhost:8000';
  const apiKey = await question(rl, 'API Key (optional): ');

  // Write .env
  const envContent = [
    `NEXUS_MODE=${mode}`,
    `NEXUS_SERVER_URL=${serverUrl}`,
    apiKey ? `NEXUS_API_KEY=${apiKey}` : ''
  ].filter(Boolean).join('\n');

  fs.writeFileSync('.env', envContent, 'utf-8');
  console.log('Wrote .env');

  // Write config.json if not exists
  if (!fs.existsSync('config.json')) {
    const config = {
      mode,
      serverUrl,
      apiKey,
      dbPath: 'db/nexus.db',
      heartbeatInterval: 10,
      port: 8000
    };
    fs.writeFileSync('config.json', JSON.stringify(config, null, 2), 'utf-8');
    console.log('Wrote config.json');
  }

  // Create admin user
  const createAdmin = (await question(rl, 'Create admin user now? (y/N): ')) || 'n';
  if (createAdmin.toLowerCase() === 'y') {
    const username = (await question(rl, 'Admin username [admin]: ')) || 'admin';
    const password = await question(rl, 'Password: ');
    const confirmPassword = await question(rl, 'Confirm Password: ');

    if (password !== confirmPassword) {
      console.log('Passwords did not match; skipping admin creation');
    } else {
      const hashed = await bcrypt.hash(password, 10);
      saveAdmin({ username, password: hashed });
      console.log('Wrote admin user to db/admin.json');
    }
  }

  rl.close();
  console.log('Installation complete. Run: npm start');
}

main().catch(err => {
  console.error('Installation failed:', err);
  process.exit(1);
});
