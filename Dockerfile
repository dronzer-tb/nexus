# ─────────────────────────────────────────────
#  Nexus — Docker Image
#  Dronzer Studios — v2.0-pre-release
# ─────────────────────────────────────────────

# Stage 1: Build dashboard
FROM node:20-alpine AS dashboard-builder

WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm ci --loglevel=warn
COPY dashboard/ ./
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine

LABEL maintainer="Dronzer Studios"
LABEL description="Nexus — Self-hosted remote resource monitoring platform"
LABEL version="2.0-pre-release"

# Install system dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    openssh-client \
    curl \
    bash

WORKDIR /app

# Copy package files and install backend deps
COPY package*.json ./
RUN npm ci --omit=dev --loglevel=warn && \
    npm cache clean --force

# Copy application source
COPY src/ ./src/
COPY config/config.default.json ./config/config.default.json
COPY VERSION ./VERSION

# Copy built dashboard from builder stage
COPY --from=dashboard-builder /app/dashboard/dist ./dashboard/dist

# Create data directory
RUN mkdir -p /app/data /app/config

# Copy entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Environment variables
ENV NODE_ENV=production
ENV NEXUS_MODE=combine
ENV NEXUS_PORT=8080
ENV NEXUS_HOST=0.0.0.0

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${NEXUS_PORT}/health || exit 1

# Persistent data
VOLUME ["/app/data", "/app/config"]

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
