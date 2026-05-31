# AI-Native Chat System — Sprint 7 开发计划

> **日期：** 2026-05-30
> **版本：** v2.4.0-dev
> **阶段：** 通信扩展 + AI 增强 + 质量基建
> **状态：** 📋 待评审

---

## 计划总览

Sprint 5（深度体验增强）和 Sprint 6（新功能 + 质量基建）已全部完成。当前项目核心功能基本齐备，剩余待实现的核心能力为 **音视频通话**。同时前端覆盖率和搜索体验有较大提升空间。

| 优先级 | 功能模块 | 预计工时 | 状态 |
|--------|---------|---------|------|
| P0 | 语音/视频通话 (WebRTC) | 16h | ✅ 完成 |
| P1 | 富文本编辑器 + Markdown 增强 | 10h | ✅ 完成 |
| P1 | 智能消息搜索增强 | 8h | 📋 规划中 |
| P2 | 消息收藏增强（标签、搜索） | 6h | 📋 规划中 |
| P2 | 前端测试覆盖率提升 (41% → 70%) | 10h | 📋 规划中 |
| P2 | 后端覆盖率提升 (分支 57% → 70%) | 8h | 📋 规划中 |

### 架构/非功能项

| 项目 | 优先级 | 预计工时 | 说明 |
|------|--------|---------|------|
| PostgreSQL 全文搜索（tsvector）迁移 | P1 | 4h | 替换当前 `contains` 模糊搜索 |
| 更多 OAuth 提供商（微信） | P2 | 6h | 微信扫码登录 |
| Docker Compose 生产调优 | P2 | 2h | healthcheck + 日志轮转 + 资源限制 |

---

## Phase 1：P0 — 语音/视频通话 (WebRTC) ⭐

### 需求描述

实现一对一音视频通话功能。基于 WebSocket 作为信令通道，WebRTC 处理媒体流。

通话流程：
```
用户 A 发起通话 → 信令: offer → 用户 B 收到来电
                                    ├── 接受 → 信令: answer + ICE → 媒体流建立
                                    └── 拒绝 → 信令: reject → 通话结束
通话中:
  任一方挂断 → 信令: hangup → 双方释放媒体流
  静音/摄像头开关 → 信令: toggle → 对方更新 UI
```

### 技术选型

| 选项 | 选择理由 |
|------|---------|
| **原生 WebRTC API** (`RTCPeerConnection`) | 零依赖，浏览器原生支持 |
| **Socket.io** 作为信令通道 | 项目已有，复用即可 |
| **无中继服务器** (P2P) | MVP 阶段不部署 TURN/STUN，仅支持同一网络 |
| **后续** 可部署 coturn TURN 服务器 | NAT 穿透需要时 |

不需要额外的 npm 包依赖。信令复用现有的 `chat.gateway.ts`。

### 后端设计

#### WebSocket 信令事件

| 事件方向 | 事件名 | 载荷 | 说明 |
|---------|--------|------|------|
| 客户端→服务端 | `call:offer` | `{ targetUserId, sdp }` | 发起通话 |
| 客户端→服务端 | `call:answer` | `{ targetUserId, sdp }` | 接受通话 |
| 客户端→服务端 | `call:ice-candidate` | `{ targetUserId, candidate }` | ICE 候选 |
| 客户端→服务端 | `call:reject` | `{ targetUserId }` | 拒绝来电 |
| 客户端→服务端 | `call:end` | `{ targetUserId }` | 挂断通话 |
| 客户端→服务端 | `call:toggle` | `{ targetUserId, type: 'audio'\|'video', enabled: boolean }` | 开关麦克风/摄像头 |
| 服务端→客户端 | `call:incoming` | `{ callerId, callerName, callerAvatar }` | 通知来电 |
| 服务端→客户端 | `call:accepted` | `{ calleeId, calleeName }` | 对方已接受 |
| 服务端→客户端 | `call:ended` | `{ userId, reason: 'hangup'\|'reject'\|'offline' }` | 通话结束 |

#### 后端新增：`CallSession` 模型（内存管理 + 可选数据库持久化）

通话状态用 Redis 管理（临时），不强制持久化。如需通话记录，可扩展到数据库：

```prisma
model CallSession {
  id         String   @id @default(uuid())
  callerId   String   @map("caller_id")
  calleeId   String   @map("callee_id")
  status     String   @default("ringing") @db.VarChar(20) // ringing, active, ended
  startedAt  DateTime @default(now()) @map("started_at")
  endedAt    DateTime? @map("ended_at")
  duration   Int?     // 秒

  caller User @relation("Caller", fields: [callerId], references: [id])
  callee User @relation("Callee", fields: [calleeId], references: [id])

  @@map("call_sessions")
}
```

