# AI-Native Chat System — Sprint 5 开发计划

> **日期：** 2026-05-28
> **版本：** v2.2.0-dev
> **阶段：** 深度体验增强与系统完善
> **状态：** 📋 规划中

---

## 计划总览

| 优先级 | 功能模块 | 预计工时 | 状态 |
|--------|---------|---------|------|
| P0 | 已读状态增强（群聊已读成员列表） | 6h | 📋 规划中 |
| P0 | 消息编辑功能 | 4h | 📋 规划中 |
| P1 | 频道功能 | 10h | 📋 规划中 |
| P1 | 消息批量操作（多选转发/删除） | 6h | 📋 规划中 |
| P1 | 群聊@全体成员 | 3h | 📋 规划中 |
| P2 | 消息免打扰与会话静音 | 4h | 📋 规划中 |
| P2 | 自定义表情回应面板 | 5h | 📋 规划中 |
| P2 | 用户在线状态自定义 | 3h | 📋 规划中 |
| — | 测试覆盖率提升 | 8h | 📋 规划中 |
| — | CI/CD 流水线完善 | 4h | 📋 规划中 |

### 架构/非功能项

| 项目 | 优先级 | 预计工时 | 说明 |
|------|--------|---------|------|
| E2E 测试补充 | P1 | 8h | Playwright 覆盖核心流程 |
| API 性能压测 | P2 | 4h | 群聊场景下消息吞吐量优化 |
| Docker 生产部署优化 | P2 | 3h | healthcheck、日志轮转、资源限制 |
| 前端国际化 i18n | P2 | 8h | 中英文切换支持 |

---

## P0 — 必做功能

### 1. 已读状态增强（群聊已读成员列表）

#### 需求描述

当前系统支持消息已读回执（单条消息标记已读），但群聊中发送者无法查看具体哪些成员已读。本功能需在群聊消息气泡上显示已读/未读计数，点击可查看已读成员列表。

#### 后端接口

```
GET /api/v1/chat/messages/:id/read-receipts
  Query: ?page=1&limit=50

Response 200:
{
  "readCount": 15,
  "unreadCount": 5,
  "readUsers": [
    {
      "userId": "uuid",
      "username": "user1",
      "avatarUrl": "...",
      "readAt": "2026-05-28T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 20 }
}
```

#### 涉及文件

| 文件 | 改动说明 |
|------|---------|
| `apps/api/src/modules/chat/chat.controller.ts` | 新增 GET `/messages/:id/read-receipts` |
| `apps/api/src/modules/chat/chat.service.ts` | 新增 `getReadReceipts()` 查询已读成员列表，聚合未读成员 |
| `apps/web/src/api/client.ts` | 新增 `getReadReceipts()` API 调用 |
| `apps/web/src/components/MessageBubble/MessageBubble.tsx` | 消息气泡底部显示 "已读 N/共 M" |
| `apps/web/src/components/ReadReceiptPanel/ReadReceiptPanel.tsx` | 新建组件：已读成员列表弹窗 |
| `apps/web/src/stores/chat.store.ts` | 新增 readReceipts 状态管理 |

#### 数据流

```
用户点击"已读 N" → GET /messages/:id/read-receipts → ReadReceiptPanel 弹窗
                                                          ├── 已读列表 (头像 + 用户名 + 时间)
                                                          └── 未读列表 (灰色显示)
```

#### 测试用例

| 编号 | 用例 | 预期结果 |
|------|------|---------|
| READ-01 | 私聊消息查看已读状态 | 显示"已读 1/共 2"（自己和对方） |
| READ-02 | 群聊消息查看已读成员列表 | 返回已读成员列表，按阅读时间排序 |
| READ-03 | 群聊中未读成员显示 | 未读成员单独分组显示 |
| READ-04 | 消息从未被阅读 | 显示"已读 0/共 N"，点击显示空已读列表 |
| READ-05 | 非群成员查看已读回执 | 返回 403 无权限 |
| READ-06 | 分页场景（群聊 >50 人） | 正确分页返回已读列表 |
| READ-07 | WebSocket 实时更新已读状态 | 另一用户阅读后，已读计数自动更新 |

---

### 2. 消息编辑功能

#### 需求描述

允许用户发送消息后在 15 分钟内编辑消息内容。编辑后的消息显示"已编辑"标记，保留编辑历史。

#### 后端接口

```
PATCH /api/v1/chat/messages/:id
Request:
{
  "content": "新的消息内容"
}

Response 200:
{
  "message": { ... },
  "editedAt": "2026-05-28T10:05:00Z",
  "editCount": 1
}

GET /api/v1/chat/messages/:id/edit-history
Response 200:
{
  "edits": [
    {
      "content": "旧内容",
      "editedAt": "2026-05-28T10:05:00Z"
    }
  ]
}
```

