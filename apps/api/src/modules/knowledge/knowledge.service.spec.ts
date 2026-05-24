import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { PrismaService } from '../../config/prisma.service';
import { RagEngine } from '../agent/rag/rag-engine.service';
import { makeKnowledgeBase, makeKnowledgeDocument } from '../../test/factories/entities.factory';

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let mockPrisma: any;
  let mockRagEngine: any;

  beforeEach(async () => {
    mockPrisma = {
      knowledgeBase: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      knowledgeDocument: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      knowledgeChunk: {
        deleteMany: jest.fn(),
      },
    };

    mockRagEngine = {
      chunkAndStore: jest.fn(),
      retrieve: jest.fn(),
      retrieveChunks: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RagEngine, useValue: mockRagEngine },
      ],
    }).compile();

    service = module.get<KnowledgeService>(KnowledgeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listBases', () => {
    it('should return knowledge bases accessible by user', async () => {
      const bases = [makeKnowledgeBase({ id: 'kb-1', name: 'Base 1' })];
      mockPrisma.knowledgeBase.findMany.mockResolvedValue(bases);

      const result = await service.listBases('user-1');

      expect(result).toEqual(bases);
    });
  });

  describe('createBase', () => {
    it('KNOW-SVC-01: should create knowledge base with defaults', async () => {
      const dto = { name: 'New KB' };
      const created = makeKnowledgeBase({ id: 'kb-new', name: 'New KB', chunkSize: 500, chunkOverlap: 50 });
      mockPrisma.knowledgeBase.create.mockResolvedValue(created);

      const result = await service.createBase('user-1', dto);

      expect(result.chunkSize).toBe(500);
      expect(result.chunkOverlap).toBe(50);
      expect(mockPrisma.knowledgeBase.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'New KB',
          ownerId: 'user-1',
          chunkSize: 500,
          chunkOverlap: 50,
        }),
      });
    });

    it('should create knowledge base with custom settings', async () => {
      const dto = { name: 'Custom KB', chunkSize: 1000, chunkOverlap: 100 };
      const created = makeKnowledgeBase({ chunkSize: 1000, chunkOverlap: 100 });
      mockPrisma.knowledgeBase.create.mockResolvedValue(created);

      const result = await service.createBase('user-1', dto);

      expect(result.chunkSize).toBe(1000);
    });
  });

  describe('getBase', () => {
    it('should return knowledge base details for owner', async () => {
      const kb = makeKnowledgeBase({ id: 'kb-1', ownerId: 'user-1' });
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue(kb);

      const result = await service.getBase('user-1', 'kb-1');

      expect(result.id).toBe('kb-1');
    });

    it('should throw NotFoundException for non-existent base', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue(null);

      await expect(service.getBase('user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('RAG-12: should throw ForbiddenException for private base of another user', async () => {
      const kb = makeKnowledgeBase({ id: 'kb-1', ownerId: 'user-2', isPublic: false });
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue(kb);

      await expect(service.getBase('user-1', 'kb-1')).rejects.toThrow(ForbiddenException);
    });

    it('RAG-12: should allow access to public base owned by another user', async () => {
      const kb = makeKnowledgeBase({ id: 'kb-public', ownerId: 'user-2', isPublic: true });
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue(kb);

      const result = await service.getBase('user-1', 'kb-public');

      expect(result.id).toBe('kb-public');
    });
  });

  describe('deleteBase', () => {
    it('KNOW-SVC-04: should throw ForbiddenException for non-owner', async () => {
      const kb = makeKnowledgeBase({ id: 'kb-1', ownerId: 'user-2' });
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue(kb);

      await expect(service.deleteBase('user-1', 'kb-1')).rejects.toThrow(ForbiddenException);
    });

    it('should delete knowledge base as owner', async () => {
      const kb = makeKnowledgeBase({ id: 'kb-1', ownerId: 'user-1' });
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue(kb);
      mockPrisma.knowledgeBase.delete.mockResolvedValue({});

      await service.deleteBase('user-1', 'kb-1');

      expect(mockPrisma.knowledgeBase.delete).toHaveBeenCalledWith({ where: { id: 'kb-1' } });
    });
  });

  describe('addTextContent', () => {
    it('KNOW-SVC-02: should add text content and call RAG chunkAndStore', async () => {
      const kb = makeKnowledgeBase({ id: 'kb-1', ownerId: 'user-1' });
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue(kb);
      mockRagEngine.chunkAndStore.mockResolvedValue(3);

      const result = await service.addTextContent('user-1', 'kb-1', 'Some text content');

      expect(result.chunksAdded).toBe(3);
      expect(mockRagEngine.chunkAndStore).toHaveBeenCalledWith('kb-1', 'Some text content', 500, 50);
    });

    it('should throw ForbiddenException for non-owner', async () => {
      const kb = makeKnowledgeBase({ id: 'kb-1', ownerId: 'user-2' });
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue(kb);

      await expect(service.addTextContent('user-1', 'kb-1', 'content')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('addDocument', () => {
    it('KNOW-SVC-05: should mark document as failed on processing error', async () => {
      const kb = makeKnowledgeBase({ id: 'kb-1', ownerId: 'user-1' });
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue(kb);
      const doc = makeKnowledgeDocument({ id: 'doc-1', status: 'processing' });
      mockPrisma.knowledgeDocument.create.mockResolvedValue(doc);
      mockRagEngine.chunkAndStore.mockRejectedValue(new Error('Embedding failed'));
      mockPrisma.knowledgeDocument.update.mockResolvedValue({ ...doc, status: 'failed' });

      await expect(
        service.addDocument('user-1', 'kb-1', {
          fileName: 'test.txt',
          fileSize: 100,
          mimeType: 'text/plain',
          content: 'test content',
        }),
      ).rejects.toThrow('Embedding failed');

      expect(mockPrisma.knowledgeDocument.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: expect.objectContaining({ status: 'failed', errorMessage: 'Embedding failed' }),
      });
    });

    it('should create document and process successfully', async () => {
      const kb = makeKnowledgeBase({ id: 'kb-1', ownerId: 'user-1' });
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue(kb);
      const doc = makeKnowledgeDocument({ id: 'doc-1' });
      mockPrisma.knowledgeDocument.create.mockResolvedValue(doc);
      mockRagEngine.chunkAndStore.mockResolvedValue(5);
      mockPrisma.knowledgeDocument.update.mockResolvedValue(doc);

      const result = await service.addDocument('user-1', 'kb-1', {
        fileName: 'test.txt',
        fileSize: 100,
        mimeType: 'text/plain',
        content: 'test content',
      });

      expect(result.chunksAdded).toBe(5);
    });
  });

  describe('search', () => {
    it('KNOW-SVC-03: should search across all user-accessible bases', async () => {
      const bases = [
        { id: 'kb-1', name: 'Base 1' },
        { id: 'kb-2', name: 'Base 2' },
      ];
      mockPrisma.knowledgeBase.findMany.mockResolvedValue(bases);
      mockRagEngine.retrieveChunks.mockResolvedValue([
        { id: 'chunk-1', content: 'Result 1', score: 0.9, metadata: {} },
      ]);

      const result = await service.search('user-1', 'query');

      expect(result.length).toBeGreaterThan(0);
      expect(mockRagEngine.retrieveChunks).toHaveBeenCalled();
    });

    it('RAG-13: should return empty array when searching with no matching keywords', async () => {
      const bases = [{ id: 'kb-1', name: 'Base 1' }];
      mockPrisma.knowledgeBase.findMany.mockResolvedValue(bases);
      mockRagEngine.retrieveChunks.mockResolvedValue([]);

      const result = await service.search('user-1', 'nonexistent_keyword_xzy');

      expect(result).toEqual([]);
    });
  });

  describe('listDocuments', () => {
    it('should list documents for a knowledge base', async () => {
      const docs = [makeKnowledgeDocument(), makeKnowledgeDocument({ id: 'doc-2' })];
      mockPrisma.knowledgeDocument.findMany.mockResolvedValue(docs);

      const result = await service.listDocuments('kb-1');

      expect(result).toHaveLength(2);
    });

    it('should return empty array for KB with no documents', async () => {
      mockPrisma.knowledgeDocument.findMany.mockResolvedValue([]);

      const result = await service.listDocuments('kb-empty');

      expect(result).toEqual([]);
    });
  });

  describe('deleteDocument', () => {
    it('should delete document as base owner', async () => {
      const kb = makeKnowledgeBase({ id: 'kb-1', ownerId: 'user-1' });
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue(kb);
      mockPrisma.knowledgeDocument.delete.mockResolvedValue({});

      await service.deleteDocument('user-1', 'kb-1', 'doc-1');

      expect(mockPrisma.knowledgeDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
    });

    it('should throw ForbiddenException for non-owner', async () => {
      const kb = makeKnowledgeBase({ id: 'kb-1', ownerId: 'user-2' });
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue(kb);

      await expect(service.deleteDocument('user-1', 'kb-1', 'doc-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
