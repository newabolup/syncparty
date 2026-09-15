# ==========================================
# Stage 1: Build Shared, Server, and Client
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/server/package*.json ./packages/server/
COPY packages/client/package*.json ./packages/client/

# Install all dependencies including devDependencies for compilation
RUN npm ci

# Copy all source files
COPY packages/shared/ ./packages/shared/
COPY packages/server/ ./packages/server/
COPY packages/client/ ./packages/client/

# Generate Prisma Client
WORKDIR /app/packages/server
RUN npx prisma generate

# Build Shared library
WORKDIR /app/packages/shared
RUN npm run build

# Build Client application
WORKDIR /app/packages/client
RUN npm run build

# Build Server application
WORKDIR /app/packages/server
RUN npm run build

# ==========================================
# Stage 2: Production Runner Image
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install OpenSSL for Prisma on Alpine
RUN apk add --no-cache openssl wget

# Copy workspace package manifests
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/server/package*.json ./packages/server/
COPY packages/client/package*.json ./packages/client/

# Install only production dependencies
RUN npm ci --omit=dev

# Copy generated Prisma client from builder
COPY --from=builder /app/packages/server/node_modules/.prisma ./packages/server/node_modules/.prisma
COPY --from=builder /app/packages/server/node_modules/@prisma ./packages/server/node_modules/@prisma

# Copy built code
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/prisma ./packages/server/prisma
COPY --from=builder /app/packages/client/dist ./packages/client/dist

# Security: run as non-root node user
RUN chown -R node:node /app
USER node

EXPOSE 5000

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start the server
CMD ["node", "packages/server/dist/index.js"]
