#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
#  Nexus Setup — Dronzer Studios
#  Split-Panel TUI Installer v3.0
#  Layout:
#    ┌──────────────────┬──────────────┐
#    │   LOGO / HEADER  │              │
#    ├──────────────────┤  LIVE LOGS   │
#    │   QUESTIONS      │              │
#    └──────────────────┴──────────────┘
# ──────────────────────────────────────────────

# ─── Colors ──────────────────────────────────
CYAN=$'\033[0;36m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
RED=$'\033[0;31m'
MAGENTA=$'\033[0;35m'
BLUE=$'\033[0;34m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
NC=$'\033[0m'
BG_DARK=$'\033[48;5;234m'

THEME=$CYAN
ACCENT=$MAGENTA

REQUIRED_NODE_MAJOR=18
TOTAL_STEPS=7

# ─── Terminal Dimensions ─────────────────────
TERM_H=$(tput lines)
TERM_W=$(tput cols)

# Panel layout
LEFT_W=$(( TERM_W * 2 / 3 ))       # Input/logo panel width (wider)
RIGHT_W=$(( TERM_W - LEFT_W - 1 ))  # Log panel width (narrower)
LOGO_H=14                           # Height of logo panel (top-left)
INPUT_H=$(( TERM_H - LOGO_H - 1 ))  # Height of input panel (bottom-left)
LOG_H=$(( TERM_H - 2 ))             # Height of log panel

# Panel start columns
LEFT_COL=1
RIGHT_COL=$(( LEFT_W + 2 ))  # Log panel starts here

# Panel start rows
LOGO_ROW=1
INPUT_ROW=$(( LOGO_H + 2 ))

# ─── State ───────────────────────────────────
LOG_LINES=()
LOG_CURRENT_LINE=0

MENU_RESULT=""
INPUT_RESULT=""
YESNO_RESULT=""
PORT_RESULT=""

# Setup variables
MODE_NAME="combine"
SETUP_PORT="8080"
NODE_SERVER_URL="http://localhost:8080"
CONSOLE_ENABLED=false
ALLOW_SUDO=false
SETUP_NGINX="n"
NGINX_DOMAIN=""
NGINX_SSL="n"
SETUP_SYSTEMD="n"
SETUP_START="y"
USE_TAILSCALE="n"
TAILSCALE_API_KEY=""
TAILSCALE_TAILNET=""

# ─── Cursor & Screen Helpers ─────────────────

hide_cursor()   { tput civis 2>/dev/null || true; }
show_cursor()   { tput cnorm 2>/dev/null || true; }
clear_screen()  { tput clear; }
move_to()       { tput cup "$(( $1 - 1 ))" "$(( $2 - 1 ))"; }  # row, col (1-based)
save_cursor()   { tput sc; }
restore_cursor(){ tput rc; }

strip_ansi() {
  echo -e "$1" | sed 's/\x1b\[[0-9;]*m//g'
}

