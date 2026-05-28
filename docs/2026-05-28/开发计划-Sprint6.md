# AI-Native Chat System — Sprint 6 开发计划

> **日期：** 2026-05-28
> **版本：** v2.3.0-dev
> **阶段：** 新功能开发 + 质量基建
> **状态：** 📋 规划中
> **分支策略：** 每个功能从 main 开独立 feature 分支，合并后删除

---

## 分支策略

```
main ───── feat/channel ─────► merge ──► main
      \
       └── feat/i18n ─────────► merge ──► main
      \
       └── feat/emoji-picker ─► merge ──► main
      \
       └── test/e2e ──────────► merge ──► main
```

| 分支类型 | 命名规则 | 说明 |
|---------|---------|------|
| 功能分支 | `feat/<short-desc>` | 从 main 创建，开发完成后合并回 main 并删除 |
| 测试分支 | `test/<short-desc>` | 纯测试补充，无业务代码变更 |
| 修复分支 | `fix/<short-desc>` | 紧急修复直接从 main 开 |

### 工作流

```bash
# 1. 从 main 创建功能分支
git checkout main
git pull origin main
git checkout -b feat/channel

# 2. 开发 & 提交
git add . && git commit -m "feat: ..."

# 3. 合并回 main
git checkout main
git merge feat/channel
git push origin main
git branch -d feat/channel    # 删除本地分支
git push origin --delete feat/channel  # 删除远程分支
```

---

## 计划总览

| 优先级 | 功能模块 | 分支 | 预计工时 | 状态 |
|--------|---------|------|---------|------|
| P0 | 频道(Channel)功能 | `feat/channel` | 12h | 📋 规划中 |
| P1 | 前端国际化 i18n | `feat/i18n` | 10h | 📋 规划中 |
| P1 | 自定义表情回应面板 | `feat/emoji-picker` | 6h | 📋 规划中 |
| P2 | CI/CD 流水线完善 | `feat/ci-cd` | 4h | 📋 规划中 |
| — | E2E 测试补充 | `test/e2e` | 8h | 📋 规划中 |
| — | 单元测试覆盖率提升 | `test/coverage` | 8h | 📋 规划中 |

---

## 1. 频道(Channel)功能 — `feat/channel` ⭐

### 需求描述

频道(Channel)是一种广播型一对多会话：管理员/频道主可发送消息，成员只能阅读。适用于公告、通知、信息广播等场景。

### 后端接口

```
POST   /api/v1/chat/channels                    — 创建频道
PATCH  /api/v1/chat/channels/:id                — 更新频道设置（名称、描述、头像）
DELETE /api/v1/chat/channels/:id                — 删除频道
POST   /api/v1/chat/channels/:id/subscribe      — 订阅频道
POST   /api/v1/chat/channels/:id/unsubscribe    — 取消订阅
GET    /api/v1/chat/channels/:id/members         — 频道成员列表
POST   /api/v1/chat/channels/:id/announcement    — 发布公告（仅频道主/管理员）
```

### 数据模型变更

```prisma
// ChatSession 已有 sessionType: 'channel' 支持
// 可复用现有 ChatSession + ChatSessionMember 模型
// 新增字段控制权限
model ChatSession {
  // 现有字段...
  // channel 专用: 权限控制
  whoCanPost: String @default("admin") @map("who_can_post")  // "admin" | "anyone"
}
```

### 涉及文件

| 文件 | 改动说明 |
|------|---------|
| `apps/api/prisma/schema.prisma` | ChatSession 表新增 `whoCanPost` 字段 |
| `apps/api/src/modules/chat/chat.controller.ts` | 新增频道 CRUD + 订阅/取消订阅路由 |
| `apps/api/src/modules/chat/chat.service.ts` | 新增频道逻辑（权限校验、订阅管理） |
| `apps/api/src/modules/chat/dto/channel.dto.ts` | 新建：频道 DTO |
| `apps/api/src/gateways/chat.gateway.ts` | 频道消息广播逻辑 |
| `apps/web/src/api/client.ts` | 新增频道 API 调用 |
| `apps/web/src/pages/ChatLayout.tsx` | 侧边栏频道专区 |
| `apps/web/src/components/ChannelList/ChannelList.tsx` | 新建：频道列表组件 |
| `apps/web/src/stores/chat.store.ts` | 频道状态管理 |
| `apps/web/src/types/index.ts` | 频道相关类型 |

