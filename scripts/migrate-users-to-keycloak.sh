#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
#  Migrate Existing Nexus Users to Keycloak
#  Exports users from Nexus database and imports to Keycloak
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
REALM_CONFIG_FILE="$KEYCLOAK_DATA_DIR/nexus-realm-config.json"

info()    { echo -e "  ${GREEN}✓${NC} $*"; }
warn()    { echo -e "  ${YELLOW}!${NC} $*"; }
fail()    { echo -e "  ${RED}✗${NC} $*"; exit 1; }
step()    { echo -e "\n  ${CYAN}→${NC} ${BOLD}$*${NC}"; }

banner() {
  echo -e "${CYAN}"
  echo '  ╔════════════════════════════════════════╗'
  echo '  ║   User Migration to Keycloak          ║'
  echo '  ╚════════════════════════════════════════╝'
  echo -e "${NC}"
}

banner

# ─── Prerequisites ────────────────────────

step "Checking prerequisites"

if ! command -v jq &>/dev/null; then
  fail "jq is required. Install with: sudo apt-get install jq"
fi

if ! command -v node &>/dev/null; then
  fail "Node.js is required"
fi

if [ ! -f "$CREDS_FILE" ]; then
  fail "Keycloak admin credentials not found. Run setup-keycloak-realm.sh first."
fi

if [ ! -f "$REALM_CONFIG_FILE" ]; then
  fail "Keycloak realm configuration not found. Run setup-keycloak-realm.sh first."
fi

info "Prerequisites met"

# ─── Get Keycloak credentials ────────────────────────

KEYCLOAK_ADMIN_USER=$(grep "Username:" "$CREDS_FILE" | awk '{print $2}')
KEYCLOAK_ADMIN_PASSWORD=$(grep "Password:" "$CREDS_FILE" | awk '{print $2}')
REALM_NAME=$(jq -r '.realm' "$REALM_CONFIG_FILE")

if [ -z "$KEYCLOAK_ADMIN_USER" ] || [ -z "$KEYCLOAK_ADMIN_PASSWORD" ] || [ -z "$REALM_NAME" ]; then
  fail "Could not read Keycloak credentials or realm name"
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
  fail "Failed to authenticate with Keycloak"
fi

info "Authenticated successfully"

# ─── Export users from Nexus ────────────────────────

step "Exporting users from Nexus database"

# Create Node.js script to export users
cat > /tmp/export-nexus-users.js <<'EOF'
const path = require('path');
const fs = require('fs');

// Load database module
const dbPath = path.join(process.cwd(), 'src/utils/database.js');
const database = require(dbPath);

// Initialize database
database.init();

// Get all users
const users = database.getAllUsers();

// Also check for file-based admin
const adminFile = path.join(process.cwd(), 'data/admin-credentials.json');
let fileAdmin = null;

if (fs.existsSync(adminFile)) {
  try {
    fileAdmin = JSON.parse(fs.readFileSync(adminFile, 'utf8'));
  } catch (err) {
    console.error('Could not read admin file:', err.message);
  }
}

// Combine users
const allUsers = [];

if (fileAdmin) {
  allUsers.push({
    username: fileAdmin.username,
    email: fileAdmin.email || `${fileAdmin.username}@nexus.local`,
    role: 'admin',
    source: 'file',
    createdAt: fileAdmin.createdAt
  });
}

users.forEach(user => {
  allUsers.push({
    username: user.username,
    email: user.email || `${user.username}@nexus.local`,
    role: user.role || 'viewer',
    source: 'database',
    createdAt: user.created_at ? new Date(user.created_at * 1000).toISOString() : null
  });
});

console.log(JSON.stringify(allUsers, null, 2));
database.close();
EOF

USERS_JSON=$(node /tmp/export-nexus-users.js)
rm /tmp/export-nexus-users.js

USER_COUNT=$(echo "$USERS_JSON" | jq '. | length')
info "Found $USER_COUNT users to migrate"

if [ "$USER_COUNT" -eq 0 ]; then
  warn "No users found to migrate"
  exit 0
fi

# ─── Import users to Keycloak ────────────────────────

step "Importing users to Keycloak"

MIGRATED=0
SKIPPED=0
FAILED=0

echo "$USERS_JSON" | jq -c '.[]' | while read -r user; do
  USERNAME=$(echo "$user" | jq -r '.username')
  EMAIL=$(echo "$user" | jq -r '.email')
  ROLE=$(echo "$user" | jq -r '.role')
  
  echo -n "  Migrating user: $USERNAME ... "
  
  # Check if user already exists
  EXISTING=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?username=${USERNAME}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq '. | length')
  
  if [ "$EXISTING" -gt 0 ]; then
    echo -e "${YELLOW}SKIPPED (already exists)${NC}"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi
  
  # Generate temporary password
  TEMP_PASSWORD=$(openssl rand -base64 12)
  
  # Create user in Keycloak
  USER_CONFIG=$(cat <<EOF_USER
{
  "username": "${USERNAME}",
  "email": "${EMAIL}",
  "emailVerified": true,
  "enabled": true,
  "credentials": [
    {
      "type": "password",
      "value": "${TEMP_PASSWORD}",
      "temporary": true
    }
  ],
  "realmRoles": ["${ROLE}"],
  "attributes": {
    "source": ["nexus-migration"]
  }
}
EOF_USER
)
  
  RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$USER_CONFIG")
  
  if [ "$RESPONSE" -eq 201 ] || [ "$RESPONSE" -eq 204 ]; then
    echo -e "${GREEN}SUCCESS${NC}"
    MIGRATED=$((MIGRATED + 1))
    
    # Save temporary password to file
    echo "$USERNAME:$TEMP_PASSWORD" >> "$KEYCLOAK_DATA_DIR/migrated-user-passwords.txt"
  else
    echo -e "${RED}FAILED (HTTP $RESPONSE)${NC}"
    FAILED=$((FAILED + 1))
  fi
done

# ─── Summary ────────────────────────

echo ""
echo -e "${GREEN}${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║   User Migration Complete!            ║${NC}"
echo -e "${GREEN}${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Migration Summary:${NC}"
echo -e "  Migrated: ${GREEN}${MIGRATED}${NC}"
echo -e "  Skipped:  ${YELLOW}${SKIPPED}${NC}"
echo -e "  Failed:   ${RED}${FAILED}${NC}"
echo ""

if [ -f "$KEYCLOAK_DATA_DIR/migrated-user-passwords.txt" ]; then
  echo -e "${YELLOW}Temporary passwords saved to:${NC}"
  echo "  $KEYCLOAK_DATA_DIR/migrated-user-passwords.txt"
  echo ""
  echo -e "${RED}⚠️  IMPORTANT:${NC}"
  echo "  1. Users must change their password on first login"
  echo "  2. Share temporary passwords securely with users"
  echo "  3. Delete the password file after distribution:"
  echo "     rm $KEYCLOAK_DATA_DIR/migrated-user-passwords.txt"
  echo ""
  chmod 600 "$KEYCLOAK_DATA_DIR/migrated-user-passwords.txt"
fi

echo -e "${CYAN}Next Steps:${NC}"
echo "  1. Enable Keycloak in Nexus .env file (already done by setup script)"
echo "  2. Restart Nexus: npm start"
echo "  3. Users can now login with Keycloak authentication"
echo "  4. Notify users of temporary passwords"
echo ""