### 前端设计

#### 新增组件

| 组件 | 说明 |
|------|------|
| `CallController` | **上层管理器** — 监听信令事件、管理通话生命周期 |
| `CallNotification` | **来电弹窗** — 显示来电者 + 接受/拒绝按钮 |
| `CallWindow` | **通话窗口** — 本地/远程视频流 + 控制栏 |

#### 组件树

```
PrivateChatPage
  ├── CallController (隐藏，管理信令)
  ├── CallNotification (来电弹窗)
  └── CallWindow (全屏通话窗口)
      ├── 远程视频 <video>
      ├── 本地画中画 <video>
      └── 控制栏
          ├── 静音按钮
          ├── 摄像头开关
          └── 挂断按钮
```

#### Store: `useCallStore`

```typescript
interface CallState {
  status: 'idle' | 'calling' | 'ringing' | 'connected'
  peerId: string | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  isMicMuted: boolean
  isCameraOff: boolean

  startCall: (userId: string) => Promise<void>
  acceptCall: (callerId: string) => Promise<void>
  rejectCall: (userId: string) => void
  endCall: () => void
  toggleMic: () => void
  toggleCamera: () => void
  // 信令事件处理
  handleIncomingCall: (data: { callerId, callerName }) => void
  handleAccepted: (data: { calleeId }) => void
  handleEnded: (data: { reason }) => void
}
```

### 数据流

```
发起方:
  PrivateChatPage
    └─ 点击"语音通话"按钮
        └─ callStore.startCall(userId)
            ├─ 创建 RTCPeerConnection
            ├─ 获取本地流 mediaDevices.getUserMedia()
            ├─ 创建 offer → setLocalDescription
            └─ socket.emit('call:offer', { targetUserId, sdp })

接收方:
  socket.on('call:incoming')
    └─ callStore.handleIncomingCall(data)
        └─ CallNotification 弹窗
            ├─ 接受 → socket.emit('call:answer')
            └─ 拒绝 → socket.emit('call:reject')
```

### 涉及文件

| 文件 | 改动说明 |
|------|---------|
| `apps/api/src/gateways/chat.gateway.ts` | 新增 `call:*` 事件处理（转发 offer/answer/ICE/挂断） |
| `apps/api/prisma/schema.prisma` | 新增 `CallSession` 模型（可选） |
| `apps/web/src/stores/call.store.ts` | **新建** — WebRTC 通话状态管理 |
| `apps/web/src/types/index.ts` | 新增通话相关类型 |
| `apps/web/src/components/CallController/CallController.tsx` | **新建** — 信令监听 + WebRTC 管理 |
| `apps/web/src/components/CallNotification/CallNotification.tsx` | **新建** — 来电弹窗 |
| `apps/web/src/components/CallWindow/CallWindow.tsx` | **新建** — 通话窗口 |
| `apps/web/src/pages/PrivateChatPage.tsx` | 集成通话按钮 + CallController |
| `apps/web/src/stores/chat.store.ts` | 新增 `startCall` 等 action |

### 测试用例

| 编号 | 用例 | 预期结果 |
|------|------|---------|
| CALL-01 | 发起语音通话 | 对方收到 `call:incoming` 事件 |
| CALL-02 | 接受通话 | 双方建立 `RTCPeerConnection`，媒体流播放 |
| CALL-03 | 拒绝通话 | 发起方收到 `call:ended (reason: reject)` |
| CALL-04 | 对方离线时发起通话 | 立即收到 `call:ended (reason: offline)` |
| CALL-05 | 通话中挂断 | 双方释放流，状态回到 `idle` |
| CALL-06 | 通话中切换静音 | 对端收到 `call:toggle (audio: false)`，UI 更新 |
| CALL-07 | 通话中关闭/开启摄像头 | 对端收到 `call:toggle (video: false)`，视频流停止/恢复 |
| CALL-08 | 通话中发起方网络断开 | 双方收到 `call:ended`，自动挂断 |
| CALL-09 | 通话中再次发起（防重复） | 已有通话时忽略新呼叫 |
| CALL-10 | 权限拒绝（麦克风） | 提示用户授予权限，通话不建立 |

---

## Phase 2：P1 — 富文本编辑器 + Markdown 增强

### 需求描述

当前消息输入为纯文本 `<textarea>`，升级为轻量富文本编辑器，支持格式化工具栏（加粗、斜体、列表、代码块）+ 实时 Markdown 预览。

### 技术选型

