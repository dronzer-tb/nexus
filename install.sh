#!/bin/bash

#############################################
# Nexus One-Command Installer
# Automated installation and deployment
# by Dronzer Studios
#############################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Banner
print_banner() {
    echo -e "${CYAN}"
    cat << "EOF"
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝

        Dronzer Studios - v1.0.0
           ONE-COMMAND INSTALLER
EOF
    echo -e "${NC}"
}

# Print status message
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Print success message
print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

# Print error message
print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Print warning message
print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_deps=()
    
    # Check Node.js
    if ! command_exists node; then
        missing_deps+=("Node.js 18+")
    else
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -lt 18 ]; then
            print_error "Node.js version 18+ required. Current: $(node -v)"
            missing_deps+=("Node.js 18+")
        else
            print_success "Node.js $(node -v) detected"
        fi
    fi
    
    # Check npm
    if ! command_exists npm; then
        missing_deps+=("npm")
    else
        print_success "npm $(npm -v) detected"
    fi
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Please run this script from the Nexus root directory."
        exit 1
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        echo ""
        echo "Please install the missing dependencies:"
        echo "  - Node.js 18+: https://nodejs.org/"
        echo "  - npm: Comes with Node.js"
        exit 1
    fi
    
    print_success "All prerequisites met"
}

# Install backend dependencies
install_backend() {
    print_status "Installing backend dependencies..."
    npm install --no-audit --no-fund
    print_success "Backend dependencies installed"
}

# Install frontend dependencies
install_frontend() {
    print_status "Installing frontend dependencies..."
    cd dashboard
    npm install --no-audit --no-fund
    cd ..
    print_success "Frontend dependencies installed"
}

# Build dashboard
build_dashboard() {
    print_status "Building React dashboard..."
    cd dashboard
    npm run build
    cd ..
    print_success "Dashboard built successfully"
}

# Create necessary directories
create_directories() {
    print_status "Creating data directories..."
    mkdir -p data
    mkdir -p config
    print_success "Directories created"
}

# Generate configuration
generate_config() {
    print_status "Generating configuration..."
    
    # Copy default config if custom one doesn't exist
    if [ ! -f "config/config.json" ]; then
        if [ -f "config/config.default.json" ]; then
            cp config/config.default.json config/config.json
            print_success "Configuration file created"
        fi
    else
        print_warning "Configuration file already exists, skipping..."
    fi
}

# Check for Docker
check_docker() {
    if command_exists docker; then
        print_success "Docker detected: $(docker --version | cut -d' ' -f3 | tr -d ',')"
        DOCKER_AVAILABLE=true
    else
        print_warning "Docker not detected (optional)"
        DOCKER_AVAILABLE=false
    fi
}

# Display installation summary
display_summary() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}   ✓ INSTALLATION COMPLETE${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${CYAN}Quick Start Commands:${NC}"
    echo ""
    echo -e "  ${YELLOW}1. Start in Combine Mode${NC} (monitor local machine + dashboard)"
    echo -e "     ${GREEN}npm run start:combine${NC}"
    echo -e "     Dashboard: ${BLUE}http://localhost:8080${NC}"
    echo ""
    echo -e "  ${YELLOW}2. Start in Server Mode${NC} (dashboard only)"
    echo -e "     ${GREEN}npm run start:server${NC}"
    echo ""
    echo -e "  ${YELLOW}3. Start in Node Mode${NC} (metrics collection only)"
    echo -e "     ${GREEN}npm run start:node${NC}"
    echo ""
    echo -e "  ${YELLOW}4. Development Mode${NC} (with auto-reload)"
    echo -e "     ${GREEN}npm run dev${NC}"
    echo ""
    
    if [ "$DOCKER_AVAILABLE" = true ]; then
        echo -e "${CYAN}Docker Commands:${NC}"
        echo ""
        echo -e "  ${YELLOW}Build Docker Image:${NC}"
        echo -e "     ${GREEN}docker build -t dronzer/nexus .${NC}"
        echo ""
        echo -e "  ${YELLOW}Run with Docker:${NC}"
        echo -e "     ${GREEN}docker-compose -f docker-compose.simple.yml up -d${NC}"
        echo ""
    fi
    
    echo -e "${CYAN}Configuration:${NC}"
    echo -e "  Config file: ${BLUE}config/config.json${NC}"
    echo -e "  Data folder: ${BLUE}data/${NC}"
    echo -e "  Logs: ${BLUE}data/nexus.log${NC}"
    echo ""
    echo -e "${CYAN}Documentation:${NC}"
    echo -e "  README: ${BLUE}README.md${NC}"
    echo -e "  Quick Reference: ${BLUE}QUICK_REFERENCE.md${NC}"
    echo -e "  Development Guide: ${BLUE}DEVELOPMENT.md${NC}"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

# Prompt to start now
prompt_start() {
    echo -e "${YELLOW}Would you like to start Nexus now? (y/n)${NC}"
    read -r response
    
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo ""
        echo -e "${CYAN}Starting Nexus in Combine mode...${NC}"
        echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
        echo ""
        sleep 2
        npm run start:combine
    else
        echo ""
        echo -e "${GREEN}Setup complete! Run ${YELLOW}npm run start:combine${GREEN} when ready.${NC}"
        echo ""
    fi
}

# Main installation function
main() {
    clear
    print_banner
    echo ""
    
    print_status "Starting Nexus installation..."
    echo ""
    
    # Step 1: Check prerequisites
    check_prerequisites
    echo ""
    
    # Step 2: Check Docker availability
    check_docker
    echo ""
    
    # Step 3: Install backend dependencies
    install_backend
    echo ""
    
    # Step 4: Install frontend dependencies
    install_frontend
    echo ""
    
    # Step 5: Build dashboard
    build_dashboard
    echo ""
    
    # Step 6: Create directories
    create_directories
    echo ""
    
    # Step 7: Generate configuration
    generate_config
    echo ""
    
    # Step 8: Display summary
    display_summary
    
    # Step 9: Prompt to start
    prompt_start
}

# Run main function
main "$@"
