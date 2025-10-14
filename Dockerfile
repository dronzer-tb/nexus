# Multi-stage Dockerfile for Nexus
# Stage 1: Build the React dashboard
FROM node:20-alpine AS dashboard-builder

WORKDIR /app/dashboard

# Copy dashboard package files
COPY dashboard/package*.json ./

# Install dashboard dependencies
RUN npm ci

# Copy dashboard source
COPY dashboard/ ./

# Build dashboard
RUN npm run build

# Stage 2: Build the main application
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    linux-headers

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source
COPY src/ ./src/
COPY config/ ./config/

# Copy built dashboard from stage 1
COPY --from=dashboard-builder /app/dashboard/build ./dashboard/build

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 8080

# Set environment
ENV NODE_ENV=production

# Default to combine mode
CMD ["node", "src/index.js", "--mode=combine"]
