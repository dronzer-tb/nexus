#!/bin/bash
set -e

# ─────────────────────────────────────────────
#  Nexus Docker Entrypoint
#  Dronzer Studios
# ─────────────────────────────────────────────

# Create data directory if not exists
mkdir -p /app/data /app/config

# Copy default config if none exists
if [ ! -f /app/config/config.json ]; then
  cp /app/config/config.default.json /app/config/config.json
  echo "[entrypoint] Created config.json from defaults"
fi

# Apply environment variable overrides to config
node -e "
  const fs = require('fs');
  const cfg = JSON.parse(fs.readFileSync('/app/config/config.json', 'utf8'));

  // Apply env overrides
  if (process.env.NEXUS_PORT) cfg.server.port = parseInt(process.env.NEXUS_PORT);
  if (process.env.NEXUS_HOST) cfg.server.host = process.env.NEXUS_HOST;
  if (process.env.NEXUS_SERVER_URL) cfg.node.serverUrl = process.env.NEXUS_SERVER_URL;
  if (process.env.NEXUS_DB_PATH) cfg.database.path = process.env.NEXUS_DB_PATH;

  // Discord bot config
  if (process.env.DISCORD_BOT_TOKEN) {
    cfg.discord = cfg.discord || {};
    cfg.discord.botToken = process.env.DISCORD_BOT_TOKEN;
  }
  if (process.env.DISCORD_USER_ID) {
    cfg.discord = cfg.discord || {};
    cfg.discord.userId = process.env.DISCORD_USER_ID;
  }

  // Tailscale config
  if (process.env.TAILSCALE_API_KEY) {
    cfg.tailscale = cfg.tailscale || {};
    cfg.tailscale.apiKey = process.env.TAILSCALE_API_KEY;
    cfg.tailscale.enabled = true;
  }
  if (process.env.TAILSCALE_TAILNET) {
    cfg.tailscale = cfg.tailscale || {};
    cfg.tailscale.tailnet = process.env.TAILSCALE_TAILNET;
  }

  fs.writeFileSync('/app/config/config.json', JSON.stringify(cfg, null, 2));
  console.log('[entrypoint] Config updated with environment overrides');
"

# Determine mode from env
MODE="${NEXUS_MODE:-combine}"

echo "[entrypoint] Starting Nexus in ${MODE} mode..."

# Execute the main command with the mode flag
exec "$@" "--mode=${MODE}"
