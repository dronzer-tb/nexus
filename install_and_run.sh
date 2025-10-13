#!/usr/bin/env bash
# One-line installer + run helper for Nexus
# Usage: ./install_and_run.sh [mode]
# mode: agent | server | both (default: both)
set -euo pipefail
MODE=${1:-both}
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
# run installer non-interactively? we'll run it interactively so user can set admin
python installer.py
# finally run nexus in chosen mode
if [ "$MODE" = "agent" ]; then
  python nexus.py --mode agent
elif [ "$MODE" = "server" ]; then
  python nexus.py --mode server
else
  python nexus.py --mode both
fi
