# AI-Native Chat System

一个由 React、NestJS 和 DeepSeek LLM 驱动的 AI 原生即时通讯系统。

## 系统架构

```mermaid
flowchart TB
    subgraph Frontend["前端 (React 18 + TypeScript)"]
        WEB[Web 应用]
    end
    subgraph Gateway["Nginx 反向代理"]
        REST[REST API]
        WS[WebSocket]
    end
    subgraph Backend["后端 (NestJS)"]
        subgraph IM["IM 模块"]
            IM_SVC[IM 服务]
            WS_GATEWAY[聊天网关]
        end
        subgraph AI["AI Agent 子系统"]
            ORCH[Agent 编排器]
            PLANNER[规划引擎<br/>ReAct + Plan-and-Execute]
            MEMORY[记忆系统]
            TOOL_REG[工具注册]
            RAG[RAG 引擎]
        end
        subgraph Auth["认证模块"]
            OAUTH[OAuth2]
            JWT[JWT]
        end
    end
    subgraph Data["数据层"]
        PG[(PostgreSQL<br/>+ pgvector)]
        REDIS[(Redis)]
        MINIO[(MinIO)]
    end
    subgraph LLM["LLM 提供商"]
        DS_V3[DeepSeek V3]
        DS_R1[DeepSeek R1]
    end
    WEB <--> REST
    WEB <--> WS
    REST --> IM_SVC
    REST --> ORCH
    WS --> WS_GATEWAY
    ORCH --> PLANNER
    PLANNER --> TOOL_REG
    PLANNER --> MEMORY
    ORCH --> RAG
    PLANNER --> DS_V3
    PLANNER --> DS_R1
    IM_SVC --> PG
    ORCH --> PG
    ORCH --> REDIS
```

## 功能特性

- **即时通讯**：私聊、群聊、频道，通过 WebSocket 实现实时消息
- **AI Agent**：ReAct + Plan-and-Execute 推理，14+ 工具（搜索、天气、时间、计算等），记忆管理
- **DeepSeek**：V3（快速）+ R1（深度推理）双模型支持，流式 SSE 输出
- **RAG**：基于向量搜索（pgvector）的知识库，支持全文检索
- **OAuth2 + JWT**：GitHub / Google OAuth，安全的身份认证，支持 Token 刷新
- **通知系统**：实时推送，好友请求、提及、消息通知
- **文件上传**：图片、文档、音频，支持预览和发送
- **消息反应**：表情回应，支持回复消息
- **深色模式**：支持浅色/深色/跟随系统三档主题
- **Docker**：全容器化部署，Nginx 反向代理

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18, TypeScript, Vite, Tailwind CSS, Zustand, Socket.io-client |
| 后端 | NestJS 10, TypeScript, Prisma |
| 数据库 | PostgreSQL 16, Redis 7 |
| 向量数据库 | pgvector |
| LLM | DeepSeek V3 + R1 |
| 容器化 | Docker, Docker Compose, Nginx |
| 持续集成 | GitHub Actions |

## 快速开始

### 环境要求

- Docker 和 Docker Compose
- Node.js 20+（本地开发）

### 1. 克隆并配置

```bash
git clone <仓库地址>
cd new-chat-system
cp .env.example .env
# 编辑 .env，填入你的 DeepSeek API Key
```

### 2. 一键启动所有服务

```bash
# 使用 Docker Compose 启动完整环境
npm run docker:up

# 或本地开发模式
npm run setup    # 安装依赖 + 生成 Prisma Client
npm run docker:up # 启动数据库和中间件
npm run dev      # 同时启动 API 和 Web
```

### 3. 访问地址

- 前端：http://localhost:5173
- API：http://localhost:3000
- Swagger 文档：http://localhost:3000/api/docs

## 开发指南

### 根目录脚本（monorepo）

```bash
npm run dev           # 同时启动 API 和 Web（热重载）
npm run build         # 构建所有应用
npm run docker:up     # 启动 Docker 服务
npm run docker:down   # 停止 Docker 服务
npm run docker:logs   # 查看 Docker 日志
npm run docker:clean  # 清理 Docker 卷（重置数据库）
npm run db:push       # 推送 Prisma schema 到数据库
npm run db:generate   # 生成 Prisma Client
npm run db:studio     # 打开 Prisma Studio
npm run check         # 类型检查 + Lint
```

### 后端

```bash
npm run start:dev     # 热重载开发服务器
npm run lint          # 代码检查
npm run test          # 单元测试
npx prisma studio     # 数据库可视化工具
```

### 前端

```bash
npm run dev           # 开发服务器（http://localhost:5173）
npm run build         # 生产构建
npm run preview       # 预览生产构建
```

## API 接口

### 认证

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | /api/v1/auth/register | 注册 |
| POST | /api/v1/auth/login | 登录 |
| POST | /api/v1/auth/refresh | 刷新 Token |
| POST | /api/v1/auth/logout | 登出 |
| POST | /api/v1/auth/oauth/github | GitHub OAuth |
| POST | /api/v1/auth/oauth/google | Google OAuth |
| POST | /api/v1/auth/change-password | 修改密码 |
| POST | /api/v1/auth/delete-account | 删除账户 |

### 聊天

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | /api/v1/chat/sessions | 获取会话列表 |
| POST | /api/v1/chat/sessions | 创建会话 |
| GET | /api/v1/chat/sessions/:id/messages | 获取消息 |
| POST | /api/v1/chat/sessions/:id/messages | 发送消息 |
| POST | /api/v1/chat/sessions/:id/reactions | 添加表情反应 |

### Agent

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | /api/v1/agent/chat | AI 对话 |
| POST | /api/v1/agent/chat/stream | AI 对话（SSE 流式） |
| GET | /api/v1/agent/history | 对话历史 |
| DELETE | /api/v1/agent/memory | 清除记忆 |

### 知识库

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | /api/v1/knowledge/bases | 获取知识库列表 |
| POST | /api/v1/knowledge/bases | 创建知识库 |
| POST | /api/v1/knowledge/bases/:kbId/text | 添加文本内容 |
| GET | /api/v1/knowledge/search | 知识检索 |

### 通知

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | /api/v1/notifications | 获取通知列表 |
| GET | /api/v1/notifications/unread-count | 未读数量 |
| POST | /api/v1/notifications/:id/read | 标记已读 |
| POST | /api/v1/notifications/read-all | 全部标记已读 |
| DELETE | /api/v1/notifications/:id | 删除通知 |

## 部署

使用 Docker Compose 一键部署：

```bash
cp .env.example .env
# 编辑 .env，填入你的 DeepSeek API Key
docker-compose up -d
```

访问 http://localhost:8080 使用系统。

## 开源协议

MIT
