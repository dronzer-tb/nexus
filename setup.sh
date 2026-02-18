#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════
#  Nexus Setup — Dronzer Studios
#  Modern TUI Installer v4.0
#
#  Full-width centered layout with arrow-key menus,
#  animated spinners, and gradient color accents.
# ══════════════════════════════════════════════════════════════

# ─── 256-Color Palette ───────────────────────────────────────
C_ACCENT=$'\033[38;5;45m'       # Bright cyan
C_ACCENT2=$'\033[38;5;39m'      # Slightly deeper cyan
C_PURPLE=$'\033[38;5;141m'      # Soft purple
C_GREEN=$'\033[38;5;114m'       # Soft green
C_RED=$'\033[38;5;203m'         # Soft red
C_YELLOW=$'\033[38;5;221m'      # Warm yellow
C_ORANGE=$'\033[38;5;208m'      # Orange
C_DIM=$'\033[38;5;243m'         # Grey
C_DIM2=$'\033[38;5;239m'        # Darker grey
C_WHITE=$'\033[38;5;255m'       # Bright white
C_BOLD=$'\033[1m'
C_RESET=$'\033[0m'

# Standard ANSI fallbacks
BOLD=$'\033[1m'
DIM=$'\033[2m'
NC=$'\033[0m'

# ─── Constants ───────────────────────────────────────────────
REQUIRED_NODE_MAJOR=18
TOTAL_STEPS=6

# ─── Layout ──────────────────────────────────────────────────
TERM_W=$(tput cols)
TERM_H=$(tput lines)
CONTENT_W=72
(( CONTENT_W > TERM_W - 4 )) && CONTENT_W=$(( TERM_W - 4 ))
PAD_LEFT=$(( (TERM_W - CONTENT_W) / 2 ))
INDENT=""
for (( i=0; i<PAD_LEFT; i++ )); do INDENT+=" "; done

# ─── Setup State ─────────────────────────────────────────────
MODE_NAME="combine"
SETUP_PORT="8080"
NODE_SERVER_URL="http://localhost:8080"
CONSOLE_ENABLED=false
ALLOW_SUDO=false
SETUP_NGINX="n"
NGINX_DOMAIN=""
NGINX_SSL="n"
SETUP_SYSTEMD="n"
USE_TAILSCALE="n"
TAILSCALE_API_KEY=""
TAILSCALE_TAILNET=""

MENU_RESULT=""
YESNO_RESULT=""
INPUT_RESULT=""
PORT_RESULT=""

# ─── Terminal Helpers ────────────────────────────────────────

hide_cursor() { printf '\033[?25l'; }
show_cursor() { printf '\033[?25h'; }
clear_screen() { printf '\033[2J\033[H'; }
move_to() { printf '\033[%d;%dH' "$1" "$2"; }

rep() {
  local c="$1" n="$2"
  (( n <= 0 )) && return
  printf '%*s' "$n" '' | tr ' ' "$c"
}

strip_ansi() { sed 's/\x1b\[[0-9;]*m//g' <<< "$1"; }

