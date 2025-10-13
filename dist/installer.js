#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const readline = __importStar(require("readline"));
const fs = __importStar(require("fs"));
const bcrypt = __importStar(require("bcrypt"));
const admin_1 = require("./db/admin");
const ASCII = `
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝

Dronzer Studios - Nexus Installer (Node.js)
`;
function question(rl, prompt) {
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
        }
        else {
            const hashed = await bcrypt.hash(password, 10);
            (0, admin_1.saveAdmin)({ username, password: hashed });
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
