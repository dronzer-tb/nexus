#!/bin/bash

# Nexus Quick Install
# One-liner: curl -fsSL https://raw.githubusercontent.com/dronzer-tb/nexus/main/quick-install.sh | bash

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${CYAN}"
cat << "EOF"
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
EOF
echo -e "${NC}"
echo -e "${GREEN}Quick Installer - Dronzer Studios${NC}"
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "Git is not installed. Please install git first."
    exit 1
fi

# Clone repository
echo "Cloning Nexus repository..."
if [ -d "nexus" ]; then
    echo "Directory 'nexus' already exists. Please remove it first."
    exit 1
fi

git clone https://github.com/dronzer-tb/nexus.git
cd nexus

# Run installer
echo ""
echo "Running automated installer..."
./install.sh
