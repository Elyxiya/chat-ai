# AI-Native Chat System — 下一阶段开发计划

> **日期：** 2026-05-31
> **当前版本：** v2.4.x（Sprint 7 功能基本完成）
> **状态：** 📋 待确认

---

## 当前项目状态

### ✅ 已合并到 main 的功能

| 功能 | 版本 | 状态 |
|------|------|------|
| 频道(Channel) / i18n / Emoji Picker / CI-CD | v2.3.0 | ✅ 完成 |
| WebRTC 音视频通话 / 富文本编辑器 / 消息搜索增强 | v2.4.x | ✅ 完成 |
| E2E 测试（auth/chat/agent/notification） | — | ✅ 完成 |
| 20 个单元测试（Sprint 5/6 功能） | — | ✅ 完成 |

### ❌ 待完成

| 任务 | 优先级 | 说明 |
|------|--------|------|
| 消息收藏增强（标签 + 备注） | P2 | Bookmark 模型增加 tags/note，标签筛选 |
| 微信 OAuth 登录 | P2 | 微信扫码登录 |
| 前端测试覆盖率（41% → 70%） | P2 | 13 个页面/组件 + 3 个新组件 |
| 后端分支覆盖率（57% → 70%） | P2 | ChatGateway / KnowledgeService / AgentModule |
| PostgreSQL tsvector 全文搜索 | P1 | 替换当前 ILIKE 模糊搜索 |
| Docker Compose 生产调优 | P2 | healthcheck + 日志轮转 + 资源限制 |

---

## 执行计划

每个功能的开发遵循 **开发功能 → 开发计划 → 功能测试** 的完整流程。

---

### 1. P1 — 消息收藏增强（标签 + 备注）

#### 📋 开发计划（Development Plan）

**背景：** 当前 Bookmark 仅有 `userId + messageId` 的简单关联，用户无法对收藏的消息进行分类和备注。

**需求：**
- 支持收藏时添加标签（如 `work`、`important`）
- 支持为收藏添加个人备注
- 支持按标签筛选收藏列表
- 支持搜索收藏消息内容

**数据库变更：**
```prisma
model Bookmark {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  messageId String   @map("message_id")
  tags      String[] @default([])       // 新增
  note      String?  @db.Text           // 新增
  createdAt DateTime @default(now()) @map("created_at")

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, messageId])
  @@map("bookmarks")
}
```

**涉及文件：**

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/api/prisma/schema.prisma` | 修改 | Bookmark 新增 tags + note 字段 |
| `apps/api/src/modules/chat/chat.controller.ts` | 修改 | 新增 PATCH `/messages/:id/bookmark`（更新标签/备注）；新增 GET `/bookmarks/search?tag=` |
| `apps/api/src/modules/chat/chat.service.ts` | 修改 | updateBookmark、searchBookmarksByTag |
| `apps/web/src/stores/chat.store.ts` | 修改 | 新增 updateBookmark、searchBookmarks action |
| `apps/web/src/components/BookmarkPanel/BookmarkPanel.tsx` | 修改 | 标签筛选 tabs + 搜索框 + 备注编辑弹窗 |
| `apps/web/src/components/MessageBubble/MessageBubble.tsx` | 修改 | 收藏弹窗中增加标签选择器 + 备注输入 |
| `apps/web/src/types/index.ts` | 修改 | Bookmark 类型扩展 |

**API 设计：**

```
PATCH /api/v1/chat/messages/:id/bookmark
Request: { tags?: string[], note?: string }
Response: { bookmark: { ... } }

GET /api/v1/chat/bookmarks/search?tag=work&q=keyword
Response: { bookmarks: [...], total: N }
```

#### 🔧 开发功能（Implementation）

1. 修改 Prisma schema → `pnpm db:push`
2. 实现 `chat.service.ts` — `updateBookmark()` 和 `searchBookmarksByTag()`
3. 实现 `chat.controller.ts` — 新增两个端点
4. 前端 `chat.store.ts` — 新增 `updateBookmark`、`searchBookmarks` action
5. 前端 `BookmarkPanel.tsx` — 标签筛选栏 + 搜索框 + 备注编辑
6. 前端 `MessageBubble.tsx` — 收藏弹窗增加标签选择和备注输入

#### 🧪 功能测试（Testing）

**后端测试用例：**

| ID | 用例 | 预期结果 |
|----|------|---------|
| BOOK-API-01 | 收藏消息时添加 tags `["work","important"]` | 数据库 tags 包含两个标签 |
| BOOK-API-02 | 更新已有收藏的 note | note 内容更新成功 |
| BOOK-API-03 | 按 tag 搜索收藏 | 只返回匹配标签的收藏 |
| BOOK-API-04 | 按关键词搜索收藏内容 | 返回匹配消息内容的收藏 |
| BOOK-API-05 | 清空 tags | tags 变为空数组 |
| BOOK-API-06 | 收藏不存在的消息 | 返回 404 |

**前端测试用例：**

| ID | 用例 | 预期结果 |
|----|------|---------|
| BOOK-WEB-01 | BookmarkPanel 显示标签筛选栏 | 标签 tabs 渲染，点击筛选 |
| BOOK-WEB-02 | 添加标签后 UI 更新 | 标签显示在收藏卡片上 |
| BOOK-WEB-03 | 编辑备注弹窗 | 弹窗打开，保存后备注更新 |
| BOOK-WEB-04 | 搜索收藏消息 | 搜索结果实时过滤 |
| BOOK-WEB-05 | 标签自动补全已有标签 | 输入时显示已有标签建议 |

---

### 2. P1 — PostgreSQL 全文搜索（tsvector）

#### 📋 开发计划（Development Plan）

**背景：** 当前 `globalSearch()` 使用 `ILIKE '%keyword%'` 查询，在大数据量下性能急剧下降。升级为 PostgreSQL 原生全文搜索（tsvector）。

**需求：**
- 消息表新增 tsvector 列 + GIN 索引
- 触发器自动维护 tsvector（新消息插入/更新时自动更新）
- 查询使用 `ts_query` + `ts_rank` 排序，提升搜索性能和相关性
- 支持中文分词（通过 pg_trgm 或简单分词兜底）

**方案：** 通过原始 SQL 管理（不修改 Prisma schema 文件），在应用启动或手动执行迁移。

```sql
-- 迁移 SQL
ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_messages_search_vector
  ON messages USING GIN(search_vector);

