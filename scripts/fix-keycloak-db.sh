#!/usr/bin/env bash
set -e

# ──────────────────────────────────────────────
#  Fix Keycloak Database Configuration
#  Updates h2-file to dev-file for Keycloak 23.0.4+
# ──────────────────────────────────────────────

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "  ${GREEN}✓${NC} $*"; }
warn()    { echo -e "  ${YELLOW}!${NC} $*"; }
fail()    { echo -e "  ${RED}✗${NC} $*"; exit 1; }
step()    { echo -e "\n  ${CYAN}→${NC} ${BOLD}$*${NC}"; }

echo -e "${CYAN}"
echo '  ╔════════════════════════════════════════╗'
echo '  ║   Fix Keycloak Database Config        ║'
echo '  ╚════════════════════════════════════════╝'
echo -e "${NC}"

KEYCLOAK_DIR="/opt/keycloak"
KEYCLOAK_CONF="$KEYCLOAK_DIR/conf/keycloak.conf"

# Check if Keycloak is installed
if [ ! -d "$KEYCLOAK_DIR" ]; then
  fail "Keycloak not found at $KEYCLOAK_DIR"
fi

if [ ! -f "$KEYCLOAK_CONF" ]; then
  fail "Keycloak config not found at $KEYCLOAK_CONF"
fi

step "Checking current configuration"

# Check if the problem exists
if grep -q "db=h2-file" "$KEYCLOAK_CONF"; then
  warn "Found incorrect database configuration: db=h2-file"
else
  info "Configuration already correct"
  exit 0
fi

step "Stopping Keycloak service"

if systemctl is-active --quiet keycloak 2>/dev/null; then
  if [ "$EUID" -eq 0 ]; then
    systemctl stop keycloak
  else
    sudo systemctl stop keycloak
  fi
  info "Keycloak stopped"
else
  warn "Keycloak is not running"
fi

step "Updating configuration file"

# Create new configuration
TEMP_CONF=$(mktemp)
cat > "$TEMP_CONF" <<'EOF'
# Keycloak Configuration for Nexus

# HTTP settings
http-enabled=true
http-port=8080
hostname-strict=false

# Database (H2 for development, PostgreSQL recommended for production)
db=dev-file

# Admin console
http-management-port=9000

# Logging
log-level=INFO
log-console-output=default

# Performance
http-pool-max-threads=200
EOF

# Backup old config
if [ "$EUID" -eq 0 ]; then
  cp "$KEYCLOAK_CONF" "$KEYCLOAK_CONF.backup"
  cp "$TEMP_CONF" "$KEYCLOAK_CONF"
else
  sudo cp "$KEYCLOAK_CONF" "$KEYCLOAK_CONF.backup"
  sudo cp "$TEMP_CONF" "$KEYCLOAK_CONF"
fi

rm "$TEMP_CONF"
info "Configuration updated (backup saved to $KEYCLOAK_CONF.backup)"

step "Starting Keycloak service"

if [ "$EUID" -eq 0 ]; then
  systemctl start keycloak
else
  sudo systemctl start keycloak
fi

# Wait for Keycloak to start
echo -n "  Waiting for Keycloak to start"
for i in {1..30}; do
  if curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo ""
    info "Keycloak is running"
    break
  fi
  echo -n "."
  sleep 2
done

if ! curl -s http://localhost:8080 > /dev/null 2>&1; then
  echo ""
  fail "Keycloak failed to start. Check logs with: sudo journalctl -u keycloak -n 50"
fi

echo ""
echo -e "${GREEN}${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║   Fix Applied Successfully!           ║${NC}"
echo -e "${GREEN}${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Keycloak is now running with correct database configuration${NC}"
echo ""
echo -e "${CYAN}Verify:${NC}"
echo "  sudo systemctl status keycloak"
echo "  curl http://localhost:8080"
echo ""