**推荐：Tiptap**（基于 ProseMirror）— 轻量（~50KB gzip）、React 集成好、支持 markdown 快捷键。

备选：`react-simplemde-editor`（EasyMDE 封装）— 更简单但不支持扩展。

### 涉及文件

| 文件 | 改动说明 |
|------|---------|
| `apps/web/package.json` | 新增 `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder` |
| `apps/web/src/components/RichTextEditor/RichTextEditor.tsx` | **新建** — 富文本编辑器组件 |
| `apps/web/src/components/RichTextEditor/RichTextEditorToolbar.tsx` | **新建** — 格式化工具栏（B/I/List/Code/Preview） |
| `apps/web/src/pages/PrivateChatPage.tsx` | 替换 `<textarea>` 为 RichTextEditor |
| `apps/web/src/pages/AgentChatPage.tsx` | Agent 输入区替换为 RichTextEditor |

### 测试用例

| 编号 | 用例 | 预期结果 |
|------|------|---------|
| EDITOR-01 | 输入文本 → 加粗 | 选中文本变粗体 |
| EDITOR-02 | 输入 `# 标题` → 自动转换为标题 | Markdown 快捷键生效 |
| EDITOR-03 | 粘贴纯文本 | 去除格式，仅保留纯文本 |
| EDITOR-04 | 预览模式切换 | 渲染 Markdown 预览 |
| EDITOR-05 | 发送后清空编辑器 | 内容被发送后编辑器重置为空 |

---

## Phase 3：P1 — 智能消息搜索增强

### 需求描述

当前搜索基于 Prisma `contains`（LIKE 查询），在大数据量下性能下降。升级为 PostgreSQL 全文搜索（tsvector）+ 搜索结果聚合。

### 后端设计

#### 当前方案

```typescript
// chat.service.ts — 当前实现
where: {
  sessionId,
  content: { contains: query, mode: 'insensitive' },
}
```

#### 升级方案

1. **PostgreSQL 全文搜索**（tsvector）
   - 消息表新增 `searchVector` 列（tsvector）
   - 触发器自动更新（新消息/编辑时重新生成）
   - 查询使用 `ts_query` + `ts_rank` 排序

2. **搜索增强接口**

```
GET /api/v1/chat/search
  Query: q, sessionId?, type?, dateFrom?, dateTo?, page, limit

Response:
{
  "results": [
    {
      "sessionId": "uuid",
      "sessionName": "群聊名称",
      "sessionType": "GROUP",
      "highlights": [
        {
          "messageId": "uuid",
          "content": "这是<mark>关键词</mark>上下文",
          "senderName": "user1",
          "createdAt": "..."
        }
      ]
    }
  ],
  "pagination": {...},
  "totalSessions": 5
}
```

### 涉及文件

| 文件 | 改动说明 |
|------|---------|
| `apps/api/prisma/schema.prisma` | Message 表新增 `searchVector` 字段（可选通过原始 SQL 管理） |
| `apps/api/prisma/migrations/...` | **新建** — 添加 tsvector 索引的迁移 SQL |
| `apps/api/src/modules/chat/chat.service.ts` | `searchMessages()` 改为 PostgreSQL 全文搜索 + 会话聚合 |
| `apps/api/src/modules/chat/chat.controller.ts` | 搜索端点返回按会话分组的结果 |
| `apps/web/src/api/client.ts` | 适配新的搜索结果格式 |
| `apps/web/src/components/GlobalSearchModal/GlobalSearchModal.tsx` | 搜索结果按会话分组展示 |

### 测试用例

| 编号 | 用例 | 预期结果 |
|------|------|---------|
| SEARCH-01 | 搜索关键词"会议" | 返回包含"会议"的消息，按会话分组 |
| SEARCH-02 | 搜索空结果 | 返回空数组 + totalSessions: 0 |
| SEARCH-03 | 搜索中文分词 | tsvector 正确分词中文 |
| SEARCH-04 | 跨会话搜索结果按相关度排序 | 最高 ts_rank 的会话排最前 |
| SEARCH-05 | 搜索高频词性能 | 100 万条消息中搜索 < 500ms |

---

## Phase 4：P2 — 消息收藏增强

### 需求描述

当前 Bookmark 仅有 `userId + messageId` 的简单关联。扩展为支持**标签分类、搜索、笔记备注**。

### 数据库变更

```prisma
model Bookmark {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  messageId String   @map("message_id")
  tags      String[] @default([])       // 标签数组 ["work", "important"]
  note      String?  @db.Text          // 个人备注
  createdAt DateTime @default(now()) @map("created_at")

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, messageId])
  @@map("bookmarks")
}
```

