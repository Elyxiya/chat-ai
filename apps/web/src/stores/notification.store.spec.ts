import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockToken = 'mock-token';

// Mock auth store for apiClient interceptor
vi.mock('./auth.store', () => ({
  useAuthStore: {
    getState: () => ({ accessToken: mockToken }),
  },
}));

// Mock apiClient
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/api/client', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

import { useNotificationStore, Notification } from './notification.store';

const mockNotifications: Notification[] = [
  { id: 'n1', type: 'friend_request', title: 'Friend Request', content: 'User wants to be friends', data: {}, isRead: false, createdAt: '2025-01-01T10:00:00Z' },
  { id: 'n2', type: 'message', title: 'New Message', content: 'You have a new message', data: {}, isRead: true, createdAt: '2025-01-01T09:00:00Z' },
  { id: 'n3', type: 'system', title: 'System Update', content: 'System maintenance tonight', data: {}, isRead: false, createdAt: '2025-01-01T08:00:00Z' },
];

describe('notification.store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNotificationStore.setState({
      notifications: [],
      unreadCount: 0,
      isOpen: false,
    });
  });

  it('should have initial state', () => {
    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([]);
    expect(state.unreadCount).toBe(0);
    expect(state.isOpen).toBe(false);
  });

  describe('setOpen', () => {
    it('should set isOpen', () => {
      useNotificationStore.getState().setOpen(true);
      expect(useNotificationStore.getState().isOpen).toBe(true);

      useNotificationStore.getState().setOpen(false);
      expect(useNotificationStore.getState().isOpen).toBe(false);
    });
  });

  describe('fetchNotifications', () => {
    it('should fetch and set notifications on success', async () => {
      mockGet.mockResolvedValue({ data: mockNotifications });

      await useNotificationStore.getState().fetchNotifications();

      expect(mockGet).toHaveBeenCalledWith('/notifications');
      expect(useNotificationStore.getState().notifications).toEqual(mockNotifications);
    });

    it('should handle fetch failure gracefully', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      await useNotificationStore.getState().fetchNotifications();

      // Should keep existing notifications on error (not clear them)
      expect(useNotificationStore.getState().notifications).toEqual([]);
    });

    it('should preserve existing notifications on API error', async () => {
      useNotificationStore.setState({ notifications: mockNotifications, unreadCount: 2 });
      mockGet.mockRejectedValue(new Error('Network error'));

      await useNotificationStore.getState().fetchNotifications();

      // Should NOT clear notifications on error
      expect(useNotificationStore.getState().notifications).toEqual(mockNotifications);
    });
  });

  describe('fetchUnreadCount', () => {
    it('should fetch and set unread count', async () => {
      mockGet.mockResolvedValue({ data: { count: 5 } });

      await useNotificationStore.getState().fetchUnreadCount();

      expect(mockGet).toHaveBeenCalledWith('/notifications/unread-count');
      expect(useNotificationStore.getState().unreadCount).toBe(5);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      useNotificationStore.setState({ notifications: mockNotifications, unreadCount: 2 });
      mockPost.mockResolvedValue({});

      await useNotificationStore.getState().markAsRead('n1');

      const state = useNotificationStore.getState();
      expect(state.notifications.find((n) => n.id === 'n1')?.isRead).toBe(true);
      expect(state.unreadCount).toBe(1);
      expect(mockPost).toHaveBeenCalledWith('/notifications/n1/read');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      useNotificationStore.setState({ notifications: mockNotifications, unreadCount: 2 });
      mockPost.mockResolvedValue({});

      await useNotificationStore.getState().markAllAsRead();

      const state = useNotificationStore.getState();
      expect(state.notifications.every((n) => n.isRead)).toBe(true);
      expect(state.unreadCount).toBe(0);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification and update counts', async () => {
      useNotificationStore.setState({ notifications: mockNotifications, unreadCount: 2 });
      mockDelete.mockResolvedValue({});

      await useNotificationStore.getState().deleteNotification('n1');

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(2);
      expect(state.notifications.find((n) => n.id === 'n1')).toBeUndefined();
      expect(state.unreadCount).toBe(1);
    });

    it('should not decrease unreadCount if deleted notification was already read', async () => {
      useNotificationStore.setState({ notifications: mockNotifications, unreadCount: 2 });
      mockDelete.mockResolvedValue({});

      await useNotificationStore.getState().deleteNotification('n2');

      expect(useNotificationStore.getState().unreadCount).toBe(2);
    });
  });

  describe('addNotification', () => {
    it('should add notification and increment unread count', () => {
      const newNotif: Notification = {
        id: 'n4', type: 'mention', title: 'Mention', content: 'You were mentioned', data: {},
        isRead: false, createdAt: '2025-01-01T11:00:00Z',
      };

      useNotificationStore.getState().addNotification(newNotif);

      const state = useNotificationStore.getState();
      expect(state.notifications[0].id).toBe('n4');
      expect(state.notifications[0].isRead).toBe(false);
      expect(state.unreadCount).toBe(1);
    });
  });
});