#### 数据库变更

```prisma
// 新增模型
model MessageEdit {
  id        String   @id @default(uuid())
  messageId String   @map("message_id")
  content   String   @db.Text
  editedAt  DateTime @default(now()) @map("edited_at")

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([messageId])
  @@map("message_edits")
}

// Message 表新增字段
editCount Int @default(0) @map("edit_count")
```

#### 涉及文件

| 文件 | 改动说明 |
|------|---------|
| `apps/api/prisma/schema.prisma` | 新增 `MessageEdit` 模型 + Message 表加 edit_count |
| `apps/api/src/modules/chat/chat.controller.ts` | 新增 PATCH `/messages/:id`、GET `/messages/:id/edit-history` |
| `apps/api/src/modules/chat/chat.service.ts` | 新增 `editMessage()` + `getEditHistory()` |
| `apps/api/src/gateways/chat.gateway.ts` | 新增 `message_edited` WebSocket 事件广播 |
| `apps/web/src/api/client.ts` | 新增 `editMessage()`, `getEditHistory()` |
| `apps/web/src/components/MessageBubble/MessageBubble.tsx` | 编辑按钮 + "已编辑"标记 |
| `apps/web/src/types/index.ts` | 新增 `MessageEdit` 类型 |
| `apps/web/src/stores/chat.store.ts` | 新增 `editMessage()` action + socket 监听 |

#### 测试用例

| 编号 | 用例 | 预期结果 |
|------|------|---------|
| EDIT-01 | 发送者 5 分钟内编辑消息 | 成功更新，显示"已编辑" |
| EDIT-02 | 发送者超过 15 分钟编辑 | 返回 403，编辑被拒绝 |
| EDIT-03 | 非发送者尝试编辑 | 返回 403 无权限 |
| EDIT-04 | 编辑后查看编辑历史 | 返回所有历史版本 |
| EDIT-05 | 已撤回消息尝试编辑 | 返回 400，已撤回不可编辑 |
| EDIT-06 | WebSocket 实时广播编辑 | 所有成员收到 `message_edited` 事件 |

---

## P1 — 推荐功能

### 3. 频道功能

#### 需求描述

频道(Channel)是一种广播型会话，支持**一对多广播**：管理员/频道主可发送消息，成员只能阅读。适用于公告、通知等场景。

#### 后端接口

```
// 频道管理
POST   /api/v1/chat/channels              — 创建频道
PATCH  /api/v1/chat/channels/:id           — 更新频道设置
DELETE /api/v1/chat/channels/:id           — 删除频道

// 频道成员
POST   /api/v1/chat/channels/:id/subscribe   — 订阅频道
POST   /api/v1/chat/channels/:id/unsubscribe — 取消订阅

// 频道消息
POST   /api/v1/chat/channels/:id/announcement — 发布公告（仅频道主/管理员）
```

#### 涉及文件

| 文件 | 改动说明 |
|------|---------|
| `apps/api/src/modules/chat/chat.controller.ts` | 新增频道相关路由 |
| `apps/api/src/modules/chat/chat.service.ts` | 新增频道 CRUD、订阅逻辑 |
| `apps/api/src/modules/chat/dto/channel.dto.ts` | 频道 DTO |
| `apps/web/src/pages/ChatLayout.tsx` | 侧边栏频道区域 |
| `apps/web/src/components/ChannelList/ChannelList.tsx` | 新建组件：频道列表 |
| `apps/web/src/stores/chat.store.ts` | 频道状态管理 |

#### 测试用例

| 编号 | 用例 | 预期结果 |
|------|------|---------|
| CHANNEL-01 | 创建频道 | 成功创建，创建者自动成为频道主 |
| CHANNEL-02 | 频道成员发送消息 | 被拒绝，成员无发送权限 |
| CHANNEL-03 | 频道主发布公告 | 所有订阅者收到公告消息 |
| CHANNEL-04 | 用户订阅/取消订阅频道 | 订阅后收到频道消息，取消后不再收到 |
| CHANNEL-05 | 非频道主修改频道设置 | 返回 403 |
| CHANNEL-06 | 频道列表展示 | 侧边栏频道区域展示已订阅频道 |

---

### 4. 消息批量操作

#### 需求描述

支持长按/右键选择多条消息，进行批量转发、批量删除(仅自己可见/全员删除)操作。

#### 后端接口

