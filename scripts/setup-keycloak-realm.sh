#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
#  Keycloak Realm Setup for Nexus
#  Creates and configures the Nexus realm in Keycloak
# ──────────────────────────────────────────────

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

KEYCLOAK_URL="http://localhost:8080"
KEYCLOAK_DATA_DIR="$HOME/.keycloak-data"
CREDS_FILE="$KEYCLOAK_DATA_DIR/admin-credentials.txt"
REALM_NAME="nexus"
CLIENT_ID="nexus-web"
CLIENT_SECRET=$(openssl rand -hex 32)

info()    { echo -e "  ${GREEN}✓${NC} $*"; }
warn()    { echo -e "  ${YELLOW}!${NC} $*"; }
fail()    { echo -e "  ${RED}✗${NC} $*"; exit 1; }
step()    { echo -e "\n  ${CYAN}→${NC} ${BOLD}$*${NC}"; }

banner() {
  echo -e "${CYAN}"
  echo '  ╔════════════════════════════════════════╗'
  echo '  ║   Nexus Realm Setup for Keycloak      ║'
  echo '  ╚════════════════════════════════════════╝'
  echo -e "${NC}"
}

banner

# ─── Check if Keycloak is running ────────────────────────

step "Checking Keycloak status"

if ! curl -s "$KEYCLOAK_URL" > /dev/null 2>&1; then
  fail "Keycloak is not running. Start it with: sudo systemctl start keycloak"
fi

info "Keycloak is running"

# ─── Get admin credentials ────────────────────────

if [ ! -f "$CREDS_FILE" ]; then
  fail "Admin credentials file not found. Run install-keycloak.sh first."
fi

KEYCLOAK_ADMIN_USER=$(grep "Username:" "$CREDS_FILE" | awk '{print $2}')
KEYCLOAK_ADMIN_PASSWORD=$(grep "Password:" "$CREDS_FILE" | awk '{print $2}')

if [ -z "$KEYCLOAK_ADMIN_USER" ] || [ -z "$KEYCLOAK_ADMIN_PASSWORD" ]; then
  fail "Could not read admin credentials from $CREDS_FILE"
fi

# ─── Install jq if needed ────────────────────────

if ! command -v jq &>/dev/null; then
  warn "jq not found. Installing..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq && sudo apt-get install -y jq
  elif command -v yum &>/dev/null; then
    sudo yum install -y jq
  else
    fail "Please install jq manually: https://stedolan.github.io/jq/"
  fi
fi

# ─── Get admin access token ────────────────────────

step "Authenticating with Keycloak"

TOKEN_RESPONSE=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${KEYCLOAK_ADMIN_USER}" \
  -d "password=${KEYCLOAK_ADMIN_PASSWORD}" \
  -d "grant_type=password" \
  -d "client_id=admin-cli")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')

if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
  fail "Failed to authenticate with Keycloak admin"
fi

info "Authenticated successfully"

# ─── Create Nexus realm ────────────────────────

step "Creating Nexus realm"

# Check if realm already exists
EXISTING_REALM=$(curl -s -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}" 2>/dev/null || echo "")

if echo "$EXISTING_REALM" | jq -e '.realm' > /dev/null 2>&1; then
  warn "Realm '${REALM_NAME}' already exists. Skipping creation."