CREATE OR REPLACE FUNCTION messages_search_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_messages_search_vector
  BEFORE INSERT OR UPDATE OF content ON messages
  FOR EACH ROW EXECUTE FUNCTION messages_search_update();
```

**涉及文件：**

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/api/prisma/migrations/tsvector.sql` | **新建** | 迁移 SQL 脚本 |
| `apps/api/src/modules/chat/chat.service.ts` | 修改 | `globalSearch()` 改用 `ts_query` + `ts_rank` |
| `apps/api/src/modules/common/migration.service.ts` | **新建** | 启动时自动执行未应用迁移 |

#### 🔧 开发功能（Implementation）

1. 编写迁移 SQL
2. 实现 MigrationService 自动执行
3. 修改 `globalSearch()` — 先用 tsvector 查询，失败降级 ILIKE
4. 测试搜索相关度排序

#### 🧪 功能测试（Testing）

| ID | 用例 | 预期结果 |
|----|------|---------|
| TSV-01 | 搜索关键词"会议" | 返回包含"会议"的消息，按 ts_rank 排序 |
| TSV-02 | 搜索空结果 | 返回空数组 + total: 0 |
| TSV-03 | 搜索中文内容 | tsvector 正确分词 |
| TSV-04 | 跨会话搜索结果按相关度排序 | 最高 ts_rank 的会话排最前 |
| TSV-05 | ILIKE 降级（tsvector 不可用时） | 自动回退到 ILIKE 查询 |

---

### 3. P2 — 微信 OAuth 登录

#### 📋 开发计划（Development Plan）

**背景：** 已支持 GitHub、Google OAuth，需增加微信扫码登录，扩展用户接入方式。

**需求：**
- 登录页显示微信登录按钮
- 点击跳转微信 OAuth 授权页
- 回调后获取微信用户信息，创建/关联本地用户
- 复用现有 OAuthAccount 模型

**流程：**
```
Web → 微信 OAuth → 重定向到 /api/v1/auth/oauth/wechat
                  → 获取 code → 后端换取 access_token
                  → 获取用户信息（openid, nickname, avatar）
                  → 创建/关联本地用户
                  → 返回 JWT tokens
```

