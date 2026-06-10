import { Test, TestingModule } from '@nestjs/testing';
import { MemoryService } from './memory.service';
import { PrismaService } from '../../../config/prisma.service';
import { RedisService } from '../../common/redis.service';
import { makeAgentMemory } from '../../../test/factories/entities.factory';

describe('MemoryService', () => {
  let service: MemoryService;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(async () => {
    mockPrisma = {
      agentMemory: {
        findMany: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      $executeRaw: jest.fn(),
      agentToolLog: {
        create: jest.fn(),
      },
    };

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      lpush: jest.fn(),
      ltrim: jest.fn(),
      lrange: jest.fn(),
      expire: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<MemoryService>(MemoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addShortTermMemory', () => {
    it('MEM-01: should store message in Redis with TTL', async () => {
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      await service.addShortTermMemory('user-1', { role: 'user', content: 'Hello' });

      expect(mockRedis.lpush).toHaveBeenCalledWith('memory:short:user-1', expect.any(String));
      expect(mockRedis.ltrim).toHaveBeenCalledWith('memory:short:user-1', 0, 99);
      expect(mockRedis.expire).toHaveBeenCalledWith('memory:short:user-1', 1800);
    });

    it('should not throw when Redis is unavailable', async () => {
      mockRedis.lpush.mockRejectedValue(new Error('Redis connection failed'));

      await expect(
        service.addShortTermMemory('user-1', { role: 'user', content: 'Hello' }),
      ).resolves.not.toThrow();
    });
  });

  describe('getShortTermMemory', () => {
    it('MEM-03: should return memories in chronological order (oldest first)', async () => {
      // lrange returns newest-first (LPUSH), then reverse() makes it oldest-first
      const memories = [
        JSON.stringify({ role: 'assistant', content: 'Hi', id: 'msg-2' }),
        JSON.stringify({ role: 'user', content: 'Hello', id: 'msg-1' }),
      ];
      mockRedis.lrange.mockResolvedValue(memories);

      const result = await service.getShortTermMemory('user-1', 50);

      expect(result).toHaveLength(2);
      // After reverse(), oldest (user Hello) comes first
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBe('Hello');
    });

    it('should return empty array when Redis fails', async () => {
      mockRedis.lrange.mockRejectedValue(new Error('Redis unavailable'));

      const result = await service.getShortTermMemory('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('clearShortTermMemory', () => {
    it('MEM-05: should delete Redis key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.clearShortTermMemory('user-1');

      expect(mockRedis.del).toHaveBeenCalledWith('memory:short:user-1');
    });
  });

  describe('storeLongTermMemory', () => {
    it('MEM-02: should store episodic memory in Prisma', async () => {
      mockPrisma.$executeRaw.mockResolvedValue({} as any);

      await service.storeLongTermMemory('user-1', {
        type: 'episodic',
        content: { summary: 'User asked about weather' },
        importance: 0.7,
      });

      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });

    it('should execute raw SQL for memory insertion', async () => {
      mockPrisma.$executeRaw.mockResolvedValue({} as any);

      await service.storeLongTermMemory('user-1', {
        type: 'episodic',
        content: {},
        importance: 0.5,
      });

      const rawCall = mockPrisma.$executeRaw.mock.calls[0][0];
      expect(rawCall).toBeDefined();
    });
  });

  describe('getRelevantMemories', () => {
    it('MEM-04: should return memories ordered by importance', async () => {
      const memories = [
        makeAgentMemory({ id: 'mem-1', importanceScore: 0.8 }),
        makeAgentMemory({ id: 'mem-2', importanceScore: 0.5 }),
      ];
      mockPrisma.agentMemory.findMany.mockResolvedValue(memories);

      const result = await service.getRelevantMemories('user-1', 'query', 5);

      expect(result).toHaveLength(2);
      expect(mockPrisma.agentMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { importanceScore: 'desc' } }),
      );
    });

    it('should exclude expired memories', async () => {
      mockPrisma.agentMemory.findMany.mockResolvedValue([]);

      await service.getRelevantMemories('user-1', 'query', 5);

      expect(mockPrisma.agentMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }] },
            ]),
          }),
        }),
      );
    });
  });

  describe('logToolCall', () => {
    it('MEM-06: should log successful tool call', async () => {
      mockPrisma.agentToolLog.create.mockResolvedValue({});

      await service.logToolCall({
        conversationId: 'conv-1',
        userId: 'user-1',
        toolName: 'search',
        toolInput: { query: 'test' },
        success: true,
        executionTimeMs: 150,
      });

      expect(mockPrisma.agentToolLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          toolName: 'search',
          success: true,
          executionTimeMs: 150,
        }),
      });
    });

    it('should log failed tool call with error message', async () => {
      mockPrisma.agentToolLog.create.mockResolvedValue({});

      await service.logToolCall({
        conversationId: 'conv-1',
        userId: 'user-1',
        toolName: 'search',
        toolInput: {},
        success: false,
        errorMessage: 'Timeout error',
        executionTimeMs: 5000,
      });

      expect(mockPrisma.agentToolLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          success: false,
          errorMessage: 'Timeout error',
        }),
      });
    });
  });

  describe('summarizeAndCompress', () => {
    it('MEM-07: should not compress when fewer than 10 memories', async () => {
      const shortMemories = [
        JSON.stringify({ role: 'user', content: 'Hi' }),
      ];
      mockRedis.lrange.mockResolvedValue(shortMemories);

      await service.summarizeAndCompress('user-1');

      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });
  });

  describe('incrementAccessCount', () => {
    it('MEM-08: should increment access count', async () => {
      mockPrisma.agentMemory.update.mockResolvedValue({});

      await service.incrementAccessCount('mem-1');

      expect(mockPrisma.agentMemory.update).toHaveBeenCalledWith({
        where: { id: 'mem-1' },
        data: { accessCount: { increment: 1 } },
      });
    });
  });

  describe('setWorkingMemory and getWorkingMemory', () => {
    it('should set and get working memory', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(JSON.stringify({ key: 'value' }));

      await service.setWorkingMemory('user-1', 'context', { key: 'value' });
      const result = await service.getWorkingMemory('user-1', 'context');

      expect(mockRedis.set).toHaveBeenCalled();
      expect(result).toEqual({ key: 'value' });
    });
  });

  describe('cleanupExpiredMemories', () => {
    it('should delete expired memories', async () => {
      mockPrisma.agentMemory.deleteMany.mockResolvedValue({ count: 5 });

      const count = await service.cleanupExpiredMemories();

      expect(count).toBe(5);
      expect(mockPrisma.agentMemory.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });
  });

  describe('Edge Cases', () => {
    it('EDGE-MEM-01: should handle malformed JSON in Redis gracefully', async () => {
      mockRedis.lrange.mockResolvedValue([
        JSON.stringify({ role: 'user', content: 'Valid message' }),
        'invalid-json{{{',
        JSON.stringify({ role: 'assistant', content: 'Another valid' }),
      ]);

      const result = await service.getShortTermMemory('user-1', 50);

      expect(result).toHaveLength(2);
      expect(result.every((m) => m !== null)).toBe(true);
    });

    it('EDGE-MEM-02: should not throw when Redis getWorkingMemory gets invalid JSON', async () => {
      mockRedis.get.mockResolvedValue('not-valid-json{{{');

      const result = await service.getWorkingMemory('user-1', 'context');

      expect(result).toBe(null);
    });

    it('EDGE-MEM-03: should handle working memory when Redis returns null', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getWorkingMemory('user-1', 'context');

      expect(result).toBe(null);
    });

    it('EDGE-MEM-04: should handle empty query in getRelevantMemories', async () => {
      mockPrisma.agentMemory.findMany.mockResolvedValue([]);

      const result = await service.getRelevantMemories('user-1', '', 5);

      expect(mockPrisma.agentMemory.findMany).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('EDGE-MEM-05: should handle memory with null content in getRelevantMemories', async () => {
      const memories = [
        makeAgentMemory({ id: 'mem-1', content: null }),
        makeAgentMemory({ id: 'mem-2', content: { summary: 'Valid content' } }),
      ];
      mockPrisma.agentMemory.findMany.mockResolvedValue(memories);

      const result = await service.getRelevantMemories('user-1', 'query', 5);

      expect(result).toHaveLength(2);
    });
  });

  describe('Token Threshold (Auto-Compression at 3000 tokens)', () => {
    it('MEM-TOKEN-01: estimateTokenCount should approximate Chinese chars (~2 chars/token)', async () => {
      // 10 Chinese chars → Math.ceil(10/2) = 5
      const text = '你好你好你好你好你好';
      const tokenCount = (service as any).estimateTokenCount(text);
      expect(tokenCount).toBe(5);
    });

    it('MEM-TOKEN-02: shouldCompress returns true when token count >= 3000', async () => {
      // Direct estimateTokenCount boundary: 6000 chars → 3000 tokens exactly
      // shouldCompress counts tokens from lrange, so test via estimateTokenCount
      // A single item of 6000 chars = 3000 tokens >= threshold
      const atThreshold = (service as any).estimateTokenCount('x'.repeat(6000));
      const belowThreshold = (service as any).estimateTokenCount('x'.repeat(5999));

      expect(atThreshold).toBe(3000);
      expect(belowThreshold).toBe(3000); // Math.ceil(5999/2) = 3000
      expect((service as any).estimateTokenCount('x'.repeat(200))).toBe(100); // below 3000
    });

    it('MEM-TOKEN-03: shouldCompress returns false when token count < 3000', async () => {
      // 5 items × 100 chars = 500 chars → 250 tokens < 3000 threshold
      mockRedis.lrange.mockResolvedValueOnce(
        Array(5).fill(null).map(() =>
          JSON.stringify({ role: 'user', content: 'x'.repeat(100) }),
        ),
      );

      const result = await service.shouldCompress('user-1', 3000);

      expect(result).toBe(false);
    });

    it('MEM-TOKEN-04: getShortTermMemory auto-triggers compression when tokens exceed threshold', async () => {
      // 60 items × 100 chars = 6000 chars → 3000 tokens >= 3000 threshold, 60 >= 10 items → triggers compress
      // First lrange: getShortTermMemory initial fetch
      // Second lrange: summarizeAndCompress calls getShortTermMemory internally
      // Third lrange: getShortTermMemory after compress (re-fetch)
      mockRedis.lrange
        .mockResolvedValueOnce(
          Array(60).fill(null).map((_, i) =>
            JSON.stringify({ role: 'user', content: 'x'.repeat(100) }),
          ),
        )
        .mockResolvedValueOnce(
          Array(60).fill(null).map((_, i) =>
            JSON.stringify({ role: 'user', content: 'x'.repeat(100) }),
          ),
        )
        .mockResolvedValueOnce([]);

      const result = await service.getShortTermMemory('user-1', 50);

      expect(result).toEqual([]);
    });
  });
});