```
POST /api/v1/chat/messages/batch/forward
Request:
{
  "messageIds": ["uuid1", "uuid2"],
  "targetSessionId": "uuid"
}

POST /api/v1/chat/messages/batch/delete
Request:
{
  "messageIds": ["uuid1", "uuid2"],
  "type": "self" | "everyone"
}
```

#### 涉及文件

| 文件 | 改动说明 |
|------|---------|
| `apps/api/src/modules/chat/chat.controller.ts` | 新增 batch/forward, batch/delete |
| `apps/api/src/modules/chat/chat.service.ts` | 批量转发/删除逻辑 |
| `apps/web/src/components/MessageBubble/MessageBubble.tsx` | 新增多选模式 |
| `apps/web/src/stores/chat.store.ts` | 批量选择状态管理 |

#### 测试用例

| 编号 | 用例 | 预期结果 |
|------|------|---------|
| BATCH-01 | 选择 2-5 条消息批量转发 | 成功转发到目标会话 |
| BATCH-02 | 批量删除(仅自己) | 自己视角消失，他人仍可见 |
| BATCH-03 | 批量删除(全员) | 所有成员视角均删除 |
| BATCH-04 | 选择 0 条时操作 | 按钮禁用，提示至少选 1 条 |
| BATCH-05 | 最大选择数限制(50 条) | 超过时提示限制 |

---

### 5. 群聊@全体成员

#### 需求描述

群聊中允许管理员/群主使用 @all 或 @everyone 标记，触发所有群成员的通知推送。

#### 后端接口

```
// 无需新接口，复用现有消息发送接口，content 中解析 @all
// 在 chat.service.ts 中增加 @all 检测逻辑

// 新增 WebSocket 事件
客户端 → 服务端: message (content 含 @all)
服务端 → 客户端: mention_all { sessionId, senderId }
```

#### 涉及文件

| 文件 | 改动说明 |
|------|---------|
| `apps/api/src/modules/chat/chat.service.ts` | 消息发送时检测 `@all`/`@everyone`，触发全员通知 |
| `apps/api/src/modules/notification/notification.service.ts` | 批量创建 @all 通知 |
| `apps/web/src/components/ChatInput/ChatInput.tsx` | @all 建议词条 |
| `apps/web/src/components/MessageBubble/MessageBubble.tsx` | @all 特殊样式高亮 |

#### 测试用例

| 编号 | 用例 | 预期结果 |
|------|------|---------|
| ATALL-01 | 群主发送 @all | 所有群成员收到通知 |
| ATALL-02 | 管理员发送 @all | 所有群成员收到通知 |
| ATALL-03 | 普通成员发送 @all | @all 被忽略，仅作为纯文本 |
| ATALL-04 | @all 触发频率限制(5 分钟/次) | 短时间内重复 @all 被拒绝 |

---

## P2 — 按需功能

### 6. 消息免打扰与会话静音

#### 需求描述

允许用户对特定会话开启免打扰(DND)模式：静音通知、隐藏未读计数红点、置顶静音会话特殊标记。

#### 后端接口

```
PATCH /api/v1/chat/sessions/:id/mute
Request:
{
  "muted": true,
  "muteUntil": "2026-06-01T00:00:00Z" | null  // null 表示永久静音
}
```

#### 测试用例

| 编号 | 用例 | 预期结果 |
|------|------|---------|
| MUTE-01 | 开启会话静音 | 不再接收该会话通知 |
| MUTE-02 | 取消会话静音 | 恢复通知 |
| MUTE-03 | 定时静音到期自动恢复 | 到期后自动取消静音状态 |
| MUTE-04 | 静音会话在列表中特殊标记 | 静音图标显示 |

---

### 7. 自定义表情回应面板

#### 需求描述

当前表情回应仅支持固定 emoji。升级为：常用 emoji 面板 + emoji 搜索 + 自定义表情。

#### 测试用例

| 编号 | 用例 | 预期结果 |
|------|------|---------|
| EMOJI-01 | 点击展开 emoji 面板 | 显示分类 emoji 网格 |
| EMOJI-02 | 搜索 emoji 关键词 | 返回匹配 emoji 结果 |
| EMOJI-03 | 选择 emoji 添加到消息 | 成功添加 reaction |
| EMOJI-04 | 已存在的 reaction 再次点击 | 取消 reaction |
| EMOJI-05 | emoji 面板响应速度 | 面板在 300ms 内打开 |

---

### 8. 用户在线状态自定义

#### 需求描述

当前 status 仅支持 online/offline。扩展为：online、away、busy、invisible，允许用户手动设置。

#### 后端接口

```
PATCH /api/v1/users/status
Request:
{
  "status": "online" | "away" | "busy" | "invisible"
}
```

#### 测试用例

