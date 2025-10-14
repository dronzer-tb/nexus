#!/bin/bash

# Nexus Quick Start Script
# This script helps you get started with Nexus quickly

set -e

echo "🚀 Nexus Setup Script"
echo "===================="
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for Node.js
if ! command_exists node; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check for npm
if ! command_exists npm; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✅ npm $(npm -v) detected"
echo ""

# Ask user what they want to do
echo "What would you like to do?"
echo "1) Full setup (install dependencies + build dashboard)"
echo "2) Start in Combine mode (local monitoring)"
echo "3) Start in Server mode (dashboard only)"
echo "4) Start in Node mode (metrics collection only)"
echo "5) Build Docker image"
echo ""
read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo ""
        echo "📦 Installing backend dependencies..."
        npm install
        
        echo ""
        echo "📦 Installing frontend dependencies..."
        cd dashboard && npm install && cd ..
        
        echo ""
        echo "🏗️  Building dashboard..."
        npm run build:dashboard
        
        echo ""
        echo "✅ Setup complete!"
        echo ""
        echo "You can now start Nexus with:"
        echo "  npm run start:combine  (local monitoring)"
        echo "  npm run start:server   (dashboard only)"
        echo "  npm run start:node     (metrics only)"
        ;;
    
    2)
        echo ""
        echo "🚀 Starting Nexus in Combine mode..."
        npm run start:combine
        ;;
    
    3)
        echo ""
        echo "🚀 Starting Nexus in Server mode..."
        npm run start:server
        ;;
    
    4)
        echo ""
        echo "🚀 Starting Nexus in Node mode..."
        npm run start:node
        ;;
    
    5)
        if ! command_exists docker; then
            echo "❌ Docker is not installed."
            exit 1
        fi
        
        echo ""
        echo "🐳 Building Docker image..."
        docker build -t dronzer/nexus .
        
        echo ""
        echo "✅ Docker image built successfully!"
        echo ""
        echo "You can now run with:"
        echo "  docker run -d -p 8080:8080 dronzer/nexus --mode=combine"
        ;;
    
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac
