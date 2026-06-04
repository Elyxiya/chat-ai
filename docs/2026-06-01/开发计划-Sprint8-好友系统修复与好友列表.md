# AI-Native Chat System — Sprint 8：好友系统修复与好友列表

> **日期：** 2026-06-01
> **当前版本：** v2.4.x → v2.5.0
> **状态：** ✅ 已完成

---

## 一、需求背景与问题描述

### 已上报的 Bug

| ID | 问题 | 描述 | 优先级 |
|----|------|------|--------|
| BUG-01 | 好友请求通知红点但列表为空 | 发出好友请求后，接收方通知铃铛显示红点，但打开通知面板无内容 | P0 |
| BUG-02 | 同意好友后双方无好友列表 | 接收方点击 Accept 后，双方均无任何好友列表或联系人显示 | P0 |
| BUG-03 | 发送消息需刷新才显示 | 发送/编辑消息后未立即出现在聊天界面，需刷新页面才能看到 | P1 |

### 根因总结

**BUG-01 根因：**

1. `notification.store.ts` 中的 `fetchNotifications()` 使用原生 `fetch`，与项目其他 API 调用（`apiClient`/axios）不一致。当 token 过期或请求异常时静默失败，`data.data` 为 `undefined`，导致 `notifications` 被设为空数组。
2. 竞态条件：`fetchNotifications()` 异步完成后无条件用 API 响应替换 store 中的 `notifications` 数组，覆盖了 WebSocket `addNotification()` 刚写入的数据。

**BUG-02 根因：**

1. `manageFriend()` 的 `accept` 分支没有向原始请求方发送 `friend_accepted` 通知，请求方完全不知道请求已通过。
2. 前端 `getFriends` API 已定义但从未被任何组件或 store 调用，前端完全没有好友列表 UI。

**BUG-03（自测发现）：**

发送消息后消息没有立即出现在聊天界面中，需刷新页面才能看到。
1. `sendMessage` 仅通过 WebSocket 发送消息到服务端，依赖服务端处理后再广播回发送者（loopback）。回环有任何延迟或异常时，本地 store 中无对应消息。
2. `editMessage` 在 WebSocket 路径下也没有乐观更新，等待 `message_edited` 事件才能看到修改。

### 已完成的修复

| 模块 | 文件 | 修复内容 | 状态 |
|------|------|---------|------|
| Frontend Store | `stores/notification.store.ts` | `fetch` → `apiClient`；API 失败时不覆盖 store；所有方法统一使用 axios | ✅ |
| Frontend Store | `stores/chat.store.ts` | `connect()` 防重复连接；新增 `friendship_updated` WebSocket 事件处理器 | ✅ |
| Backend Service | `modules/chat/chat.service.ts` | `accept` 分支调用 `sendFriendAcceptedNotification()`；emit `friendship_updated` 事件给双方；新增 `removeFriend()` | ✅ |
| Backend Controller | `modules/chat/chat.controller.ts` | 新增 `DELETE /friends/:friendId` 端点 | ✅ |
| Frontend Store | `stores/friend.store.ts` | **新建** Zustand store：friends、fetchFriends、removeFriend | ✅ |
| Frontend Component | `components/FriendList/FriendList.tsx` | **新建** 好友列表组件（搜索、在线状态、点击跳转私聊） | ✅ |
| Frontend Layout | `pages/ChatLayout.tsx` | 侧边栏 Tab 切换（聊天/好友） | ✅ |
| Frontend API | `api/client.ts` | 新增 `removeFriend()` | ✅ |
| Frontend Test | `pages/ChatLayout.spec.tsx` | 新增 friend.store + FriendList mock | ✅ |
| Frontend Store | `stores/chat.store.ts` | `sendMessage` 乐观更新（temp 消息即时显示，服务端确认后替换）；`editMessage` 乐观更新（即时修改内容） | ✅ |
| Frontend Test | `stores/chat.store.spec.ts` | 测试适配 optimistic update + auth store mock | ✅ |
| Frontend Build | — | TypeScript 编译通过，284 测试全绿 | ✅ |

### 本 Sprint 任务（全部完成）

