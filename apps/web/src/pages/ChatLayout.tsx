import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useChatStore } from '@/stores/chat.store';
import { useThemeStore } from '@/stores/theme.store';
import { useNotificationStore } from '@/stores/notification.store';
import SessionList from '@/components/SessionList/SessionList';
import NotificationPanel from '@/components/NotificationPanel/NotificationPanel';
import UserSearchModal from '@/components/UserSearch/UserSearchModal';

export default function ChatLayout() {
  const navigate = useNavigate();
  const { user, accessToken, checkAuth } = useAuthStore();
  const { connect, disconnect, loadSessions } = useChatStore();
  const { resolvedTheme, setTheme } = useThemeStore();
  const { unreadCount, setOpen, fetchUnreadCount } = useNotificationStore();
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (accessToken) fetchUnreadCount();
  }, [accessToken]);

  useEffect(() => {
    checkAuth().then(() => {
      const token = useAuthStore.getState().accessToken;
      if (token) {
        connect(token);
        loadSessions();
      }
    });
  }, []);

  useEffect(() => {
    if (!accessToken) {
      navigate('/login');
    }
  }, [accessToken, navigate]);

  return (
    <>
    <div className="flex h-screen bg-bg">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border flex flex-col bg-surface">
        {/* User info */}
        <div className="p-4 border-b border-border flex items-center gap-3">
          <img
            src={user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.username}`}
            alt={user?.username}
            className="w-10 h-10 rounded-full"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{user?.nickname || user?.username}</p>
            <p className="text-xs text-text-secondary truncate">{user?.username}</p>
          </div>
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="p-2 hover:bg-border rounded-lg transition-colors"
            title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {resolvedTheme === 'dark' ? (
              <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="p-2 hover:bg-border rounded-lg transition-colors"
            title="Settings"
          >
            <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={() => setOpen(true)}
            className="p-2 hover:bg-border rounded-lg transition-colors relative"
            title="Notifications"
          >
            <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-center bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Nav */}
        <nav className="p-2 space-y-1">
          <NavItem
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
            label="Chats"
            path="/chat"
          />
          <NavItem
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            }
            label="AI Agent"
            path="/agent"
            badge="AI"
          />
          <NavItem
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
            label="Knowledge Base"
            path="/knowledge"
          />
        </nav>

        {/* Search / Add friends */}
        <div className="p-2 border-t border-border">
          <button
            onClick={() => setShowSearch(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-border rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search users
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-hidden">
          <SessionList />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </main>
    </div>
    <NotificationPanel />
    {showSearch && <UserSearchModal onClose={() => setShowSearch(false)} />}
    </>
  );
}

function NavItem({ icon, label, path, badge }: { icon: React.ReactNode; label: string; path: string; badge?: string }) {
  const navigate = useNavigate();
  const current = window.location.pathname.startsWith(path);

  return (
    <button
      onClick={() => navigate(path)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        current
          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
          : 'text-text-secondary hover:bg-surface hover:text-text'
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span className="px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded">
          {badge}
        </span>
      )}
    </button>
  );
}
