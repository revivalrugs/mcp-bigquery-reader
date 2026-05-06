# --- Stage 1: Build ---
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.json ./
COPY src/ ./src/

RUN npm install
RUN npm run bundle

# --- Stage 2: Production ---
FROM node:20-slim

WORKDIR /app

# Copy the bundle
COPY --from=builder /app/dist/index.js ./index.js
# Also copy package files to install external dependencies
COPY package.json package-lock.json* ./

# Install only the externalized production dependencies
# Since we marked them as --external in esbuild, we need them in node_modules
RUN npm install --omit=dev

ENV PORT=8080
ENV NODE_ENV=production

USER node

CMD ["node", "index.js"]
