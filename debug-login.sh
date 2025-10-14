#!/bin/bash

# Nexus Login Debug Script
# This script helps debug login issues

echo "🔍 Nexus Login Debugger"
echo "======================="
echo ""

# Check if server is running
echo "1. Checking if server is running..."
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "   ✓ Server is running"
else
    echo "   ✗ Server is NOT running"
    echo "   Start it with: npm run start:combine"
    exit 1
fi

echo ""

# Check admin credentials file
echo "2. Checking admin credentials..."
if [ -f "data/admin-credentials.json" ]; then
    echo "   ✓ Admin credentials file exists"
    echo "   Username: $(node -e "console.log(JSON.parse(require('fs').readFileSync('data/admin-credentials.json', 'utf8')).username)" 2>/dev/null || echo "Unable to read")"
else
    echo "   ℹ  No custom admin file found"
    echo "   Using default credentials: admin / admin123"
fi

echo ""

# Check JWT secret
echo "3. Checking JWT configuration..."
if [ -f "config/config.json" ]; then
    JWT_LENGTH=$(node -e "console.log(JSON.parse(require('fs').readFileSync('config/config.json', 'utf8')).server.jwtSecret.length)" 2>/dev/null || echo "0")
    if [ "$JWT_LENGTH" -gt "20" ]; then
        echo "   ✓ JWT secret is configured (length: $JWT_LENGTH)"
    else
        echo "   ⚠  JWT secret might be default or missing"
    fi
else
    echo "   ✗ Config file not found"
fi

echo ""

# Test login with default credentials
echo "4. Testing login with default credentials..."
echo "   Username: admin"
echo "   Password: admin123"
echo ""

RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}')

if echo "$RESPONSE" | grep -q "token"; then
    echo "   ✓ LOGIN SUCCESSFUL!"
    echo ""
    echo "   Token received. You can now login to the dashboard."
    echo "   Dashboard: http://localhost:8080"
else
    echo "   ✗ LOGIN FAILED"
    echo ""
    echo "   Response: $RESPONSE"
    echo ""
    echo "   Troubleshooting:"
    echo "   1. Make sure you pulled latest changes: git pull origin main"
    echo "   2. Restart the server: npm run start:combine"
    echo "   3. Check server logs: tail -f data/nexus.log"
fi

echo ""
echo "======================="
echo "Debug complete!"
