#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
#  Nexus Setup — Dronzer Studios
#  Beautiful TUI installer v2.0-pre-release
# ──────────────────────────────────────────────

# ─── Colors & Styles ─────────────────────────

CYAN=$'\033[0;36m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
RED=$'\033[0;31m'
MAGENTA=$'\033[0;35m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
NC=$'\033[0m'

# Theme color (overridden to RED in bypass mode)
THEME_COLOR="$CYAN"
THEME_ACCENT="$MAGENTA"

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

TOTAL_STEPS=7

# ─── Drawing Helpers ─────────────────────────

repeat_char() {
  local char="$1" count="$2"
  printf '%0.s'"$char" $(seq 1 "$count")
}

draw_box_top() {
  echo -e "  ${THEME_COLOR}${TL}$(repeat_char "$H_LINE" $BOX_WIDTH)${TR}${NC}"
}

draw_box_bottom() {
  echo -e "  ${THEME_COLOR}${BL}$(repeat_char "$H_LINE" $BOX_WIDTH)${BR}${NC}"
}

draw_box_separator() {
  echo -e "  ${THEME_COLOR}${T_LEFT}$(repeat_char "$H_LINE" $BOX_WIDTH)${T_RIGHT}${NC}"
}

draw_box_line() {
  local text="$1"
  local stripped
  stripped=$(echo -e "$text" | sed 's/\x1b\[[0-9;]*m//g')
  local len=${#stripped}
  local pad=$((BOX_WIDTH - len - 1))
  if [ "$pad" -lt 0 ]; then pad=0; fi
  echo -e "  ${THEME_COLOR}${V_LINE}${NC} ${text}$(repeat_char ' ' $pad)${THEME_COLOR}${V_LINE}${NC}"
}

draw_box_empty() {
  echo -e "  ${THEME_COLOR}${V_LINE}${NC}$(repeat_char ' ' $BOX_WIDTH)${THEME_COLOR}${V_LINE}${NC}"
}

draw_box_center() {
  local text="$1"
  local stripped
  stripped=$(echo -e "$text" | sed 's/\x1b\[[0-9;]*m//g')
  local len=${#stripped}
  local total_pad=$((BOX_WIDTH - len))
  local left_pad=$((total_pad / 2))
  local right_pad=$((total_pad - left_pad))
  echo -e "  ${THEME_COLOR}${V_LINE}${NC}$(repeat_char ' ' $left_pad)${text}$(repeat_char ' ' $right_pad)${THEME_COLOR}${V_LINE}${NC}"
}

# ─── Banner ──────────────────────────────────

banner() {
  clear
  echo ""
  draw_box_top
  draw_box_empty
  draw_box_center "${THEME_COLOR}${BOLD}███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗${NC}"
  draw_box_center "${THEME_COLOR}${BOLD}████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝${NC}"
  draw_box_center "${THEME_COLOR}${BOLD}██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗${NC}"
  draw_box_center "${THEME_COLOR}${BOLD}██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║${NC}"
  draw_box_center "${THEME_COLOR}${BOLD}██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║${NC}"
  draw_box_center "${THEME_COLOR}${BOLD}╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝${NC}"
  draw_box_empty
  draw_box_center "${BOLD}Dronzer Studios${NC} ${DIM}— Interactive Setup${NC}"
  draw_box_center "${DIM}v$(cat VERSION 2>/dev/null || echo '2.0-pre-release')${NC}"
  draw_box_empty
  draw_box_bottom
  echo ""
}

# ─── Section Header ─────────────────────────

section() {
  echo ""
  draw_box_top
  draw_box_center "${THEME_ACCENT}${BOLD}$1${NC}"
  draw_box_bottom
  echo ""
}

# ─── Status Messages ─────────────────────────

info()    { echo -e "  ${GREEN}${CHECK}${NC} $*"; }
warn()    { echo -e "  ${YELLOW}!${NC} $*"; }
fail()    { echo -e "  ${RED}${CROSS}${NC} $*"; exit 1; }
step()    { echo -e "  ${THEME_COLOR}${ARROW}${NC} ${BOLD}$*${NC}"; }
dimtext() { echo -e "  ${DIM}$*${NC}"; }

# ─── Step Progress Bar ───────────────────────

draw_progress() {
  local current="$1"
  local total="$2"
  local filled=$((BOX_WIDTH * current / total))
  local empty=$((BOX_WIDTH - filled))

  draw_box_top
  draw_box_center "${BOLD}Step ${current} of ${total}${NC}"
  echo -e "  ${THEME_COLOR}${V_LINE}${NC} ${GREEN}$(repeat_char '█' $filled)${DIM}$(repeat_char '░' $empty)${NC} ${THEME_COLOR}${V_LINE}${NC}"
  draw_box_bottom
  echo ""
}

# ─── Menu Selector (inside box, with back) ───

menu_select() {
  local prompt="$1"
  IFS='|' read -ra options <<< "$2"
  local default="${3:-1}"
  local show_back="${4:-false}"
  local count=${#options[@]}

  draw_box_top
  draw_box_empty
  draw_box_line "${BOLD}${prompt}${NC}"
  draw_box_empty
  draw_box_separator
  draw_box_empty

  for i in "${!options[@]}"; do
    local num=$((i + 1))
    if [ "$num" -eq "$default" ]; then
      draw_box_line "    ${THEME_COLOR}${BOLD}${num})${NC} ${BOLD}${options[$i]}${NC} ${THEME_COLOR}(recommended)${NC}"
    else
      draw_box_line "    ${DIM}${num})${NC} ${options[$i]}"
    fi
  done

  draw_box_empty

  if [ "$show_back" = "true" ]; then
    draw_box_separator
    draw_box_line "    ${YELLOW}0)${NC} ${DIM}← Back to previous step${NC}"
  fi

  draw_box_empty
  draw_box_bottom
  echo ""

  while true; do
    local min_choice=1
    [ "$show_back" = "true" ] && min_choice=0

    read -rp "  ${THEME_COLOR}${ARROW}${NC} Choice [${min_choice}-${count}] (default: ${default}): " choice
    choice="${choice:-$default}"

    if [ "$show_back" = "true" ] && [ "$choice" = "0" ]; then
      MENU_RESULT="BACK"
      return
    fi

    if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "$count" ]; then
      MENU_RESULT="$choice"
      local idx=$((choice - 1))
      info "Selected: ${BOLD}${options[$idx]}${NC}"
      return
    fi
    warn "Please enter a number between ${min_choice} and ${count}"
  done
}

# ─── Yes/No Prompt (inside box) ──────────────

ask_yesno() {
  local prompt="$1"
  local default="${2:-n}"
  local show_back="${3:-false}"
  local hint="[y/N]"
  [ "$default" = "y" ] && hint="[Y/n]"

  draw_box_top
  draw_box_empty
  draw_box_line "${BOLD}${prompt}${NC}"
  draw_box_empty
  if [ "$show_back" = "true" ]; then
    draw_box_separator
    draw_box_line "    ${YELLOW}b)${NC} ${DIM}← Back to previous step${NC}"
  fi
  draw_box_empty
  draw_box_bottom
  echo ""

  while true; do
    read -rp "  ${THEME_COLOR}${ARROW}${NC} ${hint}: " answer
    answer="${answer:-$default}"
    case "$answer" in
      [bB])
        if [ "$show_back" = "true" ]; then
          YESNO_RESULT="BACK"
          return
        fi
        warn "Enter y or n"
        ;;
      [yY]|[yY][eE][sS]) YESNO_RESULT="y"; return ;;
      [nN]|[nN][oO])     YESNO_RESULT="n"; return ;;
      *) warn "Enter y or n" ;;
    esac
  done
}

