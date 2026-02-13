#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
#  Nexus Setup — Dronzer Studios
#  Beautiful TUI installer v1.9.6
# ──────────────────────────────────────────────

# ─── Colors & Styles ─────────────────────────

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# Box drawing characters
H_LINE='─'
V_LINE='│'
TL='┌'
TR='┐'
BL='└'
BR='┘'
T_LEFT='├'
T_RIGHT='┤'
BULLET='●'
ARROW='▸'
CHECK='✓'
CROSS='✗'

REQUIRED_NODE_MAJOR=18
TERM_WIDTH=$(tput cols 2>/dev/null || echo 60)
BOX_WIDTH=$((TERM_WIDTH > 70 ? 64 : TERM_WIDTH - 6))

# ─── Drawing Helpers ─────────────────────────

repeat_char() {
  local char="$1" count="$2"
  printf '%0.s'"$char" $(seq 1 "$count")
}

draw_box_top() {
  echo -e "  ${CYAN}${TL}$(repeat_char "$H_LINE" $BOX_WIDTH)${TR}${NC}"
}

draw_box_bottom() {
  echo -e "  ${CYAN}${BL}$(repeat_char "$H_LINE" $BOX_WIDTH)${BR}${NC}"
}

draw_box_separator() {
  echo -e "  ${CYAN}${T_LEFT}$(repeat_char "$H_LINE" $BOX_WIDTH)${T_RIGHT}${NC}"
}

draw_box_line() {
  local text="$1"
  local stripped
  stripped=$(echo -e "$text" | sed 's/\x1b\[[0-9;]*m//g')
  local len=${#stripped}
  local pad=$((BOX_WIDTH - len - 1))
  if [ "$pad" -lt 0 ]; then pad=0; fi
  echo -e "  ${CYAN}${V_LINE}${NC} ${text}$(repeat_char ' ' $pad)${CYAN}${V_LINE}${NC}"
}

draw_box_empty() {
  echo -e "  ${CYAN}${V_LINE}${NC}$(repeat_char ' ' $BOX_WIDTH)${CYAN}${V_LINE}${NC}"
}

draw_box_center() {
  local text="$1"
  local stripped
  stripped=$(echo -e "$text" | sed 's/\x1b\[[0-9;]*m//g')
  local len=${#stripped}
  local total_pad=$((BOX_WIDTH - len))
  local left_pad=$((total_pad / 2))
  local right_pad=$((total_pad - left_pad))
  echo -e "  ${CYAN}${V_LINE}${NC}$(repeat_char ' ' $left_pad)${text}$(repeat_char ' ' $right_pad)${CYAN}${V_LINE}${NC}"
}

# ─── Banner ──────────────────────────────────

banner() {
  clear
  echo ""
  draw_box_top
  draw_box_empty
  draw_box_center "${CYAN}${BOLD}███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗${NC}"
  draw_box_center "${CYAN}${BOLD}████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝${NC}"
  draw_box_center "${CYAN}${BOLD}██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗${NC}"
  draw_box_center "${CYAN}${BOLD}██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║${NC}"
  draw_box_center "${CYAN}${BOLD}██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║${NC}"
  draw_box_center "${CYAN}${BOLD}╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝${NC}"
  draw_box_empty
  draw_box_center "${BOLD}Dronzer Studios${NC} ${DIM}— Interactive Setup${NC}"
  draw_box_center "${DIM}v$(cat VERSION 2>/dev/null || echo '1.9.6')${NC}"
  draw_box_empty
  draw_box_bottom
  echo ""
}

# ─── Section Header ─────────────────────────

section() {
  echo ""
  draw_box_top
  draw_box_center "${MAGENTA}${BOLD}$1${NC}"
  draw_box_bottom
  echo ""
}

# ─── Status Messages ─────────────────────────

info()    { echo -e "  ${GREEN}${CHECK}${NC} $*"; }
warn()    { echo -e "  ${YELLOW}!${NC} $*"; }
fail()    { echo -e "  ${RED}${CROSS}${NC} $*"; exit 1; }
step()    { echo -e "  ${CYAN}${ARROW}${NC} ${BOLD}$*${NC}"; }
dimtext() { echo -e "  ${DIM}$*${NC}"; }

# ─── Menu Selector ───────────────────────────

menu_select() {
  local prompt="$1"
  IFS='|' read -ra options <<< "$2"
  local default="${3:-1}"
  local count=${#options[@]}

  draw_box_top
  draw_box_line "${BOLD}${prompt}${NC}"
  draw_box_separator
  draw_box_empty

  for i in "${!options[@]}"; do
    local num=$((i + 1))
    if [ "$num" -eq "$default" ]; then
      draw_box_line "    ${CYAN}${BOLD}${num})${NC} ${BOLD}${options[$i]}${NC} ${CYAN}(recommended)${NC}"
    else
      draw_box_line "    ${DIM}${num})${NC} ${options[$i]}"
    fi
  done

  draw_box_empty
  draw_box_bottom
  echo ""

  while true; do
    read -rp "  ${CYAN}${ARROW}${NC} Choice [1-${count}] (default: ${default}): " choice
    choice="${choice:-$default}"
    if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "$count" ]; then
      MENU_RESULT="$choice"
      local idx=$((choice - 1))
      info "Selected: ${BOLD}${options[$idx]}${NC}"
      return
    fi
    warn "Please enter a number between 1 and ${count}"
  done
}

# ─── Yes/No Prompt ───────────────────────────

ask_yesno() {
  local prompt="$1"
  local default="${2:-n}"
  local hint="[y/N]"
  [ "$default" = "y" ] && hint="[Y/n]"

  while true; do
    read -rp "  ${CYAN}${ARROW}${NC} ${prompt} ${hint}: " answer
    answer="${answer:-$default}"
    case "$answer" in
      [yY]|[yY][eE][sS]) YESNO_RESULT="y"; return ;;
      [nN]|[nN][oO])     YESNO_RESULT="n"; return ;;
      *) warn "Enter y or n" ;;
    esac
  done
}

