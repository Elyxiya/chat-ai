import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { FileParserService } from './file-parser.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { makeKnowledgeBase, makeKnowledgeDocument } from '../../test/factories/entities.factory';

describe('KnowledgeController', () => {
  let controller: KnowledgeController;
  let mockKnowledgeService: any;
  let mockFileParser: any;

  beforeEach(async () => {
    mockKnowledgeService = {
      listBases: jest.fn(),
      createBase: jest.fn(),
      getBase: jest.fn(),
      deleteBase: jest.fn(),
      addDocument: jest.fn(),
      addTextContent: jest.fn(),
      listDocuments: jest.fn(),
      deleteDocument: jest.fn(),
      search: jest.fn(),
    };

    mockFileParser = {
      parse: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KnowledgeController],
      providers: [
        { provide: KnowledgeService, useValue: mockKnowledgeService },
        { provide: FileParserService, useValue: mockFileParser },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<KnowledgeController>(KnowledgeController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /knowledge/bases', () => {
    it('KNOW-CTRL-01: should list knowledge bases', async () => {
      const bases = [makeKnowledgeBase(), makeKnowledgeBase({ id: 'kb-2' })];
      mockKnowledgeService.listBases.mockResolvedValue(bases);

      const result = await controller.listBases('user-1');

      expect((result as any).data).toEqual(bases);
    });
  });

  describe('POST /knowledge/bases', () => {
    it('KNOW-CTRL-02: should create knowledge base', async () => {
      const dto = { name: 'New KB', description: 'Test description' };
      const created = makeKnowledgeBase({ name: 'New KB' });
      mockKnowledgeService.createBase.mockResolvedValue(created);

      const result = await controller.createBase('user-1', dto);

      expect((result as any).data.name).toBe('New KB');
    });
  });

  describe('GET /knowledge/bases/:kbId', () => {
    it('KNOW-CTRL-03: should return knowledge base details', async () => {
      const kb = makeKnowledgeBase({ id: 'kb-1' });
      mockKnowledgeService.getBase.mockResolvedValue(kb);

      const result = await controller.getBase('user-1', 'kb-1');

      expect((result as any).data).toEqual(kb);
    });

    it('should throw when base not found', async () => {
      mockKnowledgeService.getBase.mockRejectedValue(new NotFoundException('Knowledge base not found'));

      await expect(controller.getBase('user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('DELETE /knowledge/bases/:kbId', () => {
    it('KNOW-CTRL-04: should delete knowledge base', async () => {
      mockKnowledgeService.deleteBase.mockResolvedValue(undefined);

      const result = await controller.deleteBase('user-1', 'kb-1');

      expect((result as any).message).toBe('Knowledge base deleted');
    });
  });

  describe('POST /knowledge/bases/:kbId/text', () => {
    it('KNOW-CTRL-05: should add text content', async () => {
      mockKnowledgeService.addTextContent.mockResolvedValue({ chunksAdded: 5 });

      const result = await controller.addText('user-1', 'kb-1', { content: 'Some text' });

      expect((result as any).data.chunksAdded).toBe(5);
    });
  });

  describe('POST /knowledge/bases/:kbId/documents', () => {
    it('KNOW-CTRL-06: should upload document', async () => {
      const mockFile = {
        originalname: 'test.txt',
        size: 1024,
        mimetype: 'text/plain',
        buffer: Buffer.from('test content'),
      } as Express.Multer.File;

      mockFileParser.parse.mockReturnValue({
        content: 'test content',
        fileName: 'test.txt',
        fileType: 'text/plain',
        fileSize: 1024,
      });
      mockKnowledgeService.addDocument.mockResolvedValue({ documentId: 'doc-1', chunksAdded: 3 });

      const result = await controller.uploadDocument('user-1', 'kb-1', mockFile);

      expect((result as any).data.documentId).toBe('doc-1');
      expect(mockFileParser.parse).toHaveBeenCalledWith(mockFile);
    });
  });

  describe('GET /knowledge/search', () => {
    it('KNOW-CTRL-07: should search across knowledge bases', async () => {
      const results = [{ kbId: 'kb-1', kbName: 'Base 1', chunks: [] }];
      mockKnowledgeService.search.mockResolvedValue(results);

      const result = await controller.search('user-1', { query: 'test', topK: 5 });

      expect((result as any).data).toEqual(results);
    });
  });

  describe('GET /knowledge/bases/:kbId/documents', () => {
    it('should list documents', async () => {
      const docs = [makeKnowledgeDocument(), makeKnowledgeDocument({ id: 'doc-2' })];
      mockKnowledgeService.listDocuments.mockResolvedValue(docs);

      const result = await controller.listDocuments('kb-1');

      expect((result as any).data).toHaveLength(2);
    });
  });

  describe('DELETE /knowledge/bases/:kbId/documents/:docId', () => {
    it('KNOW-CTRL-08: should delete document', async () => {
      mockKnowledgeService.deleteDocument.mockResolvedValue(undefined);

      const result = await controller.deleteDocument('user-1', 'kb-1', 'doc-1');

      expect((result as any).message).toBe('Document deleted');
    });
  });

  describe('Edge Cases', () => {
    it('EDGE-KNOW-CTRL-01: should handle search with default topK', async () => {
      const results: any[] = [];
      mockKnowledgeService.search.mockResolvedValue(results);

      await controller.search('user-1', { query: 'test' });

      expect(mockKnowledgeService.search).toHaveBeenCalled();
    });

    it('EDGE-KNOW-CTRL-02: should handle search with empty query', async () => {
      const results: any[] = [];
      mockKnowledgeService.search.mockResolvedValue(results);

      await controller.search('user-1', { query: '' });

      expect(mockKnowledgeService.search).toHaveBeenCalled();
    });

    it('EDGE-KNOW-CTRL-03: should handle listBases with empty result', async () => {
      mockKnowledgeService.listBases.mockResolvedValue([]);

      const result = await controller.listBases('user-1');

      expect((result as any).data).toEqual([]);
    });

    it('EDGE-KNOW-CTRL-04: should handle listDocuments with empty result', async () => {
      mockKnowledgeService.listDocuments.mockResolvedValue([]);

      const result = await controller.listDocuments('kb-1');

      expect((result as any).data).toEqual([]);
    });
  });
});
