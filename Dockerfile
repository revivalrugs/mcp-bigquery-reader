# --- Stage 1: Build ---
FROM node:20-slim AS builder

WORKDIR /app

# Copy all files needed for the build
COPY package.json package-lock.json* ./
COPY tsconfig.json ./
COPY src/ ./src/

# Install ALL dependencies (including devDeps for esbuild/typescript)
RUN npm install

# Create the single-file bundle
RUN npm run bundle

# --- Stage 2: Production ---
FROM node:20-slim

WORKDIR /app

# Copy ONLY the bundled file from the builder stage
# No node_modules, no source code, just the 5MB bundle
COPY --from=builder /app/dist/index.js ./index.js

# Cloud Run sets PORT automatically; default to 8080
ENV PORT=8080
ENV NODE_ENV=production

# Run as non-root user for security
USER node

# Run the bundle
CMD ["node", "index.js"]
