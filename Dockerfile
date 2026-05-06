# Use official Node.js LTS slim image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy server source
COPY server.js ./

# Cloud Run sets PORT automatically; default to 8080
ENV PORT=8080

# Run as non-root user for security
USER node

CMD ["node", "server.js"]
