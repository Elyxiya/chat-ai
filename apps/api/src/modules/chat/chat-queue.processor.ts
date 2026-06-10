import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { ChatGateway } from '../../gateways/chat.gateway';
import { QueuedMessage } from './chat-queue.service';

const BATCH_INTERVAL = 200; // ms
const BATCH_MAX_SIZE = 50;

interface BatchEntry {
  job: Job<QueuedMessage, any>;
  msg: QueuedMessage;
}

/**
 * BullMQ processor for chat-messages queue.
 *
 * Batches incoming messages and writes them in bulk using raw SQL
 * INSERT ... RETURNING, then broadcasts to the session room in seq order.
 */
@Processor('chat-messages')
export class ChatQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatQueueProcessor.name);
  private batch: BatchEntry[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
  ) {
    super();
  }

  async process(job: Job<QueuedMessage, any, string>): Promise<any> {
    // Collect into batch
    this.batch.push({ job, msg: job.data });

    // Flush when batch is full
    if (this.batch.length >= BATCH_MAX_SIZE) {
      await this.flush();
      return;
    }

    // Schedule flush after interval
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flush(), BATCH_INTERVAL);
    }
  }

  private async flush() {
    if (this.processing || this.batch.length === 0) return;
    this.processing = true;

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const entries = this.batch.splice(0);
    const startTime = Date.now();

    try {
      // 1. Sort by seq to guarantee broadcast order
      entries.sort((a, b) => a.msg.seq - b.msg.seq);

      // 2. Bulk insert using raw SQL with RETURNING
      const values = entries
        .map(
          (e, i) =>
            `($${i * 7 + 1}::uuid, $${i * 7 + 2}::uuid, $${i * 7 + 3}::text, $${
              i * 7 + 4
            }::varchar(30), $${i * 7 + 5}::jsonb, $${i * 7 + 6}::bigint, NOW(), NOW())`,
        )
        .join(', ');

      const params = entries.flatMap((e) => [
        e.msg.sessionId,
        e.msg.senderId,
        e.msg.content,
        e.msg.contentType,
        JSON.stringify(e.msg.metadata),
        e.msg.seq,
      ]);

      const rawSql = `
        INSERT INTO messages (session_id, sender_id, content, content_type, metadata, seq, created_at, updated_at)
        VALUES ${values}
        RETURNING id, seq, metadata->>'clientMsgId' AS returned_client_msg_id
      `;

      const inserted: Array<{ id: string; seq: number; returned_client_msg_id: string }> =
        await this.prisma.$queryRawUnsafe(rawSql, ...params);

      // 3. Build clientMsgId → serverMsgId map
      const idMap = new Map<string, { serverMsgId: string; seq: number }>();
      for (const row of inserted) {
        if (row.returned_client_msg_id) {
          idMap.set(row.returned_client_msg_id, {
            serverMsgId: row.id,
            seq: row.seq,
          });
        }
      }

      // 4. Send ACKs and broadcast per session
      const messagesBySession = new Map<string, any[]>();
      for (const entry of entries) {
        const msg = entry.msg;
        const idMapping = idMap.get(msg.clientMsgId);

        // ACK to sender
        if (idMapping) {
          const ack = {
            clientMsgId: msg.clientMsgId,
            serverMsgId: idMapping.serverMsgId,
            seq: msg.seq,
            status: 'sent' as const,
          };
          this.chatGateway.emitToUser(msg.senderId, 'message_ack', ack);
        }

        // Prepare broadcast message
        const broadcastMsg = {
          id: idMapping?.serverMsgId || '',
          sessionId: msg.sessionId,
          senderId: msg.senderId,
          content: msg.content,
          contentType: msg.contentType,
          metadata: msg.metadata,
          isRecalled: false,
          isPinned: false,
          editCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          reactions: [],
        };

        const sessionMsgs = messagesBySession.get(msg.sessionId) || [];
        sessionMsgs.push(broadcastMsg);
        messagesBySession.set(msg.sessionId, sessionMsgs);
      }

      // 5. Broadcast per session (one emit per session, not per message)
      for (const [sessionId, msgs] of messagesBySession) {
        for (const msg of msgs) {
          this.chatGateway.emitToSession(sessionId, 'message', msg);
        }
      }

      this.logger.debug(
        `[QUEUE] Flushed ${entries.length} messages in ${Date.now() - startTime}ms`,
      );
    } catch (err: any) {
      this.logger.error(`[QUEUE] Batch flush failed: ${err.message}`);
      // Re-queue individual messages on failure
      for (const entry of entries) {
        try {
          await entry.job.retry();
        } catch {
          this.logger.warn(`[QUEUE] Retry failed for msg ${entry.msg.clientMsgId}`);
        }
      }
    } finally {
      this.processing = false;
      // If more messages arrived during flush, schedule another flush
      if (this.batch.length > 0) {
        this.batchTimer = setTimeout(() => this.flush(), BATCH_INTERVAL);
      }
    }
  }

  /** Queue depth for metrics */
  async getWaitingCount(): Promise<number> {
    try {
      const counts = await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS cnt FROM bullmq_jobs WHERE queue = 'chat-messages' AND status = 'waiting'`,
      );
      return (counts as any[])?.[0]?.cnt || 0;
    } catch {
      return 0;
    }
  }
}