# ─── Text Input (inside box) ─────────────────

ask_input() {
  local prompt="$1"
  local default="${2:-}"
  local show_back="${3:-false}"

  draw_box_top
  draw_box_empty
  draw_box_line "${BOLD}${prompt}${NC}"
  draw_box_empty
  if [ -n "$default" ]; then
    draw_box_line "${DIM}Default: ${default}${NC}"
  fi
  if [ "$show_back" = "true" ]; then
    draw_box_separator
    draw_box_line "    ${YELLOW}Type 'back' to go to previous step${NC}"
  fi
  draw_box_empty
  draw_box_bottom
  echo ""

  if [ -n "$default" ]; then
    read -rp "  ${THEME_COLOR}${ARROW}${NC} [${default}]: " INPUT_RESULT
    INPUT_RESULT="${INPUT_RESULT:-$default}"
  else
    read -rp "  ${THEME_COLOR}${ARROW}${NC} : " INPUT_RESULT
  fi

  if [ "$show_back" = "true" ] && [ "$INPUT_RESULT" = "back" ]; then
    INPUT_RESULT="BACK"
  fi
}

# ─── Port Input (inside box) ─────────────────

ask_port() {
  local prompt="$1"
  local default="${2:-8080}"
  local show_back="${3:-false}"

  draw_box_top
  draw_box_empty
  draw_box_line "${BOLD}${prompt}${NC}"
  draw_box_line "${DIM}Valid range: 1-65535${NC}"
  if [ "$show_back" = "true" ]; then
    draw_box_separator
    draw_box_line "    ${YELLOW}Type 'back' to go to previous step${NC}"
  fi
  draw_box_empty
  draw_box_bottom
  echo ""

  while true; do
    read -rp "  ${THEME_COLOR}${ARROW}${NC} Port [${default}]: " PORT_RESULT
    PORT_RESULT="${PORT_RESULT:-$default}"

    if [ "$show_back" = "true" ] && [ "$PORT_RESULT" = "back" ]; then
      PORT_RESULT="BACK"
      return
    fi

    if [[ "$PORT_RESULT" =~ ^[0-9]+$ ]] && [ "$PORT_RESULT" -ge 1 ] && [ "$PORT_RESULT" -le 65535 ]; then
      return
    fi
    warn "Enter a valid port (1-65535)"
  done
}

