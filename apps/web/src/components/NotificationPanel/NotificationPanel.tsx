import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { chatApi } from '@/api/client';
import { useNotificationStore, Notification as AppNotification } from '@/stores/notification.store';
import { formatDistanceToNow } from 'date-fns';

const NOTIFICATION_ICONS: Record<string, string> = {
  friend_request: '👥',
  friend_accepted: '✅',
  message: '💬',
  mention: '@',
  system: '⚙️',
  channel_invitation: '📢',
  join_approved: '✅',
  join_request: '📋',
};

const NOTIFICATION_COLORS: Record<string, string> = {
  friend_request: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  friend_accepted: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  message: 'bg-surface dark:bg-slate-800 border-border',
  mention: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
  system: 'bg-gray-50 dark:bg-gray-800 border-border',
  channel_invitation: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  join_approved: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  join_request: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '';
  }
}

export default function NotificationPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [friendActionLoading, setFriendActionLoading] = useState<string | null>(null);
  const [inviteActionLoading, setInviteActionLoading] = useState<string | null>(null);
  const {
    notifications,
    unreadCount,
    isOpen,
    setOpen,
    fetchNotifications,
    fetchUnreadCount,
    markAllAsRead,
    deleteNotification,
    deleteAll,
  } = useNotificationStore();

  const handleNotificationClick = (notification: AppNotification) => {
    setOpen(false);

    const data = notification.data || {};

    // join_request → navigate to channel settings (for admins)
    if (notification.type === 'join_request' && data.channelId) {
      navigate(`/channels/${data.channelId}/settings`);
      return;
    }
    if (notification.type === 'join_approved' && data.channelId) {
      navigate(`/channel/${data.channelId}`);
      return;
    }
    if (data.channelId) {
      navigate(`/channel/${data.channelId}`);
    } else if (data.sessionId) {
      navigate(`/chat/${data.sessionId}`);
    } else if (notification.type === 'friend_request' && data.requesterId) {
      navigate(`/chat`);
    }
  };

  const handleFriendAction = async (requesterId: string, action: 'accept' | 'reject', notificationId: string) => {
    if (friendActionLoading === notificationId) return;
    setFriendActionLoading(notificationId);
    try {
      await chatApi.manageFriend(requesterId, { action });
      await deleteNotification(notificationId);
    } catch { /* ignore */ }
    finally { setFriendActionLoading(null); }
  };

  const handleChannelInvitationAction = async (invitationId: string, action: 'accept' | 'reject', notificationId: string) => {
    if (inviteActionLoading === notificationId) return;
    setInviteActionLoading(notificationId);
    try {
      if (action === 'accept') {
        await chatApi.acceptChannelInvitation(invitationId);
      } else {
        await chatApi.rejectChannelInvitation(invitationId);
      }
      await deleteNotification(notificationId);
    } catch { /* ignore */ }
    finally { setInviteActionLoading(null); }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    } else {
      fetchUnreadCount();
    }
  }, [isOpen, fetchNotifications, fetchUnreadCount]);

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
              onClick={deleteAll}
              className="text-xs text-text-secondary hover:text-red-500 px-2 py-1 rounded"
            >
              Delete all
            </button>
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
                  className={`relative p-3 group hover:bg-bg transition-colors cursor-pointer ${
                    !notification.isRead ? NOTIFICATION_COLORS[notification.type] || '' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
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
                      {notification.type === 'friend_request' && notification.data?.requesterId && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const id = notification.data!.requesterId;
                              handleFriendAction(id, 'accept', notification.id);
                            }}
                            disabled={friendActionLoading === notification.id}
                            className="px-2.5 py-1 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                          >
                            {friendActionLoading === notification.id ? '...' : 'Accept'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const id = notification.data!.requesterId;
                              handleFriendAction(id, 'reject', notification.id);
                            }}
                            disabled={friendActionLoading === notification.id}
                            className="px-2.5 py-1 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            {friendActionLoading === notification.id ? '...' : 'Reject'}
                          </button>
                        </div>
                      )}
                      {notification.type === 'channel_invitation' && notification.data?.invitationId && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleChannelInvitationAction(notification.data!.invitationId, 'accept', notification.id);
                            }}
                            disabled={inviteActionLoading === notification.id}
                            className="px-2.5 py-1 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                          >
                            {inviteActionLoading === notification.id ? '...' : t('chat.acceptInvite')}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleChannelInvitationAction(notification.data!.invitationId, 'reject', notification.id);
                            }}
                            disabled={inviteActionLoading === notification.id}
                            className="px-2.5 py-1 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            {inviteActionLoading === notification.id ? '...' : t('chat.declineInvite')}
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-text-secondary mt-1 opacity-60">
                        {formatTime(notification.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className="p-1 hover:text-red-500 transition-colors flex-shrink-0"
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
