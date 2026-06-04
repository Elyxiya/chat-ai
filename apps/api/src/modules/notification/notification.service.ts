import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { ChatGateway } from '../../gateways/chat.gateway';
import { CreateNotificationDto, NotificationType } from './dto/notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async create(dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        data: dto.data as any,
      },
    });

    this.chatGateway.emitToUser(dto.userId, 'notification', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      data: notification.data,
      createdAt: notification.createdAt,
    });

    return notification;
  }

  async createFriendRequest(requesterId: string, addresseeId: string, requesterName: string) {
    return this.create({
      userId: addresseeId,
      type: NotificationType.FRIEND_REQUEST,
      title: '好友请求',
      content: `${requesterName} 向你发送了好友请求`,
      data: { requesterId },
    });
  }

  async createMention(sessionId: string, mentionedUserId: string, senderName: string, content: string) {
    // Check if the user has muted this session
    const member = await this.prisma.chatSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId: mentionedUserId } },
      select: { muted: true, mutedUntil: true },
    });

    if (member?.muted) {
      if (member.mutedUntil && member.mutedUntil < new Date()) {
        // Mute expired — proceed normally
      } else {
        return null; // Session is muted, skip notification
      }
    }

    return this.create({
      userId: mentionedUserId,
      type: NotificationType.MENTION,
      title: '有人提到了你',
      content: `${senderName} 在消息中提到了你: ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`,
      data: { sessionId },
    });
  }

  async findAll(userId: string, limit = 50) {
    const take = typeof limit === 'number' && !isNaN(limit) ? limit : 50;
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async findUnread(userId: string) {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  /** 拉取指定时间之后的未读通知（用于上线时同步离线期间的@all等） */
  async findUnreadSince(userId: string, since: string) {
    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      return this.findAll(userId, 50);
    }
    return this.prisma.notification.findMany({
      where: {
        userId,
        readAt: null,
        createdAt: { gt: sinceDate },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async delete(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) throw new NotFoundException('Notification not found');

    return this.prisma.notification.delete({ where: { id: notificationId } });
  }

  async deleteAll(userId: string) {
    return this.prisma.notification.deleteMany({ where: { userId } });
  }
}