pad_right() {
  local str="$1" width="$2"
  local plain; plain=$(strip_ansi "$str")
  local len=${#plain}
  local pad=$(( width - len ))
  [[ $pad -lt 0 ]] && pad=0
  printf '%s%*s' "$str" "$pad" ''
}

repeat_char() {
  local c="$1" n="$2"
  [[ $n -le 0 ]] && return
  printf '%*s' "$n" '' | tr ' ' "$c"
}

# ─── Draw Static Frame ───────────────────────

draw_frame() {
  clear_screen
  hide_cursor

  local dv='│'
  local dh='─'
  local tl='┌' tr='┐' bl='└' br='┘'
  local tm='┬' bm='┴' lm='├' rm='┤' cx='┼'

  # Top border
  move_to 1 1
  printf "${THEME}${tl}$(repeat_char "$dh" $(( LEFT_W )))${tm}$(repeat_char "$dh" $(( RIGHT_W )))${tr}${NC}"

  # Left panel vertical lines + right panel dividers
  local row
  for (( row=2; row<=TERM_H-1; row++ )); do
    move_to "$row" 1
    printf "${THEME}${dv}${NC}"
    move_to "$row" $(( LEFT_W + 2 ))
    printf "${THEME}${dv}${NC}"
    move_to "$row" $(( TERM_W ))
    printf "${THEME}${dv}${NC}"
  done

  # Horizontal divider between logo and input (right side)
  move_to $(( LOGO_H + 1 )) $(( LEFT_W + 2 ))
  printf "${THEME}${lm}$(repeat_char "$dh" $(( RIGHT_W )))${rm}${NC}"

  # Bottom border
  move_to $(( TERM_H )) 1
  printf "${THEME}${bl}$(repeat_char "$dh" $(( LEFT_W )))${bm}$(repeat_char "$dh" $(( RIGHT_W )))${br}${NC}"

  # Right panel header (log title on top border)
  local log_title=" LIVE INSTALL LOG "
  local log_title_x=$(( LEFT_W + 2 + (RIGHT_W - ${#log_title}) / 2 ))
  move_to 1 $(( log_title_x ))
  printf "${THEME}${BOLD}${log_title}${NC}"

  draw_logo
}

# ─── Draw Logo (top-left) ────────────────────

draw_logo() {
  local col=3  # inside left panel

  move_to 2  "$col"; printf "${THEME}${BOLD}███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗${NC}"
  move_to 3  "$col"; printf "${THEME}${BOLD}████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝${NC}"
  move_to 4  "$col"; printf "${THEME}${BOLD}██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗${NC}"
  move_to 5  "$col"; printf "${THEME}${BOLD}██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║${NC}"
  move_to 6  "$col"; printf "${THEME}${BOLD}██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║${NC}"
  move_to 7  "$col"; printf "${THEME}${BOLD}╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝${NC}"

  move_to 9  "$col"; printf "${BOLD}Dronzer Studios${NC} ${DIM}— Interactive Setup${NC}"
  local version; version=$(cat VERSION 2>/dev/null || echo "2.2.2")
  move_to 10 "$col"; printf "${DIM}v${version}${NC}"

  move_to 12 "$col"; printf "${DIM}Node.js:${NC} $(node -v 2>/dev/null || echo 'not found')"
  move_to 13 "$col"; printf "${DIM}npm:${NC}     $(npm -v 2>/dev/null || echo 'not found')"
}

# ─── Log Panel ───────────────────────────────

log_line_count=2  # next log row inside right panel

add_log() {
  local type="$1" msg="$2"
  local icon color

  case "$type" in
    info)  icon="✓" color="$GREEN" ;;
    warn)  icon="!" color="$YELLOW" ;;
    error) icon="✗" color="$RED" ;;
    step)  icon="▸" color="$THEME" ;;
    dim)   icon=" " color="$DIM" ;;
    *)     icon=" " color="$NC" ;;
  esac

  local max_log=$(( TERM_H - 2 ))
  if (( log_line_count > max_log )); then
    # Reset and clear right panel content
    log_line_count=2
    local r
    for (( r=2; r<=max_log; r++ )); do
      move_to "$r" $(( RIGHT_COL + 1 ))
      printf '%*s' $(( RIGHT_W - 1 )) ''
    done
  fi

  local log_col=$(( RIGHT_COL + 2 ))
  local trunc_len=$(( RIGHT_W - 3 ))
  local full_msg="${color}${icon}${NC} ${msg}"
  local plain; plain=$(strip_ansi "${icon} ${msg}")
  if (( ${#plain} > trunc_len )); then
    full_msg="${color}${icon}${NC} ${msg:0:$trunc_len}"
  fi

  move_to "$log_line_count" "$log_col"
  printf '%s' "$full_msg"

  (( log_line_count++ )) || true
}

log_info()  { add_log info  "$*"; }
log_step()  { add_log step  "$*"; }
log_warn()  { add_log warn  "$*"; }
log_error() { add_log error "$*"; }
log_dim()   { add_log dim   "$*"; }
log_blank() { 
  local max_log=$(( TERM_H - 2 ))
  (( log_line_count <= max_log )) && (( log_line_count++ )) || true
}

# ─── Input Panel Helpers ──────────────────────

INPUT_CURRENT_ROW=$(( INPUT_ROW + 1 ))

clear_input_panel() {
  local r
  for (( r=INPUT_ROW+1; r<=TERM_H-1; r++ )); do
    move_to "$r" 2
    printf '%*s' $(( LEFT_W - 1 )) ''
  done
  INPUT_CURRENT_ROW=$(( INPUT_ROW + 1 ))
}

input_print() {
  local text="${1:-}"
  local col=3
  local avail=$(( LEFT_W - 3 ))

  if (( INPUT_CURRENT_ROW >= TERM_H - 1 )); then return; fi

  local plain; plain=$(strip_ansi "$text")
  if (( ${#plain} > avail )); then
    text="${text:0:$avail}"
  fi

  move_to "$INPUT_CURRENT_ROW" "$col"
  printf '%s' "$text"
  (( INPUT_CURRENT_ROW++ )) || true
}

input_blank() {
  input_print ""
}

input_separator() {
  if (( INPUT_CURRENT_ROW >= TERM_H - 1 )); then return; fi
  move_to "$INPUT_CURRENT_ROW" 2
  printf "${THEME}$(repeat_char '─' $(( LEFT_W - 1 )))${NC}"
  (( INPUT_CURRENT_ROW++ )) || true
}

input_title() {
  local title="$1"
  input_separator
  input_blank
  input_print "${ACCENT}${BOLD}  $title${NC}"
  input_blank
  input_separator
  input_blank
}

draw_progress_bar() {
  local current="$1" total="$2"
  local bar_w=$(( LEFT_W - 14 ))
  local filled=$(( bar_w * current / total ))
  local empty=$(( bar_w - filled ))

  if (( INPUT_CURRENT_ROW >= TERM_H - 1 )); then return; fi
  move_to "$INPUT_CURRENT_ROW" 3
  printf "${DIM}Step %d/%d ${NC}${GREEN}$(repeat_char '█' $filled)${DIM}$(repeat_char '░' $empty)${NC}" "$current" "$total"
  (( INPUT_CURRENT_ROW++ )) || true
  input_blank
}

# ─── Prompt: Read input from user ────────────
# We need to show cursor + position at a prompt line, then read

do_prompt() {
  local prompt_text="$1"
  local col=3

  if (( INPUT_CURRENT_ROW >= TERM_H - 1 )); then
    INPUT_CURRENT_ROW=$(( INPUT_ROW + 1 ))
  fi

  move_to "$INPUT_CURRENT_ROW" "$col"
  printf "${THEME}▸${NC} ${BOLD}${prompt_text}${NC} "
  show_cursor
  local answer
  read -r answer < /dev/tty
  hide_cursor
  move_to "$INPUT_CURRENT_ROW" "$col"
  printf "${THEME}▸${NC} ${BOLD}${prompt_text}${NC} ${GREEN}${answer}${NC}"
  (( INPUT_CURRENT_ROW++ )) || true
  PROMPT_RESULT="$answer"
}

# ─── Menus ────────────────────────────────────

menu_select() {
  local prompt="$1"
  IFS='|' read -ra options <<< "$2"
  local default="${3:-1}"
  local show_back="${4:-false}"
  local count=${#options[@]}

  clear_input_panel

  input_blank
  input_print "${BOLD}  ${prompt}${NC}"
  input_blank
  input_separator
  input_blank

  for i in "${!options[@]}"; do
    local num=$(( i + 1 ))
    if (( num == default )); then
      input_print "   ${THEME}${BOLD}${num})${NC} ${BOLD}${options[$i]}${NC}  ${DIM}← recommended${NC}"
    else
      input_print "   ${DIM}${num})${NC} ${options[$i]}"
    fi
    input_blank
  done

  if [ "$show_back" = "true" ]; then
    input_separator
    input_print "   ${YELLOW}0)${NC} ${DIM}← Back${NC}"
    input_blank
  fi

  input_separator
  input_blank

  while true; do
    do_prompt "Choice [$([ "$show_back" = "true" ] && echo "0-" || echo "1-")${count}] (default: ${default}):"
    local choice="${PROMPT_RESULT:-$default}"

    if [ "$show_back" = "true" ] && [ "$choice" = "0" ]; then
      MENU_RESULT="BACK"; return
    fi

    if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= count )); then
      MENU_RESULT="$choice"
      local idx=$(( choice - 1 ))
      log_info "Selected: ${options[$idx]}"
      return
    fi

    input_blank
    input_print "${RED}  ✗ Enter a number between $([ "$show_back" = "true" ] && echo "0" || echo "1") and ${count}${NC}"
    input_blank
  done
}

ask_yesno() {
  local prompt="$1"
  local default="${2:-n}"
  local show_back="${3:-false}"
  local hint="[y/N]"
  [ "$default" = "y" ] && hint="[Y/n]"

  clear_input_panel
  input_blank
  input_print "${BOLD}  ${prompt}${NC}"
  input_blank
  input_print "  ${DIM}${hint}$([ "$show_back" = "true" ] && echo "  |  b) ← Back" || echo "")${NC}"
  input_blank
  input_separator
  input_blank

  while true; do
    do_prompt "Answer:"
    local answer="${PROMPT_RESULT:-$default}"

    case "$answer" in
      [bB])
        if [ "$show_back" = "true" ]; then YESNO_RESULT="BACK"; return; fi
        ;;
      [yY]|yes) YESNO_RESULT="y"; log_info "${prompt}: Yes"; return ;;
      [nN]|no)  YESNO_RESULT="n"; log_info "${prompt}: No"; return ;;
    esac

    input_blank
    input_print "${RED}  ✗ Enter y or n${NC}"
    input_blank
  done
}