### 功能测试用例

| 编号 | 用例 | 预期结果 |
|------|------|---------|
| CHANNEL-01 | 创建频道 — 指定名称和描述 | 成功创建，创建者自动成为频道主(owner) |
| CHANNEL-02 | 更新频道设置 | 频道主可修改名称/描述/头像 |
| CHANNEL-03 | 非频道主更新设置 | 返回 403 Forbidden |
| CHANNEL-04 | 删除频道 — 频道主操作 | 频道被删除，所有订阅者自动取消订阅 |
| CHANNEL-05 | 非频道主删除频道 | 返回 403 Forbidden |
| CHANNEL-06 | 订阅频道 | 用户加入频道成员列表，频道未读计数+1 |
| CHANNEL-07 | 取消订阅频道 | 用户从频道成员列表移除，不再收到频道消息 |
| CHANNEL-08 | 频道主发送消息 | 所有订阅者实时收到消息 |
| CHANNEL-09 | 频道成员发送消息 | 返回 403，成员无发送权限 |
| CHANNEL-10 | 频道公告发布 | 公告显示在频道顶部，所有成员可见 |
| CHANNEL-11 | 订阅后侧边栏展示 | 侧边栏"频道"区域显示已订阅频道列表 |
| CHANNEL-12 | 频道未读计数 | 新消息到达时，未读计数更新 |

---

## 2. 前端国际化 i18n — `feat/i18n`

### 需求描述

为前端应用添加中英文双语支持。用户可通过设置页面切换语言。

### 技术选型

**推荐：react-i18next** — 轻量、React 集成好、支持命名空间和懒加载。

### 实现方案

```
apps/web/src/
├── i18n/
│   ├── index.ts              # i18n 初始化
│   ├── locales/
│   │   ├── zh-CN/
│   │   │   ├── common.json   # 通用 UI 文本
│   │   │   ├── chat.json     # 聊天相关
│   │   │   ├── settings.json # 设置相关
│   │   │   └── agent.json    # Agent 相关
│   │   └── en-US/
│   │       ├── common.json
│   │       ├── chat.json
│   │       ├── settings.json
│   │       └── agent.json
```

### 涉及文件

| 文件 | 改动说明 |
|------|---------|
| `apps/web/package.json` | 新增 `react-i18next`, `i18next` 依赖 |
| `apps/web/src/i18n/index.ts` | 新建：i18n 配置初始化 |
| `apps/web/src/i18n/locales/*.json` | 新建：中英文语言包 |
| `apps/web/src/main.tsx` | 引入 i18n 配置 |
| `apps/web/src/stores/theme.store.ts` | 新增语言偏好存储 |
| `apps/web/src/pages/SettingsPage.tsx` | 语言切换 UI |
| `apps/web/src/**/*.tsx` | 逐步替换硬编码文本为 `useTranslation()` |

### 测试用例

| 编号 | 用例 | 预期结果 |
|------|------|---------|
| I18N-01 | 切换语言为英文 | 界面文本更新为英文 |
| I18N-02 | 切换语言为中文 | 界面文本更新为中文 |
| I18N-03 | 刷新页面后语言保持 | 语言设置持久化 |
| I18N-04 | 未登录页面语言切换 | 登录页/注册页文本跟随切换 |
| I18N-05 | 动态内容（用户名/消息）不受影响 | 用户输入内容不参与翻译 |

---

## 3. 自定义表情回应面板 — `feat/emoji-picker`

### 需求描述

当前表情回应仅支持 6 个固定 emoji（👍 ❤️ 😂 😮 😢 🙏）。升级为完整的 emoji 选择面板：分类展示、搜索、最近使用。

### 技术选型

**推荐：`emoji-mart`** — 开源、可定制、支持搜索和分类。

### 涉及文件

| 文件 | 改动说明 |
|------|---------|
| `apps/web/package.json` | 新增 `emoji-mart` 依赖 |
| `apps/web/src/components/MessageBubble/MessageBubble.tsx` | 替换固定 reaction 为 emoji-mart 面板 |
| `apps/web/src/components/EmojiPicker/EmojiPicker.tsx` | 新建：通用 emoji 选择器组件 |

### 测试用例