# ══════════════════════════════════════════════
#  PHASE 1: ASK ALL QUESTIONS (with back nav)
# ══════════════════════════════════════════════

collect_answers() {
  local CURRENT_STEP=1

  while [ "$CURRENT_STEP" -le "$TOTAL_STEPS" ]; do
    case "$CURRENT_STEP" in
      1) # Operating Mode
        draw_progress 1 $TOTAL_STEPS
        section "OPERATING MODE"

        draw_box_top
        draw_box_empty
        draw_box_line "${DIM}Nexus runs in one of three modes:${NC}"
        draw_box_empty
        draw_box_line "  ${THEME_COLOR}${BULLET}${NC} ${BOLD}Combine${NC}  ${DIM}—${NC} Dashboard + local node monitoring"
        draw_box_line "  ${THEME_COLOR}${BULLET}${NC} ${BOLD}Server${NC}   ${DIM}—${NC} Dashboard & API only (remote nodes)"
        draw_box_line "  ${THEME_COLOR}${BULLET}${NC} ${BOLD}Node${NC}     ${DIM}—${NC} Lightweight metrics reporter"
        draw_box_empty
        draw_box_bottom
        echo ""

        menu_select "Select operating mode" "Combine — Dashboard + local monitoring|Server — Dashboard & API only|Node — Metrics reporter only" 1 false
        SETUP_MODE="$MENU_RESULT"

        case "$SETUP_MODE" in
          1) MODE_NAME="combine" ;;
          2) MODE_NAME="server"  ;;
          3) MODE_NAME="node"    ;;
        esac
        CURRENT_STEP=2
        ;;

      2) # Network
        draw_progress 2 $TOTAL_STEPS

        if [ "$MODE_NAME" != "node" ]; then
          section "NETWORK"
          ask_port "Dashboard port" "8080" true
          if [ "$PORT_RESULT" = "BACK" ]; then CURRENT_STEP=1; continue; fi
          SETUP_PORT="$PORT_RESULT"
        else
          section "SERVER CONNECTION"
          draw_box_top
          draw_box_empty
          draw_box_line "${DIM}Enter the URL of the Nexus server this${NC}"
          draw_box_line "${DIM}node should report to.${NC}"
          draw_box_empty
          draw_box_bottom
          echo ""

          ask_input "Nexus server URL" "http://localhost:8080" true
          if [ "$INPUT_RESULT" = "BACK" ]; then CURRENT_STEP=1; continue; fi
          NODE_SERVER_URL="$INPUT_RESULT"
          SETUP_PORT="8080"
        fi

        [ -z "${NODE_SERVER_URL:-}" ] && NODE_SERVER_URL="http://localhost:8080"
        CURRENT_STEP=3
        ;;

      3) # SSH Console
        draw_progress 3 $TOTAL_STEPS
        section "SSH CONSOLE"

        draw_box_top
        draw_box_empty
        draw_box_line "${DIM}The web console provides direct SSH terminal${NC}"
        draw_box_line "${DIM}access to nodes from the dashboard.${NC}"
        draw_box_line "${DIM}Requires 2FA to use.${NC}"
        draw_box_empty
        draw_box_bottom
        echo ""

        menu_select "Enable web console?" "Enable console — SSH terminal from dashboard|Disable console — no terminal access" 1 true

        if [ "$MENU_RESULT" = "BACK" ]; then CURRENT_STEP=2; continue; fi

        SETUP_CONSOLE_ENABLED="$MENU_RESULT"

        if [ "$SETUP_CONSOLE_ENABLED" -eq 1 ]; then
          CONSOLE_ENABLED=true
          info "Web console enabled"

          section "SSH CONSOLE SECURITY"

          draw_box_top
          draw_box_empty
          draw_box_line "${DIM}Configure the privilege level for remote${NC}"
          draw_box_line "${DIM}commands executed via the web console.${NC}"
          draw_box_empty
          draw_box_bottom
          echo ""

          menu_select "Allow sudo commands?" "No sudo — regular user only|Allow sudo — privileged commands (with auth)" 1 true

          if [ "$MENU_RESULT" = "BACK" ]; then continue; fi

          SETUP_SUDO="$MENU_RESULT"

          if [ "$SETUP_SUDO" -eq 1 ]; then
            ALLOW_SUDO=false
            info "Console: regular user privileges only"
          else
            ALLOW_SUDO=true
            info "Sudo access enabled — requires 2FA per session"
          fi
        else
          CONSOLE_ENABLED=false
          ALLOW_SUDO=false
          info "Web console disabled"
        fi

        CURRENT_STEP=4
        ;;

      4) # Reverse Proxy / Tailscale
        draw_progress 4 $TOTAL_STEPS

        NGINX_DOMAIN=""
        NGINX_SSL="n"
        USE_TAILSCALE="n"

        if [ "$MODE_NAME" = "node" ]; then
          SETUP_NGINX="n"
          CURRENT_STEP=5
          continue
        fi

        section "NETWORKING & ACCESS"

        local has_nginx=false
        local has_tailscale=false

        command -v nginx &>/dev/null && has_nginx=true
        command -v tailscale &>/dev/null && has_tailscale=true

        draw_box_top
        draw_box_empty
        draw_box_line "${DIM}Choose how to expose your Nexus dashboard.${NC}"
        draw_box_empty
        draw_box_line "  ${THEME_COLOR}${BULLET}${NC} ${BOLD}Nginx${NC}      ${DIM}—${NC} Reverse proxy with domain & SSL"
        draw_box_line "  ${THEME_COLOR}${BULLET}${NC} ${BOLD}Tailscale${NC}  ${DIM}—${NC} Zero-config VPN (no port forwarding)"
        draw_box_line "  ${THEME_COLOR}${BULLET}${NC} ${BOLD}Direct${NC}     ${DIM}—${NC} Access via IP:port (dev/LAN only)"
        draw_box_empty

        if [ "$has_nginx" = true ]; then
          draw_box_line "  ${GREEN}${CHECK} nginx detected${NC}"
        else
          draw_box_line "  ${YELLOW}! nginx not installed${NC}"
        fi

        if [ "$has_tailscale" = true ]; then
          local ts_ip
          ts_ip=$(tailscale ip -4 2>/dev/null || echo "not connected")
          draw_box_line "  ${GREEN}${CHECK} Tailscale detected (IP: ${ts_ip})${NC}"
        else
          draw_box_line "  ${YELLOW}! Tailscale not installed${NC}"
        fi

        draw_box_empty
        draw_box_bottom
        echo ""

        local proxy_options="Nginx — Reverse proxy with domain & SSL"
        proxy_options+="|Tailscale — Zero-config VPN mesh"
        proxy_options+="|Direct — Access via IP:port (no proxy)"
        local default_choice=1

        if [ "$has_tailscale" = true ] && [ "$has_nginx" = false ]; then
          default_choice=2
        fi

        menu_select "Select access method" "$proxy_options" $default_choice true

        if [ "$MENU_RESULT" = "BACK" ]; then CURRENT_STEP=3; continue; fi

        PROXY_CHOICE="$MENU_RESULT"

        case "$PROXY_CHOICE" in
          1) # Nginx
            SETUP_NGINX="y"
            USE_TAILSCALE="n"

            if [ "$has_nginx" = false ]; then
              warn "nginx is not installed. Install it first:"
              draw_box_top
              draw_box_empty
              draw_box_line "${DIM}Ubuntu/Debian:${NC}  sudo apt install nginx"
              draw_box_line "${DIM}CentOS/RHEL:${NC}    sudo yum install nginx"
              draw_box_line "${DIM}Arch:${NC}           sudo pacman -S nginx"
              draw_box_line "${DIM}macOS:${NC}          brew install nginx"
              draw_box_empty
              draw_box_bottom
              echo ""

              ask_yesno "Continue without nginx? (configure later)" "y" true
              if [ "$YESNO_RESULT" = "BACK" ]; then continue; fi
              if [ "$YESNO_RESULT" = "y" ]; then
                SETUP_NGINX="n"
              else
                fail "Setup requires nginx. Install it and re-run setup."
              fi
            fi

            if [ "$SETUP_NGINX" = "y" ]; then
              ask_input "Domain name (e.g., nexus.example.com)" "" true
              if [ "$INPUT_RESULT" = "BACK" ]; then continue; fi
              NGINX_DOMAIN="$INPUT_RESULT"

              ask_yesno "Enable SSL (HTTPS)?" "y" true
              if [ "$YESNO_RESULT" = "BACK" ]; then continue; fi
              NGINX_SSL="$YESNO_RESULT"
            fi
            ;;

          2) # Tailscale
            SETUP_NGINX="n"
            USE_TAILSCALE="y"

            if [ "$has_tailscale" = false ]; then
              section "TAILSCALE INSTALLATION"
              draw_box_top
              draw_box_empty
              draw_box_line "${DIM}Tailscale is not installed. Install options:${NC}"
              draw_box_empty
              draw_box_line "  ${BOLD}Quick install:${NC}"
              draw_box_line "    curl -fsSL https://tailscale.com/install.sh | sh"
              draw_box_empty
              draw_box_line "  ${BOLD}Package managers:${NC}"
              draw_box_line "    ${DIM}Debian/Ubuntu:${NC} sudo apt install tailscale"
              draw_box_line "    ${DIM}Arch:${NC}          sudo pacman -S tailscale"
              draw_box_line "    ${DIM}Fedora:${NC}        sudo dnf install tailscale"
              draw_box_empty
              draw_box_bottom
              echo ""

              ask_yesno "Install Tailscale now? (requires curl)" "y" true
              if [ "$YESNO_RESULT" = "BACK" ]; then continue; fi
              if [ "$YESNO_RESULT" = "y" ]; then
                step "Installing Tailscale..."
                if curl -fsSL https://tailscale.com/install.sh | sh 2>&1; then
                  info "Tailscale installed successfully"
                  has_tailscale=true
                else
                  warn "Tailscale installation failed"
                  ask_yesno "Continue without Tailscale?" "y"
                  if [ "$YESNO_RESULT" = "y" ]; then
                    USE_TAILSCALE="n"
                  else
                    fail "Setup cancelled"
                  fi
                fi
              else
                ask_yesno "Continue without Tailscale?" "y"
                if [ "$YESNO_RESULT" != "y" ]; then continue; fi
                USE_TAILSCALE="n"
              fi
            fi

            if [ "$USE_TAILSCALE" = "y" ] && [ "$has_tailscale" = true ]; then
              local ts_connected=false
              if tailscale ip -4 &>/dev/null; then
                ts_connected=true
                local ts_ip_addr
                ts_ip_addr=$(tailscale ip -4 2>/dev/null || echo "unknown")
                info "Tailscale is connected (IP: ${ts_ip_addr})"

                draw_box_top
                draw_box_empty
                draw_box_line "${GREEN}${CHECK} Nexus will be accessible at:${NC}"
                draw_box_line "  ${THEME_COLOR}http://${ts_ip_addr}:${SETUP_PORT}${NC}"
                draw_box_empty
                draw_box_bottom
                echo ""
              else
                warn "Tailscale is installed but not connected"
                ask_yesno "Run 'tailscale up' to connect?" "y" true
                if [ "$YESNO_RESULT" = "BACK" ]; then continue; fi
                if [ "$YESNO_RESULT" = "y" ]; then
                  step "Starting Tailscale..."
                  if tailscale up 2>&1; then
                    info "Tailscale connected"
                  else
                    warn "Tailscale connection requires browser auth."
                    dimtext "Run 'tailscale up' manually after setup."
                  fi
                fi
              fi

              section "TAILSCALE API (OPTIONAL)"
              draw_box_top
              draw_box_empty
              draw_box_line "${DIM}Provide a Tailscale API key for advanced${NC}"
              draw_box_line "${DIM}management (device listing, auth keys).${NC}"
              draw_box_line "${DIM}Skip if you don't need API integration.${NC}"
              draw_box_empty
              draw_box_bottom
              echo ""

              ask_yesno "Configure Tailscale API key?" "n" true
              if [ "$YESNO_RESULT" = "BACK" ]; then continue; fi
              if [ "$YESNO_RESULT" = "y" ]; then
                ask_input "Tailscale API key (tskey-api-...)" ""
                TAILSCALE_API_KEY="$INPUT_RESULT"
                ask_input "Tailnet name (e.g., your-org.ts.net)" ""
                TAILSCALE_TAILNET="$INPUT_RESULT"
              fi
            fi
            ;;

          3) # Direct
            SETUP_NGINX="n"
            USE_TAILSCALE="n"
            info "Direct access mode — dashboard at http://localhost:${SETUP_PORT}"
            ;;
        esac

        CURRENT_STEP=5
        ;;

      5) # Systemd
        draw_progress 5 $TOTAL_STEPS
        section "AUTO-START"

        draw_box_top
        draw_box_empty
        draw_box_line "${DIM}Install Nexus as a systemd service for${NC}"
        draw_box_line "${DIM}auto-start on boot.${NC}"
        draw_box_empty
        draw_box_bottom
        echo ""

        ask_yesno "Install systemd service?" "n" true
        if [ "$YESNO_RESULT" = "BACK" ]; then CURRENT_STEP=4; continue; fi
        SETUP_SYSTEMD="$YESNO_RESULT"

        CURRENT_STEP=6
        ;;

      6) # Launch
        draw_progress 6 $TOTAL_STEPS
        section "LAUNCH"

        ask_yesno "Start Nexus after installation?" "y" true
        if [ "$YESNO_RESULT" = "BACK" ]; then CURRENT_STEP=5; continue; fi
        SETUP_START="$YESNO_RESULT"

        CURRENT_STEP=7
        ;;

      7) # Summary
        draw_progress 7 $TOTAL_STEPS
        section "CONFIGURATION SUMMARY"

        draw_box_top
        draw_box_empty
        draw_box_line "${BOLD}Mode:${NC}           ${THEME_COLOR}${MODE_NAME}${NC}"
        draw_box_line "${BOLD}Port:${NC}           ${THEME_COLOR}${SETUP_PORT}${NC}"

        if [ "$MODE_NAME" = "node" ]; then
          draw_box_line "${BOLD}Server URL:${NC}     ${THEME_COLOR}${NODE_SERVER_URL}${NC}"
        fi

        draw_box_line "${BOLD}Console:${NC}        ${THEME_COLOR}$([ "${CONSOLE_ENABLED:-false}" = true ] && echo 'Enabled' || echo 'Disabled')${NC}"
        draw_box_line "${BOLD}Sudo access:${NC}    ${THEME_COLOR}$([ "${ALLOW_SUDO:-false}" = true ] && echo 'Enabled' || echo 'Disabled')${NC}"

        if [ "$MODE_NAME" != "node" ]; then
          if [ "${USE_TAILSCALE:-n}" = "y" ]; then
            draw_box_line "${BOLD}Access:${NC}         ${THEME_COLOR}Tailscale VPN${NC}"
          elif [ "${SETUP_NGINX:-n}" = "y" ]; then
            draw_box_line "${BOLD}Nginx:${NC}          ${THEME_COLOR}Yes (${NGINX_DOMAIN:-})${NC}"
          else
            draw_box_line "${BOLD}Access:${NC}         ${THEME_COLOR}Direct (IP:port)${NC}"
          fi
        fi

        draw_box_line "${BOLD}Systemd:${NC}        ${THEME_COLOR}$([ "${SETUP_SYSTEMD:-n}" = 'y' ] && echo 'Yes' || echo 'No')${NC}"
        draw_box_line "${BOLD}Start after:${NC}    ${THEME_COLOR}$([ "${SETUP_START:-y}" = 'y' ] && echo 'Yes' || echo 'No')${NC}"
        draw_box_empty
        draw_box_bottom
        echo ""

        ask_yesno "Proceed with installation?" "y" true
        if [ "$YESNO_RESULT" = "BACK" ]; then CURRENT_STEP=6; continue; fi
        if [ "$YESNO_RESULT" != "y" ]; then
          echo ""
          warn "Setup cancelled by user"
          exit 0
        fi

        CURRENT_STEP=$((TOTAL_STEPS + 1))
        ;;
    esac
  done
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

  node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync('config/config.json', 'utf8'));
    cfg.server.port = ${SETUP_PORT};
    cfg.node.serverUrl = '${NODE_SERVER_URL:-http://localhost:8080}';
    cfg.console = cfg.console || {};
    cfg.console.enabled = ${CONSOLE_ENABLED:-false};
    cfg.console.allowSudo = ${ALLOW_SUDO:-false};
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

    // Tailscale config
    if ('${USE_TAILSCALE:-n}' === 'y') {
      cfg.tailscale = {
        enabled: true,
        apiKey: '${TAILSCALE_API_KEY:-}',
        tailnet: '${TAILSCALE_TAILNET:-}',
      };
    }

    fs.writeFileSync('config/config.json', JSON.stringify(cfg, null, 2));
  "
  info "Configuration updated"

  # ─── Reverse SSH Setup ─────────────────────
  setup_reverse_ssh

  # ─── Nginx ─────────────────────────────────
  if [ "${SETUP_NGINX:-n}" = "y" ]; then
    step "Setting up nginx reverse proxy"
    node src/setup/wizard.js --domain="${NGINX_DOMAIN:-}" --ssl="${NGINX_SSL:-n}" --port="${SETUP_PORT}" 2>&1 || {
      warn "Nginx setup had issues — you can retry with: npm run setup:nginx"
    }
    info "Nginx configured"
  fi

  # ─── Systemd ───────────────────────────────
  if [ "${SETUP_SYSTEMD:-n}" = "y" ]; then
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

    if [ "${USE_TAILSCALE:-n}" = "y" ]; then
      local ts_ip
      ts_ip=$(tailscale ip -4 2>/dev/null || echo "your-tailscale-ip")
      draw_box_line "${BOLD}Dashboard:${NC}  ${THEME_COLOR}http://${ts_ip}:${SETUP_PORT}${NC}"
    elif [ "${SETUP_NGINX:-n}" = "y" ]; then
      draw_box_line "${BOLD}Dashboard:${NC}  ${THEME_COLOR}https://${NGINX_DOMAIN}${NC}"
    else
      draw_box_line "${BOLD}Dashboard:${NC}  ${THEME_COLOR}http://localhost:${SETUP_PORT}${NC}"
    fi

    draw_box_line "${BOLD}Login:${NC}      ${YELLOW}admin / admin123${NC}"
    draw_box_empty
  fi

  if [ "$MODE_NAME" = "node" ]; then
    draw_box_empty
    draw_box_line "${BOLD}Reports to:${NC} ${THEME_COLOR}${NODE_SERVER_URL}${NC}"
    draw_box_empty
  fi

  draw_box_separator
  draw_box_empty
  draw_box_line "${DIM}Manual commands:${NC}"
  draw_box_line "  npm run start:combine   ${DIM}# Dashboard + local monitoring${NC}"
  draw_box_line "  npm run start:server    ${DIM}# Dashboard & API only${NC}"
  draw_box_line "  npm run start:node      ${DIM}# Node reporter only${NC}"
  draw_box_line "  npm run dev             ${DIM}# Development mode${NC}"
  draw_box_line "  docker compose up -d    ${DIM}# Run with Docker${NC}"

  if [ "${USE_TAILSCALE:-n}" = "y" ]; then
    draw_box_empty
    draw_box_line "${DIM}Tailscale commands:${NC}"
    draw_box_line "  tailscale status        ${DIM}# Check connection${NC}"
    draw_box_line "  tailscale ip            ${DIM}# Show Tailscale IP${NC}"
  fi

  draw_box_empty

  if [ "${SETUP_SYSTEMD:-n}" = "y" ]; then
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
  if [ "${SETUP_START:-n}" = "y" ]; then
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
#  BYPASS MODE — red TUI, skip onboarding
# ══════════════════════════════════════════════

