#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
#  Nexus Setup — Dronzer Studios
# ──────────────────────────────────────────────

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

REQUIRED_NODE_MAJOR=18

banner() {
  echo -e "${CYAN}"
  echo '  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗'
  echo '  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝'
  echo '  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗'
  echo '  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║'
  echo '  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║'
  echo '  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝'
  echo -e "${NC}"
  echo -e "  ${BOLD}Dronzer Studios${NC} — Setup Script"
  echo ""
}

info()    { echo -e "  ${GREEN}✓${NC} $*"; }
warn()    { echo -e "  ${YELLOW}!${NC} $*"; }
fail()    { echo -e "  ${RED}✗${NC} $*"; exit 1; }
step()    { echo -e "\n  ${CYAN}→${NC} ${BOLD}$*${NC}"; }

# ─── Preflight checks ────────────────────────

check_prerequisites() {
  step "Checking prerequisites"

  # Node.js
  if ! command -v node &>/dev/null; then
    fail "Node.js is not installed. Please install Node.js >= ${REQUIRED_NODE_MAJOR} (https://nodejs.org)"
  fi

  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -lt "$REQUIRED_NODE_MAJOR" ]; then
    fail "Node.js ${REQUIRED_NODE_MAJOR}+ required (found $(node -v))"
  fi
  info "Node.js $(node -v)"

  # npm
  if ! command -v npm &>/dev/null; then
    fail "npm is not installed"
  fi
  info "npm $(npm -v)"
}

# ─── Install dependencies ────────────────────

install_deps() {
  step "Installing backend dependencies"
  npm install --loglevel=warn
  info "Backend dependencies installed"

  step "Installing dashboard dependencies"
  (cd dashboard && npm install --loglevel=warn)
  info "Dashboard dependencies installed"
}

# ─── Build dashboard ─────────────────────────

build_dashboard() {
  step "Building dashboard"
  (cd dashboard && npm run build)
  info "Dashboard built successfully"
}

# ─── Configuration ────────────────────────────

setup_config() {
  step "Setting up configuration"

  if [ -f config/config.json ]; then
    info "Config file already exists — keeping current settings"
  else
    cp config/config.default.json config/config.json
    info "Created config/config.json from defaults"
  fi

  # Ensure data directory
  mkdir -p data
  info "Data directory ready"
}

# ─── Mode selection ──────────────────────────

select_mode() {
  echo ""
  echo -e "  ${BOLD}Select a startup mode:${NC}"
  echo ""
  echo "    1) ${BOLD}combine${NC}  — Server + local monitoring (recommended)"
  echo "    2) ${BOLD}server${NC}   — Dashboard & API only"
  echo "    3) ${BOLD}node${NC}     — Metrics reporter only"
  echo "    4) ${BOLD}skip${NC}     — Don't start now"
  echo ""

  while true; do
    read -rp "  Choice [1-4]: " choice
    case "$choice" in
      1) MODE="combine"; break ;;
      2) MODE="server";  break ;;
      3) MODE="node";    break ;;
      4) MODE="skip";    break ;;
      *) warn "Enter 1, 2, 3, or 4" ;;
    esac
  done
}

# ─── Nginx setup (optional) ──────────────────

setup_nginx() {
  echo ""
  echo -e "  ${BOLD}Would you like to configure nginx reverse proxy?${NC}"
  echo ""
  echo "    This will set up:"
  echo "    • nginx as a reverse proxy for Nexus"
  echo "    • Custom domain/subdomain"
  echo "    • SSL via Certbot or custom certificate"
  echo ""

  while true; do
    read -rp "  Configure nginx? [y/N]: " nginx_choice
    case "$nginx_choice" in
      [yY]|[yY][eE][sS])
        step "Launching nginx setup wizard..."
        node src/setup/wizard.js
        break
        ;;
      [nN]|[nN][oO]|"")
        info "Skipping nginx setup — you can run it later with: npm run setup:nginx"
        break
        ;;
      *) warn "Enter y or n" ;;
    esac
  done
}