# ─── Text Input ──────────────────────────────

ask_input() {
  local prompt="$1"
  local default="${2:-}"

  if [ -n "$default" ]; then
    read -rp "  ${CYAN}${ARROW}${NC} ${prompt} [${default}]: " INPUT_RESULT
    INPUT_RESULT="${INPUT_RESULT:-$default}"
  else
    read -rp "  ${CYAN}${ARROW}${NC} ${prompt}: " INPUT_RESULT
  fi
}

# ─── Port Input ─────────────────────────────

ask_port() {
  local prompt="$1"
  local default="${2:-8080}"

  while true; do
    read -rp "  ${CYAN}${ARROW}${NC} ${prompt} [${default}]: " PORT_RESULT
    PORT_RESULT="${PORT_RESULT:-$default}"
    if [[ "$PORT_RESULT" =~ ^[0-9]+$ ]] && [ "$PORT_RESULT" -ge 1 ] && [ "$PORT_RESULT" -le 65535 ]; then
      return
    fi
    warn "Enter a valid port (1-65535)"
  done
}

# ══════════════════════════════════════════════
#  PHASE 1: ASK ALL QUESTIONS FIRST
# ══════════════════════════════════════════════

collect_answers() {
  # ─── Operating Mode ────────────────────────
  section "OPERATING MODE"

  echo -e "  ${DIM}Nexus runs in one of three modes:${NC}"
  echo ""
  echo -e "  ${CYAN}${BULLET}${NC} ${BOLD}Combine${NC}  ${DIM}—${NC} Dashboard + local node monitoring on one machine"
  echo -e "  ${CYAN}${BULLET}${NC} ${BOLD}Server${NC}   ${DIM}—${NC} Dashboard & API only (receives metrics from remote nodes)"
  echo -e "  ${CYAN}${BULLET}${NC} ${BOLD}Node${NC}     ${DIM}—${NC} Lightweight reporter (sends metrics to a Nexus server)"
  echo ""

  menu_select "Select operating mode" "Combine — Dashboard + local monitoring|Server — Dashboard & API only|Node — Metrics reporter only" 1
  SETUP_MODE="$MENU_RESULT"

  case "$SETUP_MODE" in
    1) MODE_NAME="combine" ;;
    2) MODE_NAME="server"  ;;
    3) MODE_NAME="node"    ;;
  esac

  # ─── Port Configuration ────────────────────
  if [ "$MODE_NAME" != "node" ]; then
    section "NETWORK"
    ask_port "Dashboard port" "8080"
    SETUP_PORT="$PORT_RESULT"
  else
    SETUP_PORT="8080"
  fi

  # ─── Node server URL (only for node mode) ──
  if [ "$MODE_NAME" = "node" ]; then
    section "SERVER CONNECTION"
    echo -e "  ${DIM}Enter the URL of the Nexus server this node should report to.${NC}"
    echo ""
    ask_input "Nexus server URL" "http://localhost:8080"
    NODE_SERVER_URL="$INPUT_RESULT"
  else
    NODE_SERVER_URL="http://localhost:8080"
  fi

  # ─── SSH Console Privileges ────────────────
  section "SSH CONSOLE SECURITY"

  echo -e "  ${DIM}The web console uses SSH to connect to nodes.${NC}"
  echo -e "  ${DIM}Configure the privilege level for remote commands.${NC}"
  echo ""

  menu_select "Allow sudo commands from dashboard console?" "No sudo — commands run as the current user only|Allow sudo — privileged commands permitted (requires auth)" 1
  SETUP_SUDO="$MENU_RESULT"

  if [ "$SETUP_SUDO" -eq 1 ]; then
    ALLOW_SUDO=false
    info "Console will run commands as regular user only"
  else
    ALLOW_SUDO=true
    info "Sudo access enabled — requires 2FA verification per session"
  fi

  # ─── Nginx ─────────────────────────────────
  NGINX_DOMAIN=""
  NGINX_SSL="n"

  if [ "$MODE_NAME" != "node" ]; then
    section "REVERSE PROXY"

    echo -e "  ${DIM}Set up nginx as a reverse proxy with optional SSL.${NC}"
    echo ""

    ask_yesno "Configure nginx reverse proxy?" "n"
    SETUP_NGINX="$YESNO_RESULT"

    if [ "$SETUP_NGINX" = "y" ]; then
      ask_input "Domain name (e.g., nexus.example.com)"
      NGINX_DOMAIN="$INPUT_RESULT"

      ask_yesno "Enable SSL (HTTPS)?" "y"
      NGINX_SSL="$YESNO_RESULT"
    fi
  else
    SETUP_NGINX="n"
  fi

  # ─── Systemd ───────────────────────────────
  section "AUTO-START"

  echo -e "  ${DIM}Install Nexus as a systemd service for auto-start on boot.${NC}"
  echo ""

  ask_yesno "Install systemd service?" "n"
  SETUP_SYSTEMD="$YESNO_RESULT"

  # ─── Start after install ───────────────────
  section "LAUNCH"

  ask_yesno "Start Nexus after installation?" "y"
  SETUP_START="$YESNO_RESULT"

  # ─── Summary ───────────────────────────────
  show_summary
}

