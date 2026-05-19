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

    await this.redis.lpush(key, serialized);
    await this.redis.ltrim(key, 0, 99);
    await this.redis.expire(key, SHORT_TERM_TTL);
  }

  async getShortTermMemory(userId: string, limit = 50): Promise<any[]> {
    // #region debug log
    fetch('http://127.0.0.1:7327/ingest/804a4ea0-edf2-4cdf-8542-0c7db0a68a39',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'288cad'},body:JSON.stringify({sessionId:'288cad',runId:'initial',hypothesisId:'A',location:'memory.service.ts:27',message:'getShortTermMemory start',data:{userId,limit},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const key = `memory:short:${userId}`;
    try {
      const raw = await this.redis.lrange(key, 0, limit - 1);
      // #region debug log
      fetch('http://127.0.0.1:7327/ingest/804a4ea0-edf2-4cdf-8542-0c7db0a68a39',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'288cad'},body:JSON.stringify({sessionId:'288cad',runId:'initial',hypothesisId:'A',location:'memory.service.ts:29',message:'lrange result',data:{userId,limit,rawLength:raw.length,rawFirstItem:raw[0]},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const parsed = raw.map((r, idx) => {
        try {
          return JSON.parse(r);
        } catch (e: any) {
          // #region debug log
          fetch('http://127.0.0.1:7327/ingest/804a4ea0-edf2-4cdf-8542-0c7db0a68a39',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'288cad'},body:JSON.stringify({sessionId:'288cad',runId:'initial',hypothesisId:'A',location:'memory.service.ts:31',message:'JSON.parse FAILED',data:{userId,index:idx,rawValue:r,error:e.message},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          throw e;
        }
      });
      const result = parsed.reverse();
      // #region debug log
      fetch('http://127.0.0.1:7327/ingest/804a4ea0-edf2-4cdf-8542-0c7db0a68a39',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'288cad'},body:JSON.stringify({sessionId:'288cad',runId:'initial',hypothesisId:'A',location:'memory.service.ts:32',message:'getShortTermMemory success',data:{userId,resultLength:result.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return result;
    } catch (err: any) {
      // #region debug log
      fetch('http://127.0.0.1:7327/ingest/804a4ea0-edf2-4cdf-8542-0c7db0a68a39',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'288cad'},body:JSON.stringify({sessionId:'288cad',runId:'initial',hypothesisId:'A',location:'memory.service.ts:43',message:'getShortTermMemory ERROR',data:{userId,errorType:(err as Error).constructor.name,errorMessage:err.message,errorStack:err.stack},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      throw err;
    }
  }

  async clearShortTermMemory(userId: string): Promise<void> {
    await this.redis.del(`memory:short:${userId}`);
  }

  async setWorkingMemory(userId: string, key: string, value: any): Promise<void> {
    await this.redis.set(`memory:work:${userId}:${key}`, JSON.stringify(value), WORKING_TTL * 1000);
  }

  async getWorkingMemory(userId: string, key: string): Promise<any | null> {
    const raw = await this.redis.get(`memory:work:${userId}:${key}`);
    return raw ? JSON.parse(raw) : null;
  }

  async storeLongTermMemory(
    userId: string,
    item: { type: string; content: any; importance?: number; sessionId?: string },
  ): Promise<void> {
    await this.prisma.agentMemory.create({
      data: {
        userId,
        sessionId: item.sessionId,
        memoryType: item.type,
        content: item.content as any,
        importanceScore: item.importance || 0.5,
        expiresAt: item.type === 'episodic' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
      },
    });
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

    return memories.map((m) => ({
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
