#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
#  Authentik Application Setup for Nexus
#  Creates and configures the Nexus application in Authentik
# ──────────────────────────────────────────────

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

AUTHENTIK_URL="http://localhost:9000"
AUTHENTIK_DIR="$HOME/.authentik"
CREDS_FILE="$AUTHENTIK_DIR/admin-credentials.txt"
NEXUS_REDIRECT_URI="http://localhost:8080/api/auth/callback"

info()    { echo -e "  ${GREEN}✓${NC} $*"; }
warn()    { echo -e "  ${YELLOW}!${NC} $*"; }
fail()    { echo -e "  ${RED}✗${NC} $*"; exit 1; }
step()    { echo -e "\n  ${CYAN}→${NC} ${BOLD}$*${NC}"; }

banner() {
  echo -e "${CYAN}"
  echo '  ╔════════════════════════════════════════╗'
  echo '  ║   Nexus App Setup for Authentik       ║'
  echo '  ╚════════════════════════════════════════╝'
  echo -e "${NC}"
}

banner

# ─── Check if Authentik is running ────────────────────────

step "Checking Authentik status"

if ! curl -s "$AUTHENTIK_URL" > /dev/null 2>&1; then
  fail "Authentik is not running. Start it with: cd $AUTHENTIK_DIR && docker-compose up -d"
fi

info "Authentik is running"

# ─── Get API token ────────────────────────

if [ ! -f "$CREDS_FILE" ]; then
  fail "Admin credentials file not found. Run install-authentik.sh first."
fi

API_TOKEN=$(grep "API Token:" "$CREDS_FILE" | awk '{print $3}')

if [ -z "$API_TOKEN" ]; then
  echo ""
  warn "Could not read API token from credentials file."
  echo ""
  echo "Please provide the Authentik API token manually."
  echo "You can get this from Authentik admin console:"
  echo "  1. Go to: ${AUTHENTIK_URL}/if/admin/"
  echo "  2. Navigate to: Directory → Tokens"
  echo "  3. Create a new token with 'authentik Superuser' role"
  echo ""
  read -p "Enter API Token: " API_TOKEN
  
  if [ -z "$API_TOKEN" ]; then
    fail "API token is required"
  fi
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

# ─── Create OAuth2/OIDC Provider ────────────────────────

step "Creating OAuth2/OIDC Provider"

PROVIDER_NAME="nexus-oauth"
CLIENT_ID="nexus-$(openssl rand -hex 8)"
CLIENT_SECRET=$(openssl rand -hex 32)

PROVIDER_PAYLOAD=$(cat <<EOF
{
  "name": "${PROVIDER_NAME}",
  "authorization_flow": "default-provider-authorization-implicit-consent",
  "client_type": "confidential",
  "client_id": "${CLIENT_ID}",
  "client_secret": "${CLIENT_SECRET}",
  "redirect_uris": "${NEXUS_REDIRECT_URI}\nhttp://localhost:8080/*",
  "signing_key": null,
  "access_code_validity": "minutes=1",
  "access_token_validity": "hours=1",
  "refresh_token_validity": "days=30",
  "include_claims_in_id_token": true,
  "sub_mode": "hashed_user_id",
  "issuer_mode": "per_provider"
}
EOF
)