| 编号 | 用例 | 预期结果 |
|------|------|---------|
| STATUS-01 | 在线 → 离开 | 好友列表显示"离开"状态 |
| STATUS-02 | 在线 → 忙碌 | 好友列表显示"忙碌"，私聊提示"对方忙碌" |
| STATUS-03 | 在线 → 隐身 | 好友列表显示"离线"，实际仍在线 |
| STATUS-04 | WebSocket 实时广播状态变更 | 好友实时收到状态更新 |
| STATUS-05 | 自动检测 15 分钟无操作设为"离开" | 无操作后自动变为 away |

---

## 非功能项

### 9. 测试覆盖率提升

#### 目标

| 模块 | 当前覆盖率 | 目标覆盖率 |
|------|-----------|-----------|
| 后端语句覆盖 | 72.69% | ≥ 80% |
| 后端分支覆盖 | 57.59% | ≥ 70% |
| 后端函数覆盖 | 74.77% | ≥ 80% |

#### 待补充测试

| 模块 | 需补充场景 |
|------|-----------|
| ChatService | 群公告、邀请链接、置顶、书签、@提及、reaction 广播 |
| AuthService | 密码修改、账号删除、邮箱验证码 |
| NotificationService | 各类型通知的边界情况 |
| AgentModule | ToolCall 失败路径、记忆压缩、RAG 空结果 |
| FileUpload | 文件类型校验、大小限制、MinIO 错误处理 |

---

### 10. CI/CD 流水线完善

#### GitHub Actions 配置

```yaml
# 触发条件
on:
  push:
    branches: [main, 'feature/**', 'fix/**']
  pull_request:
    branches: [main]

# 当前已有: lint + test + typecheck + build + e2e
# 需补充:
#   - 自动部署到 staging (main 分支 push)
#   - Docker 镜像构建与推送
#   - 测试覆盖率报告上传 (Codecov)
#   - 自动生成 API 文档并发布到 GitHub Pages
```

---

### 11. E2E 测试补充

#### 当前 E2E 覆盖

- `login.spec.ts` — 登录流程
- `chat.spec.ts` — 聊天功能

#### 需补充场景

| 场景 | 说明 |
|------|------|
| 注册 → OAuth → 登出 | 完整认证流程 |
| 私聊 → 发送消息 → 接收 | 消息收发 E2E |
| 创建群聊 → 邀请成员 → 群聊消息 | 群聊完整流程 |
| AI Agent 对话 | Agent 消息发送与响应 |
| 文件上传与下载 | 上传 → 消息中展示 → 下载 |
| 通知流转 | 好友请求 → 通知产生 → 标记已读 |

---

## 执行顺序

```
Phase 1 (P0): 已读状态增强 + 消息编辑 (10h)
  └── 这两个功能依赖最小，价值最高

Phase 2 (P1): 批量操作 + @全体成员 (9h)
  ├── @全体成员: 快速实现，用户体验提升明显
  └── 批量操作: 消息管理效率提升

Phase 3 (P1): 频道功能 (10h)
  └── 需要较多后端逻辑 + 前端组件，独立开发不影响其他功能

Phase 4 (P2): 消息免打扰 + 自定义表情 + 在线状态 (12h)
  └── 按需实现，可作为体验打磨

Phase 5 (测试): 测试覆盖率 + E2E + CI/CD (20h)
  └── 贯穿始终，可与功能开发并行推进
```

---

## 数据库变更汇总

### 新增模型

```prisma
model MessageEdit {
  id        String   @id @default(uuid())
  messageId String   @map("message_id")
  content   String   @db.Text
  editedAt  DateTime @default(now()) @map("edited_at")
  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  @@index([messageId])
  @@map("message_edits")
}
```

### 现有模型变更

| 模型 | 变更 |
|------|------|
| `Message` | +`editCount` Int default 0 |
| `ChatSessionMember` | +`muted` Boolean default false, +`mutedUntil` DateTime? |
| `User` | status 枚举扩展 (online, offline, away, busy, invisible) |

---

## 版本里程碑

| 阶段 | 时间 | 交付物 |
|------|------|--------|
| Phase 1 | Day 1-2 | 已读状态增强 + 消息编辑 |
| Phase 2 | Day 3-4 | 批量操作 + @全体成员 |
| Phase 3 | Day 5-6 | 频道功能 |
| Phase 4 | Day 7-8 | 消息免打扰 + 表情面板 + 在线状态 |
| Phase 5 | 持续 | 测试、CI/CD、E2E |
| 发布 | Day 9 | v2.2.0 正式版 |

---

> 计划版本：v2.2.0
> 计划制定：2026-05-28
> 状态：待评审
