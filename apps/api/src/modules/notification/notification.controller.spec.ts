import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { makeNotification } from '../../test/factories/entities.factory';

describe('NotificationController', () => {
  let controller: NotificationController;
  let mockNotificationService: any;

  beforeEach(async () => {
    mockNotificationService = {
      findAll: jest.fn(),
      findUnread: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      delete: jest.fn(),
      deleteAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [{ provide: NotificationService, useValue: mockNotificationService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NotificationController>(NotificationController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /notifications', () => {
    it('NOTIF-CTRL-01: should return notifications list', async () => {
      const notifications = [
        makeNotification({ id: 'notif-1' }),
        makeNotification({ id: 'notif-2' }),
      ];
      mockNotificationService.findAll.mockResolvedValue(notifications);

      const result = await controller.findAll('user-1', 50);

      expect((result as any).data).toHaveLength(2);
    });

    it('should pass limit parameter', async () => {
      mockNotificationService.findAll.mockResolvedValue([]);

      await controller.findAll('user-1', 100);

      expect(mockNotificationService.findAll).toHaveBeenCalledWith('user-1', 100);
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('NOTIF-CTRL-02: should return unread count', async () => {
      mockNotificationService.findUnread.mockResolvedValue(5);

      const result = await controller.getUnreadCount('user-1');

      expect((result as any).data.count).toBe(5);
    });
  });

  describe('POST /notifications/:id/read', () => {
    it('NOTIF-CTRL-03: should mark notification as read', async () => {
      const notification = makeNotification({ id: 'notif-1', isRead: true });
      mockNotificationService.markAsRead.mockResolvedValue(notification);

      const result = await controller.markAsRead('user-1', 'notif-1');

      expect((result as any).data.isRead).toBe(true);
    });

    it('should throw NotFoundException when notification not found', async () => {
      mockNotificationService.markAsRead.mockRejectedValue(new NotFoundException('Notification not found'));

      await expect(controller.markAsRead('user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /notifications/read-all', () => {
    it('NOTIF-CTRL-04: should mark all notifications as read', async () => {
      mockNotificationService.markAllAsRead.mockResolvedValue({ count: 10 });

      const result = await controller.markAllAsRead('user-1');

      expect((result as any).message).toBe('All notifications marked as read');
    });
  });

  describe('DELETE /notifications/:id', () => {
    it('NOTIF-CTRL-05: should delete notification', async () => {
      mockNotificationService.delete.mockResolvedValue({});

      const result = await controller.delete('user-1', 'notif-1');

      expect((result as any).message).toBe('Notification deleted');
    });

    it('should throw when notification not found', async () => {
      mockNotificationService.delete.mockRejectedValue(new NotFoundException('Notification not found'));

      await expect(controller.delete('user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('DELETE /notifications', () => {
    it('NOTIF-CTRL-06: should delete all notifications', async () => {
      mockNotificationService.deleteAll.mockResolvedValue({ count: 20 });

      const result = await controller.deleteAll('user-1');

      expect((result as any).message).toBe('All notifications deleted');
    });
  });
});
