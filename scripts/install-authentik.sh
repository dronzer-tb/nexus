#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
#  Authentik Installation Script for Nexus
#  Installs and configures Authentik as authentication provider
# ──────────────────────────────────────────────

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

AUTHENTIK_VERSION="2024.2.2"
AUTHENTIK_PORT=9000
AUTHENTIK_DIR="$HOME/.authentik"
AUTHENTIK_DATA_DIR="$AUTHENTIK_DIR/data"
AUTHENTIK_CERTS_DIR="$AUTHENTIK_DIR/certs"

info()    { echo -e "  ${GREEN}✓${NC} $*"; }
warn()    { echo -e "  ${YELLOW}!${NC} $*"; }
fail()    { echo -e "  ${RED}✗${NC} $*"; exit 1; }
step()    { echo -e "\n  ${CYAN}→${NC} ${BOLD}$*${NC}"; }

banner() {
  echo -e "${CYAN}"
  echo '  ╔════════════════════════════════════════╗'
  echo '  ║   Authentik Installation for Nexus    ║'
  echo '  ╚════════════════════════════════════════╝'
  echo -e "${NC}"
}

banner

# ─── Check prerequisites ────────────────────────

step "Checking prerequisites"

# Check Docker
if ! command -v docker &>/dev/null; then
  fail "Docker is required. Install with: curl -fsSL https://get.docker.com | sh"
fi

DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+' | head -1)
info "Docker $(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)"

# Check Docker Compose
if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null; then
  fail "Docker Compose is required. Install with: sudo apt-get install docker-compose-plugin"
fi

if command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
  info "Docker Compose $(docker-compose --version | grep -oP '\d+\.\d+\.\d+')"
else
  COMPOSE_CMD="docker compose"
  info "Docker Compose $(docker compose version | grep -oP '\d+\.\d+\.\d+')"
fi

# Check if user is in docker group
if ! groups | grep -q docker; then
  warn "User not in docker group. You may need sudo for Docker commands."
  echo "    Add user to docker group: sudo usermod -aG docker $USER"
fi

# ─── Check existing installation ────────────────────────

if [ -d "$AUTHENTIK_DIR" ] && [ -f "$AUTHENTIK_DIR/docker-compose.yml" ]; then
  warn "Authentik directory already exists at $AUTHENTIK_DIR"
  read -p "Remove existing installation and reinstall? (y/N): " reinstall
  if [[ "$reinstall" =~ ^[Yy]$ ]]; then
    step "Stopping existing Authentik containers"
    cd "$AUTHENTIK_DIR"
    $COMPOSE_CMD down 2>/dev/null || true
    cd -
    rm -rf "$AUTHENTIK_DIR"
    info "Removed existing Authentik installation"
  else
    info "Using existing Authentik installation"
    exit 0
  fi
fi

# ─── Create directories ────────────────────────

step "Creating Authentik directories"

mkdir -p "$AUTHENTIK_DIR"
mkdir -p "$AUTHENTIK_DATA_DIR"/{media,certs,custom-templates,geoip}
mkdir -p "$AUTHENTIK_CERTS_DIR"

info "Directories created at $AUTHENTIK_DIR"

# ─── Generate secrets ────────────────────────

step "Generating secrets"

POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
AUTHENTIK_SECRET_KEY=$(openssl rand -base64 60 | tr -d "=+/")
AUTHENTIK_BOOTSTRAP_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
AUTHENTIK_BOOTSTRAP_TOKEN=$(openssl rand -hex 32)

info "Secrets generated"

# ─── Create .env file ────────────────────────

step "Creating environment configuration"

cat > "$AUTHENTIK_DIR/.env" <<EOF
# Authentik Configuration for Nexus
# Generated: $(date)

# PostgreSQL Database
PG_PASS=${POSTGRES_PASSWORD}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_USER=authentik
POSTGRES_DB=authentik

# Authentik
AUTHENTIK_SECRET_KEY=${AUTHENTIK_SECRET_KEY}
AUTHENTIK_ERROR_REPORTING__ENABLED=false
AUTHENTIK_LOG_LEVEL=info

# Redis
AUTHENTIK_REDIS__HOST=redis
AUTHENTIK_REDIS__PORT=6379

