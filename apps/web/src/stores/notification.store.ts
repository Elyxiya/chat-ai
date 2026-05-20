import { create } from 'zustand';

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
  setOpen: (open: boolean) => void;
  addNotification: (notification: Notification) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,

  setOpen: (open) => set({ isOpen: open }),

  fetchNotifications: async () => {
    try {
      const res = await fetch('/api/v1/notifications', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.accessToken : ''}`,
        },
      });
      const data = await res.json();
      set({ notifications: data.data || [] });
    } catch { /* ignore */ }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await fetch('/api/v1/notifications/unread-count', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.accessToken : ''}`,
        },
      });
      const data = await res.json();
      set({ unreadCount: data.data?.count || 0 });
    } catch { /* ignore */ }
  },

  markAsRead: async (id) => {
    try {
      await fetch(`/api/v1/notifications/${id}/read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.accessToken : ''}`,
        },
      });
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch { /* ignore */ }
  },

  markAllAsRead: async () => {
    try {
      await fetch('/api/v1/notifications/read-all', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.accessToken : ''}`,
        },
      });
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch { /* ignore */ }
  },

  deleteNotification: async (id) => {
    try {
      await fetch(`/api/v1/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.accessToken : ''}`,
        },
      });
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: state.notifications.find((n) => n.id === id && !n.isRead)
          ? state.unreadCount - 1
          : state.unreadCount,
      }));
    } catch { /* ignore */ }
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [{ ...notification, isRead: false }, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },
}));