PROVIDER_RESPONSE=$(curl -s -X POST "${AUTHENTIK_URL}/api/v3/providers/oauth2/" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$PROVIDER_PAYLOAD" 2>&1)

if echo "$PROVIDER_RESPONSE" | jq -e '.pk' > /dev/null 2>&1; then
  PROVIDER_PK=$(echo "$PROVIDER_RESPONSE" | jq -r '.pk')
  info "OAuth2 provider created (ID: $PROVIDER_PK)"
else
  # Provider might already exist
  warn "Provider creation may have failed or already exists"
  echo "$PROVIDER_RESPONSE" | jq '.' 2>/dev/null || echo "$PROVIDER_RESPONSE"
  
  # Try to get existing provider
  EXISTING=$(curl -s "${AUTHENTIK_URL}/api/v3/providers/oauth2/?name=${PROVIDER_NAME}" \
    -H "Authorization: Bearer ${API_TOKEN}")
  
  if echo "$EXISTING" | jq -e '.results[0].pk' > /dev/null 2>&1; then
    PROVIDER_PK=$(echo "$EXISTING" | jq -r '.results[0].pk')
    CLIENT_ID=$(echo "$EXISTING" | jq -r '.results[0].client_id')
    warn "Using existing provider (ID: $PROVIDER_PK)"
  else
    fail "Could not create or find provider"
  fi
fi

# ─── Create Application ────────────────────────

step "Creating Nexus Application"

APP_PAYLOAD=$(cat <<EOF
{
  "name": "Nexus Monitoring",
  "slug": "nexus",
  "provider": ${PROVIDER_PK},
  "meta_launch_url": "http://localhost:8080",
  "meta_description": "Nexus remote resource monitoring and management platform",
  "meta_publisher": "Dronzer Studios",
  "policy_engine_mode": "any",
  "open_in_new_tab": false
}
EOF
)

APP_RESPONSE=$(curl -s -X POST "${AUTHENTIK_URL}/api/v3/core/applications/" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$APP_PAYLOAD" 2>&1)

if echo "$APP_RESPONSE" | jq -e '.slug' > /dev/null 2>&1; then
  info "Application 'Nexus Monitoring' created"
else
  warn "Application creation may have failed or already exists"
  echo "$APP_RESPONSE" | jq '.' 2>/dev/null || echo "$APP_RESPONSE"
fi

# ─── Save configuration ────────────────────────

step "Saving configuration"

CONFIG_FILE="$AUTHENTIK_DIR/nexus-app-config.json"

cat > "$CONFIG_FILE" <<EOF
{
  "authentikUrl": "${AUTHENTIK_URL}",
  "clientId": "${CLIENT_ID}",
  "clientSecret": "${CLIENT_SECRET}",
  "redirectUri": "${NEXUS_REDIRECT_URI}",
  "providerPk": ${PROVIDER_PK},
  "endpoints": {
    "authorization": "${AUTHENTIK_URL}/application/o/authorize/",
    "token": "${AUTHENTIK_URL}/application/o/token/",
    "userinfo": "${AUTHENTIK_URL}/application/o/userinfo/",
    "logout": "${AUTHENTIK_URL}/application/o/nexus/end-session/"
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

# Remove old Keycloak settings if present
sed -i '/^KEYCLOAK_/d' "$NEXUS_ENV_FILE" 2>/dev/null || true

# Add Authentik settings
{
  echo ""
  echo "# Authentik Authentication"
  echo "AUTHENTIK_ENABLED=true"
  echo "AUTHENTIK_URL=${AUTHENTIK_URL}"
  echo "AUTHENTIK_CLIENT_ID=${CLIENT_ID}"
  echo "AUTHENTIK_CLIENT_SECRET=${CLIENT_SECRET}"
  echo "AUTHENTIK_REDIRECT_URI=${NEXUS_REDIRECT_URI}"
} >> "$NEXUS_ENV_FILE"

info "Nexus .env file updated"

# ─── Summary ────────────────────────

echo ""
echo -e "${GREEN}${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║   Application Setup Complete!         ║${NC}"
echo -e "${GREEN}${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Application Name:${NC} Nexus Monitoring"
echo -e "${CYAN}Client ID:${NC}        ${CLIENT_ID}"
echo -e "${CYAN}Client Secret:${NC}    ${YELLOW}${CLIENT_SECRET}${NC}"
echo ""
echo -e "${CYAN}Configuration saved to:${NC} ${CONFIG_FILE}"
echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo "  1. Restart Nexus to enable Authentik authentication:"
echo "     npm start"
echo "  2. Access Authentik admin console to manage users:"
echo "     ${AUTHENTIK_URL}/if/admin/"
echo "  3. Login to Nexus using Authentik credentials"
echo ""
echo -e "${CYAN}User Management:${NC}"
echo "  • Create users in Authentik: Directory → Users"
echo "  • Assign users to Nexus app: Applications → Nexus Monitoring"
echo "  • Configure groups and permissions as needed"
echo ""
echo -e "${GREEN}Authentik is now ready for Nexus!${NC}"
echo ""