ask_input() {
  local prompt="$1"
  local default="${2:-}"
  local show_back="${3:-false}"

  clear_input_panel
  input_blank
  input_print "${BOLD}  ${prompt}${NC}"
  input_blank
  [ -n "$default" ] && input_print "  ${DIM}Default: ${default}${NC}" && input_blank
  [ "$show_back" = "true" ] && input_print "  ${DIM}Type 'back' to return${NC}" && input_blank
  input_separator
  input_blank

  while true; do
    do_prompt "Enter value$([ -n "$default" ] && echo " [${default}]" || echo ""):"
    local val="${PROMPT_RESULT:-$default}"

    if [ "$show_back" = "true" ] && [ "$val" = "back" ]; then
      INPUT_RESULT="BACK"; return
    fi

    if [ -n "$val" ]; then
      INPUT_RESULT="$val"; log_info "${prompt}: ${val}"; return
    fi

    input_blank
    input_print "${RED}  ✗ Value cannot be empty${NC}"
    input_blank
  done
}

ask_port() {
  local prompt="$1"
  local default="${2:-8080}"
  local show_back="${3:-false}"

  clear_input_panel
  input_blank
  input_print "${BOLD}  ${prompt}${NC}"
  input_blank
  input_print "  ${DIM}Valid range: 1–65535${NC}"
  input_blank
  [ "$show_back" = "true" ] && input_print "  ${DIM}Type 'back' to return${NC}" && input_blank
  input_separator
  input_blank

  while true; do
    do_prompt "Port [${default}]:"
    local val="${PROMPT_RESULT:-$default}"

    if [ "$show_back" = "true" ] && [ "$val" = "back" ]; then
      PORT_RESULT="BACK"; return
    fi

    if [[ "$val" =~ ^[0-9]+$ ]] && (( val >= 1 && val <= 65535 )); then
      PORT_RESULT="$val"; log_info "Port set to: ${val}"; return
    fi

    input_blank
    input_print "${RED}  ✗ Invalid port — enter 1–65535${NC}"
    input_blank
  done
}