cprint() {
  local text="$1"
  local plain
  plain=$(strip_ansi "$text")
  local pad=$(( (TERM_W - ${#plain}) / 2 ))
  (( pad < 0 )) && pad=0
  printf '%*s%s\n' "$pad" '' "$text"
}

lprint() { printf '%s%s\n' "$INDENT" "$1"; }

blank() { echo; }

# ─── Decorative Elements ────────────────────────────────────

draw_hr() {
  local char="${1:-─}" color="${2:-$C_DIM2}"
  lprint "${color}$(rep "$char" "$CONTENT_W")${C_RESET}"
}

draw_thin_hr() {
  local color="${1:-$C_DIM2}"
  local left=""
  for (( i=0; i<PAD_LEFT+4; i++ )); do left+=" "; done
  printf '%s%s%s%s\n' "$left" "$color" "$(rep '·' $(( CONTENT_W - 8 )))" "$C_RESET"
}

# ─── Logo ────────────────────────────────────────────────────

draw_logo() {
  local c1=$'\033[38;5;45m'
  local c2=$'\033[38;5;39m'
  local c3=$'\033[38;5;33m'
  local c4=$'\033[38;5;27m'
  local b="${C_BOLD}"
  local r="${C_RESET}"

  blank
  cprint "${c1}${b} ███╗   ██╗ ███████╗ ██╗  ██╗ ██╗   ██╗ ███████╗${r}"
  cprint "${c2}${b} ████╗  ██║ ██╔════╝ ╚██╗██╔╝ ██║   ██║ ██╔════╝${r}"
  cprint "${c2}${b} ██╔██╗ ██║ █████╗    ╚███╔╝  ██║   ██║ ███████╗${r}"
  cprint "${c3}${b} ██║╚██╗██║ ██╔══╝    ██╔██╗  ██║   ██║ ╚════██║${r}"
  cprint "${c3}${b} ██║ ╚████║ ███████╗ ██╔╝ ██╗ ╚██████╔╝ ███████║${r}"
  cprint "${c4}${b} ╚═╝  ╚═══╝ ╚══════╝ ╚═╝  ╚═╝  ╚═════╝  ╚══════╝${r}"
  blank
  cprint "${C_DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
  local version
  version=$(cat VERSION 2>/dev/null || echo "2.2.6")
  cprint "${C_WHITE}${C_BOLD}Dronzer Studios${C_RESET}  ${C_DIM}·${C_RESET}  ${C_PURPLE}v${version}${C_RESET}"
  cprint "${C_DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
  blank
}

# ─── System Info Bar ─────────────────────────────────────────

draw_sysinfo() {
  local node_v npm_v os_info
  node_v=$(node -v 2>/dev/null || echo "not found")
  npm_v=$(npm -v 2>/dev/null || echo "not found")
  os_info=$(uname -sr 2>/dev/null || echo "unknown")
  cprint "${C_DIM}${os_info}  ${C_DIM2}│${C_DIM}  Node ${node_v}  ${C_DIM2}│${C_DIM}  npm ${npm_v}${C_RESET}"
  blank
}

# ─── Step Indicator ──────────────────────────────────────────

draw_steps() {
  local current="$1" total="$2"
  local dots=""
  for (( i=1; i<=total; i++ )); do
    if (( i < current )); then
      dots+="${C_GREEN}●${C_RESET} "
    elif (( i == current )); then
      dots+="${C_ACCENT}${C_BOLD}●${C_RESET} "
    else
      dots+="${C_DIM2}○${C_RESET} "
    fi
  done
  cprint "$dots"
  blank
}

# ─── Section Header ─────────────────────────────────────────

section_header() {
  local title="$1" icon="${2:-▸}"
  draw_hr "─" "$C_DIM2"
  blank
  lprint "  ${C_ACCENT}${C_BOLD}${icon}  ${title}${C_RESET}"
  blank
}

# ─── Arrow-Key Menu ──────────────────────────────────────────

arrow_menu() {
  local title="$1" show_back="$2"
  shift 2
  local options=("$@")
  local count=${#options[@]}
  local selected=0

  # Calculate total drawn lines (options + back + hint)
  local draw_lines=$count
  [[ "$show_back" == "true" ]] && (( draw_lines += 2 ))  # blank + back
  (( draw_lines += 2 ))  # blank + hint line

  _draw_all() {
    local i
    for (( i=0; i<count; i++ )); do
      printf '\r\033[2K'
      if (( i == selected )); then
        lprint "    ${C_ACCENT}${C_BOLD}  ❯ ${options[$i]}${C_RESET}"
      else
        lprint "    ${C_DIM}    ${options[$i]}${C_RESET}"
      fi
    done
    if [[ "$show_back" == "true" ]]; then
      printf '\r\033[2K'
      blank
      printf '\r\033[2K'
      lprint "    ${C_DIM2}    ← Back (q)${C_RESET}"
    fi
    printf '\r\033[2K'
    blank
    printf '\r\033[2K'
    lprint "  ${C_DIM2}↑/↓ Navigate  ·  Enter Select${C_RESET}"
  }

  _redraw() {
    # Move cursor up to the start, then redraw everything
    printf '\033[%dA\r' "$draw_lines" 2>/dev/null || true
    _draw_all
  }

  # Initial draw
  _draw_all

  hide_cursor

  while true; do
    local key=""
    IFS= read -rsn1 key < /dev/tty || true
    if [[ "$key" == $'\033' ]]; then
      local seq=""
      IFS= read -rsn2 -t 0.2 seq < /dev/tty || true
      if [[ "$seq" == "[A" ]]; then
        if (( selected > 0 )); then
          (( selected-- )) || true
          _redraw
        fi
      elif [[ "$seq" == "[B" ]]; then
        if (( selected < count - 1 )); then
          (( selected++ )) || true
          _redraw
        fi
      fi
    elif [[ "$key" == "" ]]; then
      MENU_RESULT=$(( selected + 1 ))
      show_cursor
      return 0
    elif [[ "$key" == "k" || "$key" == "K" ]]; then
      if (( selected > 0 )); then
        (( selected-- )) || true
        _redraw
      fi
    elif [[ "$key" == "j" || "$key" == "J" ]]; then
      if (( selected < count - 1 )); then
        (( selected++ )) || true
        _redraw
      fi
    elif [[ "$key" == "q" || "$key" == "Q" ]]; then
      if [[ "$show_back" == "true" ]]; then
        MENU_RESULT="BACK"
        show_cursor
        return 0
      fi
    elif [[ "$key" =~ ^[1-9]$ ]] && (( key <= count )); then
      MENU_RESULT="$key"
      show_cursor
      return 0
    fi
  done
}

# ─── Yes/No Prompt ───────────────────────────────────────────

ask_yesno() {
  local prompt="$1" default="${2:-n}" show_back="${3:-false}"
  local hint="y/N"
  [[ "$default" == "y" ]] && hint="Y/n"

  show_cursor
  printf '%s  %s▸%s %s%s%s [%s]: ' "$INDENT" "$C_ACCENT" "$C_RESET" "$C_BOLD" "$prompt" "$C_RESET" "$hint"

  local answer
  read -r answer < /dev/tty
  answer="${answer:-$default}"

  case "$answer" in
    [bB]) [[ "$show_back" == "true" ]] && { YESNO_RESULT="BACK"; return; }; YESNO_RESULT="$default" ;;
    [yY]|yes) YESNO_RESULT="y" ;;
    [nN]|no)  YESNO_RESULT="n" ;;
    *)        YESNO_RESULT="$default" ;;
  esac
}

# ─── Text Input ──────────────────────────────────────────────

ask_input() {
  local prompt="$1" default="${2:-}" show_back="${3:-false}"

  show_cursor
  [[ -n "$default" ]] && lprint "  ${C_DIM}Default: ${default}${C_RESET}" && blank
  printf '%s  %s▸%s %s%s%s' "$INDENT" "$C_ACCENT" "$C_RESET" "$C_BOLD" "$prompt" "$C_RESET"
  [[ -n "$default" ]] && printf ' %s[%s]%s' "$C_DIM" "$default" "$C_RESET"
  printf ': '

  local val
  read -r val < /dev/tty
  val="${val:-$default}"

  if [[ "$show_back" == "true" && "$val" == "back" ]]; then INPUT_RESULT="BACK"; return; fi
  if [[ -z "$val" ]]; then
    lprint "  ${C_RED}✗ Value cannot be empty${C_RESET}"
    ask_input "$prompt" "$default" "$show_back"
    return
  fi
  INPUT_RESULT="$val"
}

# ─── Port Input ─────────────────────────────────────────────

ask_port() {
  local prompt="$1" default="${2:-8080}" show_back="${3:-false}"

  show_cursor
  lprint "  ${C_DIM}Valid range: 1–65535${C_RESET}"
  blank
  printf '%s  %s▸%s %s%s%s [%s]: ' "$INDENT" "$C_ACCENT" "$C_RESET" "$C_BOLD" "$prompt" "$C_RESET" "$default"

  local val
  read -r val < /dev/tty
  val="${val:-$default}"

  if [[ "$show_back" == "true" && "$val" == "back" ]]; then PORT_RESULT="BACK"; return; fi
  if [[ "$val" =~ ^[0-9]+$ ]] && (( val >= 1 && val <= 65535 )); then
    PORT_RESULT="$val"
  else
    lprint "  ${C_RED}✗ Invalid port${C_RESET}"
    ask_port "$prompt" "$default" "$show_back"
  fi
}

# ─── Spinner ─────────────────────────────────────────────────

SPINNER_PID=""

start_spinner() {
  local msg="$1"
  local frames=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
  (
    local i=0
    while true; do
      printf '\r%s  %s%s%s %s' "$INDENT" "$C_ACCENT" "${frames[$i]}" "$C_RESET" "$msg"
      i=$(( (i + 1) % ${#frames[@]} ))
      sleep 0.08
    done
  ) &
  SPINNER_PID=$!
  disown "$SPINNER_PID" 2>/dev/null || true
}

stop_spinner() {
  local success="${1:-true}" msg="${2:-}"
  if [[ -n "$SPINNER_PID" ]]; then
    kill "$SPINNER_PID" 2>/dev/null || true
    wait "$SPINNER_PID" 2>/dev/null || true
    SPINNER_PID=""
  fi
  printf '\r\033[2K'
  if [[ -n "$msg" ]]; then
    if [[ "$success" == "true" ]]; then
      lprint "  ${C_GREEN}✓${C_RESET} ${msg}"
    else
      lprint "  ${C_RED}✗${C_RESET} ${msg}"
    fi
  fi
}

# ─── Install Output Helpers ─────────────────────────────────

install_step() { lprint "  ${C_ACCENT}▸${C_RESET} ${C_BOLD}${1}${C_RESET}"; }
install_ok()   { lprint "  ${C_GREEN}✓${C_RESET} ${1}"; }
install_warn() { lprint "  ${C_YELLOW}!${C_RESET} ${1}"; }
install_fail() { lprint "  ${C_RED}✗${C_RESET} ${1}"; }

# ─── Summary Table ───────────────────────────────────────────

summary_row() {
  local label="$1" value="$2"
  printf '%s  %s%-16s%s %s%s%s\n' "$INDENT" "$C_DIM" "$label" "$C_RESET" "$C_WHITE" "$value" "$C_RESET"
}

# ══════════════════════════════════════════════════════════════
#  PHASE 1: COLLECT ANSWERS
# ══════════════════════════════════════════════════════════════

collect_answers() {
  local step=1

  while (( step <= TOTAL_STEPS )); do
    clear_screen
    draw_logo
    draw_sysinfo
    draw_steps "$step" "$TOTAL_STEPS"

    case "$step" in

      1)
        section_header "OPERATING MODE"
        blank
        lprint "    ${C_DIM}Choose how Nexus should run on this machine:${C_RESET}"
        blank

        arrow_menu "Operating Mode" "false" \
          "Combine  —  Dashboard + local monitoring" \
          "Server   —  Dashboard & API only" \
          "Node     —  Lightweight metrics reporter"

        case "$MENU_RESULT" in
          1) MODE_NAME="combine" ;;
          2) MODE_NAME="server"  ;;
          3) MODE_NAME="node"    ;;
        esac
        (( step++ )) || true
        ;;

      2)
        if [[ "$MODE_NAME" != "node" ]]; then
          section_header "NETWORK" "⚡"
          blank
          ask_port "Dashboard port" "8080" true
          if [[ "$PORT_RESULT" == "BACK" ]]; then (( step-- )) || true; continue; fi
          SETUP_PORT="$PORT_RESULT"
        else
          section_header "SERVER CONNECTION" "🔗"
          blank
          lprint "    ${C_DIM}Enter the Nexus server URL this node should report to.${C_RESET}"
          blank
          ask_input "Server URL" "http://localhost:8080" true
          if [[ "$INPUT_RESULT" == "BACK" ]]; then (( step-- )) || true; continue; fi
          NODE_SERVER_URL="$INPUT_RESULT"
          SETUP_PORT="8080"
        fi
        (( step++ )) || true
        ;;

      3)
        section_header "WEB CONSOLE" "⌨"
        blank
        lprint "    ${C_DIM}The web console provides SSH terminal access to nodes${C_RESET}"
        lprint "    ${C_DIM}directly from the dashboard. Requires 2FA.${C_RESET}"
        blank

        arrow_menu "Web Console" "true" \
          "Enable   —  SSH terminal from dashboard" \
          "Disable  —  No terminal access"

        if [[ "$MENU_RESULT" == "BACK" ]]; then (( step-- )) || true; continue; fi

        if (( MENU_RESULT == 1 )); then
          CONSOLE_ENABLED=true

          clear_screen
          draw_logo
          draw_sysinfo
          draw_steps "$step" "$TOTAL_STEPS"
          section_header "CONSOLE SECURITY" "🔒"
          blank
          lprint "    ${C_DIM}Configure privilege level for console commands.${C_RESET}"
          blank

          arrow_menu "Sudo Access" "true" \
            "No sudo   —  Regular user commands only" \
            "Allow sudo —  Privileged commands (with 2FA)"

          if [[ "$MENU_RESULT" == "BACK" ]]; then continue; fi
          (( MENU_RESULT == 1 )) && ALLOW_SUDO=false || ALLOW_SUDO=true
        else
          CONSOLE_ENABLED=false
          ALLOW_SUDO=false
        fi
        (( step++ )) || true
        ;;

      4)
        if [[ "$MODE_NAME" == "node" ]]; then
          SETUP_NGINX="n"; USE_TAILSCALE="n"
          (( step++ )) || true; continue
        fi

        section_header "NETWORKING & ACCESS" "🌐"

        local has_nginx=false has_tailscale=false
        command -v nginx     &>/dev/null && has_nginx=true
        command -v tailscale &>/dev/null && has_tailscale=true

        blank
        lprint "    ${C_DIM}Choose how to expose the Nexus dashboard:${C_RESET}"
        blank
        lprint "    $([ "$has_nginx" = true ] && echo "${C_GREEN}✓" || echo "${C_YELLOW}!")${C_RESET} ${C_DIM}Nginx${C_RESET}     $([ "$has_nginx" = true ] && echo "${C_GREEN}installed" || echo "${C_YELLOW}not found")${C_RESET}"
        lprint "    $([ "$has_tailscale" = true ] && echo "${C_GREEN}✓" || echo "${C_YELLOW}!")${C_RESET} ${C_DIM}Tailscale${C_RESET} $([ "$has_tailscale" = true ] && echo "${C_GREEN}installed" || echo "${C_YELLOW}not found")${C_RESET}"
        blank

        arrow_menu "Access Method" "true" \
          "Nginx      —  Reverse proxy with domain & SSL" \
          "Tailscale  —  Zero-config VPN mesh" \
          "Direct     —  Access via IP:port (LAN/dev)"

        if [[ "$MENU_RESULT" == "BACK" ]]; then (( step-- )) || true; continue; fi

        case "$MENU_RESULT" in
          1)
            SETUP_NGINX="y"; USE_TAILSCALE="n"
            if [[ "$has_nginx" == false ]]; then
              blank
              install_warn "nginx is not installed on this system"
              lprint ""
              lprint "    ${C_DIM}Install it first:${C_RESET}"
              lprint "      ${C_DIM}Ubuntu/Debian:${C_RESET}  sudo apt install nginx"
              lprint "      ${C_DIM}CentOS/RHEL:${C_RESET}    sudo yum install nginx"
              lprint "      ${C_DIM}Arch:${C_RESET}           sudo pacman -S nginx"
              blank
              ask_yesno "Continue without nginx? (configure later)" "y" true
              if [[ "$YESNO_RESULT" == "BACK" ]]; then continue; fi
              [[ "$YESNO_RESULT" == "y" ]] && SETUP_NGINX="n" || { show_cursor; echo; echo "  Setup cancelled."; exit 1; }
            fi
            if [[ "$SETUP_NGINX" == "y" ]]; then
              blank; draw_thin_hr; blank
              lprint "  ${C_ACCENT}${C_BOLD}Domain Setup${C_RESET}"
              blank
              ask_input "Domain (e.g., nexus.example.com)" "" true
              if [[ "$INPUT_RESULT" == "BACK" ]]; then continue; fi
              NGINX_DOMAIN="$INPUT_RESULT"
              blank
              ask_yesno "Enable SSL (HTTPS)?" "y" true
              if [[ "$YESNO_RESULT" == "BACK" ]]; then continue; fi
              NGINX_SSL="$YESNO_RESULT"
            fi
            ;;
          2)
            SETUP_NGINX="n"; USE_TAILSCALE="y"
            if [[ "$has_tailscale" == false ]]; then
              blank
              ask_yesno "Install Tailscale now?" "y" true
              if [[ "$YESNO_RESULT" == "BACK" ]]; then continue; fi
              if [[ "$YESNO_RESULT" == "y" ]]; then
                start_spinner "Installing Tailscale..."
                if curl -fsSL https://tailscale.com/install.sh | sh &>/dev/null; then
                  stop_spinner true "Tailscale installed"; has_tailscale=true
                else
                  stop_spinner false "Tailscale install failed"; USE_TAILSCALE="n"
                fi
              else
                USE_TAILSCALE="n"
              fi
            fi
            if [[ "$USE_TAILSCALE" == "y" ]]; then
              blank
              ask_yesno "Configure Tailscale API key?" "n" true
              if [[ "$YESNO_RESULT" == "BACK" ]]; then continue; fi
              if [[ "$YESNO_RESULT" == "y" ]]; then
                ask_input "API key (tskey-api-...)" ""
                TAILSCALE_API_KEY="$INPUT_RESULT"
                ask_input "Tailnet name (e.g., your-org.ts.net)" ""
                TAILSCALE_TAILNET="$INPUT_RESULT"
              fi
            fi
            ;;
          3) SETUP_NGINX="n"; USE_TAILSCALE="n" ;;
        esac
        (( step++ )) || true
        ;;

      5)
        section_header "AUTO-START" "⏻"
        blank
        lprint "    ${C_DIM}Install Nexus as a systemd service to auto-start on boot.${C_RESET}"
        blank

        arrow_menu "Systemd Service" "true" \
          "Yes  —  Install and enable systemd service" \
          "No   —  Start manually with npm commands"

        if [[ "$MENU_RESULT" == "BACK" ]]; then (( step-- )) || true; continue; fi
        (( MENU_RESULT == 1 )) && SETUP_SYSTEMD="y" || SETUP_SYSTEMD="n"
        (( step++ )) || true
        ;;

      6)
        section_header "REVIEW CONFIGURATION" "📋"
        blank

        local access_method="Direct (IP:port)"
        if [[ "$MODE_NAME" != "node" ]]; then
          [[ "$USE_TAILSCALE" == "y" ]] && access_method="Tailscale VPN"
          [[ "$SETUP_NGINX" == "y" ]] && access_method="Nginx (${NGINX_DOMAIN})"
        fi

        summary_row "Mode"        "$MODE_NAME"
        summary_row "Port"        "$SETUP_PORT"
        [[ "$MODE_NAME" == "node" ]] && summary_row "Server URL" "$NODE_SERVER_URL"
        summary_row "Web Console" "$( [[ "$CONSOLE_ENABLED" == true ]] && echo "Enabled" || echo "Disabled" )"
        [[ "$CONSOLE_ENABLED" == true ]] && summary_row "Sudo Access" "$( [[ "$ALLOW_SUDO" == true ]] && echo "Enabled" || echo "Disabled" )"
        [[ "$MODE_NAME" != "node" ]] && summary_row "Access" "$access_method"
        summary_row "Systemd"     "$( [[ "$SETUP_SYSTEMD" == "y" ]] && echo "Yes" || echo "No" )"

        blank; draw_hr "─" "$C_DIM2"; blank
        ask_yesno "Proceed with installation?" "y" true
        if [[ "$YESNO_RESULT" == "BACK" ]]; then (( step-- )) || true; continue; fi
        if [[ "$YESNO_RESULT" != "y" ]]; then
          show_cursor; clear_screen
          cprint "${C_DIM}Setup cancelled.${C_RESET}"; blank; exit 0
        fi
        (( step++ )) || true
        ;;
    esac
  done
}

