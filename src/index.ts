#!/usr/bin/env node
/**
 * Nexus - Single program that runs as Agent, Server, or Both
 * Node.js/TypeScript implementation
 */
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { loadConfig, Config } from './config';
import { startServer } from './server';
import { startAgent } from './agent';
import { checkDependencies } from './utils/deps';
import * as readline from 'readline';

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

async function promptMode(): Promise<string> {
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
      const mapping: Record<string, string> = { '1': 'agent', '2': 'server', '3': 'both' };
      resolve(mapping[choice] || 'agent');
    });
  });
}

async function main() {
  const program = new Command();
  program
    .name('nexus')
    .description('Nexus - Agent/Server monitoring system')
    .option('--mode <mode>', 'Run mode: agent, server, or both')
    .option('--config <path>', 'Config file path', 'config.json')
    .option('--debug', 'Enable debug logging')
    .parse(process.argv);

  const options = program.opts();
  const config = loadConfig(options.config);

  let mode = options.mode || config.mode;
  if (!mode) {
    mode = await promptMode();
  }

  console.log(ASCII_ART);
  console.log(`Mode: ${mode.toUpperCase()}`);

  // Check dependencies
  await checkDependencies(mode);

  if (mode === 'agent') {
    await startAgent(config);
  } else if (mode === 'server') {
    await startServer(config);
  } else if (mode === 'both') {
    // Run both concurrently
    Promise.all([
      startServer(config),
      new Promise(resolve => setTimeout(resolve, 1000)).then(() => startAgent(config))
    ]).catch(err => {
      console.error('Error running both modes:', err);
      process.exit(1);
    });
  } else {
    console.error('Invalid mode. Use: agent, server, or both');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