# ─── Show Summary ─────────────────────────────

show_summary() {
  clear_input_panel

  input_blank
  input_title "CONFIGURATION SUMMARY"
  input_blank

  input_print "  ${DIM}Mode:${NC}         ${THEME}${BOLD}${MODE_NAME}${NC}"
  input_blank
  input_print "  ${DIM}Port:${NC}         ${THEME}${BOLD}${SETUP_PORT}${NC}"
  input_blank

  if [ "$MODE_NAME" = "node" ]; then
    input_print "  ${DIM}Server URL:${NC}   ${THEME}${NODE_SERVER_URL}${NC}"
    input_blank
  fi

  input_print "  ${DIM}Console:${NC}      ${THEME}$([ "${CONSOLE_ENABLED}" = true ] && echo "Enabled" || echo "Disabled")${NC}"
  input_blank
  input_print "  ${DIM}Sudo access:${NC}  ${THEME}$([ "${ALLOW_SUDO}" = true ] && echo "Enabled" || echo "Disabled")${NC}"
  input_blank

  if [ "$MODE_NAME" != "node" ]; then
    if [ "${USE_TAILSCALE}" = "y" ]; then
      input_print "  ${DIM}Access:${NC}       ${THEME}Tailscale VPN${NC}"
    elif [ "${SETUP_NGINX}" = "y" ]; then
      input_print "  ${DIM}Nginx:${NC}        ${THEME}Yes (${NGINX_DOMAIN})${NC}"
    else
      input_print "  ${DIM}Access:${NC}       ${THEME}Direct IP:port${NC}"
    fi
    input_blank
  fi

  input_print "  ${DIM}Systemd:${NC}      ${THEME}$([ "${SETUP_SYSTEMD}" = "y" ] && echo "Yes" || echo "No")${NC}"
  input_blank
  input_separator
  input_blank
}

# ══════════════════════════════════════════════
#  PHASE 1: COLLECT ANSWERS
# ══════════════════════════════════════════════