| 编号 | 用例 | 预期结果 |
|------|------|---------|
| EMOJI-01 | 点击展开 emoji 面板 | 显示分类 emoji 网格，300ms 内打开 |
| EMOJI-02 | 搜索 emoji（如 "smile"） | 返回匹配的 emoji 列表 |
| EMOJI-03 | 选择 emoji 添加到消息 | 成功添加 reaction |
| EMOJI-04 | 已存在的 reaction 再次点击 | 取消 reaction（toggle） |
| EMOJI-05 | 最近使用分类 | 显示最近使用的 8 个 emoji |

---

## 4. CI/CD 流水线完善 — `feat/ci-cd`

### 需求描述

当前 `.github/workflows/ci.yml` 已有 lint + test + typecheck + build。需补充：
- 自动部署到 staging 环境（main 分支 push 触发）
- Docker 镜像构建与推送到 Docker Hub / GitHub Container Registry
- 测试覆盖率报告上传（Codecov）
- 自动生成 API Swagger 文档并发布到 GitHub Pages

### 涉及文件

| 文件 | 改动说明 |
|------|---------|
| `.github/workflows/ci.yml` | 补充 deploy/image/docs 步骤 |
| `Dockerfile.api` / `Dockerfile.web` | 如有需要调整构建参数 |

### 测试用例

| 编号 | 用例 | 预期结果 |
|------|------|---------|
| CI-01 | main 分支 push 触发自动构建 | 测试通过后自动构建 Docker 镜像 |
| CI-02 | 覆盖率报告上传 | Codecov 显示最新覆盖率 |
| CI-03 | API 文档自动生成 | Swagger 文档发布到 GitHub Pages |

---

## 5. E2E 测试补充 — `test/e2e`

### 当前覆盖

- `login.spec.ts` — 登录流程
- `chat.spec.ts` — 聊天功能

### 需补充场景

| 场景 | 文件 | 说明 |
|------|------|------|
| 注册 → 登录 → 登出 | `auth.spec.ts` | 完整认证生命周期 |
| 私聊发送/接收消息 | `private-chat.spec.ts` | 消息收发完整流程 |
| 创建群聊 → 邀请 → 发送消息 | `group-chat.spec.ts` | 群聊完整流程 |
| AI Agent 对话 | `agent.spec.ts` | Agent 消息发送与响应 |
| 文件上传与下载 | `upload.spec.ts` | 上传 → 消息展示 → 下载 |
| 通知流转 | `notification.spec.ts` | 好友请求 → 通知 → 标记已读 |

---

## 6. 单元测试覆盖率提升 — `test/coverage`

### 当前覆盖率

| 指标 | 当前值 | 目标值 |
|------|-------|-------|
| 语句(Statements) | 72.69% | ≥ 80% |
| 分支(Branches) | 57.59% | ≥ 70% |
| 函数(Functions) | 74.77% | ≥ 80% |
| 行(Lines) | 73.6% | ≥ 80% |

### 需补充测试的重点模块

| 模块 | 说明 |
|------|------|
| ChatService | 已读回执、消息编辑、@all、批量操作、会话静音（Sprint 5 新增功能） |
| AuthService | 密码修改、账号删除、邮箱验证码流程、OAuth 回调 |
| NotificationService | 静音检查、各类型通知边界情况 |
| AgentModule | ToolCall 异常路径、记忆压缩、RAG 空结果、流式中断 |
| FileUpload | 文件类型校验、大小限制超限、MinIO 连接失败 |

---

## 执行顺序

```
Phase 1: feat/channel (12h)
  └── 核心新功能，独立开发不影响其他模块

Phase 2: feat/emoji-picker (6h)
  └── 与 Channel 无依赖，可并行开发

Phase 3: feat/i18n (10h)
  └── 涉及面广，建议在功能稳定后进行

Phase 4: test/e2e + test/coverage (16h)
  └── 可与 Phase 2/3 并行

Phase 5: feat/ci-cd (4h)
  └── 最后进行，确保测试通过后再配置自动化
```

## 分支创建速查

```bash
# 频道功能
git checkout main && git pull origin main
git checkout -b feat/channel
# ... 开发后 ...
git checkout main && git merge feat/channel
git push origin main && git branch -d feat/channel

# 国际化
git checkout main && git pull origin main
git checkout -b feat/i18n
# ...
git checkout main && git merge feat/i18n && git branch -d feat/i18n

# 依此类推...
```

---

> 计划版本：v2.3.0
> 计划制定：2026-05-28
> 分支策略：每个功能独立 feature 分支 → 合并即删除