run_bypass_mode() {
  # Override theme to RED for bypass mode
  THEME_COLOR="$RED"
  THEME_ACCENT="$RED"

  banner

  draw_box_top
  draw_box_empty
  draw_box_center "${RED}${BOLD}⚡ BYPASS MODE ⚡${NC}"
  draw_box_empty
  draw_box_center "${RED}${BOLD}WARNING: DEVELOPMENT/TESTING ONLY${NC}"
  draw_box_empty
  draw_box_center "${DIM}Skipping onboarding & 2FA — using defaults${NC}"
  draw_box_center "${DIM}All prompts use default values${NC}"
  draw_box_empty
  draw_box_bottom
  echo ""

  MODE_NAME="combine"
  SETUP_PORT="8080"
  NODE_SERVER_URL="http://localhost:8080"
  CONSOLE_ENABLED=true
  ALLOW_SUDO=false
  SETUP_NGINX="n"
  NGINX_DOMAIN=""
  NGINX_SSL="n"
  SETUP_SYSTEMD="n"
  USE_TAILSCALE="n"

  # ─── Prerequisites ─────────────────────────
  section "PREREQUISITES"

  if ! command -v node &>/dev/null; then
    fail "Node.js is not installed. Install Node.js >= ${REQUIRED_NODE_MAJOR}"
  fi

  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -lt "$REQUIRED_NODE_MAJOR" ]; then
    fail "Node.js ${REQUIRED_NODE_MAJOR}+ required (found $(node -v))"
  fi
  info "Node.js $(node -v)"
  info "npm $(npm -v)"

  # ─── Dependencies ──────────────────────────
  section "DEPENDENCIES"

  step "Installing backend dependencies"
  npm install --loglevel=warn 2>&1 | tail -3
  info "Backend dependencies installed"

  step "Installing dashboard dependencies"
  (cd dashboard && npm install --loglevel=warn 2>&1 | tail -3)
  info "Dashboard dependencies installed"

  step "Building dashboard"
  (cd dashboard && npm run build 2>&1 | tail -5)
  info "Dashboard built"

  # ─── Config ────────────────────────────────
  section "CONFIGURATION"

  mkdir -p data

  if [ ! -f config/config.json ]; then
    cp config/config.default.json config/config.json
    info "Created config from defaults"
  fi

  node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync('config/config.json', 'utf8'));
    cfg.server.port = ${SETUP_PORT};
    cfg.node.serverUrl = '${NODE_SERVER_URL}';
    cfg.console = cfg.console || {};
    cfg.console.enabled = ${CONSOLE_ENABLED};
    cfg.console.allowSudo = ${ALLOW_SUDO};
    fs.writeFileSync('config/config.json', JSON.stringify(cfg, null, 2));
  "
  info "Config updated"

  # ─── Bypass: auto-setup admin + 2FA + onboarding ──
  section "BYPASS SETUP"

  step "Creating admin account & 2FA"

  BYPASS_OUTPUT=$(node -e "
    const database = require('./src/utils/database');
    const { hashPassword } = require('./src/utils/password');
    const { generateSecret, encryptSecret, generateRecoveryCodes, hashRecoveryCode } = require('./src/utils/totp');

    database.init();

    const bcrypt = require('bcrypt');
    const passwordHash = bcrypt.hashSync('admin123', 10);

    let user = database.getUserByUsername('admin');
    if (user) {
      database.updateUser(user.id, { password: passwordHash, mustChangePassword: 0 });
    } else {
      database.createUser({ username: 'admin', password: passwordHash, role: 'admin', mustChangePassword: 0 });
      user = database.getUserByUsername('admin');
    }

    const { secret, otpauth_url } = generateSecret('admin');
    const encrypted = encryptSecret(secret);

    const codes = generateRecoveryCodes(10);
    const hashedCodes = codes.map(c => hashRecoveryCode(c));

    database.updateUser(user.id, {
      totpSecret: encrypted,
      totpEnabled: 1,
      recoveryCodes: JSON.stringify(hashedCodes)
    });

    database.setSetting('onboarding_completed', 'true');
    database.setSetting('onboarding_version', '1.9.5');

    console.log('SECRET=' + secret);
    console.log('OTPAUTH=' + otpauth_url);
    console.log('RECOVERY=' + codes.slice(0, 3).join(','));
  ")

  BYPASS_SECRET=$(echo "$BYPASS_OUTPUT" | grep '^SECRET=' | cut -d= -f2-)
  BYPASS_RECOVERY=$(echo "$BYPASS_OUTPUT" | grep '^RECOVERY=' | cut -d= -f2-)

  info "Admin account ready  ${DIM}(admin / admin123)${NC}"
  info "2FA configured"
  info "Onboarding marked complete"

  # ─── Done ──────────────────────────────────
  echo ""
  draw_box_top
  draw_box_empty
  draw_box_center "${RED}${BOLD}${CHECK} Bypass Mode Ready${NC}"
  draw_box_empty
  draw_box_separator
  draw_box_empty
  draw_box_line "${BOLD}Dashboard:${NC}    ${RED}http://localhost:${SETUP_PORT}${NC}"
  draw_box_line "${BOLD}Login:${NC}        ${YELLOW}admin / admin123${NC}"
  draw_box_empty
  draw_box_separator
  draw_box_empty
  draw_box_line "${BOLD}2FA Secret:${NC}   ${MAGENTA}${BYPASS_SECRET}${NC}"
  draw_box_empty
  draw_box_line "${DIM}Add this to your authenticator app, or use a${NC}"
  draw_box_line "${DIM}recovery code below for first login:${NC}"
  draw_box_empty

  IFS=',' read -ra RCODES <<< "$BYPASS_RECOVERY"
  for code in "${RCODES[@]}"; do
    draw_box_line "  ${RED}${BULLET}${NC} ${BOLD}${code}${NC}"
  done

  draw_box_empty
  draw_box_bottom
  echo ""

  info "Starting Nexus in ${BOLD}combine${NC} mode..."
  dimtext "Press Ctrl+C to stop"
  echo ""
  exec node src/index.js "--mode=combine"
}

