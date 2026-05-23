# ============================================================
# AI-Native Chat System - Web Dockerfile (pnpm workspaces)
# ============================================================

# Stage 1: build
FROM node:22-alpine AS builder
RUN npm install -g pnpm@10
WORKDIR /app
RUN echo "registry=https://mirrors.cloud.tencent.com/npm/" > .npmrc && \
    echo "fetch-timeout=120000" >> .npmrc && \
    echo "fetch-retries=5" >> .npmrc && \
    echo "network-concurrency=3" >> .npmrc && \
    echo "ignore-release-age=true" >> .npmrc
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
# 复制所有工作区 package.json，确保 pnpm 能正确解析整个 monorepo
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
RUN pnpm install
COPY apps/web ./apps/web
RUN pnpm --filter ai-native-chat-web build

# Stage 2: production (nginx)
FROM nginx:alpine AS production
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]