# ─── Systemd Setup ──────────────────────────

setup_systemd() {
  echo ""
  echo -e "  ${BOLD}Would you like to install Nexus as a systemd service?${NC}"
  echo ""
  echo "    This will:"
  echo "    • Create a systemd service file"
  echo "    • Enable auto-start on boot"
  echo "    • Allow management via systemctl"
  echo ""

  while true; do
    read -rp "  Install systemd service? [y/N]: " systemd_choice
    case "$systemd_choice" in
      [yY]|[yY][eE][sS])
        install_systemd_service
        break
        ;;
      [nN]|[nN][oO]|"")
        info "Skipping systemd service installation"
        break
        ;;
      *) warn "Enter y or n" ;;
    esac
  done
}

install_systemd_service() {
  step "Installing systemd service"
  
  # Check if running as root or can use sudo
  if [ "$EUID" -ne 0 ] && ! command -v sudo &>/dev/null; then
    warn "Root access required for systemd installation. Skipping..."
    return
  fi

  local INSTALL_DIR=$(pwd)
  local NODE_PATH=$(command -v node)
  local SERVICE_FILE="/etc/systemd/system/nexus.service"

  # Determine the mode for the service
  local SERVICE_MODE="${MODE}"
  if [ "$SERVICE_MODE" = "skip" ]; then
    SERVICE_MODE="combine"
  fi

  # Create service file
  local SERVICE_CONTENT="[Unit]
Description=Nexus Monitoring Server
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=${NODE_PATH} ${INSTALL_DIR}/src/index.js --mode=${SERVICE_MODE}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Environment
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target"

  # Write service file
  if [ "$EUID" -eq 0 ]; then
    echo "$SERVICE_CONTENT" > "$SERVICE_FILE"
  else
    echo "$SERVICE_CONTENT" | sudo tee "$SERVICE_FILE" > /dev/null
  fi

  # Reload systemd and enable service
  if [ "$EUID" -eq 0 ]; then
    systemctl daemon-reload
    systemctl enable nexus.service
  else
    sudo systemctl daemon-reload
    sudo systemctl enable nexus.service
  fi

  info "Systemd service installed and enabled"
  echo ""
  echo -e "  ${CYAN}Service commands:${NC}"
  echo "    sudo systemctl start nexus    # Start the service"
  echo "    sudo systemctl stop nexus     # Stop the service"
  echo "    sudo systemctl restart nexus  # Restart the service"
  echo "    sudo systemctl status nexus   # Check status"
  echo "    sudo journalctl -u nexus -f   # View logs"
  echo ""
}

# ─── Start Nexus ─────────────────────────────

start_nexus() {
  if [ "$MODE" = "skip" ]; then
    echo ""
    echo -e "  ${GREEN}Setup complete!${NC} Start Nexus later with:"
    echo ""
    echo "    npm run start:combine   # Server + local monitoring"
    echo "    npm run start:server    # Server only"
    echo "    npm run start:node      # Node reporter only"
    echo "    npm run dev             # Development mode"
    echo ""
    echo "  Or if you installed the systemd service:"
    echo "    sudo systemctl start nexus"
    echo ""
    return
  fi

  echo ""
  info "Starting Nexus in ${BOLD}${MODE}${NC} mode..."
  echo ""
  echo -e "  ${YELLOW}Dashboard:${NC}  http://localhost:8080"
  echo -e "  ${YELLOW}Login:${NC}      admin / admin123"
  echo -e "  ${YELLOW}Stop:${NC}       Ctrl+C"
  echo ""

  exec node src/index.js "--mode=${MODE}"
}

# ─── Main ─────────────────────────────────────

main() {
  banner
  check_prerequisites
  install_deps
  build_dashboard
  setup_config
  setup_nginx
  select_mode
  setup_systemd
  start_nexus
}

main "$@"
