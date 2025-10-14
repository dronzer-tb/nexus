#!/bin/bash

# Nexus Quick Install
# One-liner: curl -fsSL https://raw.githubusercontent.com/dronzer-tb/nexus/main/quick-install.sh | bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Banner
echo -e "${CYAN}"
cat << "EOF"
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝

        Dronzer Studios - v1.0.0
          QUICK INSTALLER
EOF
echo -e "${NC}"
echo ""

# Print messages
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if git is installed
print_status "Checking prerequisites..."
if ! command -v git &> /dev/null; then
    print_error "Git is not installed. Please install git first."
    echo ""
    echo "Install git:"
    echo "  Ubuntu/Debian: sudo apt-get install git"
    echo "  macOS: brew install git"
    echo "  Windows: https://git-scm.com/download/win"
    exit 1
fi
print_success "Git detected"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_warning "Node.js not detected. It will be required after cloning."
    echo "  Download from: https://nodejs.org/ (version 18+ required)"
fi

echo ""

# Clone repository
print_status "Cloning Nexus repository from GitHub..."
if [ -d "nexus" ]; then
    print_error "Directory 'nexus' already exists."
    echo ""
    echo "Options:"
    echo "  1. Remove it: rm -rf nexus"
    echo "  2. Update it: cd nexus && git pull origin main"
    echo "  3. Choose a different location"
    exit 1
fi

if git clone https://github.com/dronzer-tb/nexus.git; then
    print_success "Repository cloned successfully"
else
    print_error "Failed to clone repository"
    exit 1
fi

cd nexus

# Run installer
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
print_status "Starting automated installation..."
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "install.sh" ]; then
    chmod +x install.sh
    # Execute with proper TTY handling
    exec ./install.sh
else
    print_error "install.sh not found in repository"
    exit 1
fi
