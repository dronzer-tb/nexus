#!/bin/bash

# Nexus Uninstaller
# Safely removes Nexus and all associated data

set -e

# Check for auto-confirm flag
AUTO_CONFIRM=false
if [ "$1" == "--auto-confirm" ]; then
  AUTO_CONFIRM=true
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Banner
echo ""
echo -e "${CYAN}${BOLD}"
echo "███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗"
echo "████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝"
echo "██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗"
echo "██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║"
echo "██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║"
echo "╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝"
echo -e "${NC}"
echo -e "${RED}${BOLD}UNINSTALLATION SCRIPT${NC}"
echo -e "${YELLOW}This will completely remove Nexus from your system${NC}"
echo ""

# Warning
echo -e "${RED}${BOLD}⚠️  WARNING ⚠️${NC}"
echo ""
echo "This script will:"
echo "  • Stop the Nexus service (if running)"
echo "  • Remove systemd service files"
echo "  • Delete the Nexus installation directory"
echo "  • Remove all databases and configuration files"
echo "  • Delete all metrics and historical data"
echo ""
echo -e "${YELLOW}This action is ${BOLD}IRREVERSIBLE${NC}${YELLOW}. All data will be permanently lost.${NC}"
echo ""

# Confirmation
if [ "$AUTO_CONFIRM" = false ]; then
  read -p "Are you ABSOLUTELY sure you want to uninstall Nexus? (type 'yes' to confirm): " confirm
  if [ "$confirm" != "yes" ]; then
    echo ""
    echo -e "${GREEN}Uninstallation cancelled.${NC}"
    exit 0
  fi

  echo ""
  read -p "Type 'DELETE ALL DATA' to confirm data deletion: " confirm2
  if [ "$confirm2" != "DELETE ALL DATA" ]; then
    echo ""
    echo -e "${GREEN}Uninstallation cancelled.${NC}"
    exit 0
  fi
else
  echo -e "${YELLOW}Auto-confirm mode enabled - proceeding with uninstallation...${NC}"
fi

echo ""
echo -e "${BLUE}Starting uninstallation...${NC}"
echo ""

# Function to run commands with or without sudo
run_cmd() {
  if [ "$EUID" -eq 0 ]; then
    "$@"
  elif command -v sudo &>/dev/null; then
    sudo "$@"
  else
    echo -e "${YELLOW}Warning: Not running as root and sudo not found. Some operations may fail.${NC}"
    "$@"
  fi
}

# Step 1: Stop Nexus processes
echo -e "${BLUE}[1/6]${NC} Stopping Nexus processes..."
if systemctl is-active --quiet nexus 2>/dev/null; then
  run_cmd systemctl stop nexus
  echo -e "${GREEN}✓ Nexus service stopped${NC}"
else
  # Try to kill any running node processes for nexus
  pkill -f "node.*nexus" 2>/dev/null && echo -e "${GREEN}✓ Nexus processes stopped${NC}" || echo -e "${YELLOW}⚠ No running Nexus processes found${NC}"
fi

# Step 2: Disable and remove systemd service
echo -e "${BLUE}[2/6]${NC} Removing systemd service..."
if [ -f /etc/systemd/system/nexus.service ]; then
  run_cmd systemctl disable nexus 2>/dev/null || true
  run_cmd rm /etc/systemd/system/nexus.service
  run_cmd systemctl daemon-reload
  echo -e "${GREEN}✓ Systemd service removed${NC}"
else
  echo -e "${YELLOW}⚠ No systemd service found${NC}"
fi

# Step 3: Remove PM2 process (if exists)
echo -e "${BLUE}[3/6]${NC} Checking for PM2 processes..."
if command -v pm2 &>/dev/null; then
  pm2 delete nexus 2>/dev/null && echo -e "${GREEN}✓ PM2 process removed${NC}" || echo -e "${YELLOW}⚠ No PM2 process found${NC}"
else
  echo -e "${YELLOW}⚠ PM2 not installed${NC}"
fi

# Step 4: Backup option
echo -e "${BLUE}[4/6]${NC} Data backup option..."
INSTALL_DIR=$(pwd)
if [ -d "$INSTALL_DIR/data" ] && [ "$AUTO_CONFIRM" = false ]; then
  read -p "Create a backup of databases before deletion? (y/N): " backup
  if [[ "$backup" =~ ^[Yy]$ ]]; then
    BACKUP_DIR="$HOME/nexus_backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp -r "$INSTALL_DIR/data" "$BACKUP_DIR/"
    cp "$INSTALL_DIR/config.json" "$BACKUP_DIR/" 2>/dev/null || true
    echo -e "${GREEN}✓ Backup created at: $BACKUP_DIR${NC}"
  fi
elif [ "$AUTO_CONFIRM" = true ]; then
  echo -e "${YELLOW}⚠ Skipping backup in auto-confirm mode${NC}"
fi

# Step 5: Remove installation directory
echo -e "${BLUE}[5/6]${NC} Removing installation directory..."
if [ "$AUTO_CONFIRM" = false ]; then
  read -p "Installation directory: $INSTALL_DIR - Remove? (y/N): " remove_dir
  if [[ "$remove_dir" =~ ^[Yy]$ ]]; then
    cd ..
    rm -rf "$INSTALL_DIR"
    echo -e "${GREEN}✓ Installation directory removed${NC}"
  else
    echo -e "${YELLOW}⚠ Installation directory preserved${NC}"
  fi
else
  # Auto-confirm mode - always remove
  cd ..
  rm -rf "$INSTALL_DIR"
  echo -e "${GREEN}✓ Installation directory removed${NC}"
fi

# Step 6: Clean up additional files
echo -e "${BLUE}[6/6]${NC} Cleaning up additional files..."
# Remove any global configs if they exist
rm -f "$HOME/.nexusrc" 2>/dev/null || true
rm -f "$HOME/.config/nexus/config.json" 2>/dev/null || true
rmdir "$HOME/.config/nexus" 2>/dev/null || true
echo -e "${GREEN}✓ Additional files cleaned${NC}"

# Final message
echo ""
echo -e "${GREEN}${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║  Nexus Uninstallation Complete!       ║${NC}"
echo -e "${GREEN}${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Thank you for using Nexus!${NC}"
echo ""
echo -e "${YELLOW}Remaining items to clean manually (if desired):${NC}"
echo "  • Node.js (if installed specifically for Nexus)"
echo "  • Nginx configuration (if set up)"
echo "  • Firewall rules (if configured)"
echo ""
echo -e "${CYAN}Made with ❤️  by Dronzer Studios${NC}"
echo ""