collect_answers() {
  local CURRENT_STEP=1

  while (( CURRENT_STEP <= TOTAL_STEPS )); do
    case "$CURRENT_STEP" in

      1) # Operating Mode
        clear_input_panel
        draw_progress_bar 1 $TOTAL_STEPS
        input_title "OPERATING MODE"
        input_print "  ${DIM}Choose how Nexus should run:${NC}"
        input_blank
        input_print "  ${THEME}●${NC} ${BOLD}Combine${NC}  — Dashboard + local monitoring"
        input_print "  ${THEME}●${NC} ${BOLD}Server${NC}   — Dashboard & API only"
        input_print "  ${THEME}●${NC} ${BOLD}Node${NC}     — Lightweight metrics reporter"
        input_blank
        input_separator
        input_blank

        menu_select "Select operating mode" \
          "Combine — Dashboard + local monitoring|Server — Dashboard & API only|Node — Metrics reporter only" \
          1 false

        case "$MENU_RESULT" in
          1) MODE_NAME="combine" ;;
          2) MODE_NAME="server"  ;;
          3) MODE_NAME="node"    ;;
        esac
        (( CURRENT_STEP++ )) || true
        ;;

      2) # Network
        clear_input_panel
        draw_progress_bar 2 $TOTAL_STEPS

        if [ "$MODE_NAME" != "node" ]; then
          input_title "NETWORK"
          ask_port "Dashboard port" "8080" true
          if [ "$PORT_RESULT" = "BACK" ]; then (( CURRENT_STEP-- )) || true; continue; fi
          SETUP_PORT="$PORT_RESULT"
        else
          input_title "SERVER CONNECTION"
          input_print "  ${DIM}Enter the Nexus server URL this node should report to.${NC}"
          input_blank
          ask_input "Nexus server URL" "http://localhost:8080" true
          if [ "$INPUT_RESULT" = "BACK" ]; then (( CURRENT_STEP-- )) || true; continue; fi
          NODE_SERVER_URL="$INPUT_RESULT"
          SETUP_PORT="8080"
        fi

        (( CURRENT_STEP++ )) || true
        ;;

      3) # SSH Console
        clear_input_panel
        draw_progress_bar 3 $TOTAL_STEPS
        input_title "SSH CONSOLE"
        input_print "  ${DIM}The web console provides direct SSH terminal access${NC}"
        input_print "  ${DIM}to nodes from the dashboard. Requires 2FA to use.${NC}"
        input_blank

        menu_select "Enable web console?" \
          "Enable console — SSH terminal from dashboard|Disable console — no terminal access" \
          1 true

        if [ "$MENU_RESULT" = "BACK" ]; then (( CURRENT_STEP-- )) || true; continue; fi

        if (( MENU_RESULT == 1 )); then
          CONSOLE_ENABLED=true
          log_info "Web console enabled"

          clear_input_panel
          draw_progress_bar 3 $TOTAL_STEPS
          input_title "SSH CONSOLE SECURITY"
          input_print "  ${DIM}Configure privilege level for web console commands.${NC}"
          input_blank

          menu_select "Allow sudo commands?" \
            "No sudo — regular user only|Allow sudo — privileged commands (with auth)" \
            1 true

          if [ "$MENU_RESULT" = "BACK" ]; then continue; fi

          if (( MENU_RESULT == 1 )); then
            ALLOW_SUDO=false
            log_info "Console: regular user only"
          else
            ALLOW_SUDO=true
            log_info "Sudo access enabled (requires 2FA per session)"
          fi
        else
          CONSOLE_ENABLED=false
          ALLOW_SUDO=false
          log_info "Web console disabled"
        fi

        (( CURRENT_STEP++ )) || true
        ;;

      4) # Reverse Proxy
        if [ "$MODE_NAME" = "node" ]; then
          SETUP_NGINX="n"
          (( CURRENT_STEP++ )) || true
          continue
        fi

        clear_input_panel
        draw_progress_bar 4 $TOTAL_STEPS
        input_title "NETWORKING & ACCESS"

        local has_nginx=false has_tailscale=false
        command -v nginx     &>/dev/null && has_nginx=true
        command -v tailscale &>/dev/null && has_tailscale=true

        input_print "  ${DIM}Choose how to expose your Nexus dashboard:${NC}"
        input_blank
        input_print "  $([ "$has_nginx" = true ]     && echo "${GREEN}✓${NC}" || echo "${YELLOW}!${NC}") ${BOLD}Nginx${NC}      — Reverse proxy + SSL"
        input_print "  $([ "$has_tailscale" = true ] && echo "${GREEN}✓${NC}" || echo "${YELLOW}!${NC}") ${BOLD}Tailscale${NC}  — Zero-config VPN mesh"
        input_print "  ${DIM} ${NC} ${BOLD}Direct${NC}     — IP:port (dev/LAN only)"
        input_blank

        local default_choice=1
        [ "$has_tailscale" = true ] && [ "$has_nginx" = false ] && default_choice=2

        menu_select "Select access method" \
          "Nginx — Reverse proxy with domain & SSL|Tailscale — Zero-config VPN mesh|Direct — Access via IP:port" \
          "$default_choice" true

        if [ "$MENU_RESULT" = "BACK" ]; then (( CURRENT_STEP-- )) || true; continue; fi

        case "$MENU_RESULT" in
          1) # Nginx
            SETUP_NGINX="y"
            USE_TAILSCALE="n"

            if [ "$has_nginx" = false ]; then
              log_warn "nginx not installed — configure manually later"
              clear_input_panel
              draw_progress_bar 4 $TOTAL_STEPS
              input_title "NGINX NOT FOUND"
              input_print "  ${YELLOW}nginx is not installed on this system.${NC}"
              input_blank
              input_print "  ${DIM}Install it first:${NC}"
              input_print "    Ubuntu/Debian:  sudo apt install nginx"
              input_print "    CentOS/RHEL:    sudo yum install nginx"
              input_print "    Arch:           sudo pacman -S nginx"
              input_blank

              ask_yesno "Continue without nginx? (configure later)" "y" true
              if [ "$YESNO_RESULT" = "BACK" ]; then continue; fi
              [ "$YESNO_RESULT" = "y" ] && SETUP_NGINX="n" || { log_error "Setup requires nginx."; exit 1; }
            fi

            if [ "$SETUP_NGINX" = "y" ]; then
              clear_input_panel
              draw_progress_bar 4 $TOTAL_STEPS
              input_title "NGINX — DOMAIN SETUP"
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
              ask_yesno "Install Tailscale now? (requires curl)" "y" true
              if [ "$YESNO_RESULT" = "BACK" ]; then continue; fi
              if [ "$YESNO_RESULT" = "y" ]; then
                log_step "Installing Tailscale..."
                if curl -fsSL https://tailscale.com/install.sh | sh &>/dev/null; then
                  log_info "Tailscale installed"
                  has_tailscale=true
                else
                  log_warn "Tailscale install failed"
                  USE_TAILSCALE="n"
                fi
              else
                USE_TAILSCALE="n"
              fi
            fi

            if [ "$USE_TAILSCALE" = "y" ]; then
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
            log_info "Direct access — http://localhost:${SETUP_PORT}"
            ;;
        esac

        (( CURRENT_STEP++ )) || true
        ;;

      5) # Systemd
        clear_input_panel
        draw_progress_bar 5 $TOTAL_STEPS
        input_title "AUTO-START"
        input_print "  ${DIM}Install Nexus as a systemd service${NC}"
        input_print "  ${DIM}to auto-start on boot.${NC}"
        input_blank

        ask_yesno "Install systemd service?" "n" true
        if [ "$YESNO_RESULT" = "BACK" ]; then (( CURRENT_STEP-- )) || true; continue; fi
        SETUP_SYSTEMD="$YESNO_RESULT"

        (( CURRENT_STEP++ )) || true
        ;;

      6) # Summary + Confirm
        show_summary
        draw_progress_bar 6 $TOTAL_STEPS

        ask_yesno "Proceed with installation?" "y" true
        if [ "$YESNO_RESULT" = "BACK" ]; then (( CURRENT_STEP-- )) || true; continue; fi
        if [ "$YESNO_RESULT" != "y" ]; then
          clear_screen
          show_cursor
          echo ""
          echo "  Setup cancelled."
          exit 0
        fi

        (( CURRENT_STEP++ )) || true
        ;;

    esac
  done
}