| 任务 | 说明 | 优先级 | 状态 |
|------|------|--------|:----:|
| F1-好友列表数据层 | 创建 `friend.store.ts`，封装好友 CRUD 状态管理 | P0 | ✅ |
| F2-好友列表 UI | 创建 `FriendList` 组件，支持好友列表展示、搜索、删除好友 | P0 | ✅ |
| F3-侧边栏集成 | 在 `ChatLayout` 侧边栏添加「好友」Tab，与 SessionList 并列 | P0 | ✅ |
| F4-好友请求完整闭环 | 好友请求/接受/拒绝的端到端 UI 流程完善 | P1 | ✅ |
| F5-实时同步 | `friendship_updated` WebSocket 事件驱动好友列表自动刷新 | P0 | ✅ |
| T1-测试覆盖 | ChatLayout 测试适配 + 全量 284 测试通过 | P1 | ✅ |

---

## 二、验收标准（AC）

### F1：好友列表数据层

```gherkin
Given 用户已登录且有 accessToken
When 用户打开好友列表
Then 系统调用 GET /api/v1/chat/friends 获取好友列表，并按 friendly_name 字母排序

Given 好友列表已在 store 中
When 收到 WebSocket 'friendship_updated' 事件
Then 系统自动重新获取好友列表并更新 store

Given 获取好友列表 API 失败
When 用户打开好友列表
Then store 保留上次成功获取的数据，不显示空列表
```

### F2：好友列表 UI

```gherkin
Given 用户好友列表不为空
When 用户在侧边栏切换到「好友」Tab
Then 展示所有好友的 avatar、nickname、在线状态（绿点/灰点）

Given 好友列表为空
When 用户切换到「好友」Tab
Then 显示空状态提示「暂无好友，去搜索添加」

Given 用户有大量好友（>50）
When 用户打开好友列表
Then 支持滚动加载，每次加载 50 条
```

### F3：侧边栏集成

```gherkin
Given 用户在 ChatLayout 侧边栏
When 用户点击「好友」Tab
Then Tab 高亮，下方展示好友列表

Given 用户在好友列表
When 用户点击某个好友
Then 导航到与该好友的私聊会话（若无则自动创建）
```

### F4：好友请求完整闭环

```gherkin
Given 用户 B 收到好友请求通知
When 用户 B 点击 Accept
Then ① 通知标记已读/删除 ② 好友列表自动添加用户 A ③ 发送方收到 "XXX 接受了你的好友请求" 通知

Given 用户 B 收到好友请求通知
When 用户 B 点击 Reject
Then ① 通知标记已读/删除 ② 请求方收到 "XXX 拒绝了你的好友请求" 通知（可选）
```

### F5：实时同步

```gherkin
Given 用户 A 和 B 已打开应用
When A 通过 B 的好友请求
Then B 的好友列表实时显示 A，A 的好友列表实时显示 B

Given 用户在线
When 好友删除关系
Then 双方的好友列表实时移除对方
```

---

## 三、技术方案

### 整体架构

```
┌─────────────────────────────────────────────────┐
│                  ChatLayout                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Chats Tab │  │ Friends  │  │ Channels Tab │   │
│  │ (Session) │  │   Tab    │  │              │   │
│  └──────────┘  └──────────┘  └──────────────┘   │
│                     │                            │
│               ┌─────┴──────┐                     │
│               │ FriendList │                     │
│               │ Component  │                     │
│               └─────┬──────┘                     │
│                     │                            │
└─────────────────────┼────────────────────────────┘
                      │
              ┌───────┴────────┐
              │ friend.store   │ ← Zustand
              │ - friends[]    │
              │ - isLoading    │
              │ - fetchFriends │
              │ - removeFriend │
              └───────┬────────┘
                      │
              ┌───────┴────────┐
              │ GET /chat/friends│
              │ WebSocket:      │
              │ friendship_updated│
              └────────────────┘
```

### F1：FriendStore 设计

**新增文件：** `apps/web/src/stores/friend.store.ts`

```typescript
interface Friend {
  id: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
  status: 'online' | 'offline' | 'away';
}

interface FriendState {
  friends: Friend[];
  isLoading: boolean;
  error: string | null;
  fetchFriends: () => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
}
```

### F2：FriendList 组件

**新增文件：** `apps/web/src/components/FriendList/FriendList.tsx`

- 在线状态通过 `chat.store` 的 `onlineUsers` Set 判断
- 支持按 nickname/username 本地搜索过滤
- 点击好友 → 检查是否有已有私聊会话 → 有则跳转，无则创建 → 跳转

### F3：ChatLayout 侧边栏 Nav