# ─── Summary ─────────────────────────────────

show_summary() {
  section "CONFIGURATION SUMMARY"

  draw_box_top
  draw_box_empty
  draw_box_line "${BOLD}Mode:${NC}           ${CYAN}${MODE_NAME}${NC}"
  draw_box_line "${BOLD}Port:${NC}           ${CYAN}${SETUP_PORT}${NC}"

  if [ "$MODE_NAME" = "node" ]; then
    draw_box_line "${BOLD}Server URL:${NC}     ${CYAN}${NODE_SERVER_URL}${NC}"
  fi

  draw_box_line "${BOLD}Sudo access:${NC}    ${CYAN}$([ "$ALLOW_SUDO" = true ] && echo 'Enabled' || echo 'Disabled')${NC}"

  if [ "$MODE_NAME" != "node" ]; then
    draw_box_line "${BOLD}Nginx:${NC}          ${CYAN}$([ "$SETUP_NGINX" = 'y' ] && echo "Yes (${NGINX_DOMAIN:-})" || echo 'No')${NC}"
  fi

  draw_box_line "${BOLD}Systemd:${NC}        ${CYAN}$([ "$SETUP_SYSTEMD" = 'y' ] && echo 'Yes' || echo 'No')${NC}"
  draw_box_line "${BOLD}Start after:${NC}    ${CYAN}$([ "$SETUP_START" = 'y' ] && echo 'Yes' || echo 'No')${NC}"
  draw_box_empty
  draw_box_bottom
  echo ""

  ask_yesno "Proceed with installation?" "y"
  if [ "$YESNO_RESULT" != "y" ]; then
    echo ""
    warn "Setup cancelled by user"
    exit 0
  fi
}

