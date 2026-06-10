import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface QueuedMessage {
  clientMsgId: string;
  sessionId: string;
  senderId: string;
  content: string;
  contentType: string;
  metadata: Record<string, any>;
  mentions?: string[];
  replyToId?: string;
  seq: number;
  timestamp: number;
}

@Injectable()
export class ChatQueueService {
  private readonly logger = new Logger(ChatQueueService.name);

  constructor(
    @InjectQueue('chat-messages') private readonly messageQueue: Queue,
  ) {}

  async addToQueue(msg: QueuedMessage): Promise<void> {
    try {
      await this.messageQueue.add('send', msg, {
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    } catch (err: any) {
      this.logger.error(`[QUEUE] Failed to enqueue message: ${err.message}`);
      throw err;
    }
  }

  async getQueueSize(): Promise<number> {
    try {
      const counts = await this.messageQueue.getJobCounts();
      return (counts.waiting || 0) + (counts.active || 0);
    } catch {
      return 0;
    }
  }
}
