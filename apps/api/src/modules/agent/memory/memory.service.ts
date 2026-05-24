import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { RedisService } from '../../common/redis.service';
import { MemoryItem, AgentMessage } from '../types';

const SHORT_TERM_TTL = 30 * 60;
const WORKING_TTL = 5 * 60;

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async addShortTermMemory(userId: string, message: AgentMessage): Promise<void> {
    const key = `memory:short:${userId}`;
    const serialized = JSON.stringify({ ...message, id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}` });
    try {
      await this.redis.lpush(key, serialized);
      await this.redis.ltrim(key, 0, 99);
      await this.redis.expire(key, SHORT_TERM_TTL);
    } catch (err: any) {
      this.logger.warn(`[${userId}] addShortTermMemory failed (Redis unavailable): ${err.message}`);
    }
  }

  async getShortTermMemory(userId: string, limit = 50): Promise<any[]> {
    const key = `memory:short:${userId}`;
    // Ensure stop is always a valid integer to avoid Redis protocol errors
    const stop = Number.isFinite(limit) ? Math.floor(limit) - 1 : 49;
    try {
      const raw = await this.redis.lrange(key, 0, stop);
      const parsed = raw.map((r) => {
        try {
          return JSON.parse(r);
        } catch {
          return null;
        }
      }).filter(Boolean);
      return parsed.reverse();
    } catch (err: any) {
      this.logger.warn(`[${userId}] getShortTermMemory failed (Redis unavailable): ${err.message}`);
      return [];
    }
  }

  async clearShortTermMemory(userId: string): Promise<void> {
    try {
      await this.redis.del(`memory:short:${userId}`);
    } catch (err: any) {
      this.logger.warn(`[${userId}] clearShortTermMemory failed: ${err.message}`);
    }
  }

  async setWorkingMemory(userId: string, key: string, value: any): Promise<void> {
    try {
      await this.redis.set(`memory:work:${userId}:${key}`, JSON.stringify(value), WORKING_TTL * 1000);
    } catch (err: any) {
      this.logger.warn(`[${userId}] setWorkingMemory failed: ${err.message}`);
    }
  }

  async getWorkingMemory(userId: string, key: string): Promise<any | null> {
    try {
      const raw = await this.redis.get(`memory:work:${userId}:${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch (err: any) {
      this.logger.warn(`[${userId}] getWorkingMemory failed: ${err.message}`);
      return null;
    }
  }

  async storeLongTermMemory(
    userId: string,
    item: { type: string; content: any; importance?: number; sessionId?: string },
  ): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO agent_memories (id, user_id, session_id, memory_type, content, embedding, importance_score, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${userId}::uuid,
        ${item.sessionId}::uuid,
        ${item.type}::varchar(30),
        ${JSON.stringify(item.content)}::jsonb,
        '[0]'::vector(1536),
        ${item.importance || 0.5}::float,
        NOW(),
        NOW()
      )
    `;
  }

  async getRelevantMemories(userId: string, query: string, topK = 5): Promise<MemoryItem[]> {
    const memories = await this.prisma.agentMemory.findMany({
      where: {
        userId,
        memoryType: { in: ['episodic', 'semantic', 'long_term'] },
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        ],
      },
      orderBy: { importanceScore: 'desc' },
      take: topK,
    });

    return memories.map((m: any) => ({
      id: m.id,
      type: m.memoryType as any,
      content: m.content,
      importance: m.importanceScore,
      createdAt: m.createdAt,
    }));
  }

  async summarizeAndCompress(userId: string): Promise<void> {
    const recentMemories = await this.getShortTermMemory(userId, 50);

    if (recentMemories.length < 10) return;

    const summaryPrompt = `请总结以下对话的关键信息，保留重要的用户偏好和事实：

${recentMemories.map((m) => `${m.role}: ${m.content}`).join('\n')}

简洁总结（200字以内）：`;

    const { DeepSeekProvider } = await import('../../llm/providers/deepseek.provider');
    const provider = new DeepSeekProvider();

    const summary = await provider.chat([{ role: 'user', content: summaryPrompt }]);

    await this.storeLongTermMemory(userId, {
      type: 'semantic',
      content: { summary, originalCount: recentMemories.length },
      importance: 0.6,
    });

    await this.clearShortTermMemory(userId);
    this.logger.log(`[${userId}] Memory summarized and compressed`);
  }

  async logToolCall(log: {
    conversationId: string;
    userId: string;
    toolName: string;
    toolInput: any;
    success: boolean;
    errorMessage?: string;
    executionTimeMs: number;
  }): Promise<void> {
    await this.prisma.agentToolLog.create({
      data: {
        conversationId: log.conversationId || undefined,
        userId: log.userId,
        toolName: log.toolName,
        toolInput: log.toolInput as any,
        success: log.success,
        errorMessage: log.errorMessage,
        executionTimeMs: log.executionTimeMs,
      },
    });
  }

  async incrementAccessCount(memoryId: string): Promise<void> {
    await this.prisma.agentMemory.update({
      where: { id: memoryId },
      data: { accessCount: { increment: 1 } },
    });
  }

  async cleanupExpiredMemories(): Promise<number> {
    const result = await this.prisma.agentMemory.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
