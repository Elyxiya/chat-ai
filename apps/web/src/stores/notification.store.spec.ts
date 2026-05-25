import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockToken = 'mock-token';

vi.mock('./auth.store', () => ({
  useAuthStore: {
    getState: () => ({ accessToken: mockToken }),
  },
}));

import { useNotificationStore, Notification } from './notification.store';

const mockNotifications: Notification[] = [
  { id: 'n1', type: 'friend_request', title: 'Friend Request', content: 'User wants to be friends', data: {}, isRead: false, createdAt: '2025-01-01T10:00:00Z' },
  { id: 'n2', type: 'message', title: 'New Message', content: 'You have a new message', data: {}, isRead: true, createdAt: '2025-01-01T09:00:00Z' },
  { id: 'n3', type: 'system', title: 'System Update', content: 'System maintenance tonight', data: {}, isRead: false, createdAt: '2025-01-01T08:00:00Z' },
];

describe('notification.store', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    useNotificationStore.setState({
      notifications: [],
      unreadCount: 0,
      isOpen: false,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
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
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ data: mockNotifications }),
      });

      await useNotificationStore.getState().fetchNotifications();

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/notifications', {
        headers: { Authorization: `Bearer ${mockToken}` },
      });
      expect(useNotificationStore.getState().notifications).toEqual(mockNotifications);
    });

    it('should handle fetch failure gracefully', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await useNotificationStore.getState().fetchNotifications();

      expect(useNotificationStore.getState().notifications).toEqual([]);
    });
  });

  describe('fetchUnreadCount', () => {
    it('should fetch and set unread count', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ data: { count: 5 } }),
      });

      await useNotificationStore.getState().fetchUnreadCount();

      expect(useNotificationStore.getState().unreadCount).toBe(5);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      useNotificationStore.setState({ notifications: mockNotifications, unreadCount: 2 });
      globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({}) });

      await useNotificationStore.getState().markAsRead('n1');

      const state = useNotificationStore.getState();
      expect(state.notifications.find((n) => n.id === 'n1')?.isRead).toBe(true);
      expect(state.unreadCount).toBe(1);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/notifications/n1/read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${mockToken}` },
      });
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      useNotificationStore.setState({ notifications: mockNotifications, unreadCount: 2 });
      globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({}) });

      await useNotificationStore.getState().markAllAsRead();

      const state = useNotificationStore.getState();
      expect(state.notifications.every((n) => n.isRead)).toBe(true);
      expect(state.unreadCount).toBe(0);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification and update counts', async () => {
      useNotificationStore.setState({ notifications: mockNotifications, unreadCount: 2 });
      globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({}) });

      await useNotificationStore.getState().deleteNotification('n1');

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(2);
      expect(state.notifications.find((n) => n.id === 'n1')).toBeUndefined();
      expect(state.unreadCount).toBe(1);
    });

    it('should not decrease unreadCount if deleted notification was already read', async () => {
      useNotificationStore.setState({ notifications: mockNotifications, unreadCount: 2 });
      globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({}) });

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
