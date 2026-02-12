#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
#  Keycloak Installation Script for Nexus
#  Installs and configures Keycloak as authentication provider
# ──────────────────────────────────────────────

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

KEYCLOAK_VERSION="23.0.4"
KEYCLOAK_PORT=8080
KEYCLOAK_ADMIN_PORT=9000
KEYCLOAK_DIR="/opt/keycloak"
KEYCLOAK_DATA_DIR="$HOME/.keycloak-data"

info()    { echo -e "  ${GREEN}✓${NC} $*"; }
warn()    { echo -e "  ${YELLOW}!${NC} $*"; }
fail()    { echo -e "  ${RED}✗${NC} $*"; exit 1; }
step()    { echo -e "\n  ${CYAN}→${NC} ${BOLD}$*${NC}"; }

banner() {
  echo -e "${CYAN}"
  echo '  ╔════════════════════════════════════════╗'
  echo '  ║   Keycloak Installation for Nexus     ║'
  echo '  ╚════════════════════════════════════════╝'
  echo -e "${NC}"
}

banner

# ─── Check prerequisites ────────────────────────

step "Checking prerequisites"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ] && ! command -v sudo &>/dev/null; then
  fail "This script requires root access or sudo. Please run with sudo."
fi

# Check Java
if ! command -v java &>/dev/null; then
  warn "Java not found. Installing OpenJDK 17..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y openjdk-17-jdk
  elif command -v yum &>/dev/null; then
    sudo yum install -y java-17-openjdk
  else
    fail "Unable to install Java automatically. Please install Java 17+ manually."
  fi
fi

JAVA_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d. -f1)
if [ "$JAVA_VERSION" -lt 17 ]; then
  fail "Java 17+ required (found Java $JAVA_VERSION)"
fi
info "Java $(java -version 2>&1 | head -n1)"

# Check if Keycloak is already installed
if [ -d "$KEYCLOAK_DIR" ]; then
  warn "Keycloak directory already exists at $KEYCLOAK_DIR"
  read -p "Remove existing installation and reinstall? (y/N): " reinstall
  if [[ "$reinstall" =~ ^[Yy]$ ]]; then
    sudo systemctl stop keycloak 2>/dev/null || true
    sudo rm -rf "$KEYCLOAK_DIR"
    info "Removed existing Keycloak installation"
  else
    info "Using existing Keycloak installation"
    exit 0
  fi
fi

# ─── Download and install Keycloak ────────────────────────

step "Downloading Keycloak ${KEYCLOAK_VERSION}"

TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

DOWNLOAD_URL="https://github.com/keycloak/keycloak/releases/download/${KEYCLOAK_VERSION}/keycloak-${KEYCLOAK_VERSION}.tar.gz"

if command -v wget &>/dev/null; then
  wget -q --show-progress "$DOWNLOAD_URL" -O keycloak.tar.gz
elif command -v curl &>/dev/null; then
  curl -L --progress-bar "$DOWNLOAD_URL" -o keycloak.tar.gz
else
  fail "wget or curl required to download Keycloak"
fi

info "Keycloak downloaded"

# ─── Extract and install ────────────────────────

step "Installing Keycloak to $KEYCLOAK_DIR"

sudo mkdir -p "$KEYCLOAK_DIR"
sudo tar -xzf keycloak.tar.gz -C "$KEYCLOAK_DIR" --strip-components=1
sudo chown -R $USER:$USER "$KEYCLOAK_DIR"

info "Keycloak extracted"

# ─── Create Keycloak data directory ────────────────────────

mkdir -p "$KEYCLOAK_DATA_DIR"
info "Created data directory at $KEYCLOAK_DATA_DIR"

# ─── Configure Keycloak ────────────────────────

step "Configuring Keycloak"

# Generate random admin password
KEYCLOAK_ADMIN_USER="admin"
KEYCLOAK_ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)

# Create Keycloak configuration file
cat > "$KEYCLOAK_DIR/conf/keycloak.conf" <<EOF
# Keycloak Configuration for Nexus

# HTTP settings
http-enabled=true
http-port=${KEYCLOAK_PORT}
hostname-strict=false

# Database (H2 for development, PostgreSQL recommended for production)
db=dev-file

# Admin console
http-management-port=${KEYCLOAK_ADMIN_PORT}

# Logging
log-level=INFO
log-console-output=default

# Performance
http-pool-max-threads=200
EOF

info "Configuration file created"

# ─── Create systemd service ────────────────────────

step "Creating systemd service"

sudo tee /etc/systemd/system/keycloak.service > /dev/null <<EOF
[Unit]
Description=Keycloak Authentication Server
After=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$KEYCLOAK_DIR
Environment="KEYCLOAK_ADMIN=$KEYCLOAK_ADMIN_USER"
Environment="KEYCLOAK_ADMIN_PASSWORD=$KEYCLOAK_ADMIN_PASSWORD"
ExecStart=$KEYCLOAK_DIR/bin/kc.sh start-dev
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
info "Systemd service created"

# ─── Start Keycloak ────────────────────────

step "Starting Keycloak service"

sudo systemctl enable keycloak
sudo systemctl start keycloak

# Wait for Keycloak to start
echo -n "  Waiting for Keycloak to start"
for i in {1..30}; do
  if curl -s http://localhost:${KEYCLOAK_PORT} > /dev/null 2>&1; then
    echo ""
    info "Keycloak is running"
    break
  fi
  echo -n "."
  sleep 2
done

if ! curl -s http://localhost:${KEYCLOAK_PORT} > /dev/null 2>&1; then
  echo ""
  fail "Keycloak failed to start. Check logs with: sudo journalctl -u keycloak -n 50"
fi

# ─── Save credentials ────────────────────────

CREDS_FILE="$KEYCLOAK_DATA_DIR/admin-credentials.txt"
cat > "$CREDS_FILE" <<EOF
Keycloak Admin Credentials
==========================

Admin Console URL: http://localhost:${KEYCLOAK_PORT}/admin
Username: ${KEYCLOAK_ADMIN_USER}
Password: ${KEYCLOAK_ADMIN_PASSWORD}

IMPORTANT: Store these credentials securely!

Installation Directory: ${KEYCLOAK_DIR}
Data Directory: ${KEYCLOAK_DATA_DIR}
Configuration: ${KEYCLOAK_DIR}/conf/keycloak.conf

Service Management:
  Start:   sudo systemctl start keycloak
  Stop:    sudo systemctl stop keycloak
  Restart: sudo systemctl restart keycloak
  Status:  sudo systemctl status keycloak
  Logs:    sudo journalctl -u keycloak -f
EOF

chmod 600 "$CREDS_FILE"

# ─── Cleanup ────────────────────────

cd ~
rm -rf "$TEMP_DIR"

# ─── Summary ────────────────────────

echo ""
echo -e "${GREEN}${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║   Keycloak Installation Complete!     ║${NC}"
echo -e "${GREEN}${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Admin Console:${NC} http://localhost:${KEYCLOAK_PORT}/admin"
echo -e "${CYAN}Username:${NC}      ${KEYCLOAK_ADMIN_USER}"
echo -e "${CYAN}Password:${NC}      ${YELLOW}${KEYCLOAK_ADMIN_PASSWORD}${NC}"
echo ""
echo -e "${YELLOW}Credentials saved to:${NC} ${CREDS_FILE}"
echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo "  1. Access the admin console at the URL above"
echo "  2. Run the Nexus realm setup script:"
echo "     bash scripts/setup-keycloak-realm.sh"
echo ""
echo -e "${GREEN}Service is running and enabled on boot${NC}"
echo ""
