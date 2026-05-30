import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { EmbeddingService } from '../../llm/providers/embedding.service';
import { RagChunk } from '../types';

@Injectable()
export class RagEngine {
  private readonly logger = new Logger(RagEngine.name);
  private warnedFallback = false;

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
      // If no specific kbId, search across all knowledge bases accessible to user
      if (!kbId) {
        return this.retrieveAllUserBases(query, userId, topK);
      }

      const queryEmbedding = await this.embedding.embed(query);

      let chunks: Array<{ id: string; content: string; metadata: any; score: number }>;

      if (!queryEmbedding || queryEmbedding.length === 0) {
        const kwChunks = await this.keywordSearch(query, kbId, topK);
        chunks = kwChunks.map((c) => ({ ...c, metadata: c.metadata || {} }));
      } else {
        chunks = await this.prisma.$queryRaw<
          Array<{ id: string; content: string; metadata: any; score: number }>
        >`
          SELECT id, content, metadata,
            1 - (embedding <=> ${queryEmbedding}::vector) AS score
          FROM knowledge_chunks
          WHERE kb_id = ${kbId}::uuid
          ORDER BY embedding <=> ${queryEmbedding}::vector
          LIMIT ${topK}
        `;
      }

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

  /**
   * Search all knowledge bases accessible to the user.
   * Used when Agent searches without specifying a specific kbId.
   */
  private async retrieveAllUserBases(query: string, userId: string, topK = 5): Promise<string> {
    try {
      const bases = await this.prisma.knowledgeBase.findMany({
        where: { OR: [{ ownerId: userId }, { isPublic: true }] },
        select: { id: true, name: true },
      });

      if (bases.length === 0) return '';

      // Search each base and collect results
      const allResults: Array<{ content: string; kbName: string }> = [];
      const perBaseK = Math.max(1, Math.ceil(topK / bases.length));

      for (const base of bases) {
        const kwChunks = await this.keywordSearch(query, base.id, perBaseK);
        for (const c of kwChunks) {
          allResults.push({ content: c.content, kbName: base.name });
        }
      }

      if (allResults.length === 0) return '';

      const context = allResults
        .map((c, i) => `[${i + 1}] ${c.content}\n来源: ${c.kbName}`)
        .join('\n\n');

      return `【相关知识】\n${context}`;
    } catch (error) {
      this.logger.warn(`Cross-base retrieval failed: ${error.message}`);
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
        // Vector embedding unavailable — fall back to keyword search
        return this.keywordSearch(query, kbId, topK);
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

  /**
   * Keyword search fallback when vector embedding is unavailable.
   * Splits the query into words and uses ILIKE to find matching chunks,
   * ranked by how many query words match.
   */
  private async keywordSearch(query: string, kbId: string, topK = 5): Promise<RagChunk[]> {
    try {
      const words = query
        .split(/[\s,，。.！？、；;：:()（）\[\]【】]+/)
        .filter((w) => w.length > 0);
      if (words.length === 0) return [];

      // Use Prisma findMany to avoid raw SQL type issues with uuid columns
      const chunks = await this.prisma.knowledgeChunk.findMany({
        where: { kbId },
        select: { id: true, content: true, metadata: true },
      });
      if (chunks.length === 0) return [];

      // Score by case-insensitive word match count in JavaScript
      const lowerWords = words.map((w) => w.toLowerCase());
      const scored = chunks
        .map((c) => {
          const lower = c.content.toLowerCase();
          const matches = lowerWords.filter((w) => lower.includes(w)).length;
          return { id: c.id, content: c.content, metadata: c.metadata, score: matches };
        })
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return scored.map((c) => ({
        id: c.id,
        content: c.content,
        score: c.score / Math.max(words.length, 1),
        metadata: c.metadata as Record<string, unknown>,
      }));
    } catch (error) {
      this.logger.warn(`Keyword search fallback failed: ${error.message}`);
      return [];
    }
  }

  async addChunk(
    kbId: string,
    content: string,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    try {
      let embedding = await this.embedding.embed(content);

      // Fallback: use zero vector if embedding fails
      if (!embedding || embedding.length === 0) {
        if (!this.warnedFallback) {
          this.logger.warn(`Embedding unavailable; using zero vector. Content stored but semantic search disabled.`);
          this.warnedFallback = true;
        }
        embedding = new Array(1536).fill(0);
      }

      await this.prisma.$executeRaw`
        INSERT INTO knowledge_chunks (id, kb_id, content, embedding, chunk_index, metadata, created_at)
        VALUES (
          gen_random_uuid(),
          ${kbId}::uuid,
          ${content}::text,
          ${`[${embedding.join(',')}]`}::vector(1536),
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
    extraMetadata: Record<string, any> = {},
  ): Promise<number> {
    const chunks = this.splitText(text, chunkSize, overlap);
    let count = 0;

    for (let i = 0; i < chunks.length; i++) {
      await this.addChunk(kbId, chunks[i], {
        chunkIndex: i,
        totalChunks: chunks.length,
        ...extraMetadata,
      });
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
