import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { RedisService } from '../modules/common/redis.service';
import { JwtService } from '@nestjs/jwt';
import { SendMessageDto } from '../modules/chat/dto/chat.dto';

@Injectable()
export class ChatGatewayService {
  private readonly logger = new Logger(ChatGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
  ) {}

  async authenticate(token: string) {
    if (!token) return null;
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, username: true, avatarUrl: true, status: true, userType: true },
      });
      return user;
    } catch {
      return null;
    }
  }

  async setUserOnline(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'online', lastSeenAt: new Date() },
    });
    try {
      await this.redis.set(`online:${userId}`, Date.now().toString(), 24 * 60 * 60 * 1000);
    } catch (err: any) {
      this.logger.warn(`setUserOnline Redis unavailable: ${err.message}`);
    }
  }

  async setUserOffline(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'offline' },
    });
    try {
      await this.redis.del(`online:${userId}`);
    } catch (err: any) {
      this.logger.warn(`setUserOffline Redis unavailable: ${err.message}`);
    }
  }

  async canJoinSession(userId: string, sessionId: string): Promise<boolean> {
    const member = await this.prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });
    return !!member;
  }

  async getOrCreateAgentSession(userId: string): Promise<string> {
    let session = await this.prisma.chatSession.findFirst({
      where: { sessionType: 'agent', ownerId: userId },
    });

    if (!session) {
      session = await this.prisma.chatSession.create({
        data: {
          sessionType: 'agent',
          name: 'AI Assistant',
          owner: { connect: { id: userId } },
          members: {
            create: { userId, role: 'owner' },
          },
        },
      });
    }

    return session.id;
  }

  async sendMessage(userId: string, sessionId: string, dto: Partial<SendMessageDto>) {
    const clientMsgId = dto.metadata?.clientMsgId as string | undefined;

    // Idempotency: if clientMsgId is provided and already exists, return existing message
    if (clientMsgId) {
      try {
        const existing = await this.prisma.message.findFirst({
          where: {
            senderId: userId,
            sessionId,
            metadata: { path: ['clientMsgId'], equals: clientMsgId },
          },
          include: {
            sender: { select: { id: true, username: true, avatarUrl: true, nickname: true } },
            reactions: true,
          },
        });
        if (existing) {
          this.logger.debug(`[ACK] Duplicate clientMsgId=${clientMsgId}, returning existing message ${existing.id}`);
          return existing;
        }
      } catch (err: any) {
        this.logger.warn(`[ACK] Idempotency check failed for clientMsgId=${clientMsgId}: ${err.message}`);
      }
    }

    // Assign monotonically increasing sequence number per session
    let seq = Date.now(); // fallback if Redis fails
    try {
      seq = await this.redis.incr(`seq:${sessionId}`);
    } catch (err: any) {
      this.logger.warn(`[SEQ] Redis INCR failed for session ${sessionId}, using timestamp fallback: ${err.message}`);
    }

    const metadata = {
      ...(dto.metadata || {}),
      seq,
    };

    return this.prisma.message.create({
      data: {
        sessionId,
        senderId: userId,
        content: dto.content || '',
        contentType: dto.contentType || 'text',
        metadata,
      },
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true, nickname: true } },
        reactions: true,
      },
    });
  }

  async recallMessage(userId: string, messageId: string) {
    return this.prisma.message.update({
      where: { id: messageId },
      data: { isRecalled: true, recalledAt: new Date(), recalledById: userId },
    });
  }

  async getMessageById(messageId: string) {
    return this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, sessionId: true },
    });
  }

  async editMessage(userId: string, messageId: string, newContent: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new Error('Message not found');
    if (message.senderId !== userId) throw new Error('Cannot edit others message');

    // Save edit history
    await this.prisma.messageEdit.create({
      data: { messageId, content: message.content },
    });

    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: newContent,
        editCount: { increment: 1 },
      },
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true, nickname: true } },
        reactions: true,
      },
    });
  }

  async markRead(userId: string, sessionId: string, _lastMessageId: string) {
    await this.prisma.chatSessionMember.update({
      where: { sessionId_userId: { sessionId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  async *streamAIResponse(userId: string, content: string): AsyncGenerator<string> {
    const { DeepSeekProvider } = await import('../modules/llm/providers/deepseek.provider');
    const provider = new DeepSeekProvider();

    const messages = [
      { role: 'system', content: 'You are a helpful AI assistant in a chat application. Be concise and friendly.' },
      { role: 'user', content },
    ];

    yield* provider.chatStream(messages);
  }
}
