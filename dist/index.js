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
/**
 * Nexus - Single program that runs as Agent, Server, or Both
 * Node.js/TypeScript implementation
 */
const commander_1 = require("commander");
const dotenv = __importStar(require("dotenv"));
const config_1 = require("./config");
const server_1 = require("./server");
const agent_1 = require("./agent");
const deps_1 = require("./utils/deps");
const readline = __importStar(require("readline"));
dotenv.config();
const ASCII_ART = `
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
        Dronzer Studios - v1.0.0
`;
async function promptMode() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        console.log('Select mode to run:');
        console.log('  1) Agent');
        console.log('  2) Server');
        console.log('  3) Agent + Server (both)');
        rl.question('Enter choice [1]: ', (answer) => {
            rl.close();
            const choice = answer.trim() || '1';
            const mapping = { '1': 'agent', '2': 'server', '3': 'both' };
            resolve(mapping[choice] || 'agent');
        });
    });
}
async function main() {
    const program = new commander_1.Command();
    program
        .name('nexus')
        .description('Nexus - Agent/Server monitoring system')
        .option('--mode <mode>', 'Run mode: agent, server, or both')
        .option('--config <path>', 'Config file path', 'config.json')
        .option('--debug', 'Enable debug logging')
        .parse(process.argv);
    const options = program.opts();
    const config = (0, config_1.loadConfig)(options.config);
    let mode = options.mode || config.mode;
    if (!mode) {
        mode = await promptMode();
    }
    console.log(ASCII_ART);
    console.log(`Mode: ${mode.toUpperCase()}`);
    // Check dependencies
    await (0, deps_1.checkDependencies)(mode);
    if (mode === 'agent') {
        await (0, agent_1.startAgent)(config);
    }
    else if (mode === 'server') {
        await (0, server_1.startServer)(config);
    }
    else if (mode === 'both') {
        // Run both concurrently
        Promise.all([
            (0, server_1.startServer)(config),
            new Promise(resolve => setTimeout(resolve, 1000)).then(() => (0, agent_1.startAgent)(config))
        ]).catch(err => {
            console.error('Error running both modes:', err);
            process.exit(1);
        });
    }
    else {
        console.error('Invalid mode. Use: agent, server, or both');
        process.exit(1);
    }
}
main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
