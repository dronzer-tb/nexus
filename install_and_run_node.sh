#!/usr/bin/env bash
# One-line installer + runner for Nexus (Node.js version)
# Usage: ./install_and_run_node.sh [mode]
# mode: agent | server | both (default: both)
set -euo pipefail

MODE=${1:-both}

echo "Installing Nexus (Node.js)..."
npm install

echo "Building TypeScript..."
npm run build

echo "Running installer..."
node dist/installer.js

echo "Starting Nexus in $MODE mode..."
node dist/index.js --mode "$MODE"