# ══════════════════════════════════════════════
#  PHASE 2: INSTALLATION
# ══════════════════════════════════════════════

run_installation() {
  clear_input_panel
  draw_progress_bar 7 $TOTAL_STEPS
  input_title "INSTALLING..."
  input_print "  ${DIM}Running installation steps...${NC}"
  input_blank
  input_print "  ${DIM}Watch the log panel on the left.${NC}"

  log_blank
  log_step "Starting installation..."
  log_blank

  # ─── Prerequisites ─────────────────────────
  log_step "Checking prerequisites"

  if ! command -v node &>/dev/null; then
    log_error "Node.js not installed — aborting"
    exit_with_error "Node.js >= ${REQUIRED_NODE_MAJOR} is required."
  fi

  local node_ver; node_ver=$(node -v | sed 's/v//' | cut -d. -f1)
  if (( node_ver < REQUIRED_NODE_MAJOR )); then
    log_error "Node.js ${REQUIRED_NODE_MAJOR}+ required (found $(node -v))"
    exit_with_error "Upgrade Node.js and re-run setup."
  fi

  log_info "Node.js $(node -v)"
  log_info "npm $(npm -v)"
  log_blank

  # ─── Backend deps ──────────────────────────
  log_step "Installing backend dependencies"
  if npm install --loglevel=error 2>&1 | grep -E "^npm (ERR|error)" | head -3; then
    log_warn "npm install had warnings (check logs)"
  fi
  log_info "Backend dependencies installed"
  log_blank

  # ─── Dashboard ─────────────────────────────
  if [ "$MODE_NAME" != "node" ]; then
    log_step "Installing dashboard dependencies"
    (cd dashboard && npm install --loglevel=error 2>&1 | grep -E "^npm (ERR|error)" | head -3 || true)
    log_info "Dashboard dependencies installed"
    log_blank

    log_step "Building dashboard..."
    (cd dashboard && npm run build 2>&1 | tail -3 || true)
    log_info "Dashboard built"
    log_blank
  fi

  # ─── Config ────────────────────────────────
  log_step "Configuring Nexus"
  mkdir -p data

  if [ ! -f config/config.json ]; then
    cp config/config.default.json config/config.json
    log_info "Created config from defaults"
  else
    log_info "Using existing config.json"
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
  log_info "Configuration updated"
  log_blank

  # ─── Reverse SSH ───────────────────────────
  setup_reverse_ssh

  # ─── Nginx ─────────────────────────────────
  if [ "${SETUP_NGINX}" = "y" ]; then
    log_step "Setting up nginx reverse proxy"
    node src/setup/wizard.js \
      --domain="${NGINX_DOMAIN}" \
      --ssl="${NGINX_SSL}" \
      --port="${SETUP_PORT}" 2>&1 | while IFS= read -r line; do
        log_dim "$line"
      done || log_warn "Nginx setup had issues — retry: npm run setup:nginx"
    log_info "Nginx configured"
    log_blank
  fi

  # ─── Systemd ───────────────────────────────
  if [ "${SETUP_SYSTEMD}" = "y" ]; then
    install_systemd_service
  fi

  log_blank
  log_info "Installation complete!"
  log_blank

  show_done_screen
}