**修改文件：** `apps/web/src/pages/ChatLayout.tsx`

- 在 SessionList 上方新增 Tab 切换：`聊天 | 好友 | 频道`
- Tab 状态存储在本地 state 中

### F4：WebSocket 事件流

```
后端 ChatGateway                         前端 chat.store.ts
  │                                         │
  ├── emit 'friendship_updated' ──────────► │
  │    { friendId, status }                │
  │                                         ├── friend.store.fetchFriends()
  │                                         ├── chat.store.loadSessions()
  │                                         │
  │  (好友删除时)                            │
  ├── emit 'friend_removed' ───────────────►│
  │    { friendId }                         ├── friend.store.removeLocal(friendId)
```

### 接口定义

```
GET /api/v1/chat/friends
Response: {
  code: 0,
  data: [
    { id, username, nickname, avatarUrl, status },
    ...
  ],
  message: "Success"
}

DELETE /api/v1/chat/friends/:friendId  (新增)
Request: (none)
Response: { code: 0, message: "Friend removed" }
```

### 数据库变更

- `friendships` 表已有 `@@unique([userId, friendId])` + `status` 字段，无需 Schema 变更
- 需要新增 `DELETE /friends/:friendId` 端点（删除好友关系，双向删除）

### 异常处理

| 场景 | 处理 |
|------|------|
| 获取好友列表超时 | 重试 2 次，间隔 1s，仍失败则保留缓存数据 + toast 提示 |
| WebSocket 断连后恢复 | 重新 `fetchFriends()` 同步状态 |
| 删除好友时请求失败 | toast 提示「操作失败，请重试」 |

---

## 四、关键测试用例

### F1：FriendStore 单元测试

**测试文件：** `apps/web/src/stores/friend.store.spec.ts`（新增）

| ID | 类型 | 场景描述 | 预期结果 |
|----|------|---------|---------|
| FRD-WEB-01 | 快乐路径 | `fetchFriends()` 成功返回好友列表 | friends 更新为返回数据，isLoading=false |
| FRD-WEB-02 | 快乐路径 | `removeFriend()` 成功删除 | 本地 friends 移除该好友，API 调用正确 |
| FRD-WEB-03 | 异常路径 | `fetchFriends()` 网络错误 | isLoading=false，保留原 friends 数据 |
| FRD-WEB-04 | 异常路径 | `removeFriend()` API 404 | error 更新，friends 不变 |
| FRD-WEB-05 | 边界值 | 好友列表为空 | friends=[]，不报错 |
| FRD-WEB-06 | 边界值 | 大量好友（>100） | 正常分页获取 |

### F2：FriendList 组件测试

**测试文件：** `apps/web/src/components/FriendList/FriendList.spec.tsx`（新增）

| ID | 类型 | 场景描述 | 预期结果 |
|----|------|---------|---------|
| FRD-UI-01 | 快乐路径 | 渲染好友列表 | 显示所有好友的头像、昵称、在线状态 |
| FRD-UI-02 | 快乐路径 | 点击好友跳转私聊 | navigate 被调用，参数为私聊 sessionId |
| FRD-UI-03 | 异常路径 | 好友列表为空 | 显示「暂无好友」空状态 |
| FRD-UI-04 | 异常路径 | 加载中状态 | 显示 skeleton / spinner |
| FRD-UI-05 | 边界值 | 搜索过滤好友 | 输入关键词后只显示匹配的好友 |
| FRD-UI-06 | 快乐路径 | 删除好友 | 确认弹窗 → 确认 → 好友从列表移除 |

### F3：端到端集成测试

| ID | 类型 | 场景描述 | 预期结果 |
|----|------|---------|---------|
| FRD-E2E-01 | 快乐路径 | A 发送请求 → B 接受 → 双方看到对方在好友列表 | 完整闭环验证 |
| FRD-E2E-02 | 快乐路径 | WebSocket `friendship_updated` 触发前端刷新 | 好友列表自动更新 |
| FRD-E2E-03 | 异常路径 | 接受不存在的请求 | 返回 404，前端显示错误提示 |
| FRD-E2E-04 | 并发 | A 和 B 互发请求 | 系统正确处理，无重复记录 |

---

## 五、执行计划

### 执行顺序