# PostgreSQL
AUTHENTIK_POSTGRESQL__HOST=postgresql
AUTHENTIK_POSTGRESQL__NAME=authentik
AUTHENTIK_POSTGRESQL__USER=authentik
AUTHENTIK_POSTGRESQL__PASSWORD=${POSTGRES_PASSWORD}

# Email (optional - configure later)
# AUTHENTIK_EMAIL__HOST=smtp.example.com
# AUTHENTIK_EMAIL__PORT=587
# AUTHENTIK_EMAIL__USERNAME=authentik@example.com
# AUTHENTIK_EMAIL__PASSWORD=
# AUTHENTIK_EMAIL__USE_TLS=true
# AUTHENTIK_EMAIL__FROM=authentik@example.com

# Networking
AUTHENTIK_LISTEN__HTTP=0.0.0.0:9000
AUTHENTIK_LISTEN__HTTPS=0.0.0.0:9443

# Bootstrap credentials
AUTHENTIK_BOOTSTRAP_PASSWORD=${AUTHENTIK_BOOTSTRAP_PASSWORD}
AUTHENTIK_BOOTSTRAP_TOKEN=${AUTHENTIK_BOOTSTRAP_TOKEN}
AUTHENTIK_BOOTSTRAP_EMAIL=admin@nexus.local
EOF

chmod 600 "$AUTHENTIK_DIR/.env"
info "Environment file created"

# ─── Create docker-compose.yml ────────────────────────

step "Creating Docker Compose configuration"

cat > "$AUTHENTIK_DIR/docker-compose.yml" <<'EOF'
version: '3.8'

services:
  postgresql:
    image: docker.io/library/postgres:12-alpine
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -d $${POSTGRES_DB} -U $${POSTGRES_USER}"]
      start_period: 20s
      interval: 30s
      retries: 5
      timeout: 5s
    volumes:
      - database:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: ${PG_PASS}
      POSTGRES_USER: ${POSTGRES_USER:-authentik}
      POSTGRES_DB: ${POSTGRES_DB:-authentik}
    networks:
      - authentik

  redis:
    image: docker.io/library/redis:alpine
    command: --save 60 1 --loglevel warning
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "redis-cli ping | grep PONG"]
      start_period: 20s
      interval: 30s
      retries: 5
      timeout: 3s
    volumes:
      - redis:/data
    networks:
      - authentik

  server:
    image: ghcr.io/goauthentik/server:2024.2.2
    restart: unless-stopped
    command: server
    environment:
      AUTHENTIK_SECRET_KEY: ${AUTHENTIK_SECRET_KEY}
      AUTHENTIK_ERROR_REPORTING__ENABLED: ${AUTHENTIK_ERROR_REPORTING__ENABLED:-false}
      AUTHENTIK_LOG_LEVEL: ${AUTHENTIK_LOG_LEVEL:-info}
      AUTHENTIK_REDIS__HOST: redis
      AUTHENTIK_POSTGRESQL__HOST: postgresql
      AUTHENTIK_POSTGRESQL__NAME: ${POSTGRES_DB:-authentik}
      AUTHENTIK_POSTGRESQL__USER: ${POSTGRES_USER:-authentik}
      AUTHENTIK_POSTGRESQL__PASSWORD: ${PG_PASS}
      AUTHENTIK_BOOTSTRAP_PASSWORD: ${AUTHENTIK_BOOTSTRAP_PASSWORD}
      AUTHENTIK_BOOTSTRAP_TOKEN: ${AUTHENTIK_BOOTSTRAP_TOKEN}
      AUTHENTIK_BOOTSTRAP_EMAIL: ${AUTHENTIK_BOOTSTRAP_EMAIL:-admin@nexus.local}
    volumes:
      - ./data/media:/media
      - ./data/custom-templates:/templates
      - ./data/geoip:/geoip
    ports:
      - "9000:9000"
      - "9443:9443"
    depends_on:
      - postgresql
      - redis
    networks:
      - authentik

  worker:
    image: ghcr.io/goauthentik/server:2024.2.2
    restart: unless-stopped
    command: worker
    environment:
      AUTHENTIK_SECRET_KEY: ${AUTHENTIK_SECRET_KEY}
      AUTHENTIK_ERROR_REPORTING__ENABLED: ${AUTHENTIK_ERROR_REPORTING__ENABLED:-false}
      AUTHENTIK_LOG_LEVEL: ${AUTHENTIK_LOG_LEVEL:-info}
      AUTHENTIK_REDIS__HOST: redis
      AUTHENTIK_POSTGRESQL__HOST: postgresql
      AUTHENTIK_POSTGRESQL__NAME: ${POSTGRES_DB:-authentik}
      AUTHENTIK_POSTGRESQL__USER: ${POSTGRES_USER:-authentik}
      AUTHENTIK_POSTGRESQL__PASSWORD: ${PG_PASS}
    user: root
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data/media:/media
      - ./data/certs:/certs
      - ./data/custom-templates:/templates
      - ./data/geoip:/geoip
    depends_on:
      - postgresql
      - redis
    networks:
      - authentik

