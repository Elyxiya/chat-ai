import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PrismaService } from '../../config/prisma.service';
import { ChatGateway } from '../../gateways/chat.gateway';
import { NotificationType } from './dto/notification.dto';
import { makeNotification } from '../../test/factories/entities.factory';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockPrisma: any;
  let mockChatGateway: any;

  beforeEach(async () => {
    mockPrisma = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
      },
      chatSessionMember: {
        findUnique: jest.fn(),
      },
    };

    mockChatGateway = {
      emitToUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ChatGateway, useValue: mockChatGateway },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('NOTIF-SVC-01: should create notification and emit via gateway', async () => {
      const dto = {
        userId: 'user-2',
        type: NotificationType.SYSTEM,
        title: 'Test',
        content: 'Test content',
      };
      const notification = makeNotification({ userId: 'user-2', type: NotificationType.SYSTEM });
      mockPrisma.notification.create.mockResolvedValue(notification);

      await service.create(dto);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-2',
          type: NotificationType.SYSTEM,
        }),
      });
      expect(mockChatGateway.emitToUser).toHaveBeenCalledWith(
        'user-2',
        'notification',
        expect.any(Object),
      );
    });
  });

  describe('createFriendRequest', () => {
    it('NOTIF-SVC-02: should create FRIEND_REQUEST notification', async () => {
      const notification = makeNotification({ type: NotificationType.FRIEND_REQUEST });
      mockPrisma.notification.create.mockResolvedValue(notification);

      await service.createFriendRequest('user-1', 'user-2', 'Alice');

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-2',
          type: NotificationType.FRIEND_REQUEST,
          title: '好友请求',
        }),
      });
    });

    it('NOTIF-02: should create notification with requester data and emit via gateway', async () => {
      const notification = makeNotification({
        type: NotificationType.FRIEND_REQUEST,
        data: { requesterId: 'user-1' },
      });
      mockPrisma.notification.create.mockResolvedValue(notification);

      await service.createFriendRequest('user-1', 'user-2', 'Alice');

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-2',
          type: NotificationType.FRIEND_REQUEST,
          title: '好友请求',
          data: { requesterId: 'user-1' },
        }),
      });
      expect(mockChatGateway.emitToUser).toHaveBeenCalledWith(
        'user-2',
        'notification',
        expect.objectContaining({
          type: NotificationType.FRIEND_REQUEST,
        }),
      );
    });
  });

  describe('createMention', () => {
    it('should create MENTION notification with content preview', async () => {
      const notification = makeNotification({ type: NotificationType.MENTION });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue({ muted: false, mutedUntil: null });
      mockPrisma.notification.create.mockResolvedValue(notification);

      await service.createMention('session-1', 'user-2', 'Bob', 'Hello @user-2!');

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-2',
          type: NotificationType.MENTION,
          content: expect.stringContaining('Bob'),
        }),
      });
    });
  });

  describe('findAll', () => {
    it('NOTIF-SVC-03: should return notifications for user', async () => {
      const notifications = [
        makeNotification({ id: 'notif-1' }),
        makeNotification({ id: 'notif-2' }),
      ];
      mockPrisma.notification.findMany.mockResolvedValue(notifications);

      const result = await service.findAll('user-1', 50);

      expect(result).toHaveLength(2);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('should use default limit of 50', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);

      await service.findAll('user-1');

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });
  });

  describe('findUnread', () => {
    it('should return count of unread notifications', async () => {
      mockPrisma.notification.count.mockResolvedValue(5);

      const result = await service.findUnread('user-1');

      expect(result).toBe(5);
    });
  });

  describe('markAsRead', () => {
    it('should mark single notification as read', async () => {
      const notification = makeNotification({ id: 'notif-1', userId: 'user-1' });
      mockPrisma.notification.findUnique.mockResolvedValue(notification);
      const updated = { ...notification, isRead: true };
      mockPrisma.notification.update.mockResolvedValue(updated);

      const result = await service.markAsRead('user-1', 'notif-1');

      expect(result.isRead).toBe(true);
    });

    it('NOTIF-SVC-05: should throw NotFoundException for unauthorized user', async () => {
      const notification = makeNotification({ id: 'notif-1', userId: 'user-2' });
      mockPrisma.notification.findUnique.mockResolvedValue(notification);

      await expect(service.markAsRead('user-1', 'notif-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('NOTIF-SVC-04: should mark all notifications as read', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 10 });

      const result = await service.markAllAsRead('user-1');

      expect(result.count).toBe(10);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
        data: { isRead: true, readAt: expect.any(Date) },
      });
    });
  });

  describe('delete', () => {
    it('should delete notification owned by user', async () => {
      const notification = makeNotification({ id: 'notif-1', userId: 'user-1' });
      mockPrisma.notification.findUnique.mockResolvedValue(notification);
      mockPrisma.notification.delete.mockResolvedValue({});

      await service.delete('user-1', 'notif-1');

      expect(mockPrisma.notification.delete).toHaveBeenCalledWith({ where: { id: 'notif-1' } });
    });

    it('should throw NotFoundException when notification not found', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      await expect(service.delete('user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAll', () => {
    it('NOTIF-SVC-06: should delete all notifications for user', async () => {
      mockPrisma.notification.deleteMany.mockResolvedValue({ count: 20 });

      const result = await service.deleteAll('user-1');

      expect(result.count).toBe(20);
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });
  });

  describe('Notification Payload', () => {
    it('NOTIF-09: should include correct type, metadata, and timestamp in emitted payload', async () => {
      const now = new Date();
      const notification = makeNotification({
        id: 'notif-payload',
        userId: 'user-2',
        type: NotificationType.FRIEND_REQUEST,
        title: '好友请求',
        content: 'Alice 向你发送了好友请求',
        data: { requesterId: 'user-1' },
        createdAt: now,
      });
      mockPrisma.notification.create.mockResolvedValue(notification);

      await service.createFriendRequest('user-1', 'user-2', 'Alice');

      expect(mockChatGateway.emitToUser).toHaveBeenCalledWith(
        'user-2',
        'notification',
        expect.objectContaining({
          id: 'notif-payload',
          type: NotificationType.FRIEND_REQUEST,
          title: '好友请求',
          content: expect.stringContaining('Alice'),
          data: expect.objectContaining({ requesterId: 'user-1' }),
          createdAt: now,
        }),
      );
    });

    it('NOTIF-09: should include sessionId for mention notification payload', async () => {
      const notification = makeNotification({
        type: NotificationType.MENTION,
        data: { sessionId: 'session-1' },
      });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue({ muted: false, mutedUntil: null });
      mockPrisma.notification.create.mockResolvedValue(notification);

      await service.createMention('session-1', 'user-2', 'Bob', 'Hello @user-2!');

      expect(mockChatGateway.emitToUser).toHaveBeenCalledWith(
        'user-2',
        'notification',
        expect.objectContaining({
          type: NotificationType.MENTION,
          data: expect.objectContaining({ sessionId: 'session-1' }),
        }),
      );
    });

    it('should truncate long content in mention notification to 50 chars', async () => {
      const longContent = 'A'.repeat(100);
      const notification = makeNotification({ type: NotificationType.MENTION });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue({ muted: false, mutedUntil: null });
      mockPrisma.notification.create.mockResolvedValue(notification);

      await service.createMention('session-1', 'user-2', 'Bob', longContent);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: expect.stringMatching(/\.\.\.$/),
        }),
      });
    });
  });
});
