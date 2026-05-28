import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { RedisService } from '../common/redis.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/dto/notification.dto';
import {
  CreateSessionDto,
  SendMessageDto,
  UpdateSessionDto,
  MessageWithSender,
} from './dto/chat.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notificationService: NotificationService,
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

    const sessionIds = memberships.map((m: any) => m.sessionId);

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

    const sessions = memberships.map((m: any) => ({
      ...m.session,
      myRole: m.role,
      myNickname: m.nickname,
      lastReadAt: m.lastReadAt,
      pinnedAt: m.pinnedAt,
      lastMessage: lastMessageBySession.get(m.sessionId) || null,
      unreadCount: lastMessageBySession.has(m.sessionId) && m.lastReadAt
        ? recentMessages.filter(
            (msg: any) =>
              msg.sessionId === m.sessionId &&
              msg.createdAt > (m.lastReadAt ?? new Date(0)) &&
              msg.senderId !== userId,
          ).length
        : 0,
    }));

    // Sort: pinned first, then by lastMessage time
    sessions.sort((a: any, b: any) => {
      if (a.pinnedAt && !b.pinnedAt) return -1;
      if (!a.pinnedAt && b.pinnedAt) return 1;
      if (a.pinnedAt && b.pinnedAt) return new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime();
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.createdAt).getTime();
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

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

    // Detect @all / @everyone mention
    const hasAtAll = /\B@(all|everyone)\b/i.test(dto.content);
    let atAllTargets: string[] = [];

    if (hasAtAll) {
      const session = await this.prisma.chatSession.findUnique({
        where: { id: sessionId },
        select: { sessionType: true },
      });

      if (session && session.sessionType === 'group') {
        // Only admins and owner can use @all
        if (member.role !== 'owner' && member.role !== 'admin') {
          // Strip @all from content for non-admin users
          dto.content = dto.content.replace(/\B@(all|everyone)\b/gi, '@all');
        } else {
          // Rate limit check via Redis (5-minute cooldown)
          const rateKey = `atall:${sessionId}:${userId}`;
          try {
            const lastUsed = await this.redis.get(rateKey);
            if (lastUsed) {
              // Rate limited — still allow but don't trigger notifications
              this.logger.warn(`@all rate limited for user ${userId} in session ${sessionId}`);
            } else {
              await this.redis.set(rateKey, Date.now().toString(), 300); // 5 min TTL
              // Get all members to notify
              const allMembers = await this.prisma.chatSessionMember.findMany({
                where: { sessionId, userId: { not: userId } },
                select: { userId: true },
              });
              atAllTargets = allMembers.map((m) => m.userId);
            }
          } catch (err: any) {
            this.logger.warn(`@all rate check failed: ${err.message}`);
          }
        }
      }
    }

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

    // Create mentions from explicit mention list
    if (dto.mentions?.length) {
      await this.prisma.messageMention.createMany({
        data: dto.mentions.map((userId) => ({
          messageId: message.id,
          userId,
        })),
      });
    }

    // Create mentions for @all targets
    if (atAllTargets.length > 0) {
      await this.prisma.messageMention.createMany({
        data: atAllTargets.map((targetId) => ({
          messageId: message.id,
          userId: targetId,
        })),
      });

      // Create notifications for @all
      const sender = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, nickname: true },
      });
      const senderName = sender?.nickname || sender?.username || 'Someone';

      for (const targetId of atAllTargets) {
        try {
          await this.notificationService.create({
            userId: targetId,
            type: NotificationType.MENTION,
            title: `@all from ${senderName}`,
            content: dto.content.slice(0, 100),
            data: { messageId: message.id, sessionId, mentionedBy: userId, type: 'all' },
          });
        } catch (err: any) {
          this.logger.error(`Failed to send @all notification to ${targetId}: ${err.message}`);
        }
      }
    }

    return message as unknown as MessageWithSender;
  }

  async forwardMessage(userId: string, messageId: string, targetSessionIds: string[]) {
    const original = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!original) throw new NotFoundException('Message not found');

    const memberSessions = await this.prisma.chatSessionMember.findMany({
      where: { userId, sessionId: { in: targetSessionIds } },
      select: { sessionId: true },
    });

    const validSessionIds = memberSessions.map((m) => m.sessionId);
    if (validSessionIds.length === 0) {
      throw new ForbiddenException('Not a member of any target session');
    }

    const forwardedMessages = await Promise.all(
      validSessionIds.map((sid) =>
        this.prisma.message.create({
          data: {
            sessionId: sid,
            senderId: userId,
            content: original.content,
            contentType: original.contentType,
            metadata: {
              ...(original.metadata as Record<string, any> || {}),
              forwardedFrom: original.senderId,
              forwardedMessageId: original.id,
              forwardedAt: new Date().toISOString(),
            },
          },
          include: {
            sender: { select: { id: true, username: true, avatarUrl: true, nickname: true } },
            reactions: true,
          },
        }),
      ),
    );

    // Update session timestamps
    await this.prisma.chatSession.updateMany({
      where: { id: { in: validSessionIds } },
      data: { updatedAt: new Date() },
    });

    return forwardedMessages;
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

  async batchForwardMessages(userId: string, messageIds: string[], targetSessionId: string) {
    if (!messageIds?.length) throw new NotFoundException('No messages to forward');
    if (messageIds.length > 50) throw new ForbiddenException('Cannot forward more than 50 messages at once');

    const isMember = await this.prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId: targetSessionId, userId } },
    });

    if (!isMember) throw new ForbiddenException('Not a member of target session');

    const messages = await this.prisma.message.findMany({
      where: { id: { in: messageIds }, isRecalled: false },
    });

    if (messages.length === 0) throw new NotFoundException('No valid messages to forward');

    const forwarded = await Promise.all(
      messages.map((msg) =>
        this.prisma.message.create({
          data: {
            sessionId: targetSessionId,
            senderId: userId,
            content: msg.content,
            contentType: msg.contentType,
            metadata: {
              ...(msg.metadata as Record<string, any> || {}),
              forwardedFrom: msg.senderId,
              forwardedMessageId: msg.id,
              forwardedAt: new Date().toISOString(),
            },
          },
          include: {
            sender: { select: { id: true, username: true, avatarUrl: true, nickname: true } },
            reactions: true,
          },
        }),
      ),
    );

    await this.prisma.chatSession.update({
      where: { id: targetSessionId },
      data: { updatedAt: new Date() },
    });

    return { forwarded: forwarded.length, total: messageIds.length };
  }

  async batchDeleteMessages(userId: string, messageIds: string[], deleteType: 'self' | 'everyone') {
    if (!messageIds?.length) throw new NotFoundException('No messages to delete');
    if (messageIds.length > 50) throw new ForbiddenException('Cannot delete more than 50 messages at once');

    if (deleteType === 'everyone') {
      const messages = await this.prisma.message.findMany({
        where: { id: { in: messageIds }, senderId: userId, isRecalled: false },
      });

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      for (const msg of messages) {
        if (msg.createdAt >= fiveMinutesAgo) {
          await this.prisma.message.update({
            where: { id: msg.id },
            data: { isRecalled: true, recalledAt: new Date(), recalledById: userId },
          });
        }
      }

      return { deleted: messages.length, skipped: messageIds.length - messages.length };
    }

    // "self" mode: no-op on backend, handled by frontend filtering
    return { deleted: messageIds.length, skipped: 0 };
  }

  async markAsRead(userId: string, sessionId: string, _lastMessageId?: string) {
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

  private async sendFriendRequestNotification(userId: string, friendId: string) {
    // Check if a pending friend_request notification already exists for this pair
    const existingNotif = await this.prisma.notification.findFirst({
      where: {
        userId: friendId,
        type: 'friend_request',
        isRead: false,
        // Match notifications where data->requesterId matches the requester
      },
      orderBy: { createdAt: 'desc' },
    });
    // If there's an unread friend_request notification for this pair, skip sending another
    if (existingNotif) {
      const data = existingNotif.data as Record<string, any> | undefined;
      if (data?.requesterId === userId) return;
    }

    const requester = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!requester) return;
    const requesterName = requester.nickname || requester.username || 'Someone';
    try {
      await this.notificationService.createFriendRequest(userId, friendId, requesterName);
    } catch (err) {
      this.logger.error(`Failed to send friend request notification from ${userId} to ${friendId}: ${err.message}`);
    }
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

        if (existing) {
          // Still send notification if pending — the first one may have been missed
          if (existing.status === 'pending') {
            await this.sendFriendRequestNotification(userId, friendId);
          }
          return { status: existing.status };
        }

        await this.sendFriendRequestNotification(userId, friendId);

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

    try {
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'online:*', 100);
        cursor = nextCursor;
        userIds.push(...keys.map((k: string) => k.replace('online:', '')));
      } while (cursor !== '0');
    } catch (err: any) {
      this.logger.warn(`getOnlineUsers Redis unavailable: ${err.message}`);
      return [];
    }

    if (userIds.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, avatarUrl: true, status: true },
    });

    return users;
  }

  async searchMessages(userId: string, sessionId: string, query: string) {
    if (!query || query.length < 1) return [];

    const member = await this.prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });

    if (!member) throw new ForbiddenException('Not a member of this session');

    return this.prisma.message.findMany({
      where: {
        sessionId,
        isRecalled: false,
        contentType: 'text',
        content: { contains: query, mode: 'insensitive' },
      },
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true, nickname: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getSessionMembers(userId: string, sessionId: string) {
    const member = await this.prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this session');

    return this.prisma.chatSessionMember.findMany({
      where: { sessionId },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true, nickname: true, status: true } },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
  }

  async setAnnouncement(userId: string, sessionId: string, content: string) {
    const member = await this.prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      throw new ForbiddenException('Only admins can set announcements');
    }

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        announcement: content,
        announcementUpdatedAt: new Date(),
        announcementUpdaterId: userId,
      },
    });

    // Create system message about announcement update
    await this.prisma.message.create({
      data: {
        sessionId,
        senderId: null,
        content: `📢 Announcement updated`,
        contentType: 'system',
        metadata: { announcement: content, updatedBy: userId },
      },
    });

    return { content, updatedAt: new Date() };
  }

  async removeAnnouncement(userId: string, sessionId: string) {
    const member = await this.prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      throw new ForbiddenException('Only admins can remove announcements');
    }

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { announcement: null, announcementUpdatedAt: null, announcementUpdaterId: null },
    });
  }

  async generateInviteLink(userId: string, sessionId: string) {
    const member = await this.prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      throw new ForbiddenException('Only admins can generate invite links');
    }

    const code = `${sessionId.slice(0, 8)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { inviteCode: code, inviteCodeExpiresAt: expiresAt },
    });

    return { code, expiresAt, url: `/join?code=${code}` };
  }

  async joinByLink(userId: string, code: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { inviteCode: code },
    });

    if (!session) throw new NotFoundException('Invalid invite link');
    if (session.inviteCodeExpiresAt && session.inviteCodeExpiresAt < new Date()) {
      throw new ForbiddenException('Invite link has expired');
    }

    const existing = await this.prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId: session.id, userId } },
    });
    if (existing) return { sessionId: session.id, alreadyMember: true };

    await this.prisma.chatSessionMember.create({
      data: { sessionId: session.id, userId, role: 'member' },
    });

    // System message
    await this.prisma.message.create({
      data: {
        sessionId: session.id,
        content: `joined the group via invite link`,
        contentType: 'system',
        metadata: { userId, invited: true },
      },
    });

    return { sessionId: session.id, alreadyMember: false };
  }

  async globalSearch(
    userId: string,
    query: string,
    options: {
      sessionId?: string;
      types?: string[];
      page: number;
      limit: number;
    },
  ) {
    if (!query || query.length < 1) {
      return { results: [], total: 0, page: options.page, limit: options.limit };
    }

    const userSessionIds = await this.prisma.chatSessionMember.findMany({
      where: { userId },
      select: { sessionId: true },
    });

    const allSessionIds = userSessionIds.map((s: { sessionId: string }) => s.sessionId);
    if (allSessionIds.length === 0) {
      return { results: [], total: 0, page: options.page, limit: options.limit };
    }

    const where: any = {
      sessionId: options.sessionId || { in: allSessionIds },
      isRecalled: false,
      content: { contains: query, mode: 'insensitive' },
    };

    if (options.types?.length) {
      where.contentType = { in: options.types };
    }

    const [total, messages] = await Promise.all([
      this.prisma.message.count({ where }),
      this.prisma.message.findMany({
        where,
        include: {
          sender: {
            select: { id: true, username: true, avatarUrl: true, nickname: true },
          },
          session: {
            select: { id: true, name: true, sessionType: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.limit,
        take: options.limit,
      }),
    ]);

    const results = messages.map((msg: any) => ({
      message: {
        id: msg.id,
        content: msg.content,
        contentType: msg.contentType,
        createdAt: msg.createdAt,
        sender: msg.sender,
      },
      session: msg.session,
      highlight: this.buildHighlight(msg.content, query),
    }));

    return { results, total, page: options.page, limit: options.limit };
  }

  private buildHighlight(content: string, query: string): string {
    const idx = content.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return content.slice(0, 100);
    const start = Math.max(0, idx - 40);
    const end = Math.min(content.length, idx + query.length + 60);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < content.length ? '...' : '';
    return prefix + content.slice(start, end) + suffix;
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

  async getReadReceipts(userId: string, messageId: string, page: number = 1, limit: number = 50) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { session: { include: { members: true } } },
    });

    if (!message) throw new NotFoundException('Message not found');

    const isMember = message.session.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Not a member of this session');

    const members = await this.prisma.chatSessionMember.findMany({
      where: { sessionId: message.sessionId },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true, nickname: true, status: true } },
      },
    });

    const msgTime = new Date(message.createdAt).getTime();
    const readUsers = members
      .filter((m) => m.lastReadAt && new Date(m.lastReadAt).getTime() >= msgTime)
      .map((m) => ({
        userId: m.user.id,
        username: m.user.username,
        nickname: m.user.nickname,
        avatarUrl: m.user.avatarUrl,
        status: m.user.status,
        readAt: m.lastReadAt!.toISOString(),
      }))
      .sort((a, b) => new Date(b.readAt).getTime() - new Date(a.readAt).getTime());

    const unreadUsers = members
      .filter((m) => !m.lastReadAt || new Date(m.lastReadAt).getTime() < msgTime)
      .map((m) => ({
        userId: m.user.id,
        username: m.user.username,
        nickname: m.user.nickname,
        avatarUrl: m.user.avatarUrl,
        status: m.user.status,
      }));

    const total = readUsers.length;
    const start = (page - 1) * limit;
    const pagedReadUsers = readUsers.slice(start, start + limit);

    return {
      readCount: total,
      unreadCount: unreadUsers.length,
      total: members.length,
      readUsers: pagedReadUsers,
      unreadUsers,
      pagination: { page, limit, total },
    };
  }

  async editMessage(userId: string, messageId: string, newContent: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('Cannot edit others message');
    if (message.isRecalled) throw new ForbiddenException('Cannot edit a recalled message');

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (message.createdAt < fifteenMinutesAgo) {
      throw new ForbiddenException('Cannot edit messages older than 15 minutes');
    }

    // Save the previous version as an edit history entry
    await this.prisma.messageEdit.create({
      data: {
        messageId,
        content: message.content,
      },
    });

    const updated = await this.prisma.message.update({
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

    return updated;
  }

  async getEditHistory(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { session: { include: { members: true } } },
    });

    if (!message) throw new NotFoundException('Message not found');

    const isMember = message.session.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Not a member of this session');

    const edits = await this.prisma.messageEdit.findMany({
      where: { messageId },
      orderBy: { editedAt: 'desc' },
      select: { content: true, editedAt: true },
    });

    return edits;
  }

  async toggleBookmark(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { session: { include: { members: true } } },
    });

    if (!message) throw new NotFoundException('Message not found');

    const isMember = message.session.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Not a member of this session');

    const existing = await this.prisma.bookmark.findUnique({
      where: { userId_messageId: { userId, messageId } },
    });

    if (existing) {
      await this.prisma.bookmark.delete({ where: { id: existing.id } });
      return { bookmarked: false };
    }

    await this.prisma.bookmark.create({
      data: { userId, messageId },
    });

    return { bookmarked: true };
  }

  async getBookmarks(userId: string, limit: number) {
    const bookmarks = await this.prisma.bookmark.findMany({
      where: { userId },
      include: {
        message: {
          include: {
            sender: { select: { id: true, username: true, avatarUrl: true, nickname: true } },
            session: { select: { id: true, name: true, sessionType: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return bookmarks.map((b) => ({
      id: b.id,
      bookmarkedAt: b.createdAt,
      message: b.message,
    }));
  }

  async muteSession(userId: string, sessionId: string, muted: boolean, muteUntil?: string) {
    const member = await this.prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this session');

    const data: any = { muted };
    if (muteUntil) {
      data.mutedUntil = new Date(muteUntil);
    } else if (!muted) {
      data.mutedUntil = null;
    }

    await this.prisma.chatSessionMember.update({
      where: { sessionId_userId: { sessionId, userId } },
      data,
    });

    return { muted, mutedUntil: muteUntil || null };
  }

  async togglePinSession(userId: string, sessionId: string) {
    const member = await this.prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });

    if (!member) throw new ForbiddenException('Not a member of this session');

    if (member.pinnedAt) {
      await this.prisma.chatSessionMember.update({
        where: { sessionId_userId: { sessionId, userId } },
        data: { pinnedAt: null },
      });
      return { pinned: false };
    }

    await this.prisma.chatSessionMember.update({
      where: { sessionId_userId: { sessionId, userId } },
      data: { pinnedAt: new Date() },
    });

    return { pinned: true };
  }

  async addReaction(userId: string, messageId: string, emoji: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { session: { include: { members: true } } },
    });

    if (!message) throw new NotFoundException('Message not found');

    const isMember = message.session.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Not a member of this session');

    const existing = await this.prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });

    if (existing) return existing;

    return this.prisma.messageReaction.create({
      data: { messageId, userId, emoji },
    });
  }

  async removeReaction(userId: string, messageId: string, emoji: string) {
    const reaction = await this.prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });

    if (!reaction) throw new NotFoundException('Reaction not found');

    await this.prisma.messageReaction.delete({
      where: { id: reaction.id },
    });

    return { success: true };
  }
}