volumes:
  database:
    driver: local
  redis:
    driver: local

networks:
  authentik:
    driver: bridge
EOF

info "Docker Compose configuration created"

# ─── Start Authentik ────────────────────────

step "Starting Authentik containers"

cd "$AUTHENTIK_DIR"

# Pull images
echo "  Pulling Docker images (this may take a few minutes)..."
$COMPOSE_CMD pull

# Start containers
$COMPOSE_CMD up -d

# Wait for Authentik to be ready
echo -n "  Waiting for Authentik to start"
for i in {1..60}; do
  if curl -s http://localhost:${AUTHENTIK_PORT}/if/flow/initial-setup/ > /dev/null 2>&1; then
    echo ""
    info "Authentik is running"
    break
  fi
  echo -n "."
  sleep 2
done

if ! curl -s http://localhost:${AUTHENTIK_PORT} > /dev/null 2>&1; then
  echo ""
  warn "Authentik may not be fully started yet. Check with: $COMPOSE_CMD logs -f"
else
  info "Authentik is accessible at http://localhost:${AUTHENTIK_PORT}"
fi

cd - > /dev/null

# ─── Save credentials ────────────────────────

CREDS_FILE="$AUTHENTIK_DIR/admin-credentials.txt"
cat > "$CREDS_FILE" <<EOF
Authentik Admin Credentials
============================

Admin Console URL: http://localhost:${AUTHENTIK_PORT}/if/admin/
Username: akadmin
Password: ${AUTHENTIK_BOOTSTRAP_PASSWORD}
Email: admin@nexus.local

API Token: ${AUTHENTIK_BOOTSTRAP_TOKEN}

IMPORTANT: Change the password after first login!

Installation Directory: ${AUTHENTIK_DIR}
Data Directory: ${AUTHENTIK_DATA_DIR}
Environment File: ${AUTHENTIK_DIR}/.env

Service Management:
  Start:   cd ${AUTHENTIK_DIR} && ${COMPOSE_CMD} up -d
  Stop:    cd ${AUTHENTIK_DIR} && ${COMPOSE_CMD} down
  Restart: cd ${AUTHENTIK_DIR} && ${COMPOSE_CMD} restart
  Status:  cd ${AUTHENTIK_DIR} && ${COMPOSE_CMD} ps
  Logs:    cd ${AUTHENTIK_DIR} && ${COMPOSE_CMD} logs -f
EOF

chmod 600 "$CREDS_FILE"

# ─── Summary ────────────────────────

echo ""
echo -e "${GREEN}${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║   Authentik Installation Complete!    ║${NC}"
echo -e "${GREEN}${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Admin Console:${NC} http://localhost:${AUTHENTIK_PORT}/if/admin/"
echo -e "${CYAN}Username:${NC}      akadmin"
echo -e "${CYAN}Password:${NC}      ${YELLOW}${AUTHENTIK_BOOTSTRAP_PASSWORD}${NC}"
echo ""
echo -e "${YELLOW}Credentials saved to:${NC} ${CREDS_FILE}"
echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo "  1. Access the admin console at the URL above"
echo "  2. Change the default password"
echo "  3. Run the Nexus application setup script:"
echo "     bash scripts/setup-authentik-app.sh"
echo ""
echo -e "${GREEN}Authentik is running in Docker containers${NC}"
echo ""
