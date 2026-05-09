FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
# Force Prisma to use the OpenSSL 3.x engine (Alpine ships OpenSSL 3)
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x

# Copy package files
COPY package.json package-lock.json ./
# Increase timeouts to reduce build failures on flaky networks
RUN npm ci --network-timeout=100000 --fetch-timeout=600000 --no-audit

# Rebuild the source code only when needed
FROM base AS builder
RUN apk add --no-cache openssl
WORKDIR /app
# Force Prisma to use the OpenSSL 3.x engine during next build
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Set environment variable for workspace path
ENV WORKSPACE_PATH=/data
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT_STANDALONE=true

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Install OpenSSL 3.x for Prisma (matches linux-musl-openssl-3.0.x binary target)
RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV WORKSPACE_PATH=/data

# Use the existing 'node' user (UID 1000, GID 1000) from node:alpine image
# This matches the host user that owns ./data directory

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown node:node .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Copy Prisma files for migrations
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=node:node /app/node_modules/prisma ./node_modules/prisma

# Copy startup script
COPY --from=builder /app/scripts/start.sh ./start.sh
RUN chmod +x ./start.sh

# Create data directory for workspace storage
RUN mkdir -p /data/attachments && chown -R node:node /data

# Create npm cache directory for prisma migrations (node home is /home/node)
RUN mkdir -p /home/node/.npm && chown -R node:node /home/node

USER node

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./start.sh"]