# ══════════════════════════════════════════════════════════════
#  PHASE 2: INSTALLATION
# ══════════════════════════════════════════════════════════════

run_installation() {
  clear_screen
  draw_logo
  blank
  section_header "INSTALLING" "⚙"
  blank

  # Prerequisites
  install_step "Checking prerequisites"
  if ! command -v node &>/dev/null; then
    install_fail "Node.js not found"
    exit_with_error "Node.js >= ${REQUIRED_NODE_MAJOR} is required."
  fi
  local node_ver
  node_ver=$(node -v | sed 's/v//' | cut -d. -f1)
  if (( node_ver < REQUIRED_NODE_MAJOR )); then
    install_fail "Node.js ${REQUIRED_NODE_MAJOR}+ required (found $(node -v))"
    exit_with_error "Upgrade Node.js and re-run setup."
  fi
  install_ok "Node.js $(node -v)  ·  npm $(npm -v)"
  blank

  # Backend deps
  start_spinner "Installing backend dependencies..."
  npm install --loglevel=error &>/dev/null || true
  stop_spinner true "Backend dependencies installed"

  # Dashboard
  if [[ "$MODE_NAME" != "node" ]]; then
    start_spinner "Installing dashboard dependencies..."
    (cd dashboard && npm install --loglevel=error &>/dev/null) || true
    stop_spinner true "Dashboard dependencies installed"

    start_spinner "Building dashboard..."
    (cd dashboard && npm run build &>/dev/null) || true
    stop_spinner true "Dashboard built"
  fi
  blank

  # Config
  install_step "Writing configuration"
  mkdir -p data
  if [[ ! -f config/config.json ]]; then
    cp config/config.default.json config/config.json
    install_ok "Created config from defaults"
  else
    install_ok "Using existing config.json"
  fi

  node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync('config/config.json', 'utf8'));
    cfg.server.port = ${SETUP_PORT};
    cfg.node = cfg.node || {};
    cfg.node.serverUrl = '${NODE_SERVER_URL}';
    cfg.console = cfg.console || {};
    cfg.console.enabled = ${CONSOLE_ENABLED};
    cfg.console.allowSudo = ${ALLOW_SUDO};
    cfg.console.blockedCommands = ['rm -rf /','rm -rf /*','mkfs.',':(){:|:&};:'];
    cfg.console.blockedPaths = ['/etc/passwd','/etc/shadow','/etc/sudoers','/boot'];
    if ('${USE_TAILSCALE}' === 'y') {
      cfg.tailscale = { enabled: true, apiKey: '${TAILSCALE_API_KEY}', tailnet: '${TAILSCALE_TAILNET}' };
    }
    fs.writeFileSync('config/config.json', JSON.stringify(cfg, null, 2));
  "
  install_ok "Configuration updated"
  blank

  # Reverse SSH (disabled by default — enable in config if needed)
  # setup_reverse_ssh

  # Nginx
  if [[ "$SETUP_NGINX" == "y" ]]; then
    start_spinner "Configuring nginx reverse proxy..."
    if node src/setup/wizard.js --domain="${NGINX_DOMAIN}" --ssl="${NGINX_SSL}" --port="${SETUP_PORT}" &>/dev/null; then
      stop_spinner true "Nginx configured"
    else
      stop_spinner false "Nginx setup had issues — retry: npm run setup:nginx"
    fi
    # Post-setup: verify nginx proxy_pass port matches config
    sync_nginx_port "${SETUP_PORT}" "${NGINX_DOMAIN}"
  fi

  # Systemd
  [[ "$SETUP_SYSTEMD" == "y" ]] && install_systemd_service

  blank
  draw_hr "━" "$C_GREEN"
  blank
  cprint "${C_GREEN}${C_BOLD}✓  Installation complete${C_RESET}"
  blank
  draw_hr "━" "$C_GREEN"
  blank

  show_done_screen
}