**涉及文件：**

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/api/src/modules/auth/auth.controller.ts` | 修改 | 新增 wechat OAuth 端点 |
| `apps/api/src/modules/auth/auth.service.ts` | 修改 | wechat token 交换 + 用户信息获取 |
| `apps/web/src/pages/LoginPage.tsx` | 修改 | 新增微信登录按钮 |

#### 🔧 开发功能（Implementation）

1. 后端 `auth.service.ts` — `wechatLogin(code)` 方法
2. 后端 `auth.controller.ts` — `POST /auth/oauth/wechat` 端点
3. 前端 `LoginPage.tsx` — 微信登录按钮 + 跳转逻辑

#### 🧪 功能测试（Testing）

| ID | 用例 | 预期结果 |
|----|------|---------|
| WECHAT-01 | 有效 code 登录 | 成功获取用户信息，返回 JWT tokens |
| WECHAT-02 | 无效 code | 返回 401 错误 |
| WECHAT-03 | 首次登录（新用户） | 自动创建用户 + OAuthAccount |
| WECHAT-04 | 重复登录（已有绑定） | 返回已有用户的 JWT tokens |
| WECHAT-05 | 微信头像同步 | 用户 avatarUrl 更新为微信头像 |

---

### 4. P2 — 前端测试覆盖率攻坚

#### 📋 开发计划（Development Plan）

**目标：** 41.33% → ≥ 70%

**测试框架：** Vitest v4 + React Testing Library + jsdom

**Mock 策略：** 使用现有模式（vi.mock store/api、MemoryRouter 包裹、vi.hoisted 初始化）

**需新建测试文件：**

| 测试文件 | 覆盖模块 |
|---------|---------|
| `pages/KnowledgePage.spec.tsx` | 知识库列表、文档管理、上传 |
| `pages/SettingsPage.spec.tsx` | 主题切换、语言切换、密码修改 |
| `pages/AgentChatPage.spec.tsx` | 模式切换、流式对话、清空记忆 |
| `pages/AdminPage.spec.tsx` | 用户管理表格、系统设置、审计日志 |
| `pages/ProfilePage.spec.tsx` | 头像上传、资料编辑、改密 |
| `components/NotificationPanel/NotificationPanel.spec.tsx` | 通知列表操作 |
| `components/FileUpload/FileUploadPanel.spec.tsx` | 拖拽上传、进度条 |
| `components/GlobalSearchModal/GlobalSearchModal.spec.tsx` | 搜索交互、快捷键 |
| `components/ForwardModal/ForwardModal.spec.tsx` | 会话选择、转发 |
| `components/GroupDetailPanel/GroupDetailPanel.spec.tsx` | 群公告、成员列表 |
| `components/VirtualizedMessageList/VirtualizedMessageList.spec.tsx` | 虚拟滚动 |
| `components/ChannelList/ChannelList.spec.tsx` | 频道列表、订阅 |
| `components/RichTextEditor/RichTextEditor.spec.tsx` | 编辑器功能、工具栏 |
| `components/CallWindow/CallWindow.spec.tsx` | 通话窗口、媒体控制 |
| `stores/knowledge.store.spec.ts` | 知识库 store |
| `stores/notification.store.spec.ts` | 通知 store |

#### 🔧 开发功能（Implementation）

逐个文件编写测试，覆盖正常渲染、用户交互、加载状态、空状态、错误状态。

#### 🧪 测试执行

```
pnpm --filter ai-native-chat-web test:coverage
# 验证覆盖率 ≥ 70%
```

---

### 5. P2 — 后端测试覆盖率攻坚

#### 📋 开发计划（Development Plan）

**目标：** 分支覆盖率 57.59% → ≥ 70%

**重点模块：**

| 模块 | 新增测试场景 |
|------|------------|
| ChatGateway（chat.gateway.spec.ts） | `call:*` 信令事件（offer/answer/ice-candidate/reject/end/toggle） |
| NotificationService | 静音检查（muted sessions）、批量删除、@all 批量通知 |
| KnowledgeService | FileParserService 编码检测（UTF-8/GBK/PDF）、文档删除级联 |
| AgentModule | ToolCall 异常路径、RAG 空结果降级、流式中断恢复 |
| FileUpload | 文件类型校验、大小限制超限、MinIO 连接失败 |

#### 🔧 开发功能（Implementation）

在现有 `*.spec.ts` 文件中追加测试用例，遵循现有命名约定（`MODULE-TYPE-NUMBER`）。

#### 🧪 测试执行

```
pnpm --filter ai-native-chat-api test -- --coverage
# 验证分支覆盖率 ≥ 70%
```

---

### 6. P2 — Docker Compose 生产调优

#### 📋 开发计划（Development Plan）

**需求：**
- 所有服务添加 `healthcheck` 健康检查
- Nginx 日志轮转配置
- 容器资源限制（CPU / Memory）
- PostgreSQL 持久化卷配置优化

#### 🔧 开发功能（Implementation）

| 文件 | 改动 |
|------|------|
| `docker/docker-compose.yml` | 所有服务添加 healthcheck + resource limits |
| `docker/nginx.conf` | 日志轮转配置 |

#### 🧪 功能测试（Testing）

```
docker compose up -d
docker compose ps                    # 确认所有服务 healthy
docker compose logs api --tail=50    # 检查启动日志
```

---

## 执行顺序建议

```
         Week 1                           Week 2
┌─────────────────────┐    ┌──────────────────────────┐
│ 1. 消息收藏增强      │    │ 4. 前端测试覆盖率攻坚      │
│    （开发→计划→测试）  │    │    （每个组件开发→测试）    │
├─────────────────────┤    ├──────────────────────────┤
│ 2. tsvector 全文搜索  │    │ 5. 后端测试覆盖率攻坚      │
│    （开发→计划→测试）  │    │    （每个模块开发→测试）    │
├─────────────────────┤    ├──────────────────────────┤
│ 3. 微信 OAuth 登录   │    │ 6. Docker 生产调优        │
│    （开发→计划→测试）  │    │    （配置→验证）          │
└─────────────────────┘    └──────────────────────────┘
```

每个功能独立分支，开发完成后执行 `功能测试（Testing）` 章节的全部用例，通过后合并。

---

> 请确认这个计划是否合适？我可以调整优先级或增减任务。
> 确认后，我按顺序从第一个功能开始执行。
