#!/bin/bash

# Nexus - New UI Setup Script
# This script sets up the new React-based dashboard

set -e

echo "========================================="
echo "  Nexus Dashboard Setup"
echo "  By Dronzer Studios"
echo "========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install
echo "✅ Backend dependencies installed"
echo ""

# Install dashboard dependencies
echo "📦 Installing dashboard dependencies..."
cd dashboard
npm install
echo "✅ Dashboard dependencies installed"
echo ""

# Build dashboard
echo "🔨 Building dashboard..."
npm run build
echo "✅ Dashboard built successfully"
echo ""

cd ..

echo "========================================="
echo "✅ Setup Complete!"
echo "========================================="
echo ""
echo "To start Nexus:"
echo "  npm run start:server    # Start server only"
echo "  npm run start:combine   # Start combined mode"
echo ""
echo "Default credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "⚠️  Remember to change the default password!"
echo ""
