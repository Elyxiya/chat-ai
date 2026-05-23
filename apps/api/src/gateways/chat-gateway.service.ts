import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { RedisService } from '../modules/common/redis.service';
import { JwtService } from '@nestjs/jwt';
import { SendMessageDto } from '../modules/chat/dto/chat.dto';

@Injectable()
export class ChatGatewayService {
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
    await this.redis.set(`online:${userId}`, Date.now().toString(), 24 * 60 * 60 * 1000);
  }

  async setUserOffline(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'offline' },
    });
    await this.redis.del(`online:${userId}`);
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
          ownerId: userId,
          members: {
            create: { userId, role: 'owner' },
          },
        },
      });
    }

    return session.id;
  }

  async sendMessage(userId: string, sessionId: string, dto: Partial<SendMessageDto>) {
    return this.prisma.message.create({
      data: {
        sessionId,
        senderId: userId,
        content: dto.content || '',
        contentType: dto.contentType || 'text',
        metadata: dto.metadata || {},
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
