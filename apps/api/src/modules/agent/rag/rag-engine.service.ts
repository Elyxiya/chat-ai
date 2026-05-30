import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { EmbeddingService } from '../../llm/providers/embedding.service';
import { RagChunk } from '../types';

@Injectable()
export class RagEngine {
  private readonly logger = new Logger(RagEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
  ) {}

  async retrieve(
    query: string,
    userId: string,
    topK = 5,
    kbId?: string,
  ): Promise<string> {
    try {
      const queryEmbedding = await this.embedding.embed(query);
      if (!queryEmbedding || queryEmbedding.length === 0) {
        return '';
      }

      const chunks = await this.prisma.$queryRaw<
        Array<{ id: string; content: string; metadata: any; score: number }>
      >`
        SELECT id, content, metadata,
          1 - (embedding <=> ${queryEmbedding}::vector) AS score
        FROM knowledge_chunks
        WHERE kb_id = ${kbId || '00000000-0000-0000-0000-000000000000'}
        ORDER BY embedding <=> ${queryEmbedding}::vector
        LIMIT ${topK}
      `;

      if (!chunks || chunks.length === 0) {
        return '';
      }

      const context = chunks
        .map((c: any, i: number) => `[${i + 1}] ${c.content}\n来源: ${c.metadata?.source || '知识库'}`)
        .join('\n\n');

      return `【相关知识】\n${context}`;
    } catch (error) {
      this.logger.warn(`RAG retrieval failed: ${error.message}`);
      return '';
    }
  }

  async retrieveChunks(
    query: string,
    kbId: string,
    topK = 5,
  ): Promise<RagChunk[]> {
    try {
      const queryEmbedding = await this.embedding.embed(query);

      if (!queryEmbedding || queryEmbedding.length === 0) {
        return [];
      }

      const chunks = await this.prisma.$queryRaw<
        Array<{ id: string; content: string; metadata: any; score: number }>
      >`
        SELECT id, content, metadata,
          1 - (embedding <=> ${queryEmbedding}::vector) AS score
        FROM knowledge_chunks
        WHERE kb_id = ${kbId}
        ORDER BY embedding <=> ${queryEmbedding}::vector
        LIMIT ${topK}
      `;

      return chunks.map((c: any) => ({
        id: c.id,
        content: c.content,
        score: c.score,
        metadata: c.metadata || {},
      }));
    } catch (error) {
      this.logger.error(`RAG chunk retrieval failed: ${error.message}`);
      return [];
    }
  }

  async addChunk(
    kbId: string,
    content: string,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    try {
      const embedding = await this.embedding.embed(content);

      if (!embedding || embedding.length === 0) {
        this.logger.warn(`Cannot store chunk: embedding is empty (API key may be missing)`);
        return;
      }

      await this.prisma.$executeRaw`
        INSERT INTO knowledge_chunks (id, kb_id, content, embedding, chunk_index, metadata, created_at)
        VALUES (
          gen_random_uuid(),
          ${kbId}::uuid,
          ${content}::text,
          ${embedding}::vector(1536),
          0::int,
          ${JSON.stringify(metadata)}::jsonb,
          NOW()
        )
      `;
    } catch (error) {
      this.logger.error(`Add chunk failed: ${error.message}`);
      throw error;
    }
  }

  async chunkAndStore(
    kbId: string,
    text: string,
    chunkSize = 500,
    overlap = 50,
  ): Promise<number> {
    const chunks = this.splitText(text, chunkSize, overlap);
    let count = 0;

    for (let i = 0; i < chunks.length; i++) {
      await this.addChunk(kbId, chunks[i], { chunkIndex: i, totalChunks: chunks.length });
      count++;
    }

    return count;
  }

  private splitText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
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

    if (current) chunks.push(current.trim());
    return chunks;
  }
}
