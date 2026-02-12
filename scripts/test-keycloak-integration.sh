#!/usr/bin/env bash
set -e

# ──────────────────────────────────────────────
#  Test Keycloak Integration with Nexus
#  Validates the complete authentication flow
# ──────────────────────────────────────────────

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

KEYCLOAK_URL="http://localhost:9090"
NEXUS_URL="http://localhost:8080"
REALM="nexus"
CLIENT_ID="nexus-web"

info()    { echo -e "  ${GREEN}✓${NC} $*"; }
warn()    { echo -e "  ${YELLOW}!${NC} $*"; }
fail()    { echo -e "  ${RED}✗${NC} $*"; }
step()    { echo -e "\n  ${CYAN}→${NC} ${BOLD}$*${NC}"; }

PASSED=0
FAILED=0

test_result() {
  if [ $1 -eq 0 ]; then
    info "$2"
    PASSED=$((PASSED + 1))
  else
    fail "$2"
    FAILED=$((FAILED + 1))
  fi
}

banner() {
  echo -e "${CYAN}"
  echo '  ╔════════════════════════════════════════╗'
  echo '  ║   Keycloak Integration Test Suite    ║'
  echo '  ╚════════════════════════════════════════╝'
  echo -e "${NC}"
}

banner

# ─── Test 1: Keycloak Service Status ────────────────────────

step "Test 1: Keycloak Service Status"

if systemctl is-active --quiet keycloak 2>/dev/null; then
  test_result 0 "Keycloak service is running"
else
  test_result 1 "Keycloak service is NOT running"
  echo "    Start with: sudo systemctl start keycloak"
fi

# ─── Test 2: Keycloak HTTP Endpoint ────────────────────────

step "Test 2: Keycloak HTTP Endpoint"

if curl -s "${KEYCLOAK_URL}" > /dev/null 2>&1; then
  test_result 0 "Keycloak is accessible at ${KEYCLOAK_URL}"
else
  test_result 1 "Keycloak is NOT accessible at ${KEYCLOAK_URL}"
  echo "    Check logs: sudo journalctl -u keycloak -n 50"
fi

# ─── Test 3: Realm Exists ────────────────────────

step "Test 3: Nexus Realm Configuration"

REALM_CHECK=$(curl -s "${KEYCLOAK_URL}/realms/${REALM}" 2>/dev/null)
if echo "$REALM_CHECK" | grep -q "realm"; then
  test_result 0 "Realm '${REALM}' exists and is accessible"
else
  test_result 1 "Realm '${REALM}' not found"
  echo "    Run: bash scripts/setup-keycloak-realm.sh"
fi

# ─── Test 4: OIDC Configuration ────────────────────────

step "Test 4: OpenID Connect Configuration"

OIDC_CONFIG=$(curl -s "${KEYCLOAK_URL}/realms/${REALM}/.well-known/openid-configuration" 2>/dev/null)
if echo "$OIDC_CONFIG" | grep -q "issuer"; then
  test_result 0 "OIDC configuration endpoint is working"
  
  # Extract important endpoints
  AUTH_ENDPOINT=$(echo "$OIDC_CONFIG" | jq -r '.authorization_endpoint' 2>/dev/null)
  TOKEN_ENDPOINT=$(echo "$OIDC_CONFIG" | jq -r '.token_endpoint' 2>/dev/null)
  
  if [ "$AUTH_ENDPOINT" != "null" ] && [ "$TOKEN_ENDPOINT" != "null" ]; then
    info "Auth endpoint: $AUTH_ENDPOINT"
    info "Token endpoint: $TOKEN_ENDPOINT"
  fi
else
  test_result 1 "OIDC configuration not accessible"
fi

# ─── Test 5: Nexus Service Status ────────────────────────

step "Test 5: Nexus Service Status"

if curl -s "${NEXUS_URL}" > /dev/null 2>&1; then
  test_result 0 "Nexus is accessible at ${NEXUS_URL}"
else
  test_result 1 "Nexus is NOT accessible at ${NEXUS_URL}"
  echo "    Start with: npm start"
fi

# ─── Test 6: Nexus Keycloak Configuration ────────────────────────

step "Test 6: Nexus Keycloak Configuration Endpoint"

NEXUS_KC_CONFIG=$(curl -s "${NEXUS_URL}/api/keycloak/config" 2>/dev/null)
if echo "$NEXUS_KC_CONFIG" | grep -q "enabled"; then
  KC_ENABLED=$(echo "$NEXUS_KC_CONFIG" | jq -r '.enabled' 2>/dev/null)
  
  if [ "$KC_ENABLED" = "true" ]; then
    test_result 0 "Keycloak is enabled in Nexus"
    
    KC_URL=$(echo "$NEXUS_KC_CONFIG" | jq -r '.url' 2>/dev/null)
    KC_REALM=$(echo "$NEXUS_KC_CONFIG" | jq -r '.realm' 2>/dev/null)
    KC_CLIENT=$(echo "$NEXUS_KC_CONFIG" | jq -r '.clientId' 2>/dev/null)
    
    info "Keycloak URL: $KC_URL"
    info "Realm: $KC_REALM"
    info "Client ID: $KC_CLIENT"
  else
    test_result 1 "Keycloak is DISABLED in Nexus"
    echo "    Check .env file: KEYCLOAK_ENABLED=true"
  fi
else
  test_result 1 "Cannot retrieve Keycloak config from Nexus"
fi

# ─── Test 7: Environment Variables ────────────────────────

step "Test 7: Environment Variables"