# ══════════════════════════════════════════════
#  Reverse SSH Setup
# ══════════════════════════════════════════════

setup_reverse_ssh() {
  local os_type=$(uname -s)
  local arch=$(uname -m)

  mkdir -p bin

  local binary_name="reverse-ssh"

  case "$os_type" in
    Linux)
      if [ "$arch" = "x86_64" ]; then binary_name="reverse-ssh"
      elif [ "$arch" = "i686" ] || [ "$arch" = "i386" ]; then binary_name="reverse-ssh-x86"
      elif [ "$arch" = "aarch64" ] || [ "$arch" = "arm64" ]; then binary_name="reverse-ssh-arm64"
      else warn "Unsupported architecture: $arch — skip reverse-ssh"; return; fi
      ;;
    Darwin)
      if [ "$arch" = "x86_64" ]; then binary_name="reverse-ssh-darwin-amd64"
      elif [ "$arch" = "arm64" ]; then binary_name="reverse-ssh-darwin-arm64"
      else warn "Unsupported macOS architecture: $arch"; return; fi
      ;;
    *) warn "Unsupported OS: $os_type — skip reverse-ssh"; return ;;
  esac

  if [ -f "bin/$binary_name" ]; then
    info "Reverse-SSH binary already present at bin/$binary_name"
    chmod +x "bin/$binary_name"
    return
  fi

  step "Downloading reverse-ssh from GitHub..."

  local release_url="https://github.com/Fahrj/reverse-ssh/releases/latest/download"
  local download_url="${release_url}/${binary_name}"

  if command -v wget &>/dev/null; then
    if wget -q -O "bin/$binary_name" "$download_url" 2>/dev/null; then
      chmod +x "bin/$binary_name"
      info "Reverse-SSH binary downloaded to bin/$binary_name"
    else
      warn "Failed to download reverse-ssh (wget)"
    fi
  elif command -v curl &>/dev/null; then
    if curl -sL -o "bin/$binary_name" "$download_url" 2>/dev/null; then
      chmod +x "bin/$binary_name"
      info "Reverse-SSH binary downloaded to bin/$binary_name"
    else
      warn "Failed to download reverse-ssh (curl)"
    fi
  else
    warn "wget or curl not found — cannot auto-download reverse-ssh"
    dimtext "Download manually from: $release_url"
  fi
}

# ══════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════

main() {
  if [[ "${1:-}" == "--bypass-mode" ]]; then
    run_bypass_mode
    exit 0
  fi

  banner
  collect_answers
  run_installation
}

main "$@"