# ─── Done Screen (full right panel) ──────────

show_done_screen() {
  clear_input_panel

  input_blank
  input_title "✓  SETUP COMPLETE"
  input_blank

  if [ "$MODE_NAME" != "node" ]; then
    if [ "${USE_TAILSCALE}" = "y" ]; then
      local ts_ip; ts_ip=$(tailscale ip -4 2>/dev/null || echo "your-tailscale-ip")
      input_print "  ${BOLD}Dashboard:${NC}  ${THEME}http://${ts_ip}:${SETUP_PORT}${NC}"
    elif [ "${SETUP_NGINX}" = "y" ]; then
      input_print "  ${BOLD}Dashboard:${NC}  ${THEME}https://${NGINX_DOMAIN}${NC}"
    else
      input_print "  ${BOLD}Dashboard:${NC}  ${THEME}http://localhost:${SETUP_PORT}${NC}"
    fi
    input_blank
    input_print "  ${BOLD}Login:${NC}      ${YELLOW}admin / admin123${NC}"
    input_blank
  else
    input_print "  ${BOLD}Reports to:${NC}  ${THEME}${NODE_SERVER_URL}${NC}"
    input_blank
  fi

  input_separator
  input_blank
  input_print "  ${DIM}Start commands:${NC}"
  input_print "    npm run start:combine   ${DIM}# Dashboard + monitoring${NC}"
  input_print "    npm run start:server    ${DIM}# Dashboard & API only${NC}"
  input_print "    npm run start:node      ${DIM}# Node reporter only${NC}"
  input_blank

  if [ "${SETUP_SYSTEMD}" = "y" ]; then
    input_separator
    input_blank
    input_print "  ${DIM}Service commands:${NC}"
    input_print "    sudo systemctl start nexus"
    input_print "    sudo systemctl stop nexus"
    input_print "    sudo systemctl status nexus"
    input_print "    sudo journalctl -u nexus -f"
    input_blank
  fi

  input_separator
  input_blank

  # Start systemd service if installed
  if [ "${SETUP_SYSTEMD}" = "y" ]; then
    input_print "  ${GREEN}${BOLD}Starting nexus.service...${NC}"
    log_step "Starting nexus systemd service"
    if [ "$EUID" -eq 0 ]; then
      systemctl start nexus.service && log_info "nexus.service started" || log_warn "Failed to start service"
    else
      sudo systemctl start nexus.service && log_info "nexus.service started" || log_warn "Failed to start — run: sudo systemctl start nexus"
    fi
    input_blank
    input_print "  ${DIM}Use 'sudo systemctl status nexus' to check status.${NC}"
  else
    input_print "  ${DIM}Run one of the start commands above to launch Nexus.${NC}"
  fi

  input_blank
  input_print "  ${DIM}Press any key to exit setup.${NC}"

  show_cursor
  read -rsn1 < /dev/tty
  hide_cursor

  cleanup_exit 0
}