### 涉及文件

| 文件 | 改动说明 |
|------|---------|
| `apps/api/prisma/schema.prisma` | Bookmark 新增 tags + note 字段 |
| `apps/api/src/modules/chat/chat.controller.ts` | 新增 PATCH `/messages/:id/bookmark`（更新标签/备注）、新增 GET `/bookmarks/search?tag=` |
| `apps/api/src/modules/chat/chat.service.ts` | 标签 CRUD、按标签搜索 |
| `apps/web/src/components/BookmarkPanel/BookmarkPanel.tsx` | 标签筛选 + 搜索框 + 备注编辑 |
| `apps/web/src/components/MessageBubble/MessageBubble.tsx` | 收藏弹窗中增加标签选择 + 备注输入 |
| `apps/web/src/types/index.ts` | Bookmark 类型扩展 |
| `apps/web/src/stores/chat.store.ts` | 新增 updateBookmark action |

### 测试用例

| 编号 | 用例 | 预期结果 |
|------|------|---------|
| BOOK-01 | 收藏消息时添加标签 "work" | 数据库中 tags 包含 "work" |
| BOOK-02 | 按标签筛选收藏 | 只显示对应标签的消息 |
| BOOK-03 | 搜索收藏消息内容 | 返回匹配的消息收藏 |
| BOOK-04 | 添加/编辑收藏备注 | 备注内容更新成功 |
| BOOK-05 | 标签自动补全已有标签 | 输入时显示已有标签建议 |

---

## Phase 5：P2 — 测试覆盖率提升

### 前端覆盖率目标

| 指标 | 当前值 | 目标值 |
|------|-------|-------|
| 语句 (Statements) | 41.33% | ≥ 70% |
| 分支 (Branches) | 32.17% | ≥ 55% |
| 函数 (Functions) | 31.73% | ≥ 60% |

#### 未覆盖的测试文件

| 文件 | 策略 |
|------|------|
| `pages/KnowledgePage.tsx` | Vitest + RTL，Mock knowledge.store |
| `pages/SettingsPage.tsx` | 主题切换、语言切换、密码修改表单 |
| `pages/AgentChatPage.tsx` | 模式切换、流式对话、清空记忆 |
| `pages/AdminPage.tsx` | 用户管理表格、设置表单（需 Admin 权限 mock） |
| `pages/ProfilePage.tsx` | 头像上传、资料编辑、改密 |
| `components/NotificationPanel/NotificationPanel.tsx` | 通知列表、已读/未读切换、好友操作按钮 |
| `components/FileUpload/FileUploadPanel.tsx` | 拖拽上传、进度条 |
| `components/GlobalSearchModal/GlobalSearchModal.tsx` | 搜索输入、结果展示、快捷键 Ctrl+K |
| `components/ForwardModal/ForwardModal.tsx` | 会话选择、转发确认 |
| `components/GroupDetailPanel/GroupDetailPanel.tsx` | 群公告、成员列表、静音开关 |
| `components/VirtualizedMessageList/VirtualizedMessageList.tsx` | 虚拟滚动、自动滚动 |
| `stores/knowledge.store.ts` | 知识库 CRUD、文档管理 |
| `stores/notification.store.ts` | 通知状态、已读、删除全部 |

#### 需新增的测试文件

| 测试文件 | 覆盖模块 |
|---------|---------|
| `components/ChannelList/ChannelList.spec.tsx` | 频道列表、订阅/取消 |
| `components/EmojiPicker/EmojiPicker.spec.tsx` | Emoji 面板、搜索、选择 |

### 后端覆盖率目标

| 指标 | 当前值 | 目标值 |
|------|-------|-------|
| 语句 (Statements) | 72.69% | ≥ 80% |
| 分支 (Branches) | 57.59% | ≥ 70% |

#### 重点补充测试

| 模块 | 新增场景 |
|------|---------|
| ChatService | 消息编辑（15分钟限制、权限校验、编辑历史）、@all 检测、批量操作（forward/delete）、频道 CRUD、会话静音 |
| ChatGateway | `call:*` 信令事件测试 |
| NotificationService | 静音检查、批量删除、@all 批量通知 |
| KnowledgeService | FileParserService 编码检测（UTF-8/GBK/PDF）、文档删除级联 |
| AgentModule | ToolCall 异常路径、RAG 空结果降级、流式中断恢复 |
| FileUpload | 文件类型校验、大小限制超限、MinIO 连接失败 |

---

## Phase 6：P2 — 更多 OAuth 提供商（微信）

### 需求描述

