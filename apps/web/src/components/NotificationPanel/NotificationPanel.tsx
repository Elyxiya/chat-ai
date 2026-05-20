import { useEffect } from 'react';
import { useNotificationStore } from '@/stores/notification.store';
import { formatDistanceToNow } from 'date-fns';

const NOTIFICATION_ICONS: Record<string, string> = {
  friend_request: '👥',
  friend_accepted: '✅',
  message: '💬',
  mention: '@',
  system: '⚙️',
};

const NOTIFICATION_COLORS: Record<string, string> = {
  friend_request: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  friend_accepted: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  message: 'bg-surface dark:bg-slate-800 border-border',
  mention: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
  system: 'bg-gray-50 dark:bg-gray-800 border-border',
};

export default function NotificationPanel() {
  const {
    notifications,
    unreadCount,
    isOpen,
    setOpen,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationStore();

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    } else {
      fetchUnreadCount();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={() => setOpen(false)}
      />
      <div className="fixed right-0 top-0 h-full w-80 bg-surface border-l border-border z-50 flex flex-col shadow-xl">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-primary-600 text-white rounded-full">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-text-secondary hover:text-primary-600 px-2 py-1 rounded"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 hover:bg-border rounded transition-colors"
            >
              <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-secondary">
              <span className="text-4xl mb-2">🔔</span>
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 hover:bg-bg transition-colors cursor-pointer ${
                    !notification.isRead ? NOTIFICATION_COLORS[notification.type] || '' : ''
                  }`}
                  onClick={() => {
                    if (!notification.isRead) markAsRead(notification.id);
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {NOTIFICATION_ICONS[notification.type] || '📌'}
                    </span>
                    <div className="flex-1 min-w-0">
                      {notification.title && (
                        <p className="text-sm font-medium truncate">{notification.title}</p>
                      )}
                      {notification.content && (
                        <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                          {notification.content}
                        </p>
                      )}
                      <p className="text-xs text-text-secondary mt-1 opacity-60">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {!notification.isRead && (
                    <span className="absolute top-3 right-3 w-2 h-2 bg-primary-500 rounded-full" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
