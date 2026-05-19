import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { ChatService } from '../../chat/chat.service';
import { ToolDefinition, AgentContext } from '../types';

@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly tools: Map<string, ToolDefinition> = new Map();

  constructor(private readonly prisma: PrismaService) {
    this.registerBuiltInTools();
  }

  private registerBuiltInTools() {
    this.register({
      name: 'search_knowledge_base',
      description: '搜索业务知识库，获取相关文档和答案。使用此工具获取知识库中的信息。',
      parameters: {
        query: { type: 'string', description: '搜索查询', required: true },
        topK: { type: 'number', description: '返回结果数量，默认5' },
      },
      handler: async ({ query, topK = 5 }, ctx) => {
        const { RagEngine } = await import('../rag/rag-engine.service');
        const rag = new RagEngine(this.prisma);
        const results = await rag.retrieve(query, ctx.userId, topK);
        return results;
      },
    });

    this.register({
      name: 'get_user_info',
      description: '获取指定用户的详细信息',
      parameters: {
        userId: { type: 'string', description: '用户ID', required: true },
      },
      handler: async ({ userId }, ctx) => {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, username: true, nickname: true, avatarUrl: true, bio: true, status: true },
        });
        return user;
      },
    });

    this.register({
      name: 'send_message',
      description: '向指定会话发送消息',
      parameters: {
        sessionId: { type: 'string', description: '会话ID', required: true },
        content: { type: 'string', description: '消息内容', required: true },
        contentType: { type: 'string', description: '消息类型，默认text' },
      },
      requiresSessionMembership: true,
      handler: async ({ sessionId, content, contentType = 'text' }, ctx) => {
        const message = await this.prisma.message.create({
          data: { sessionId, senderId: ctx.userId, content, contentType },
          include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
        });
        return message;
      },
    });

    this.register({
      name: 'search_users',
      description: '搜索用户',
      parameters: {
        query: { type: 'string', description: '搜索关键词', required: true },
      },
      handler: async ({ query }, ctx) => {
        const users = await this.prisma.user.findMany({
          where: {
            id: { not: ctx.userId },
            OR: [
              { username: { contains: query, mode: 'insensitive' } },
              { nickname: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: 10,
          select: { id: true, username: true, nickname: true, avatarUrl: true, status: true },
        });
        return users;
      },
    });

    this.register({
      name: 'create_chat_session',
      description: '创建一个新的聊天会话',
      parameters: {
        name: { type: 'string', description: '会话名称', required: true },
        sessionType: { type: 'string', description: '会话类型: private/group/channel/agent' },
        memberIds: { type: 'array', description: '成员ID列表' },
      },
      handler: async ({ name, sessionType = 'group', memberIds = [] }, ctx) => {
        const session = await this.prisma.chatSession.create({
          data: {
            sessionType,
            name,
            ownerId: ctx.userId,
            members: {
              create: [
                { userId: ctx.userId, role: 'owner' },
                ...memberIds.map((id: string) => ({ userId: id as string })),
              ],
            },
          },
          include: {
            members: { include: { user: { select: { id: true, username: true } } } },
          },
        });
        return session;
      },
    });

    this.register({
      name: 'get_conversation_history',
      description: '获取与指定用户的私聊历史',
      parameters: {
        userId: { type: 'string', description: '对方用户ID', required: true },
        limit: { type: 'number', description: '消息数量限制，默认20' },
      },
      handler: async ({ userId, limit = 20 }, ctx) => {
        const session = await this.prisma.chatSession.findFirst({
          where: {
            sessionType: 'private',
            AND: [
              { members: { some: { userId: ctx.userId } } },
              { members: { some: { userId } } },
            ],
          },
          include: {
            messages: {
              where: { isRecalled: false },
              orderBy: { createdAt: 'desc' },
              take: limit,
              include: {
                sender: { select: { id: true, username: true, avatarUrl: true } },
              },
            },
          },
        });
        return session?.messages?.reverse() || [];
      },
    });

    this.register({
      name: 'get_friends_list',
      description: '获取当前用户的好友列表',
      parameters: {},
      handler: async (_, ctx) => {
        const friendships = await this.prisma.friendship.findMany({
          where: { OR: [{ userId: ctx.userId }, { friendId: ctx.userId }], status: 'accepted' },
          include: {
            user: { select: { id: true, username: true, avatarUrl: true, status: true } },
            friend: { select: { id: true, username: true, avatarUrl: true, status: true } },
          },
        });
        return friendships.map((f) => (f.userId === ctx.userId ? f.friend : f.user));
      },
    });

    this.register({
      name: 'calculate',
      description: '执行数学计算',
      parameters: {
        expression: { type: 'string', description: '数学表达式', required: true },
      },
      handler: async ({ expression }) => {
        try {
          const mathjsModule = await import('mathjs');
          const mathjs = mathjsModule.create(mathjsModule.all);
          const result = mathjs.evaluate(expression);
          return { expression, result, type: typeof result };
        } catch (error) {
          return { expression, error: error.message };
        }
      },
    });

    this.register({
      name: 'get_online_friends',
      description: '获取当前在线的好友列表',
      parameters: {},
      handler: async (_, ctx) => {
        const friendships = await this.prisma.friendship.findMany({
          where: { OR: [{ userId: ctx.userId }, { friendId: ctx.userId }], status: 'accepted' },
        });

        const friendIds = friendships.map((f) => (f.userId === ctx.userId ? f.friendId : f.userId));

        const users = await this.prisma.user.findMany({
          where: { id: { in: friendIds }, status: 'online' },
          select: { id: true, username: true, avatarUrl: true, status: true },
        });

        return users;
      },
    });

    this.register({
      name: 'record_metric',
      description: '记录AI使用指标',
      parameters: {
        metricType: { type: 'string', description: '指标类型', required: true },
        metricValue: { type: 'number', description: '指标值', required: true },
        metadata: { type: 'object', description: '额外元数据' },
      },
      handler: async ({ metricType, metricValue, metadata = {} }, ctx) => {
        await this.prisma.agentMetric.create({
          data: { userId: ctx.userId, metricType, metricValue, metadata: metadata as any },
        });
        return { recorded: true, metricType, metricValue };
      },
    });

    this.logger.log(`Registered ${this.tools.size} built-in tools`);
  }

  register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  async execute(
    toolName: string,
    args: Record<string, any>,
    ctx: AgentContext,
  ): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool "${toolName}" not found. Available: ${Array.from(this.tools.keys()).join(', ')}`);
    }

    if (tool.requiresSessionMembership) {
      const sessionId = args.sessionId || (ctx.sessionId as string);
      if (!sessionId) {
        throw new Error(`Tool "${toolName}" requires a sessionId argument`);
      }
      const member = await this.prisma.chatSessionMember.findUnique({
        where: { sessionId_userId: { sessionId, userId: ctx.userId } },
      });
      if (!member) {
        throw new Error(`You are not a member of session "${sessionId}"`);
      }
    }

    const validatedArgs = this.validateArgs(args, tool.parameters);

    try {
      const result = await tool.handler(validatedArgs, ctx);
      this.logger.debug(`Tool "${toolName}" executed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Tool "${toolName}" failed: ${error.message}`);
      throw error;
    }
  }

  getToolDescriptions(): string {
    return Array.from(this.tools.values())
      .map((t) => `${t.name}: ${t.description} | params: ${JSON.stringify(t.parameters)}`)
      .join('\n');
  }

  getTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  private validateArgs(
    args: Record<string, any>,
    schema: Record<string, { type: string; required?: boolean }>,
  ): Record<string, any> {
    const validated: Record<string, any> = {};

    for (const [key, spec] of Object.entries(schema)) {
      if (spec.required && !(key in args)) {
        throw new Error(`Missing required argument: ${key}`);
      }
      if (key in args) {
        validated[key] = args[key];
      }
    }

    return validated;
  }
}
