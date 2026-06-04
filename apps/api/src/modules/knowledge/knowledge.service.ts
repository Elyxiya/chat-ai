import { Injectable, NotFoundException, ForbiddenException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { RagEngine } from '../agent/rag/rag-engine.service';
import { CreateKbDto } from './dto/knowledge.dto';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragEngine: RagEngine,
  ) {}

  async listBases(userId: string) {
    return this.prisma.knowledgeBase.findMany({
      where: {
        OR: [{ ownerId: userId }, { isPublic: true }],
      },
      include: {
        _count: { select: { documents: true, chunks: true } },
        owner: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createBase(userId: string, dto: CreateKbDto) {
    return this.prisma.knowledgeBase.create({
      data: {
        name: dto.name,
        description: dto.description,
        owner: { connect: { id: userId } },
        isPublic: dto.isPublic ?? false,
        chunkSize: dto.chunkSize ?? 500,
        chunkOverlap: dto.chunkOverlap ?? 50,
        embeddingModel: dto.embeddingModel ?? 'deepseek-embed',
      },
    });
  }

  async getBase(userId: string, kbId: string) {
    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id: kbId },
      include: {
        _count: { select: { documents: true, chunks: true } },
        owner: { select: { id: true, username: true, avatarUrl: true } },
        documents: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!kb) throw new NotFoundException('Knowledge base not found');
    if (!kb.isPublic && kb.ownerId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return kb;
  }

  async deleteBase(userId: string, kbId: string) {
    const kb = await this.prisma.knowledgeBase.findUnique({ where: { id: kbId } });
    if (!kb) throw new NotFoundException('Knowledge base not found');
    if (kb.ownerId !== userId) throw new ForbiddenException('Access denied');

    await this.prisma.knowledgeBase.delete({ where: { id: kbId } });
  }

  async addDocument(
    userId: string,
    kbId: string,
    doc: { fileName: string; fileSize: number; mimeType: string; content: string },
  ) {
    const kb = await this.prisma.knowledgeBase.findUnique({ where: { id: kbId } });
    if (!kb) throw new NotFoundException('Knowledge base not found');
    if (kb.ownerId !== userId) throw new ForbiddenException('Access denied');

    const document = await this.prisma.knowledgeDocument.create({
      data: {
        kbId,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        fileType: doc.mimeType,
        status: 'processing',
      },
    });

    try {
      const chunkCount = await this.ragEngine.chunkAndStore(
        kbId,
        doc.content,
        kb.chunkSize,
        kb.chunkOverlap,
        { documentId: document.id },  // Tag chunks with document ID for cleanup
      );

      await this.prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: { status: 'completed', totalChunks: chunkCount, processedChunks: chunkCount },
      });

      return { documentId: document.id, chunksAdded: chunkCount };
    } catch (error) {
      await this.prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: { status: 'failed', errorMessage: error.message },
      });
      throw error;
    }
  }

  async addTextContent(
    userId: string,
    kbId: string,
    content: string,
    _metadata: Record<string, unknown> = {},
  ) {
    const kb = await this.prisma.knowledgeBase.findUnique({ where: { id: kbId } });
    if (!kb) throw new NotFoundException('Knowledge base not found');
    if (kb.ownerId !== userId) throw new ForbiddenException('Access denied');

    const chunkCount = await this.ragEngine.chunkAndStore(
      kbId,
      content,
      kb.chunkSize,
      kb.chunkOverlap,
    );

    return { chunksAdded: chunkCount };
  }

  async listDocuments(kbId: string) {
    return this.prisma.knowledgeDocument.findMany({
      where: { kbId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDocumentChunks(kbId: string, docId: string) {
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: { kbId },
      select: { id: true, content: true, chunkIndex: true, metadata: true, createdAt: true },
      orderBy: { chunkIndex: 'asc' },
    });

    return chunks
      .filter((c) => {
        const meta = c.metadata as Record<string, unknown> | null;
        return meta?.documentId === docId;
      })
      .map(({ id, content, chunkIndex, createdAt }) => ({
        id,
        content,
        chunk_index: chunkIndex,
        created_at: createdAt,
      }));
  }

  async deleteDocument(userId: string, kbId: string, docId: string) {
    const kb = await this.prisma.knowledgeBase.findUnique({ where: { id: kbId } });
    if (!kb) throw new NotFoundException('Knowledge base not found');
    if (kb.ownerId !== userId) throw new ForbiddenException('Access denied');

    // Delete associated chunks by finding them with Prisma and filtering in JS
    // Avoids $executeRaw template literal type inference issues
    try {
      const allChunks = await this.prisma.knowledgeChunk.findMany({
        where: { kbId },
        select: { id: true, metadata: true },
      });
      const matchIds = allChunks
        .filter((c) => {
          const meta = c.metadata as Record<string, unknown> | null;
          return meta?.documentId === docId;
        })
        .map((c) => c.id);

      if (matchIds.length > 0) {
        await this.prisma.knowledgeChunk.deleteMany({
          where: { id: { in: matchIds } },
        });
      }
    } catch (err) {
      this.logger.warn(`Failed to delete chunks for document ${docId}: ${err.message}`);
    }

    try {
      await this.prisma.knowledgeDocument.delete({ where: { id: docId } });
    } catch (err) {
      this.logger.error(`Failed to delete document ${docId}: ${err.message}`);
      throw new InternalServerErrorException('Failed to delete document');
    }
  }

  async search(userId: string, query: string, topK = 5) {
    const bases = await this.prisma.knowledgeBase.findMany({
      where: { OR: [{ ownerId: userId }, { isPublic: true }] },
      select: { id: true, name: true },
    });

    const results = [];

    for (const base of bases) {
      const chunks = await this.ragEngine.retrieveChunks(query, base.id, Math.ceil(topK / bases.length));
      if (chunks.length) {
        results.push({ kbId: base.id, kbName: base.name, chunks });
      }
    }

    return results;
  }
}