# ══════════════════════════════════════════════
#  PHASE 2: EXECUTE INSTALLATION
# ══════════════════════════════════════════════

run_installation() {
  section "INSTALLING"

  # ─── Prerequisites ─────────────────────────
  step "Checking prerequisites"

  if ! command -v node &>/dev/null; then
    fail "Node.js is not installed. Install Node.js >= ${REQUIRED_NODE_MAJOR} (https://nodejs.org)"
  fi

  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -lt "$REQUIRED_NODE_MAJOR" ]; then
    fail "Node.js ${REQUIRED_NODE_MAJOR}+ required (found $(node -v))"
  fi
  info "Node.js $(node -v)"

  if ! command -v npm &>/dev/null; then
    fail "npm is not installed"
  fi
  info "npm $(npm -v)"

  # ─── Backend deps ──────────────────────────
  step "Installing backend dependencies"
  npm install --loglevel=warn 2>&1 | tail -3
  info "Backend dependencies installed"

  # ─── Dashboard deps & build ────────────────
  if [ "$MODE_NAME" != "node" ]; then
    step "Installing dashboard dependencies"
    (cd dashboard && npm install --loglevel=warn 2>&1 | tail -3)
    info "Dashboard dependencies installed"

    step "Building dashboard"
    (cd dashboard && npm run build 2>&1 | tail -5)
    info "Dashboard built successfully"
  else
    dimtext "Skipping dashboard (node mode)"
  fi

  # ─── Configuration ─────────────────────────
  step "Configuring Nexus"

  mkdir -p data

  if [ -f config/config.json ]; then
    info "Config file exists — updating settings"
  else
    cp config/config.default.json config/config.json
    info "Created config/config.json from defaults"
  fi

  # Update config with answers
  node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync('config/config.json', 'utf8'));
    cfg.server.port = ${SETUP_PORT};
    cfg.node.serverUrl = '${NODE_SERVER_URL}';
    cfg.console = cfg.console || {};
    cfg.console.allowSudo = ${ALLOW_SUDO};
    cfg.console.blockedCommands = [
      'rm -rf /',
      'rm -rf /*',
      'mkfs.',
      'dd if=',
      ':(){:|:&};:',
      'chmod -R 777 /',
      'chown -R',
      '> /dev/sda',
      '> /dev/nvme'
    ];
    cfg.console.blockedPaths = [
      '/etc/passwd',
      '/etc/shadow',
      '/etc/sudoers',
      '/boot',
      '/proc',
      '/sys'
    ];
    fs.writeFileSync('config/config.json', JSON.stringify(cfg, null, 2));
  "
  info "Configuration updated"

  # ─── Nginx ─────────────────────────────────
  if [ "$SETUP_NGINX" = "y" ]; then
    step "Setting up nginx reverse proxy"
    node src/setup/wizard.js --domain="${NGINX_DOMAIN:-}" --ssl="${NGINX_SSL:-n}" 2>&1 || {
      warn "Nginx setup had issues — you can retry with: npm run setup:nginx"
    }
    info "Nginx configured"
  fi

  # ─── Systemd ───────────────────────────────
  if [ "$SETUP_SYSTEMD" = "y" ]; then
    install_systemd_service
  fi

  # ─── Done ──────────────────────────────────
  section "SETUP COMPLETE"

  draw_box_top
  draw_box_empty
  draw_box_center "${GREEN}${BOLD}${CHECK} Nexus v$(cat VERSION) is ready!${NC}"
  draw_box_empty
  draw_box_separator

  if [ "$MODE_NAME" != "node" ]; then
    draw_box_empty
    draw_box_line "${BOLD}Dashboard:${NC}  ${CYAN}http://localhost:${SETUP_PORT}${NC}"
    draw_box_line "${BOLD}Login:${NC}      ${YELLOW}admin / admin123${NC}"
    draw_box_line "${BOLD}Console:${NC}    SSH-based with $([ "$ALLOW_SUDO" = true ] && echo 'sudo enabled' || echo 'restricted privileges')"
    draw_box_empty
  fi

  if [ "$MODE_NAME" = "node" ]; then
    draw_box_empty
    draw_box_line "${BOLD}Reports to:${NC} ${CYAN}${NODE_SERVER_URL}${NC}"
    draw_box_empty
  fi

  draw_box_separator
  draw_box_empty
  draw_box_line "${DIM}Manual commands:${NC}"
  draw_box_line "  npm run start:combine   ${DIM}# Dashboard + local monitoring${NC}"
  draw_box_line "  npm run start:server    ${DIM}# Dashboard & API only${NC}"
  draw_box_line "  npm run start:node      ${DIM}# Node reporter only${NC}"
  draw_box_line "  npm run dev             ${DIM}# Development mode${NC}"
  draw_box_empty

  if [ "$SETUP_SYSTEMD" = "y" ]; then
    draw_box_line "${DIM}Service commands:${NC}"
    draw_box_line "  sudo systemctl start nexus    ${DIM}# Start${NC}"
    draw_box_line "  sudo systemctl stop nexus     ${DIM}# Stop${NC}"
    draw_box_line "  sudo systemctl status nexus   ${DIM}# Status${NC}"
    draw_box_line "  sudo journalctl -u nexus -f   ${DIM}# Logs${NC}"
    draw_box_empty
  fi

  draw_box_bottom
  echo ""

  # ─── Start ─────────────────────────────────
  if [ "$SETUP_START" = "y" ]; then
    echo ""
    info "Starting Nexus in ${BOLD}${MODE_NAME}${NC} mode..."
    dimtext "Press Ctrl+C to stop"
    echo ""
    exec node src/index.js "--mode=${MODE_NAME}"
  fi
}

# ─── Systemd installer ──────────────────────

install_systemd_service() {
  step "Installing systemd service"

  if [ "$EUID" -ne 0 ] && ! command -v sudo &>/dev/null; then
    warn "Root access required for systemd installation. Skipping..."
    return
  fi

  local INSTALL_DIR=$(pwd)
  local NODE_PATH=$(command -v node)
  local SERVICE_FILE="/etc/systemd/system/nexus.service"

  local SERVICE_CONTENT="[Unit]
Description=Nexus Monitoring Server
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=${NODE_PATH} ${INSTALL_DIR}/src/index.js --mode=${MODE_NAME}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target"

  if [ "$EUID" -eq 0 ]; then
    echo "$SERVICE_CONTENT" > "$SERVICE_FILE"
    systemctl daemon-reload
    systemctl enable nexus.service
  else
    echo "$SERVICE_CONTENT" | sudo tee "$SERVICE_FILE" > /dev/null
    sudo systemctl daemon-reload
    sudo systemctl enable nexus.service
  fi

  info "Systemd service installed and enabled"
}

# ══════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════

main() {
  banner
  collect_answers
  run_installation
}

main "$@"