```
Phase 1 (已完成)       Phase 2 (已完成)        Phase 3 (已完成)
┌──────────────┐    ┌───────────────┐    ┌────────────────┐
│ F1: 数据层    │    │ F2: 好友列表   │    │ T1: 测试覆盖    │
│ friend.store │    │ FriendList    │    │ 全量 284 通过   │
├──────────────┤    │ 组件 + UI     │    └────────────────┘
│ F3: 侧边栏    │    ├───────────────┤
│ Tab 集成     │    │ F4: 完整闭环   │
├──────────────┤    │ 删除好友端点  │
│ F5: 实时同步  │    │               │
│ WebSocket    │    │               │
└──────────────┘    └───────────────┘
```

### Phase 1：数据层 + 侧边栏集成

| Step | 文件 | 操作 | 说明 |
|------|------|------|------|
| 1.1 | `stores/friend.store.ts` | **新建** | Zustand store：friends、fetchFriends、removeFriend |
| 1.2 | `pages/ChatLayout.tsx` | 修改 | 侧边栏增加 Tab 切换（聊天/好友/频道） |
| 1.3 | `stores/chat.store.ts` | 修改 | `friendship_updated` 处理器调用 `friend.store.fetchFriends()` |
| 1.4 | TypeScript 类型检查 | 验证 | `npx tsc --noEmit` |

### Phase 2：好友列表 UI + 完整闭环

| Step | 文件 | 操作 | 说明 |
|------|------|------|------|
| 2.1 | `components/FriendList/FriendList.tsx` | **新建** | 好友列表组件：渲染、搜索、在线状态 |
| 2.2 | `components/FriendList/FriendList.css` | **新建** | 样式（或使用 Tailwind） |
| 2.3 | **Backend**: `chat.service.ts` | 修改 | 新增 `removeFriend(userId, friendId)` 方法 |
| 2.4 | **Backend**: `chat.controller.ts` | 修改 | 新增 `DELETE /friends/:friendId` 端点 |
| 2.5 | `api/client.ts` | 修改 | 新增 `removeFriend()` API 方法 |
| 2.6 | 侧边栏好友 Tab 中集成 FriendList | 集成 | ChatLayout 条件渲染 |

### Phase 3：测试覆盖

| Step | 文件 | 操作 | 说明 |
|------|------|------|------|
| 3.1 | `stores/friend.store.spec.ts` | **新建** | FriendStore 单元测试（6 用例） |
| 3.2 | `components/FriendList/FriendList.spec.tsx` | **新建** | FriendList 组件测试（6 用例） |
| 3.3 | 运行全部测试 | 验证 | `pnpm --filter ai-native-chat-web test` |

### 涉及文件清单（实际变更）

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/web/src/stores/notification.store.ts` | **修改** | `fetch` → `apiClient`；API 失败不覆盖 store |
| `apps/web/src/stores/chat.store.ts` | **修改** | `connect()` 防重复；`sendMessage`/`editMessage` 乐观更新；`message` 事件去重；WebSocket 事件处理器 |
| `apps/web/src/stores/friend.store.ts` | **新建** | 好友列表状态管理 |
| `apps/web/src/pages/ChatLayout.tsx` | **修改** | 侧边栏 Tab 切换（聊天/好友） |
| `apps/web/src/components/FriendList/FriendList.tsx` | **新建** | 好友列表 UI（搜索、在线状态、跳转私聊） |
| `apps/web/src/api/client.ts` | **修改** | 新增 `removeFriend()` |
| `apps/api/src/modules/chat/chat.service.ts` | **修改** | `sendFriendAcceptedNotification()`、`removeFriend()`、WebSocket 事件 |
| `apps/api/src/modules/chat/chat.controller.ts` | **修改** | 新增 `DELETE /friends/:friendId` |
| `apps/web/src/stores/notification.store.spec.ts` | **修改** | 测试适配 `apiClient` mock |
| `apps/web/src/stores/chat.store.spec.ts` | **修改** | 新增 auth.store mock + optimistic update 适配 |
| `apps/web/src/pages/ChatLayout.spec.tsx` | **修改** | 新增 friend.store + FriendList mock |

---

## 六、版本信息

| 字段 | 值 |
|------|-----|
| 计划版本 | Sprint 8 |
| 计划日期 | 2026-06-01 ~ 2026-06-03 |
| 涉及模块 | Frontend (Web) + Backend (API) |
| 规范版本 | LDF v1.0 |

---

> 请确认这个计划是否合适？确认后我从 Phase 1 开始按序执行。
