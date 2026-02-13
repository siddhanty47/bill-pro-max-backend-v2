# Stage 1: Build TypeScript
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production runtime
FROM node:18-alpine

WORKDIR /app

# Copy compiled output and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

ENV NODE_ENV=production
EXPOSE 3001

# Run as non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create writable directories for logs and file uploads
RUN mkdir -p /app/logs /app/uploads && chown -R appuser:appgroup /app/logs /app/uploads

USER appuser

CMD ["node", "dist/server.js"]