# ─── Sync Nginx Port ──────────────────────────────────────────
# Ensures all nginx configs for the domain have the correct proxy_pass port.
# Fixes port mismatches caused by config changes, certbot rewrites, etc.

sync_nginx_port() {
  local port="$1" domain="$2"
  local safe_domain="${domain//./_}"
  local dirs=("/etc/nginx/sites-enabled" "/etc/nginx/sites-available" "/etc/nginx/conf.d")
  local fixed=0

  for dir in "${dirs[@]}"; do
    [[ -d "$dir" ]] || continue
    for f in "$dir"/*; do
      [[ -f "$f" ]] || continue
      # Match config files for this domain (by name or content)
      local match=false
      if [[ "$(basename "$f")" == *"$safe_domain"* ]]; then
        match=true
      elif grep -q "server_name.*${domain}" "$f" 2>/dev/null; then
        match=true
      fi
      [[ "$match" == "true" ]] || continue

      # Check if proxy_pass port differs from target
      if grep -qP "proxy_pass\s+http://127\.0\.0\.1:(?!${port}\b)\d+" "$f" 2>/dev/null; then
        sed -i "s|proxy_pass http://127\.0\.0\.1:[0-9]\+|proxy_pass http://127.0.0.1:${port}|g" "$f" 2>/dev/null && fixed=$((fixed + 1)) || true
      fi
    done
  done

  if (( fixed > 0 )); then
    install_ok "Fixed proxy_pass port in ${fixed} nginx config(s) → ${port}"
    # Reload nginx to apply
    systemctl reload nginx 2>/dev/null || nginx -s reload 2>/dev/null || true
  fi
}

# ─── Reverse SSH Setup ───────────────────────────────────────

setup_reverse_ssh() {
  local os_type arch binary_name="reverse-ssh"
  os_type=$(uname -s); arch=$(uname -m)
  mkdir -p bin

  case "$os_type" in
    Linux)
      case "$arch" in
        x86_64)        binary_name="reverse-ssh" ;;
        i686|i386)     binary_name="reverse-ssh-x86" ;;
        aarch64|arm64) binary_name="reverse-ssh-arm64" ;;
        *) install_warn "Unsupported arch: $arch"; return ;;
      esac ;;
    Darwin)
      case "$arch" in
        x86_64) binary_name="reverse-ssh-darwin-amd64" ;;
        arm64)  binary_name="reverse-ssh-darwin-arm64" ;;
        *) install_warn "Unsupported macOS arch: $arch"; return ;;
      esac ;;
    *) install_warn "Unsupported OS: $os_type"; return ;;
  esac

  if [[ -f "bin/$binary_name" ]]; then
    chmod +x "bin/$binary_name"
    install_ok "Reverse-SSH binary ready"
    return
  fi

  local url="https://github.com/Fahrj/reverse-ssh/releases/latest/download/${binary_name}"
  start_spinner "Downloading reverse-ssh..."
  local dl_ok=false
  if command -v wget &>/dev/null; then
    wget -q -O "bin/$binary_name" "$url" 2>/dev/null && dl_ok=true
  elif command -v curl &>/dev/null; then
    curl -sL -o "bin/$binary_name" "$url" 2>/dev/null && dl_ok=true
  fi
  if [[ "$dl_ok" == true ]]; then
    chmod +x "bin/$binary_name"
    stop_spinner true "Reverse-SSH downloaded"
  else
    stop_spinner false "Failed to download reverse-ssh"
  fi
}

# ─── Systemd Service ─────────────────────────────────────────

install_systemd_service() {
  install_step "Installing systemd service"
  if (( EUID != 0 )) && ! command -v sudo &>/dev/null; then
    install_warn "Root required for systemd — skipping"; return
  fi

  local install_dir node_path svc_file="/etc/systemd/system/nexus.service"
  install_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; node_path=$(command -v node)

  local svc_content="[Unit]
Description=Nexus Monitoring Server
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${install_dir}
ExecStart=${node_path} ${install_dir}/src/index.js --mode=${MODE_NAME}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target"

  if (( EUID == 0 )); then
    echo "$svc_content" > "$svc_file"
    systemctl daemon-reload; systemctl enable nexus.service
  else
    echo "$svc_content" | sudo tee "$svc_file" >/dev/null
    sudo systemctl daemon-reload; sudo systemctl enable nexus.service
  fi
  install_ok "Systemd service installed and enabled"
}

# ─── Done Screen ─────────────────────────────────────────────

show_done_screen() {
  if [[ "$MODE_NAME" != "node" ]]; then
    local url
    if [[ "$USE_TAILSCALE" == "y" ]]; then
      local ts_ip; ts_ip=$(tailscale ip -4 2>/dev/null || echo "your-tailscale-ip")
      url="http://${ts_ip}:${SETUP_PORT}"
    elif [[ "$SETUP_NGINX" == "y" ]]; then
      url="https://${NGINX_DOMAIN}"
    else
      url="http://localhost:${SETUP_PORT}"
    fi
    lprint "  ${C_WHITE}${C_BOLD}Dashboard${C_RESET}   ${C_ACCENT}${url}${C_RESET}"
    lprint "  ${C_WHITE}${C_BOLD}Login${C_RESET}       ${C_YELLOW}admin${C_RESET} / ${C_YELLOW}admin123${C_RESET}"
  else
    lprint "  ${C_WHITE}${C_BOLD}Reports to${C_RESET}  ${C_ACCENT}${NODE_SERVER_URL}${C_RESET}"
  fi

  blank; draw_hr "─" "$C_DIM2"; blank
  lprint "  ${C_DIM}Quick start:${C_RESET}"
  blank
  lprint "    ${C_ACCENT}npm run start:combine${C_RESET}   ${C_DIM}Dashboard + monitoring${C_RESET}"
  lprint "    ${C_ACCENT}npm run start:server${C_RESET}    ${C_DIM}Dashboard & API only${C_RESET}"
  lprint "    ${C_ACCENT}npm run start:node${C_RESET}      ${C_DIM}Node reporter only${C_RESET}"

  if [[ "$SETUP_SYSTEMD" == "y" ]]; then
    blank; draw_thin_hr; blank
    lprint "  ${C_DIM}Service:${C_RESET}"
    blank
    lprint "    ${C_ACCENT}sudo systemctl start nexus${C_RESET}"
    lprint "    ${C_ACCENT}sudo systemctl status nexus${C_RESET}"
    lprint "    ${C_ACCENT}sudo journalctl -u nexus -f${C_RESET}"
    blank

    start_spinner "Starting nexus.service..."
    local svc_ok=false
    if (( EUID == 0 )); then
      systemctl start nexus.service 2>/dev/null && svc_ok=true
    else
      sudo systemctl start nexus.service 2>/dev/null && svc_ok=true
    fi
    [[ "$svc_ok" == true ]] && stop_spinner true "nexus.service is running" || stop_spinner false "Run: sudo systemctl start nexus"
  fi

  blank; draw_hr "━" "$C_ACCENT"; blank
  cprint "${C_DIM}Press any key to exit${C_RESET}"
  show_cursor
  read -rsn1 < /dev/tty
  cleanup_exit 0
}

# ─── Error / Exit ────────────────────────────────────────────

exit_with_error() {
  show_cursor; blank
  lprint "  ${C_RED}${C_BOLD}✗ Error:${C_RESET} ${1}"
  blank; exit 1
}

cleanup_exit() {
  show_cursor
  tput rmcup 2>/dev/null || clear_screen
  exit "${1:-0}"
}

trap 'cleanup_exit 130' INT TERM

# ══════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════

main() {
  tput smcup 2>/dev/null || true
  hide_cursor

  if (( TERM_W < 60 || TERM_H < 24 )); then
    show_cursor; tput rmcup 2>/dev/null || true
    echo ""; echo "  Terminal too small (${TERM_W}x${TERM_H}). Need at least 60x24."; echo ""
    exit 1
  fi

  collect_answers
  run_installation
}

main "$@"
