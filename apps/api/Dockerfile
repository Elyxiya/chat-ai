# ============================================================
# AI-Native Chat System - API Dockerfile (pnpm workspaces)
# ============================================================

# Stage 1: production dependencies
FROM node:22-alpine AS deps
RUN npm install -g pnpm@10
WORKDIR /app
RUN echo "registry=https://mirrors.cloud.tencent.com/npm/" > .npmrc && \
    echo "fetch-timeout=120000" >> .npmrc && \
    echo "fetch-retries=5" >> .npmrc && \
    echo "network-concurrency=3" >> .npmrc && \
    echo "ignore-release-age=true" >> .npmrc
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --filter ai-native-chat-api --prod

# Stage 2: build
FROM node:22-alpine AS builder
RUN apk add --no-cache openssl
RUN npm install -g pnpm@10
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma/
WORKDIR /app
RUN echo "registry=https://mirrors.cloud.tencent.com/npm/" > .npmrc && \
    echo "fetch-timeout=120000" >> .npmrc && \
    echo "fetch-retries=5" >> .npmrc && \
    echo "network-concurrency=3" >> .npmrc && \
    echo "ignore-release-age=true" >> .npmrc
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install
COPY apps/api ./apps/api
RUN pnpm --filter ai-native-chat-api prisma:generate
RUN pnpm --filter ai-native-chat-api build

# Stage 3: production runtime
FROM node:22-alpine AS production
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api ./apps/api
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "apps/api/dist/main"]