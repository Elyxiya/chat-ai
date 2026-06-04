import { create } from 'zustand';
import { apiClient } from '@/api/client';

const MAX_NOTIFICATIONS = 100;

export interface Notification {
  id: string;
  type: string;
  title?: string;
  content?: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isOpen: boolean;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteAll: () => Promise<void>;
  setOpen: (open: boolean) => void;
  addNotification: (notification: Notification) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,

  setOpen: (open) => set({ isOpen: open }),

  fetchNotifications: async () => {
    try {
      const result: any = await apiClient.get('/notifications');
      // apiClient interceptor returns response.data, so result = { code, data, message }
      const loaded: Notification[] = result?.data || [];
      const trimmed = loaded.length > MAX_NOTIFICATIONS
        ? loaded.slice(0, MAX_NOTIFICATIONS)
        : loaded;
      set({ notifications: trimmed });
    } catch (err) {
      console.warn('[NotificationStore] Failed to fetch notifications:', err);
      // Do NOT clear notifications on error — preserve WebSocket-added data
    }
  },

  fetchUnreadCount: async () => {
    try {
      const result: any = await apiClient.get('/notifications/unread-count');
      set({ unreadCount: result?.data?.count || 0 });
    } catch (err) {
      console.warn('[NotificationStore] Failed to fetch unread count:', err);
    }
  },

  markAsRead: async (id) => {
    try {
      await apiClient.post(`/notifications/${id}/read`);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (err) {
      console.warn('[NotificationStore] Failed to mark notification as read:', err);
    }
  },

  markAllAsRead: async () => {
    try {
      await apiClient.post('/notifications/read-all');
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch (err) {
      console.warn('[NotificationStore] Failed to mark all as read:', err);
    }
  },

  deleteNotification: async (id) => {
    try {
      await apiClient.delete(`/notifications/${id}`);
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: state.notifications.find((n) => n.id === id && !n.isRead)
          ? state.unreadCount - 1
          : state.unreadCount,
      }));
    } catch (err) {
      console.warn('[NotificationStore] Failed to delete notification:', err);
    }
  },

  deleteAll: async () => {
    try {
      await apiClient.delete('/notifications');
      set({ notifications: [], unreadCount: 0 });
    } catch (err) {
      console.warn('[NotificationStore] Failed to delete all notifications:', err);
    }
  },

  addNotification: (notification) => {
    set((state) => {
      if (state.notifications.some((n) => n.id === notification.id)) {
        return { notifications: state.notifications, unreadCount: state.unreadCount };
      }
      const updated = [{ ...notification, isRead: false }, ...state.notifications];
      const trimmed = updated.length > MAX_NOTIFICATIONS
        ? updated.slice(0, MAX_NOTIFICATIONS)
        : updated;
      return {
        notifications: trimmed,
        unreadCount: state.unreadCount + 1,
      };
    });
  },
}));