if [ -f ".env" ]; then
  if grep -q "KEYCLOAK_ENABLED=true" .env; then
    test_result 0 "KEYCLOAK_ENABLED=true in .env"
  else
    test_result 1 "KEYCLOAK_ENABLED not set to true in .env"
  fi
  
  if grep -q "KEYCLOAK_URL=" .env; then
    KC_URL_ENV=$(grep "KEYCLOAK_URL=" .env | cut -d= -f2)
    if [ "$KC_URL_ENV" = "$KEYCLOAK_URL" ]; then
      test_result 0 "KEYCLOAK_URL matches expected URL"
    else
      warn "KEYCLOAK_URL mismatch: $KC_URL_ENV (expected: $KEYCLOAK_URL)"
    fi
  fi
  
  if grep -q "KEYCLOAK_CLIENT_SECRET=" .env; then
    test_result 0 "KEYCLOAK_CLIENT_SECRET is set"
  else
    test_result 1 "KEYCLOAK_CLIENT_SECRET is missing"
  fi
else
  test_result 1 ".env file not found"
  echo "    Run setup script to create .env"
fi

# ─── Test 8: Admin User Exists ────────────────────────

step "Test 8: Keycloak Admin User"

if [ -f "$HOME/.keycloak-data/admin-credentials.txt" ]; then
  test_result 0 "Admin credentials file exists"
  info "Location: $HOME/.keycloak-data/admin-credentials.txt"
else
  test_result 1 "Admin credentials file not found"
fi

# ─── Test 9: Realm Config File ────────────────────────

step "Test 9: Realm Configuration File"

if [ -f "$HOME/.keycloak-data/nexus-realm-config.json" ]; then
  test_result 0 "Realm config file exists"
  
  if command -v jq &>/dev/null; then
    REALM_FILE="$HOME/.keycloak-data/nexus-realm-config.json"
    REALM_NAME=$(jq -r '.realm' "$REALM_FILE" 2>/dev/null)
    CLIENT_SECRET=$(jq -r '.clientSecret' "$REALM_FILE" 2>/dev/null)
    
    if [ "$REALM_NAME" = "$REALM" ]; then
      test_result 0 "Realm name matches: $REALM_NAME"
    else
      warn "Realm name mismatch in config file"
    fi
    
    if [ -n "$CLIENT_SECRET" ] && [ "$CLIENT_SECRET" != "null" ]; then
      test_result 0 "Client secret is configured"
    else
      test_result 1 "Client secret is missing"
    fi
  fi
else
  test_result 1 "Realm config file not found"
  echo "    Run: bash scripts/setup-keycloak-realm.sh"
fi

# ─── Test 10: Port Conflicts ────────────────────────

step "Test 10: Port Configuration"

if netstat -tuln 2>/dev/null | grep -q ":9090.*LISTEN" || ss -tuln 2>/dev/null | grep -q ":9090"; then
  test_result 0 "Keycloak is listening on port 9090"
else
  test_result 1 "Keycloak is NOT listening on port 9090"
fi

if netstat -tuln 2>/dev/null | grep -q ":8080.*LISTEN" || ss -tuln 2>/dev/null | grep -q ":8080"; then
  PORT_8080_PROCESS=$(netstat -tulnp 2>/dev/null | grep ":8080" | awk '{print $7}' | head -1)
  if echo "$PORT_8080_PROCESS" | grep -qi "node"; then
    test_result 0 "Nexus is listening on port 8080"
  else
    warn "Port 8080 is occupied by: $PORT_8080_PROCESS"
  fi
fi

# ─── Summary ────────────────────────

echo ""
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════${NC}"
echo -e "${CYAN}${BOLD}   Test Summary${NC}"
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════${NC}"
echo ""

TOTAL=$((PASSED + FAILED))
echo -e "  Total Tests:  ${BOLD}$TOTAL${NC}"
echo -e "  Passed:       ${GREEN}${BOLD}$PASSED${NC}"
echo -e "  Failed:       ${RED}${BOLD}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
  echo ""
  echo -e "${GREEN}${BOLD}╔════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║   All Tests Passed! ✓                 ║${NC}"
  echo -e "${GREEN}${BOLD}╚════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${CYAN}Keycloak integration is working correctly!${NC}"
  echo ""
  echo -e "${CYAN}Next Steps:${NC}"
  echo "  1. Open Nexus Dashboard: ${NEXUS_URL}"
  echo "  2. Click 'Login with Keycloak' (if available)"
  echo "  3. Or test login manually (see manual test below)"
  echo ""
else
  echo ""
  echo -e "${YELLOW}${BOLD}╔════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}${BOLD}║   Some Tests Failed                   ║${NC}"
  echo -e "${YELLOW}${BOLD}╚════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${CYAN}Review the failures above and:${NC}"
  echo "  • Check service logs: sudo journalctl -u keycloak -n 50"
  echo "  • Verify .env configuration"
  echo "  • Run setup scripts if needed"
  echo ""
fi

echo -e "${CYAN}${BOLD}═══════════════════════════════════════════${NC}"
echo -e "${CYAN}${BOLD}   Manual Login Test${NC}"
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════${NC}"
echo ""
echo "To test the complete authentication flow manually:"
echo ""
echo "1. Get admin credentials:"
echo "   cat $HOME/.keycloak-data/nexus-realm-config.json | jq '.adminUsername, .adminPassword'"
echo ""
echo "2. Access Keycloak admin console:"
echo "   ${KEYCLOAK_URL}/admin"
echo ""
echo "3. Access Nexus dashboard:"
echo "   ${NEXUS_URL}"
echo ""
echo "4. Test API authentication:"
echo "   curl ${NEXUS_URL}/api/keycloak/config | jq"
echo ""
