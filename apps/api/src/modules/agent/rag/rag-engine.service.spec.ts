import { Test, TestingModule } from '@nestjs/testing';
import { RagEngine } from './rag-engine.service';
import { PrismaService } from '../../../config/prisma.service';

jest.mock('../../llm/providers/deepseek.provider', () => ({
  DeepSeekProvider: jest.fn().mockImplementation(() => ({
    embed: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  })),
}));

// Mock the provider with configurable embed response
let mockEmbedResponse: number[] | null = null;
jest.mock('../../llm/providers/deepseek.provider', () => ({
  DeepSeekProvider: jest.fn().mockImplementation(() => ({
    embed: jest.fn().mockImplementation(() => {
      if (mockEmbedResponse === null) {
        return Promise.resolve([0.1, 0.2, 0.3]);
      }
      return Promise.resolve(mockEmbedResponse);
    }),
  })),
}));

describe('RagEngine', () => {
  let engine: RagEngine;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      knowledgeChunk: {
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagEngine,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    engine = module.get<RagEngine>(RagEngine);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('retrieve', () => {
    it('RAG-01: should return formatted knowledge context', async () => {
      const chunks = [
        { id: 'chunk-1', content: 'Tokyo is the capital of Japan', metadata: { source: 'wiki' }, score: 0.95 },
        { id: 'chunk-2', content: 'Japan has a population of 125 million', metadata: {}, score: 0.85 },
      ];
      mockPrisma.$queryRaw.mockResolvedValue(chunks);

      const result = await engine.retrieve('Tokyo capital', 'user-1', 5, 'kb-1');

      expect(result).toContain('【相关知识】');
      expect(result).toContain('Tokyo is the capital of Japan');
      expect(result).toContain('[1]');
    });

    it('should return empty string when no chunks found', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await engine.retrieve('unknown query', 'user-1', 5, 'kb-1');

      expect(result).toBe('');
    });
  });

  describe('retrieveChunks', () => {
    it('RAG-03: should return chunks with scores', async () => {
      const chunks = [
        { id: 'chunk-1', content: 'Content A', metadata: {}, score: 0.9 },
        { id: 'chunk-2', content: 'Content B', metadata: {}, score: 0.8 },
      ];
      mockPrisma.$queryRaw.mockResolvedValue(chunks);

      const result = await engine.retrieveChunks('query', 'kb-1', 5);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('score');
      expect(result[0]).toHaveProperty('content');
    });

    it('should return empty array when no chunks found', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await engine.retrieveChunks('query', 'kb-1', 5);

      expect(result).toEqual([]);
    });
  });

  describe('addChunk', () => {
    it('should execute raw SQL for chunk insertion', async () => {
      mockPrisma.$executeRaw.mockResolvedValue({} as any);

      await engine.addChunk('kb-1', 'Test content', { source: 'manual' });

      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('chunkAndStore', () => {
    it('RAG-02: should split text and store chunks', async () => {
      mockPrisma.$executeRaw.mockResolvedValue({} as any);

      const text = 'First sentence. Second sentence. Third sentence.';
      const count = await engine.chunkAndStore('kb-1', text, 500, 50);

      expect(count).toBeGreaterThan(0);
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });

    it('should handle single long text chunk', async () => {
      mockPrisma.$executeRaw.mockResolvedValue({} as any);

      const longText = 'This is sentence one. This is sentence two. This is sentence three.';
      await engine.chunkAndStore('kb-1', longText, 20, 5);

      expect(mockPrisma.$executeRaw.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockEmbedResponse = [0.1, 0.2, 0.3];
    });

    afterEach(() => {
      mockEmbedResponse = null;
    });

    it('EDGE-RAG-01: should return empty string when query embedding fails (null)', async () => {
      mockEmbedResponse = null;

      const result = await engine.retrieve('test query', 'user-1', 5, 'kb-1');

      expect(result).toBe('');
    });

    it('EDGE-RAG-02: should return empty string when query embedding returns empty array', async () => {
      mockEmbedResponse = [];

      const result = await engine.retrieve('test query', 'user-1', 5, 'kb-1');

      expect(result).toBe('');
    });

    it('EDGE-RAG-03: should handle retrieveChunks with empty embedding', async () => {
      mockEmbedResponse = null;

      const result = await engine.retrieveChunks('test', 'kb-1', 5);

      expect(result).toEqual([]);
    });

    it('EDGE-RAG-04: should handle chunkAndStore with empty text', async () => {
      mockPrisma.$executeRaw.mockResolvedValue({} as any);

      const count = await engine.chunkAndStore('kb-1', '', 500, 50);

      expect(count).toBe(0);
      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('EDGE-RAG-05: should handle chunkAndStore with very short chunk size', async () => {
      mockPrisma.$executeRaw.mockResolvedValue({} as any);

      const text = 'Short sentence that might not need chunking at all.';
      const count = await engine.chunkAndStore('kb-1', text, 10, 2);

      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('EDGE-RAG-06: should handle text with no sentence boundaries', async () => {
      mockPrisma.$executeRaw.mockResolvedValue({} as any);

      const text = 'ThisIsALongStringWithoutSpacesOrPunctuationToSplitOn';
      const count = await engine.chunkAndStore('kb-1', text, 20, 5);

      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('EDGE-RAG-07: should handle Chinese text without Western punctuation', async () => {
      mockPrisma.$executeRaw.mockResolvedValue({} as any);

      const text = '这是中文文本没有句号逗号分隔符';
      const count = await engine.chunkAndStore('kb-1', text, 10, 2);

      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});