增加**微信扫码登录**，复用现有的 OAuthAccount 模型。

### 后端方案

```
Web 端 → 微信 OAuth → 重定向到 /api/v1/auth/oauth/wechat
                     → 获取 code → 后端换取 access_token
                     → 获取用户信息 → 创建/关联本地用户
                     → 返回 JWT tokens
```

### 涉及文件

| 文件 | 改动说明 |
|------|---------|
| `apps/api/src/modules/auth/auth.controller.ts` | 新增 wechat OAuth 端点 |
| `apps/api/src/modules/auth/auth.service.ts` | wechat token 交换 + 用户信息获取 |
| `apps/web/src/pages/LoginPage.tsx` | 新增微信登录按钮 |

---

## 执行顺序与依赖关系

```
Phase 1 (P0, 16h): WebRTC 音视频通话
  └── 独立功能，无外部依赖
  └── 可启用 `feat/webrtc` 分支

Phase 2 (P1, 10h): 富文本编辑器
  └── 独立，与 Phase 1 可并行
  └── 可启用 `feat/richtext-editor` 分支

Phase 3 (P1, 12h): 消息搜索增强
  └── 依赖 schema 变更（tsvector 迁移）
  └── 与 Phase 1/2 可并行
  └── 可启用 `feat/search-enhance` 分支

Phase 4 (P2, 6h): 消息收藏增强
  └── 依赖 schema 变更
  └── 与 Phase 1/2/3 可并行
  └── 可启用 `feat/bookmark-enhance` 分支

Phase 5 (P2, 18h): 测试覆盖率提升
  └── 贯穿始终，可在任一 Phase 之后并行进行
  └── 可启用 `test/coverage-web` + `test/coverage-api` 分支

Phase 6 (P2, 6h): 微信 OAuth
  └── 无外部依赖，可随时开始
  └── 可启用 `feat/oauth-wechat` 分支
```

### 并行执行示意图

```
Week 1:  ┌──── Phase 1 (WebRTC) ────┐
         ├──── Phase 2 (富文本) ─────┤
         ├──── Phase 3 (搜索增强) ───┤
         └──── Phase 5 (测试) ──────┘

Week 2:  ├── Phase 4 (收藏增强) ────┤
         ├── Phase 6 (微信 OAuth) ──┤
         ├── Phase 5 (测试, 续) ────┤
         └── Bug 修复 + 发布 ───────┘
```

---

## 分支策略

沿用 Sprint 6 的分支策略，每个功能使用独立 feature 分支：

| 分支 | 说明 |
|------|------|
| `feat/webrtc` | 音视频通话 |
| `feat/richtext-editor` | 富文本编辑器 |
| `feat/search-enhance` | 消息搜索增强 |
| `feat/bookmark-enhance` | 消息收藏增强 |
| `test/coverage-web` | 前端测试 |
| `test/coverage-api` | 后端测试 |
| `feat/oauth-wechat` | 微信 OAuth |

```bash
# 工作流
git checkout main && git pull origin main
git checkout -b feat/webrtc
# ... 开发 & 提交 ...
git checkout main && git merge feat/webrtc
git push origin main && git branch -d feat/webrtc
```

---

## 数据库变更汇总（Sprint 7）

| 模型 | 变更 | 涉及 Phase |
|------|------|-----------|
| `CallSession` | **新增** — 通话记录 | Phase 1 |
| `Bookmark` | +`tags` String[], +`note` String? | Phase 4 |
| `Message` | +`searchVector` Unsupported("tsvector")? | Phase 3 |

> `searchVector` 建议通过原始 SQL 迁移管理而非 Prisma schema（tsvector 不是 Prisma 原生支持的类型），使用 `prisma.$executeRawUnsafe` 在应用启动时执行迁移。

---

## 版本里程碑

| 阶段 | 预计时间 | 交付物 |
|------|---------|--------|
| Phase 1 WebRTC | Day 1-3 | 一对一音视频通话可用 |
| Phase 2 富文本 | Day 3-5 | 富文本编辑器替换 textarea |
| Phase 3 搜索增强 | Day 3-6 | 全文搜索 + 结果分组 |
| Phase 4 收藏增强 | Day 6-8 | 标签 + 备注 + 搜索 |
| Phase 5 测试覆盖 | Day 1-10 持续 | 前端 70% + 后端分支 70% |
| Phase 6 微信 OAuth | Day 8-10 | 微信扫码登录 |
| 发布 | Day 10 | v2.4.0 正式版 |

---

> 计划版本：v2.4.0
> 计划制定：2026-05-30
> 分支策略：每个功能独立 feature 分支 → 合并即删除
