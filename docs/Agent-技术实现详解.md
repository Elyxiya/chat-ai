# AI Agent 系统 — 技术实现详解

> 项目：`new-chat-system`（`ai-native-chat`）
>
> 基于 NestJS + PostgreSQL(pgvector) + Redis + DeepSeek 构建的 AI-Native 智能对话系统

---

## 目录

1. [技术栈概览](#1-技术栈概览)
2. [整体架构设计](#2-整体架构设计)
3. [LLM 提供层 — DeepSeek 集成](#3-llm-提供层--deepseek-集成)
4. [Agent 编排器 — 三种处理管线](#4-agent-编排器--三种处理管线)
5. [意图分类](#5-意图分类)
6. [ReAct 循环 — 思考-行动-观察](#6-react-循环--思考-行动-观察)
7. [Plan-and-Execute — 计划与执行](#7-plan-and-execute--计划与执行)
8. [工具注册与执行系统](#8-工具注册与执行系统)
9. [三层记忆系统](#9-三层记忆系统)
10. [RAG 检索增强生成](#10-rag-检索增强生成)
11. [SSE 流式传输 — 结构化事件](#11-sse-流式传输--结构化事件)
12. [Socket.IO WebSocket AI 聊天](#12-socketio-websocket-ai-聊天)
13. [知识库管理](#13-知识库管理)
14. [前端 Agent Store](#14-前端-agent-store)
15. [数据库模型与 pgvector](#15-数据库模型与-pgvector)
16. [总结：能力速查](#16-总结能力速查)

---

## 1. 技术栈概览

### 后端

| 技术 | 用途 |
|------|------|
| **NestJS** (Node.js) | 后端框架，模块化架构 |
| **TypeScript** | 全栈语言 |
| **PostgreSQL + pgvector** | 主数据库 + 向量嵌入存储与相似度搜索 |
| **Redis** | 短期记忆缓存（30分钟TTL） |
| **Prisma ORM** | 数据库 ORM，支持原生 SQL 查询 |
| **DeepSeek API** | 主要 LLM 提供者（deepseek-chat / deepseek-reasoner） |
| **OpenAI API** | Embedding 备选提供者 |
| **Socket.IO** | WebSocket 实时通信 |
| **Axios** | HTTP 客户端调用 LLM API |
| **mathjs** | 数学计算工具（Agent 工具之一） |
| **@nestjs/swagger** | API 文档 |

### 前端

| 技术 | 用途 |
|------|------|
| **Vite + React** | 构建工具与 UI 框架 |
| **Zustand** | 轻量状态管理（替代 Pinia） |
| **TypeScript** | 类型安全 |
| **Fetch API** | SSE 流式消费（非 Axios） |

---

## 2. 整体架构设计

### 模块结构

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Module                          │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │         Agent Orchestrator (编排器)                │    │
│  │    - process()       同步处理                      │    │
│  │    - streamProcess() 原始流式处理                   │    │
│  │    - streamProcessWithEvents() 结构化事件流         │    │
│  └────────────┬─────────────────────────┬────────────┘    │
│               │                         │                  │
│       ┌───────▼───────┐         ┌───────▼────────┐        │
│       │  Planning     │         │  Tool Registry │        │
│       │  Engine       │         │  (13 个工具)    │        │
│       │  - 意图分类    │         │                │        │
│       │  - ReAct 循环  │         │  - 知识库搜索   │        │
│       │  - 计划执行    │         │  - 用户查询     │        │
│       │  - 反思重试    │         │  - 发送消息     │        │
│       └───────┬───────┘         │  - 数学计算     │        │
│               │                  │  - 网页搜索     │        │
│       ┌───────▼───────┐         │  - 天气查询     │        │
│       │  Memory       │         │  - ...          │        │
│       │  Service      │         └─────────────────┘        │
│       │  (3 层记忆)    │                                    │
│       └───────┬───────┘                                    │
│               │                                             │
│       ┌───────▼───────┐                                    │
│       │  RAG Engine   │                                    │
│       │  (向量检索)    │                                    │
│       └───────────────┘                                    │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                  LLM Module                               │
│  ┌────────────────┐  ┌────────────────────────────────┐  │
│  │ DeepSeek       │  │ Embedding Service               │  │
│  │ Provider       │  │  - DeepSeek Embed (备选)        │  │
│  │ - v3: chat     │  │  - OpenAI Embed (推荐)          │  │
│  │ - r1: reasoner │  └────────────────────────────────┘  │
│  └────────────────┘                                      │
└─────────────────────────────────────────────────────────┘
```

### 数据处理流

```
用户输入
    │
    ▼
┌─────────────────────┐
│ 1. 意图分类 (LLM)    │ ─── simple / complex / reasoning / creative
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 2. 策略选择          │
│    ├─ simple/creative ──► ReAct 循环
│    ├─ complex ──────────► Plan-and-Execute
│    └─ reasoning ───────► ReAct (使用 r1 模型)
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 3. 上下文构建        │
│    ├─ 短期记忆 (Redis)│
│    ├─ 长期记忆 (SQL)  │
│    └─ RAG 知识 (向量) │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 4. 推理-行动循环      │
│    ├─ LLM 推理        │
│    ├─ 工具调用        │
│    └─ 观察反馈        │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 5. 输出             │
│    ├─ 同步: JSON     │
│    └─ 流式: SSE      │
└─────────────────────┘
```

---

## 3. LLM 提供层 — DeepSeek 集成

### 3.1 接口抽象 (`llm-provider.interface.ts`)

```typescript
interface LLMProvider {
  chat(prompt, options?): Promise<string>;          // 同步对话
  chatStream(prompt, options?): AsyncGenerator<string>;  // 纯文本流
  chatStreamWithReasoning(prompt, options?):         // 带思考链的流
    AsyncGenerator<{ type: 'reasoning'|'content', data: string }>;
  embed(text): Promise<number[]>;                   // 向量嵌入
  isAvailable(): Promise<boolean>;                   // 健康检查
}
```

### 3.2 DeepSeek 双模型支持

| 模型别名 | 实际模型 | 特点 | 应用场景 |
|----------|----------|------|----------|
| `v3` | `deepseek-chat` | 通用对话，支持温度控制 | 意图分类、普通对话、计划生成 |
| `r1` | `deepseek-reasoner` | 深度推理，显示思考链 | 复杂推理、数学问题、逻辑分析 |

### 3.3 思考模式（Thinking Mode）

```typescript
private buildExtraBody(options?: LLMOptions): Record<string, any> {
  if (!options?.thinking) return {};
  return { thinking: { type: 'enabled' } };
}
```

- 开启思考模式时：`extra_body.thinking = { type: 'enabled' }`，此时**不传温度参数**
- 关闭思考模式时：传 `temperature`、`top_p` 等参数
- `reasoningEffort` 映射：`low/medium -> high`，`xhigh -> max`

### 3.4 SSE 流解析 (`chatStreamWithReasoning`)

```typescript
// 核心逻辑：逐行解析 SSE 中的 reasoning_content 和 content
const response = await axios.post(url, body, {
  responseType: 'stream',
  signal: AbortSignal.timeout(timeoutMs),
});

const nodeStream = response.data;
const webStream = Readable.toWeb(nodeStream);
const reader = webStream.getReader();
const decoder = new TextDecoder();

// 逐行读取 SSE chunks
// 解析 delta.reasoning_content → yield { type: 'reasoning', data }
// 解析 delta.content         → yield { type: 'content', data }
```

**关键细节：**
- 使用 `AbortSignal.timeout()` 控制超时（默认 120 秒）
- Node.js `Readable.toWeb()` 将 Node Stream 转为 Web Stream
- 流式解析 SSE，累计 buffer 按行分割
- 收到 `[DONE]` 标记结束

### 3.5 Embedding 双提供者

```typescript
class EmbeddingService {
  private readonly provider: 'deepseek' | 'openai';

  async embed(text: string): Promise<number[]> {
    switch (this.provider) {
      case 'openai':  return this.embedOpenAI(text);   // 推荐
      case 'deepseek': return this.embedDeepSeek(text); // 备选
    }
  }
}
```

- **推荐 OpenAI** `text-embedding-3-small`（1536 维）
- **备选 DeepSeek** `deepseek-embedding`（部分端点可能返回 404）
- 返回空数组时 RAG 检索降级为空结果

---

## 4. Agent 编排器 — 三种处理管线

`AgentOrchestrator` 是 Agent 的入口，根据模式和意图选择不同的处理策略。

### 4.1 同步管线 `process()`

```
用户输入 → 添加短期记忆 → 意图分类
  ├─ complex  → planAndExecute() → 最终响应
  └─ 其他     → executeReAct()  → 最终响应
```

### 4.2 原始流式管线 `streamProcess()`

```
用户输入 → 添加短期记忆 → 意图分类
  ├─ complex  → streamPlanAndExecute() (yield 文本块)
  └─ 其他     → streamReAct() (yield 文本块)
```

### 4.3 增强结构化事件流 `streamProcessWithEvents()`

```
用户输入 → 添加短期记忆 → 意图分类
  ├─ mode=planner / complex → streamPlanAndExecuteWithEvents()
  ├─ mode=reasoner / reasoning → streamReActWithEvents(reasoning模式)
  └─ 其他 → streamReActWithEvents()
```

**结构化事件类型：**

| 事件 | 说明 | 数据 |
|------|------|------|
| `start` | 开始 | `{ sessionId }` |
| `step` | 步骤状态 | `{ step, status }` |
| `reasoning` | 思考过程 | `{ step, content }` |
| `chunk` | 文本块 | `{ content }` |
| `thinking_done` | 思考完成 | `{ step, reasoning }` |
| `tool_call` | 工具调用 | `{ name, args }` |
| `tool_result` | 工具结果 | `{ name, result }` |
| `final` | 最终答案 | `{ content, reasoning }` |
| `done` | 完成 | `{}` |
| `error` | 错误 | `{ message }` |

### 4.4 记忆持久化

每次处理完成后，调用 `finalize()`：将 assistant 响应写入短期记忆；若 `metadata.important` 为 true，则写入长期记忆（episodic 类型）。

---

## 5. 意图分类

### 5.1 分类 Prompt

```typescript
const prompt = `分析以下用户输入，判断其类型：

用户输入：${input}

类型说明：
- simple: 简单问答或闲聊，不需要工具调用
- complex: 复杂任务，需要多个步骤或工具调用
- reasoning: 需要深度推理和思考的问题
- creative: 创意生成任务（写作、代码等）

请只输出JSON格式：{"type":"类型","confidence":0.0-1.0,"reason":"原因"}`;
```

### 5.2 配置参数

- **模型**：`v3`（deepseek-chat）
- **温度**：`0.1`（低温度保证分类一致性）
- **最大 Token**：200
- **降级策略**：JSON 解析失败时，默认返回 `{ type: 'simple', confidence: 0.5 }`

### 5.3 分类映射到策略

| 分类结果 | 处理策略 | LLM 模型 |
|----------|----------|----------|
| `simple` | ReAct 循环 | v3 |
| `creative` | ReAct 循环 | v3 |
| `complex` | Plan-and-Execute | v3 |
| `reasoning` | ReAct 循环 | **r1**（深度推理） |

---

## 6. ReAct 循环 — 思考-行动-观察

### 6.1 原理

ReAct（Reasoning + Acting）是一种让 LLM **交替进行推理和行动**的 Agent 范式。每轮循环中，LLM 先思考当前状况，然后决定是调用工具还是直接回答。

```
循环 (最多 10 步):
  ┌────────────────────────────────────┐
  │  思考: 分析问题，决定下一步方案        │
  │  ↓                                 │
  │  行动: 调用工具 / 给出最终答案        │
  │  ↓                                 │
  │  观察: 工具执行结果反馈              │
  │  ↓                                 │
  │  (回到思考，或结束)                  │
  └────────────────────────────────────┘
```

### 6.2 ReAct Prompt

```typescript
system: `你是一个智能助手，通过推理和工具调用来完成任务。

可用工具：
${tools}

上下文：
${context}

推理格式：
思考：<你的推理过程>
行动：<工具名称>(<参数JSON>)
或者：
思考：<你的推理过程>
最终答案：<直接回答用户>

注意：
- 只使用列表中的工具
- 参数必须严格匹配工具描述
- 如果问题可以直接回答，使用"最终答案"
- 最多执行${MAX_REACT_STEPS}步`

user: `任务：${input}

历史：${history}
当前观察：${observation || '无'}
步骤 ${step}/${MAX_REACT_STEPS}`
```

### 6.3 响应解析 (`parseThought`)

```typescript
// 1. 剥离 r1 模型的 <think>...</think> 块
text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');

// 2. 处理 r1 模型的 <final_answer>...</final_answer>
const r1FinalMatch = text.match(/<final_answer>([\s\S]*?)<\/final_answer>/i);

// 3. 解析标准格式
const thoughtMatch = text.match(/思考[：:]\s*(.+?)(?=\n行动[：:]|最终答案[：:])/s);
const toolMatch = text.match(/行动[：:]\s*(\w+)\s*\(\s*(\{[^}]*\})?\s*\)/s);
const finalMatch = text.match(/最终答案[：:]\s*(.+)/s);
```

**三种解析结果：**

| 匹配到 | 动作类型 | 说明 |
|--------|----------|------|
| `行动：search_users({"query":"张三"})` | `tool` | 执行工具调用 |
| `最终答案：你好！我是AI助手` | `final` | 返回最终答案 |
| 未匹配到动作 | 无动作 | 若超出最大步数则返回兜底消息 |

### 6.4 流式 ReAct 事件 (`streamReActWithEvents`)

```
Step 1:
  yield { type: 'step', data: { step: 1, status: 'thinking' } }
  // LLM 流式输出
  yield { type: 'reasoning', data: { step: 1, content: '我需要查询用户信息...' } }
  yield { type: 'chunk', data: { content: '' } }  // 可能为空
  yield { type: 'thinking_done', data: { step: 1, reasoning: '...' } }

  // 若调用工具
  yield { type: 'tool_call', data: { name: 'calculate', args: { expression: '2+2' } } }
  // 执行工具...
  yield { type: 'tool_result', data: { name: 'calculate', result: { success: true, result: 4 } } }

Step 2:
  yield { type: 'step', data: { step: 2, status: 'thinking' } }
  // ... 继续

最终:
  yield { type: 'final', data: { content: '结果是4', reasoning: '...' } }
```

---

## 7. Plan-and-Execute — 计划与执行

### 7.1 原理

对于**复杂任务**（意图分类为 `complex`），Agent 不直接 ReAct，而是先生成**步骤计划**，然后按顺序执行，最后**反思结果**，必要时**重试**。

```
┌──────────────────────────────────────────┐
│  1. createPlan(): 生成步骤计划           │
│     输入: 用户任务 + 可用工具 + 上下文    │
│     输出: STEP-1: 描述 | 工具 | 参数      │
│           STEP-2: 描述 | 工具 | 参数      │
│           ...                            │
├──────────────────────────────────────────┤
│  2. 顺序执行每个步骤                      │
│     每个步骤: 解析工具 → 调用 → 记录结果   │
│     状态: pending → completed / failed   │
├──────────────────────────────────────────┤
│  3. reflect(): LLM 反思执行结果           │
│     输出: { needsRetry, summary, feedback }│
├──────────────────────────────────────────┤
│  4. 若 needsRetry && 有失败步骤           │
│     → retry(): 基于反馈生成改进计划 → 重执行│
├──────────────────────────────────────────┤
│  5. summarizer: LLM 汇总最终结果          │
└──────────────────────────────────────────┘
```

### 7.2 计划生成 Prompt

```typescript
const prompt = `你是一个任务规划专家。用户需要完成以下任务：

任务：${input}
可用工具：${tools}
背景信息：${context}

请将任务拆解为清晰的步骤序列。每个步骤格式：
STEP-[序号]: 描述 | 工具名称 | 参数JSON

只输出步骤序列，不要其他内容。`;
```

### 7.3 计划解析

使用正则 `STEP-(\d+):\s*(.+?)\s*\|\s*(\w+)\s*(?:\|)?\s*(\{.*?\})?` 解析步骤，支持：
- `STEP-1: 获取用户信息 | get_user_info | {"userId":"abc"}`
- `STEP-2: 发送问候消息 | send_message`

### 7.4 反思 Prompt

```typescript
const prompt = `任务：${input}
执行结果：
${plan.steps.map(s => `- ${s.description}: ${s.status === 'completed' ? '成功 ✓' : '失败 ✗'}`).join('\n')}

请反思：
1. 任务是否成功完成？
2. 有哪些失败的步骤？原因是什么？
3. 如何改进？

输出JSON：{"needsRetry":true/false,"summary":"最终总结","feedback":"改进建议"}`;
```

### 7.5 面试问答要点

| 问题 | 回答 |
|------|------|
| **ReAct 和 Plan-and-Execute 本质区别？** | ReAct 是「边想边做」，每步推理后立即决策，适合动态任务；Plan-and-Execute 是「先想再做」，规划好所有步骤再执行，适合确定性多步骤任务。 |
| **最大步数限制的意义？** | 防止 LLM 无限循环或过度思考消耗 Token。ReAct 10 步、Plan 20 步是成本与效能的平衡点。 |
| **反思失败后重试会无限重试吗？** | 不会，`retry()` 只执行一次。如果仍失败，返回首次计划的执行结果而非无限循环。 |

---

## 8. 工具注册与执行系统

### 8.1 架构

```
ToolRegistry (单例)
  │
  ├── Map<string, ToolDefinition>  // 名称 -> 工具定义
  │
  ├── register(tool)     // 注册工具
  ├── execute(name, args, ctx)  // 执行 + 校验 + 权限
  ├── getToolDescriptions()     // 供 LLM 使用的描述文本
  └── getTools()                // 获取所有工具定义
```

### 8.2 13 个内置工具

| 工具名 | 描述 | 关键参数 | 权限 |
|--------|------|----------|------|
| `search_knowledge_base` | 知识库向量搜索 | query, topK | 公开 |
| `get_user_info` | 查用户详情 | userId | 公开 |
| `send_message` | 发送消息到会话 | sessionId, content | **需会话成员** |
| `search_users` | 搜索用户 | query | 公开 |
| `create_chat_session` | 创建会话 | name, sessionType, memberIds | 公开 |
| `get_conversation_history` | 查私聊历史 | userId, limit | 公开 |
| `get_friends_list` | 好友列表 | 无 | 公开 |
| `calculate` | 数学计算 | expression (mathjs) | 公开 |
| `get_online_friends` | 在线好友 | 无 | 公开 |
| `record_metric` | 记录指标 | metricType, metricValue | 公开 |
| `web_search` | 互联网搜索 | query (DuckDuckGo) | 公开 |
| `get_time` | 当前时间 | timezone | 公开 |
| `get_weather` | 查询天气 | city (wttr.in) | 公开 |

### 8.3 工具定义结构

```typescript
interface ToolDefinition {
  name: string;                    // 唯一名称
  description: string;             // LLM 理解的功能描述
  parameters: Record<string, {     // 参数 Schema
    type: string;
    description: string;
    required?: boolean;
  }>;
  requiresSessionMembership?: boolean; // 敏感操作权限标记
  handler: (args, ctx) => Promise<any>; // 实际执行函数
}
```

### 8.4 权限校验

```typescript
async execute(toolName, args, ctx) {
  // 1. 查找工具
  // 2. 校验会话成员权限（敏感工具）
  if (tool.requiresSessionMembership) {
    const member = await prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId: ctx.userId } },
    });
    if (!member) throw new Error('You are not a member of this session');
  }
  // 3. 参数校验 (validateArgs)
  // 4. 执行 handler
  // 5. 日志记录 (通过 MemoryService.logToolCall)
}
```

### 8.5 面试问答要点

| 问题 | 回答 |
|------|------|
| **工具调用如何保证参数正确？** | 两重校验：LLM 生成的参数通过 `validateArgs()` 检查必需字段；执行前通过 TypeScript 类型约束。 |
| **`requiresSessionMembership` 的设计意图？** | 防止 Agent 在未授权的会话中发送消息，类似 OAuth 的作用域（scope）机制。 |
| **工具执行失败如何处理？** | 在 ReAct 循环中作为 `observation` 反馈给 LLM，LLM 可决定重试或更换策略。 |

---

## 9. 三层记忆系统

### 9.1 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                   Memory Service                          │
│                                                           │
│  ┌─────────────────┐   ┌──────────────────┐              │
│  │  短期记忆 (Redis) │   │  工作记忆 (Redis) │              │
│  │  TTL: 30 分钟    │   │  TTL: 5 分钟     │              │
│  │  LPUSH + LTRIM   │   │  SET/GET 键值    │              │
│  │  最大 100 条     │   │  单次会话上下文   │              │
│  └────────┬────────┘   └──────────────────┘              │
│           │                                                │
│  ┌────────▼───────────────────────────────────────┐       │
│  │          长期记忆 (PostgreSQL)                    │       │
│  │  表: agent_memories                              │       │
│  │  类型: episodic(事件) / semantic(语义) / long_term │       │
│  │  排序: importanceScore DESC                      │       │
│  │  向量: embedding vector(1536)  (用于语义检索)     │       │
│  └────────────────────────────────────────────────┘       │
│                                                           │
│  ┌────────────────────────────────────────────────┐       │
│  │       记忆压缩 (summarizeAndCompress)           │       │
│  │  触发: 短期记忆 > 10 条时                      │       │
│  │  动作: LLM 总结 → 存为 semantic 记忆 → 清空短期  │       │
│  └────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

### 9.2 短期记忆（Redis）

```typescript
// 存储
redis.lpush(`memory:short:${userId}`, JSON.stringify(message));
redis.ltrim(`memory:short:${userId}`, 0, 99);     // 最大 100 条
redis.expire(`memory:short:${userId}`, 30 * 60);  // 30 分钟 TTL

// 读取
const raw = redis.lrange(`memory:short:${userId}`, 0, limit - 1);
return raw.map(JSON.parse).filter(Boolean).reverse(); // 按时间正序
```

### 9.3 长期记忆（PostgreSQL）

通过 `storeLongTermMemory()` 写入 `agent_memories` 表：
- `memoryType`: `episodic`（对话事件）/ `semantic`（语义知识）/ `long_term`
- `embedding`: vector(1536) 向量
- `importanceScore`: 重要性评分，用于排序
- `expiresAt`: 过期时间

### 9.4 记忆检索 (`getRelevantMemories`)

```typescript
// 按用户 + 类型 + 重要性排序
const memories = await prisma.agentMemory.findMany({
  where: {
    userId,
    memoryType: { in: ['episodic', 'semantic', 'long_term'] },
    AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
  },
  orderBy: { importanceScore: 'desc' },
  take: topK,  // 默认 5 条
});
```

> **注意：** 当前实现使用 `importanceScore DESC` 排序，而非向量相似度检索。这意味着检索到的是「最重要的」记忆，而非「最相关的」。可以通过后续迭代改用 `pgvector` 的 `<=>` 操作符实现语义检索。

### 9.5 记忆压缩 (`summarizeAndCompress`)

**触发条件：** 短期记忆超过 10 条

**流程：**
1. 读取 50 条短期记忆
2. LLM 总结关键信息（200 字以内）
3. 存储为 `semantic` 类型的长期记忆
4. 清空短期记忆

```typescript
const summaryPrompt = `请总结以下对话的关键信息，保留重要的用户偏好和事实：

${recentMemories.map(m => `${m.role}: ${m.content}`).join('\n')}

简洁总结（200字以内）：`;
```

### 9.6 上下文构建 (`buildContext`)

```typescript
private async buildContext(userId: string, input: string): Promise<string> {
  const memories = await this.memory.getRelevantMemories(userId, input, 5);
  const knowledge = await this.ragEngine.retrieve(input, userId, 3);

  let context = '';
  if (memories.length) {
    context += `相关记忆：\n${memories.map(m => `- ${m.content}`).join('\n')}\n\n`;
  }
  if (knowledge) {
    context += `相关知识：\n${knowledge}\n\n`;
  }
  return context;
}
```

### 9.7 面试问答要点

| 问题 | 回答 |
|------|------|
| **为什么短期记忆用 Redis 而非数据库？** | Redis 基于内存，LPUSH/LRANGE 操作 O(1)，支持 TTL 自动过期，非常适合高频读写的对话上下文。 |
| **长期记忆为什么不用向量检索？** | 当前版本使用 `importanceScore` 降序排列，是简化实现。后续可升级为 `pgvector` 的 `<=>` 向量相似度检索，实现语义级记忆召回。 |
| **记忆压缩解决了什么问题？** | 防止短期记忆无限增长消耗 Token（每次 ReAct Prompt 都会携带历史）。压缩后保留精华，减少 Token 消耗的同时不丢失关键信息。 |

---

## 10. RAG 检索增强生成

### 10.1 架构

```
用户查询 → EmbeddingService → 1536维向量
                                │
                                ▼
                    PostgreSQL (pgvector)
                    SELECT 1 - (embedding <=> $vector) AS score
                    FROM knowledge_chunks
                    ORDER BY score DESC
                    LIMIT topK
                                │
                                ▼
                    格式化上下文 → 注入 ReAct Prompt
```

### 10.2 向量检索实现

```sql
SELECT id, content, metadata,
  1 - (embedding <=> ${queryEmbedding}::vector) AS score
FROM knowledge_chunks
WHERE kb_id = ${kbId}
ORDER BY embedding <=> ${queryEmbedding}::vector
LIMIT ${topK}
```

- 使用 `<=>` 余弦距离操作符
- `1 - distance` 转换为相似度分数（0~1 之间）
- 维度：1536（与 `text-embedding-3-small` 一致）

### 10.3 文本分块 (`chunkAndStore`)

```typescript
private splitText(text: string, chunkSize: number, overlap: number): string[] {
  const sentences = text.match(/[^.!?。！？]+[.!?。！？]+/g) || [text];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length <= chunkSize) {
      current += sentence;
    } else {
      if (current) chunks.push(current.trim());
      current = current.slice(-overlap) + sentence;
    }
  }
}
```

- **分块策略**：按句子边界分割（支持中英文标点）
- **覆盖窗口**：前后块重叠 overlap 个字符，保证语义连续性
- **默认参数**：chunkSize=500, overlap=50

---

## 11. SSE 流式传输 — 结构化事件

### 11.1 服务端实现

使用 NestJS `@Res() res: Response` 手动管理 SSE 响应：

```typescript
@Post('chat/stream/enhanced')
async chatStreamEnhanced(@Res() res: Response) {
  // 设置 SSE 头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // 禁用 Nagle 算法，确保即时推送
  res.socket?.setNoDelay(true);

  // 推送事件
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}
```

**关键配置：**
- `X-Accel-Buffering: no` — 禁用 Nginx 缓冲（生产环境）
- `socket.setNoDelay(true)` — 禁用 Nagle 算法
- `flushHeaders()` — 强制刷出头，让客户端提前收到 Content-Type

### 11.2 超时控制

```typescript
const timeoutSignal = AbortSignal.timeout(timeoutMs);
timeoutSignal.addEventListener('abort', () => {
  res.write(`data: ${JSON.stringify({ type: 'error', message: 'Stream timed out' })}\n\n`);
  res.end();
});
```

### 11.3 前端消费（Fetch API）

```typescript
// 前端通过 fetch + ReadableStream 消费 SSE
const response = await fetch('/api/v1/agent/chat/stream/enhanced', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ message: content, mode }),
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value, { stream: true });
  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    if (!rawLine.startsWith('data: ')) continue;
    const event = JSON.parse(rawLine.slice(6));

    switch (event.type) {
      case 'reasoning': /* 更新思考过程 */ break;
      case 'chunk':     /* 累积文本内容 */ break;
      case 'tool_call': /* 显示工具调用 */ break;
      case 'final':     /* 最终结果 */ break;
      case 'done':      /* 完成处理 */ break;
    }
  }
}
```

### 11.4 面试问答要点

| 问题 | 回答 |
|------|------|
| **为什么不用 WebSocket 而用 SSE？** | SSE 基于 HTTP，天然兼容 REST 架构，支持自动重连、无需额外协议升级。SSE 是单向推送，适合 Agent 流式输出的场景。 |
| **SSE 和 WebSocket 的取舍？** | SSE 适用于**服务端到客户端**的流式推送，浏览器原生支持。WebSocket 适用于双向实时通信。项目中两者并存：REST SSE 用于 Agent 流式输出，Socket.IO 用于聊天消息。 |
| **`setNoDelay(true)` 的作用？** | 禁用 Nagle 算法。Nagle 会合并小数据包后再发送，导致流式输出延迟。禁用后每个 `res.write()` 立即推送。 |

---

## 12. Socket.IO WebSocket AI 聊天

### 12.1 集成方式

除了 REST SSE，Agent 还通过 Socket.IO 提供 WebSocket 通道的 AI 对话，消息类型 `WsMessageType.AI_CHAT = 12`。

### 12.2 AI_CHAT 处理流程

```typescript
case WsMessageType.AI_CHAT: {
  const { sessionId, content } = payload.data;

  // 1. 广播 "AI 正在输入" 事件
  client.to(`session:${sessionId}`).emit('ai_typing', { sessionId });

  // 2. 流式获取 AI 回复
  let fullResponse = '';
  const stream = await this.chatGatewayService.streamAIResponse(user.id, content);
  for await (const chunk of stream) {
    fullResponse += chunk;
    client.emit('ai_chunk', { sessionId, content: chunk });  // 逐块推送
  }

  // 3. 存储完整回复到数据库
  const aiMessage = await this.chatGatewayService.sendMessage(
    user.id, sessionId,
    { content: fullResponse, contentType: 'ai_response', metadata: { source: 'deepseek' } },
  );

  // 4. 广播最终消息
  this.server.to(`session:${sessionId}`).emit('message', aiMessage);
  client.emit('ai_done', { sessionId, messageId: aiMessage.id });
  break;
}
```

### 12.3 事件一览

| 事件方向 | 事件名 | 说明 |
|----------|--------|------|
| 服务端→客户端 | `ai_typing` | AI 开始生成 |
| 服务端→客户端 | `ai_chunk` | 逐块文本流 |
| 服务端→客户端 | `ai_done` | 生成完成，含消息 ID |
| 服务端→客户端 | `message` | 最终消息广播到会话 |
| 客户端→服务端 | `join_agent` | 加入 Agent 会话 |

### 12.4 面试问答要点

| 问题 | 回答 |
|------|------|
| **为什么要同时支持 REST SSE 和 Socket.IO？** | SSE 适用于 Agent 独立页面，协议简洁，便于调试；Socket.IO 适用于聊天场景，Agent 回复在聊天窗口中与其他消息统一展示。 |
| **`ai_chunk` 和最终 `message` 的关系？** | `ai_chunk` 是实时流式中间结果，用于前端逐字显示；`message` 是入库后的完整消息，用于消息历史和持久化。 |

---

## 13. 知识库管理

### 13.1 数据模型

```
KnowledgeBase (知识库)
  ├── id, name, description
  ├── ownerId, isPublic
  ├── chunkSize, chunkOverlap, embeddingModel
  │
  ├── KnowledgeDocument (上传的文档)
  │   ├── fileName, fileSize, fileType
  │   ├── status, totalChunks, processedChunks
  │   │
  │   └── KnowledgeChunk (文档分块)
  │       ├── content (文本)
  │       ├── embedding (vector(1536))
  │       └── chunkIndex, metadata
  │
  └── (也可直接添加文本内容)
```

### 13.2 完整流程

```
用户上传文档 / 添加文本
  → chunkAndStore() 分块 + 生成嵌入向量
  → 存储到 knowledge_chunks 表
  → Agent 调用 search_knowledge_base 工具时
    → 用户查询 → embedding → pgvector 相似度搜索 → 返回上下文
```

---

## 14. 前端 Agent Store

### 14.1 Zustand Store 设计

```typescript
interface AgentState {
  isAgentMode: boolean;        // 是否处于 Agent 模式
  messages: AgentMessage[];    // 消息历史
  streamingContent: string;    // 当前流式内容
  isStreaming: boolean;        // 是否正在流式接收
  typingSpeed: number;         // 打字速度
  mode: 'react' | 'planner' | 'reasoner';  // 当前模式
  toolCalls: ToolCallEntry[];  // 工具调用记录
  reasoningSteps: ReasoningStep[];  // 思考步骤
  currentStep: number;         // 当前步骤
  error: string | null;        // 错误信息
  sessionId: string | null;    // Agent 会话 ID
  pendingMessage: string | null;  // 防止重复发送
}
```

### 14.2 流式消息消费

```typescript
sendStreamMessage: async (content) => {
  // 1. 防重复校验
  if (isStreaming) return;
  if (pendingMessage === content) return;

  // 2. 发送 SSE 请求
  const response = await fetch('/api/v1/agent/chat/stream/enhanced', { ... });

  // 3. 读取事件流
  const reader = response.body?.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // 解析 SSE data: 行
    // 分发 reasoning / chunk / tool_call / final / done 事件
  }
}
```

### 14.3 去重保护

```typescript
let hasFinalized = false; // 防止 done 事件的重复处理

// chunk 事件：仅当未 finalize 时累积
case 'chunk':
  if (!hasFinalized) { fullContent += event.data?.content; }
  break;

// done 事件：仅处理一次
case 'done':
  if (hasFinalized || fullContent) {
    // 添加 assistant 消息
    hasFinalized = true;
  }
  break;
```

---

## 15. 数据库模型与 pgvector

### 15.1 核心 AI 相关表

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `agent_memories` | 长期记忆 | `memoryType`, `content(JSONB)`, `embedding(vector(1536))`, `importanceScore` |
| `agent_conversations` | 对话历史 | `mode`, `messages(JSONB)`, `contextSummary` |
| `agent_tool_logs` | 工具调用日志 | `toolName`, `toolInput(JSONB)`, `executionTimeMs`, `success` |
| `agent_metrics` | AI 使用指标 | `metricType`, `metricValue`, `metadata(JSONB)` |
| `knowledge_bases` | 知识库 | `chunkSize`, `chunkOverlap`, `isPublic` |
| `knowledge_documents` | 知识库文档 | `status`, `totalChunks`, `processedChunks` |
| `knowledge_chunks` | 知识库分块 | `content`, `embedding(vector(1536))`, `metadata(JSONB)` |

### 15.2 pgvector 使用

```sql
-- 创建扩展
CREATE EXTENSION vector;

-- 相似度查询
SELECT 1 - (embedding <=> $query_vector) AS score
FROM knowledge_chunks
ORDER BY embedding <=> $query_vector
LIMIT $topK;

-- 插入向量（通过 Prisma $executeRaw）
INSERT INTO knowledge_chunks (id, kb_id, content, embedding)
VALUES (gen_random_uuid(), $kbId, $content, $embedding::vector(1536));
```

### 15.3 用户类型的 Agent 扩展

`User` 模型支持 `userType: 'human' | 'bot' | 'agent'`，`ChatSession` 支持 `sessionType: 'agent'`，为未来 Agent 作为独立聊天参与者打下基础。

---

## 16. 总结：能力速查

| 能力 | 实现技术 | 关键参数/限制 |
|------|----------|---------------|
| **LLM 接入** | DeepSeek API (deepseek-chat / deepseek-reasoner) | 超时 120s, temperature 0.1~0.7 |
| **流式输出** | SSE (REST) + Socket.IO (WebSocket) | 支持思考链 + 内容分块 |
| **Agent 范式** | ReAct + Plan-and-Execute | ReAct 最大 10 步, Plan 最大 20 步 |
| **意图分类** | LLM 自分类 (simple/complex/reasoning/creative) | temperature 0.1, JSON 输出 |
| **工具系统** | 13 个内置工具，动态注册 | 支持参数校验 + 权限控制 |
| **短期记忆** | Redis List (TTL 30min, 最大 100 条) | LPUSH + LTRIM |
| **长期记忆** | PostgreSQL agent_memories (importanceScore 排序) | `episodic` / `semantic` 类型 |
| **记忆压缩** | LLM 总结短期记忆 → 转存为语义记忆 | 触发条件 >10 条 |
| **RAG 检索** | pgvector 余弦相似度 `<=>` | 1536 维, 支持分块 + overlap |
| **知识库** | 用户自建知识库，支持文档上传 + 文本添加 | 可配置 chunkSize/overlap |
| **思考模式** | DeepSeek thinking mode | `extra_body.thinking = enabled` |
| **重试机制** | 反思 + 重试 (Plan-and-Execute) | 最多 1 次重试 |
| **速率限制** | @nestjs/throttler | 每日 100 次 (AI_DAILY_LIMIT) |
| **认证** | JWT (NestJS Guard) | 所有 Agent 端点需鉴权 |
| **前端状态** | Zustand (防重复提交 + 流式事件解析) | 支持 react/planner/reasoner 模式 |
