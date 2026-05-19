import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { RedisService } from '../common/redis.service';
import {
  CreateSessionDto,
  SendMessageDto,
  UpdateSessionDto,
  MessageWithSender,
  SessionWithMembers,
} from './dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getUserSessions(userId: string) {
    const memberships = await this.prisma.chatSessionMember.findMany({
      where: { userId },
      include: {
        session: {
          include: {
            owner: { select: { id: true, username: true, avatarUrl: true } },
            members: {
              where: { userId: { not: userId } },
              take: 3,
              include: {
                user: { select: { id: true, username: true, avatarUrl: true, status: true } },
              },
            },
            _count: { select: { members: true, messages: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    if (memberships.length === 0) {
      return [];
    }

    const sessionIds = memberships.map((m) => m.sessionId);

    const recentMessages = await this.prisma.message.findMany({
      where: {
        sessionId: { in: sessionIds },
        isRecalled: false,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    const lastMessageBySession = new Map<string, typeof recentMessages[0]>();
    for (const msg of recentMessages) {
      if (!lastMessageBySession.has(msg.sessionId)) {
        lastMessageBySession.set(msg.sessionId, msg);
      }
    }

    const sessions = memberships.map((m) => ({
      ...m.session,
      myRole: m.role,
      myNickname: m.nickname,
      lastReadAt: m.lastReadAt,
      lastMessage: lastMessageBySession.get(m.sessionId) || null,
      unreadCount: lastMessageBySession.has(m.sessionId) && m.lastReadAt
        ? recentMessages.filter(
            (msg) =>
              msg.sessionId === m.sessionId &&
              msg.createdAt > (m.lastReadAt ?? new Date(0)) &&
              msg.senderId !== userId,
          ).length
        : 0,
    }));

    return sessions;
  }

  async createSession(userId: string, dto: CreateSessionDto) {
    if (dto.sessionType === 'private' && dto.memberIds?.length === 1) {
      const existing = await this.prisma.chatSession.findFirst({
        where: {
          sessionType: 'private',
          AND: [
            { members: { some: { userId } } },
            { members: { some: { userId: dto.memberIds[0] } } },
          ],
        },
        include: { members: { include: { user: true } } },
      });

      if (existing) {
        return existing;
      }
    }

    const session = await this.prisma.chatSession.create({
      data: {
        sessionType: dto.sessionType,
        name: dto.name,
        description: dto.description,
        ownerId: userId,
        isPublic: dto.isPublic ?? false,
        members: {
          create: [
            { userId, role: 'owner' },
            ...(dto.memberIds?.map((id) => ({ userId: id })) || []),
          ],
        },
      },
      include: {
        members: { include: { user: { select: { id: true, username: true, avatarUrl: true, status: true } } } },
        owner: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    return session;
  }

  async getSession(userId: string, sessionId: string) {
    const member = await this.prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });

    if (!member) throw new ForbiddenException('Not a member of this session');

    return this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        members: { include: { user: { select: { id: true, username: true, avatarUrl: true, status: true, nickname: true } } } },
        owner: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
  }

  async updateSession(userId: string, sessionId: string, dto: UpdateSessionDto) {
    const member = await this.prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });

    if (!member || member.role === 'member') {
      throw new ForbiddenException('Insufficient permissions');
    }

    return this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        name: dto.name,
        description: dto.description,
        avatarUrl: dto.avatarUrl,
        isPublic: dto.isPublic,
      },
    });
  }

  async deleteSession(userId: string, sessionId: string) {
    const member = await this.prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });

    if (!member || member.role !== 'owner') {
      throw new ForbiddenException('Only owner can delete the session');
    }

    await this.prisma.chatSession.delete({ where: { id: sessionId } });
  }

  async getMessages(
    userId: string,
    sessionId: string,
    query: { limit?: number; before?: string },
  ) {
    const member = await this.prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });

    if (!member) throw new ForbiddenException('Not a member of this session');

    const limit = Math.min(query.limit || 50, 200);

    return this.prisma.message.findMany({
      where: {
        sessionId,
        isRecalled: false,
        ...(query.before ? { createdAt: { lt: new Date(query.before) } } : {}),
      },
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true, nickname: true } },
        reactions: true,
        replyTo: {
          select: { id: true, content: true, contentType: true, sender: { select: { username: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async sendMessage(
    userId: string,
    sessionId: string,
    dto: SendMessageDto,
  ): Promise<MessageWithSender> {
    const member = await this.prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });

    if (!member) throw new ForbiddenException('Not a member of this session');

    const message = await this.prisma.message.create({
      data: {
        sessionId,
        senderId: userId,
        content: dto.content,
        contentType: dto.contentType || 'text',
        metadata: dto.metadata || {},
      },
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true, nickname: true } },
        reactions: true,
      },
    });

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    if (dto.mentions?.length) {
      await this.prisma.messageMention.createMany({
        data: dto.mentions.map((userId) => ({
          messageId: message.id,
          userId,
        })),
      });
    }

    return message as unknown as MessageWithSender;
  }

  async recallMessage(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('Cannot recall others message');

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (message.createdAt < fiveMinutesAgo) {
      throw new ForbiddenException('Cannot recall messages older than 5 minutes');
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: { isRecalled: true, recalledAt: new Date(), recalledById: userId },
    });
  }

  async markAsRead(userId: string, sessionId: string, lastMessageId: string) {
    await this.prisma.chatSessionMember.update({
      where: { sessionId_userId: { sessionId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  async addMembers(userId: string, sessionId: string, memberIds: string[]) {
    const member = await this.prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });

    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { _count: { select: { members: true } }, maxMembers: true },
    });

    if (session && session._count.members + memberIds.length > session.maxMembers) {
      throw new ForbiddenException('Session is full');
    }

    const existingIds = await this.prisma.chatSessionMember.findMany({
      where: { sessionId, userId: { in: memberIds } },
      select: { userId: true },
    });

    const newIds = memberIds.filter((id) => !existingIds.some((e: { userId: string }) => e.userId === id));

    if (newIds.length) {
      await this.prisma.chatSessionMember.createMany({
        data: newIds.map((id) => ({ sessionId, userId: id })),
      });
    }

    return { added: newIds.length, skipped: memberIds.length - newIds.length };
  }

  async removeMember(userId: string, sessionId: string, targetUserId: string) {
    const member = await this.prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });

    if (!member || (member.role !== 'owner' && member.role !== 'admin' && member.userId !== targetUserId)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    await this.prisma.chatSessionMember.delete({
      where: { sessionId_userId: { sessionId, userId: targetUserId } },
    });
  }

  async getFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ userId }, { friendId: userId }],
        status: 'accepted',
      },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true, status: true, nickname: true } },
        friend: { select: { id: true, username: true, avatarUrl: true, status: true, nickname: true } },
      },
    });

    return friendships.map((f: { userId: string; friendId: string; friend: any; user: any }) => (f.userId === userId ? f.friend : f.user));
  }

  async manageFriend(userId: string, friendId: string, action: string) {
    switch (action) {
      case 'request': {
        const existing = await this.prisma.friendship.findFirst({
          where: {
            OR: [
              { userId, friendId },
              { userId: friendId, friendId: userId },
            ],
          },
        });

        if (existing) return { status: existing.status };

        return this.prisma.friendship.create({
          data: { userId, friendId, status: 'pending' },
        });
      }

      case 'accept': {
        const request = await this.prisma.friendship.findFirst({
          where: { userId: friendId, friendId: userId, status: 'pending' },
        });

        if (!request) throw new NotFoundException('No pending friend request');

        await this.prisma.friendship.update({
          where: { id: request.id },
          data: { status: 'accepted' },
        });

        return this.prisma.friendship.create({
          data: { userId, friendId, status: 'accepted' },
        });
      }

      case 'reject':
      case 'block': {
        const request = await this.prisma.friendship.findFirst({
          where: { userId: friendId, friendId: userId },
        });

        if (request) {
          await this.prisma.friendship.update({
            where: { id: request.id },
            data: { status: action === 'block' ? 'blocked' : 'rejected' },
          });
        }

        if (action === 'block') {
          await this.prisma.friendship.upsert({
            where: { userId_friendId: { userId, friendId } },
            create: { userId, friendId, status: 'blocked' },
            update: { status: 'blocked' },
          });
        }

        return { status: action === 'block' ? 'blocked' : 'rejected' };
      }

      default:
        throw new ForbiddenException('Unknown action');
    }
  }

  async searchUsers(userId: string, query: string) {
    if (!query || query.length < 2) return [];

    return this.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } },
          {
            OR: [
              { username: { contains: query, mode: 'insensitive' } },
              { nickname: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          },
        ],
      },
      take: 20,
      select: {
        id: true,
        username: true,
        nickname: true,
        avatarUrl: true,
        status: true,
      },
    });
  }

  async getOnlineUsers() {
    const userIds: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'online:*', 100);
      cursor = nextCursor;
      userIds.push(...keys.map((k: string) => k.replace('online:', '')));
    } while (cursor !== '0');

    if (userIds.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, avatarUrl: true, status: true },
    });

    return users;
  }

  private async getUnreadCount(userId: string, sessionId: string, lastReadAt: Date | null): Promise<number> {
    const where: any = {
      sessionId,
      isRecalled: false,
    };

    if (lastReadAt) {
      where.createdAt = { gt: lastReadAt };
    }

    return this.prisma.message.count({ where });
  }
}