else
  # Create realm
  REALM_CONFIG=$(cat <<EOF
{
  "realm": "${REALM_NAME}",
  "enabled": true,
  "displayName": "Nexus Monitoring",
  "displayNameHtml": "<b>Nexus</b> Monitoring Platform",
  "loginWithEmailAllowed": true,
  "duplicateEmailsAllowed": false,
  "registrationAllowed": false,
  "registrationEmailAsUsername": false,
  "resetPasswordAllowed": true,
  "editUsernameAllowed": false,
  "bruteForceProtected": true,
  "permanentLockout": false,
  "maxFailureWaitSeconds": 900,
  "minimumQuickLoginWaitSeconds": 60,
  "waitIncrementSeconds": 60,
  "quickLoginCheckMilliSeconds": 1000,
  "maxDeltaTimeSeconds": 43200,
  "failureFactor": 5,
  "passwordPolicy": "length(8) and notUsername and passwordHistory(3)",
  "otpPolicyType": "totp",
  "otpPolicyAlgorithm": "HmacSHA1",
  "otpPolicyDigits": 6,
  "otpPolicyPeriod": 30,
  "sslRequired": "none",
  "accessTokenLifespan": 3600,
  "accessTokenLifespanForImplicitFlow": 900,
  "ssoSessionIdleTimeout": 1800,
  "ssoSessionMaxLifespan": 36000,
  "offlineSessionIdleTimeout": 2592000,
  "accessCodeLifespan": 60,
  "accessCodeLifespanUserAction": 300,
  "accessCodeLifespanLogin": 1800,
  "actionTokenGeneratedByAdminLifespan": 43200,
  "actionTokenGeneratedByUserLifespan": 300,
  "smtpServer": {},
  "eventsEnabled": true,
  "eventsListeners": ["jboss-logging"],
  "enabledEventTypes": ["LOGIN", "LOGIN_ERROR", "LOGOUT", "UPDATE_PASSWORD", "UPDATE_TOTP"],
  "adminEventsEnabled": true,
  "adminEventsDetailsEnabled": true
}
EOF
)

  RESPONSE=$(curl -s -X POST "${KEYCLOAK_URL}/admin/realms" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$REALM_CONFIG")

  if [ -z "$RESPONSE" ]; then
    info "Realm '${REALM_NAME}' created successfully"
  else
    fail "Failed to create realm: $RESPONSE"
  fi
fi

# ─── Create client ────────────────────────

step "Creating OAuth2 client"

CLIENT_CONFIG=$(cat <<EOF
{
  "clientId": "${CLIENT_ID}",
  "name": "Nexus Web Dashboard",
  "description": "Nexus monitoring web application",
  "enabled": true,
  "clientAuthenticatorType": "client-secret",
  "secret": "${CLIENT_SECRET}",
  "redirectUris": [
    "http://localhost:3000/*",
    "http://localhost:5173/*",
    "http://localhost/*",
    "https://*"
  ],
  "webOrigins": ["+"],
  "standardFlowEnabled": true,
  "implicitFlowEnabled": false,
  "directAccessGrantsEnabled": true,
  "serviceAccountsEnabled": false,
  "publicClient": false,
  "protocol": "openid-connect",
  "attributes": {
    "access.token.lifespan": "3600",
    "pkce.code.challenge.method": "S256"
  },
  "fullScopeAllowed": true,
  "defaultClientScopes": ["profile", "email", "roles"],
  "optionalClientScopes": []
}
EOF
)

RESPONSE=$(curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$CLIENT_CONFIG")

if [ -z "$RESPONSE" ]; then
  info "Client '${CLIENT_ID}' created successfully"
else
  warn "Client may already exist or creation failed"
fi

# ─── Create realm roles ────────────────────────

step "Creating realm roles"

for ROLE in "admin" "viewer" "operator"; do
  ROLE_CONFIG=$(cat <<EOF
{
  "name": "${ROLE}",
  "description": "Nexus ${ROLE} role"
}
EOF
)

  curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/roles" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$ROLE_CONFIG" > /dev/null 2>&1 || true

  info "Role '${ROLE}' created"
done

# ─── Create default admin user ────────────────────────

step "Creating default admin user"

DEFAULT_ADMIN_PASSWORD=$(openssl rand -base64 12)

USER_CONFIG=$(cat <<EOF
{
  "username": "admin",
  "email": "admin@nexus.local",
  "emailVerified": true,
  "enabled": true,
  "credentials": [
    {
      "type": "password",
      "value": "${DEFAULT_ADMIN_PASSWORD}",
      "temporary": true
    }
  ],
  "realmRoles": ["admin"],
  "attributes": {
    "source": ["keycloak"]
  }
}
EOF
)

RESPONSE=$(curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$USER_CONFIG")

if [ -z "$RESPONSE" ]; then
  info "Admin user created (password must be changed on first login)"
else
  warn "User 'admin' may already exist"
fi

# ─── Save configuration ────────────────────────

step "Saving configuration"

CONFIG_FILE="$KEYCLOAK_DATA_DIR/nexus-realm-config.json"

cat > "$CONFIG_FILE" <<EOF
{
  "keycloakUrl": "${KEYCLOAK_URL}",
  "realm": "${REALM_NAME}",
  "clientId": "${CLIENT_ID}",
  "clientSecret": "${CLIENT_SECRET}",
  "adminUsername": "admin",
  "adminPassword": "${DEFAULT_ADMIN_PASSWORD}",
  "endpoints": {
    "auth": "${KEYCLOAK_URL}/realms/${REALM_NAME}/protocol/openid-connect/auth",
    "token": "${KEYCLOAK_URL}/realms/${REALM_NAME}/protocol/openid-connect/token",
    "userinfo": "${KEYCLOAK_URL}/realms/${REALM_NAME}/protocol/openid-connect/userinfo",
    "logout": "${KEYCLOAK_URL}/realms/${REALM_NAME}/protocol/openid-connect/logout",
    "jwks": "${KEYCLOAK_URL}/realms/${REALM_NAME}/protocol/openid-connect/certs"
  }
}
EOF

chmod 600 "$CONFIG_FILE"
info "Configuration saved to ${CONFIG_FILE}"

# ─── Update Nexus .env file ────────────────────────

step "Updating Nexus environment configuration"

NEXUS_ENV_FILE="$(dirname "$(dirname "$0")")/.env"

# Create .env if it doesn't exist
if [ ! -f "$NEXUS_ENV_FILE" ]; then
  cp "$(dirname "$(dirname "$0")")/.env.example" "$NEXUS_ENV_FILE" 2>/dev/null || touch "$NEXUS_ENV_FILE"
fi

# Update or add Keycloak settings
{
  echo ""
  echo "# Keycloak Authentication"
  echo "KEYCLOAK_ENABLED=true"
  echo "KEYCLOAK_URL=${KEYCLOAK_URL}"
  echo "KEYCLOAK_REALM=${REALM_NAME}"
  echo "KEYCLOAK_CLIENT_ID=${CLIENT_ID}"
  echo "KEYCLOAK_CLIENT_SECRET=${CLIENT_SECRET}"
} >> "$NEXUS_ENV_FILE"

info "Nexus .env file updated"

# ─── Summary ────────────────────────

echo ""
echo -e "${GREEN}${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║   Realm Setup Complete!                ║${NC}"
echo -e "${GREEN}${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Realm Name:${NC}     ${REALM_NAME}"
echo -e "${CYAN}Client ID:${NC}      ${CLIENT_ID}"
echo -e "${CYAN}Client Secret:${NC}  ${YELLOW}${CLIENT_SECRET}${NC}"
echo ""
echo -e "${CYAN}Default Admin Login:${NC}"
echo -e "  Username: ${BOLD}admin${NC}"
echo -e "  Password: ${YELLOW}${DEFAULT_ADMIN_PASSWORD}${NC}"
echo -e "  ${RED}(Must be changed on first login)${NC}"
echo ""
echo -e "${CYAN}Configuration saved to:${NC} ${CONFIG_FILE}"
echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo "  1. Restart Nexus to enable Keycloak authentication:"
echo "     npm start"
echo "  2. Access Keycloak admin console:"
echo "     ${KEYCLOAK_URL}/admin"
echo "  3. Login to Nexus with the admin credentials above"
echo ""
echo -e "${GREEN}Keycloak is now ready for Nexus!${NC}"
echo ""
