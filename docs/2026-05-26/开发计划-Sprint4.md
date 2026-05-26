# AI-Native Chat System — Sprint 4 开发计划

> **日期：** 2026-05-26
> **版本：** v2.1.0-dev
> **阶段：** 功能完善与体验增强
> **状态：** ✅ 全部完成

---

## 计划总览

| 优先级 | 功能模块 | 预计工时 | 实际工时 | 状态 |
|--------|---------|---------|---------|------|
| P0 | 全局消息搜索 | 4h | ~3h | ✅ 完成 |
| P0 | 文件上传系统完善 | 6h | ~4h | ✅ 完成 |
| P1 | 消息回复与转发 | 6h | ~5h | ✅ 完成 |
| P1 | 群聊增强 | 8h | ~6h | ✅ 完成 |
| P2 | 用户个人主页 | 4h | ~3h | ✅ 完成 |
| P2 | 消息收藏与会话置顶 | 4h | ~3h | ✅ 完成 |

### 附加修复

| 问题 | 根因 | 修复 |
|------|------|------|
| DOM 嵌套警告 | `<button>` 嵌套 `<button>` | 外层改为 `<div role="button">` |
| 表情回应不可用 | VirtualizedMessageList 未透传 onReaction | 补全 prop 链 |
| 表情不实时更新 | 无本地 store 更新和 WebSocket 广播 | 新增 addMessageReaction + socket reaction 监听/广播 |
| 消息气泡重叠 | getItemHeight 估算不足 | 各类型高度上调 30-60px |

---

## 1. 全局消息搜索 ✅

### 后端接口

```
GET /api/v1/chat/search?q=&sessionId=&types=&dateFrom=&dateTo=&page=&limit=

Response 200:
{
  "results": [
    {
      "message": { ... },
      "session": { "id": "xxx", "name": "xxx", "type": "PRIVATE" },
      "highlight": "匹配上下文..."
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 100 }
}
```

### 前端组件

- `GlobalSearchModal`: 模态搜索框，Ctrl+K 快捷键
- 搜索结果分组按会话，点击跳转

### 涉及文件

- `apps/api/src/modules/chat/chat.controller.ts` ✅
- `apps/api/src/modules/chat/chat.service.ts` ✅
- `apps/web/src/api/client.ts` ✅
- `apps/web/src/components/GlobalSearchModal/GlobalSearchModal.tsx` ✅
- `apps/web/src/pages/ChatLayout.tsx` ✅

---

## 2. 文件上传系统完善 ✅

### 后端接口

```
POST /api/v1/upload/files          — 上传文件 (multipart/form-data)
GET  /api/v1/upload/files/:id       — 获取文件信息
GET  /api/v1/upload/files/:id/download — 下载文件
```

### 前端组件

- `FileUploadPanel`: 拖拽/选择上传区域
- 上传进度条集成
- `MessageBubble` 支持图片点击放大 + 文件类型消息渲染

### 涉及文件

- `apps/api/src/modules/upload/upload.controller.ts` ✅
- `apps/api/src/modules/upload/upload.service.ts` ✅
- `apps/api/src/modules/upload/minio.service.ts` ✅
- `apps/web/src/components/FileUpload/FileUploadPanel.tsx` ✅
- `apps/web/src/components/MessageBubble/MessageBubble.tsx` ✅

---

## 3. 消息回复与转发 ✅

### 后端接口

```
POST /api/v1/chat/messages/:id/reply-context — 获取被回复消息上下文
POST /api/v1/chat/messages/forward            — 转发消息
{
  "messageId": "uuid",
  "targetSessionIds": ["uuid1", "uuid2"]
}
```

### 前端

- 消息气泡菜单「回复」→ 输入区引用条
- 消息气泡菜单「转发」→ ForwardModal 选择目标会话
- 被回复消息在气泡中以引用块显示

### 涉及文件

- `apps/api/src/modules/chat/chat.controller.ts` ✅
- `apps/api/src/modules/chat/chat.service.ts` ✅
- `apps/web/src/components/MessageBubble/MessageBubble.tsx` ✅
- `apps/web/src/components/ForwardModal/ForwardModal.tsx` ✅
- `apps/web/src/stores/chat.store.ts` ✅
- `apps/web/src/pages/PrivateChatPage.tsx` ✅

---

## 4. 群聊增强 ✅

### 后端接口

```
POST   /api/v1/chat/sessions/:id/announcement     — 设置/更新群公告
DELETE /api/v1/chat/sessions/:id/announcement     — 删除群公告
POST   /api/v1/chat/sessions/:id/invite-link       — 生成邀请链接
POST   /api/v1/chat/sessions/join-by-link          — 通过链接加入群聊
GET    /api/v1/chat/sessions/:id/members            — 群成员列表
```

### 前端

- 群聊详情面板：群公告显示/编辑入口
- 群成员列表 + 角色标识 (群主/管理员/成员)
- @提及输入触发器 + 成员选择器

### 涉及文件

- `apps/api/src/modules/chat/chat.controller.ts` ✅
- `apps/api/src/modules/chat/chat.service.ts` ✅
- `apps/web/src/components/GroupDetailPanel/GroupDetailPanel.tsx` ✅
- `apps/web/src/components/MentionPicker/MentionPicker.tsx` ✅
- `apps/web/src/pages/ChatLayout.tsx` ✅

---

## 5. 用户个人主页 ✅

### 后端接口

```
GET    /api/v1/users/profile        — 获取当前用户资料
PATCH  /api/v1/users/profile        — 更新资料
POST   /api/v1/users/avatar         — 上传头像
POST   /api/v1/auth/change-password — 修改密码
GET    /api/v1/users/profile/:id    — 查看他人资料
```

### 前端

- `ProfilePage`: 头像编辑、昵称、bio、修改密码
- `UserProfileCard`: 查看他人资料的弹窗

### 涉及文件

- `apps/api/src/modules/user/user.controller.ts` ✅
- `apps/api/src/modules/user/user.service.ts` ✅
- `apps/api/src/modules/auth/auth.controller.ts` ✅
- `apps/web/src/pages/ProfilePage.tsx` ✅
- `apps/web/src/components/UserProfileCard/UserProfileCard.tsx` ✅

---

## 6. 消息收藏与会话置顶 ✅

### 后端接口

```
POST   /api/v1/chat/messages/:id/bookmark — 收藏/取消收藏消息
GET    /api/v1/chat/bookmarks              — 获取收藏列表
PATCH  /api/v1/chat/sessions/:id/pin      — 置顶/取消置顶会话
```

### 前端

- 消息菜单「收藏」按钮
- 收藏面板查看所有收藏消息
- 会话列表置顶会话优先显示

### 涉及文件

- `apps/api/src/modules/chat/chat.controller.ts` ✅
- `apps/api/src/modules/chat/chat.service.ts` ✅
- `apps/web/src/stores/chat.store.ts` ✅
- `apps/web/src/components/BookmarkPanel/BookmarkPanel.tsx` ✅
- `apps/web/src/components/SessionList/SessionList.tsx` ✅

---

## 执行顺序

```
P0 (必须) → P1 (推荐) → P2 (按需)
```

优先完成 P0 的全局消息搜索和文件上传系统，随后 P1 的消息回复转发和群聊增强，最后 P2 的用户主页和收藏功能。