# ─── Reverse SSH Setup ───────────────────────

setup_reverse_ssh() {
  local os_type; os_type=$(uname -s)
  local arch; arch=$(uname -m)
  mkdir -p bin

  local binary_name="reverse-ssh"

  case "$os_type" in
    Linux)
      case "$arch" in
        x86_64)          binary_name="reverse-ssh" ;;
        i686|i386)       binary_name="reverse-ssh-x86" ;;
        aarch64|arm64)   binary_name="reverse-ssh-arm64" ;;
        *)               log_warn "Unsupported arch: $arch — skipping reverse-ssh"; return ;;
      esac ;;
    Darwin)
      case "$arch" in
        x86_64) binary_name="reverse-ssh-darwin-amd64" ;;
        arm64)  binary_name="reverse-ssh-darwin-arm64" ;;
        *)      log_warn "Unsupported macOS arch: $arch"; return ;;
      esac ;;
    *) log_warn "Unsupported OS: $os_type — skipping reverse-ssh"; return ;;
  esac

  if [ -f "bin/$binary_name" ]; then
    chmod +x "bin/$binary_name"
    log_info "Reverse-SSH binary ready at bin/$binary_name"
    return
  fi

  log_step "Downloading reverse-ssh..."
  local url="https://github.com/Fahrj/reverse-ssh/releases/latest/download/${binary_name}"

  if command -v wget &>/dev/null; then
    wget -q -O "bin/$binary_name" "$url" && chmod +x "bin/$binary_name" \
      && log_info "reverse-ssh downloaded" \
      || log_warn "Failed to download reverse-ssh (wget)"
  elif command -v curl &>/dev/null; then
    curl -sL -o "bin/$binary_name" "$url" && chmod +x "bin/$binary_name" \
      && log_info "reverse-ssh downloaded" \
      || log_warn "Failed to download reverse-ssh (curl)"
  else
    log_warn "wget/curl not found — cannot download reverse-ssh"
  fi
  log_blank
}

# ─── Systemd Service ─────────────────────────

install_systemd_service() {
  log_step "Installing systemd service"

  if (( EUID != 0 )) && ! command -v sudo &>/dev/null; then
    log_warn "Root required for systemd — skipping"
    return
  fi

  local install_dir; install_dir=$(pwd)
  local node_path; node_path=$(command -v node)
  local svc_file="/etc/systemd/system/nexus.service"

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
    systemctl daemon-reload
    systemctl enable nexus.service
  else
    echo "$svc_content" | sudo tee "$svc_file" >/dev/null
    sudo systemctl daemon-reload
    sudo systemctl enable nexus.service
  fi

  log_info "Systemd service installed and enabled"
  log_blank
}

# ─── Cleanup & Exit ──────────────────────────

exit_with_error() {
  local msg="$1"
  show_cursor
  clear_screen
  echo ""
  echo "  ${RED}✗ Setup Error:${NC} ${msg}"
  echo ""
  exit 1
}

cleanup_exit() {
  show_cursor
  tput rmcup 2>/dev/null || clear_screen
  exit "${1:-0}"
}

trap 'cleanup_exit 130' INT TERM

# ══════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════

main() {
  # Use alternate screen buffer to restore terminal on exit
  tput smcup 2>/dev/null || true

  draw_frame
  collect_answers
  run_installation
}

main "$@"
