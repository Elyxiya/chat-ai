import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import { ChatSession } from '@/types';
import { formatDistanceToNow } from 'date-fns';

export default function SessionList() {
  const navigate = useNavigate();
  const { sessions, onlineUsers } = useChatStore();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');

  const currentPath = window.location.pathname;

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => {
      if (s.name?.toLowerCase().includes(q)) return true;
      if (s.sessionType === 'agent' && 'ai agent'.includes(q)) return true;
      const otherMembers = s.members.filter((m) => m.user.id !== user?.id);
      return otherMembers.some((m) => {
        const u = m.user as any;
        return u.username?.toLowerCase().includes(q) || u.nickname?.toLowerCase().includes(q);
      });
    });
  }, [sessions, searchQuery, user?.id]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Sessions</span>
        <button
          onClick={() => navigate('/chat')}
          className="p-1.5 hover:bg-border rounded-lg transition-colors text-text-secondary flex-shrink-0"
          title="New chat"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Search bar */}
      <div className="px-3 pb-2">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-bg border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filteredSessions.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-text-secondary text-sm">No conversations yet</p>
            <button
              onClick={() => navigate('/chat')}
              className="mt-2 text-primary-600 text-sm hover:underline"
            >
              Start a chat
            </button>
          </div>
        ) : (
          <div className="space-y-0.5 px-2">
            {filteredSessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={currentPath === `/chat/${session.id}` || currentPath === `/agent/${session.id}`}
                currentUserId={user?.id}
                onlineUsers={onlineUsers}
                onClick={() => {
                  const path = session.sessionType === 'agent' ? `/agent/${session.id}` : `/chat/${session.id}`;
                  navigate(path);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionItem({
  session,
  isActive,
  currentUserId,
  onlineUsers,
  onClick,
}: {
  session: ChatSession;
  isActive: boolean;
  currentUserId?: string;
  onlineUsers: Set<string>;
  onClick: () => void;
}) {
  const otherMembers = session.members.filter((m) => m.user.id !== currentUserId);
  const displayName = session.sessionType === 'agent'
    ? 'AI Agent'
    : session.name || (otherMembers.length === 1
      ? (otherMembers[0].user as any)?.nickname || otherMembers[0].user.username
      : otherMembers.map((m) => (m.user as any)?.username || m.user.username).join(', '));

  const avatarUrl = session.sessionType === 'agent'
    ? null
    : otherMembers.length === 1
      ? otherMembers[0].user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${otherMembers[0].user.username}`
      : null;

  const lastMessage = session.lastMessage;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
        isActive
          ? 'bg-primary-50 dark:bg-primary-900/30'
          : 'hover:bg-surface'
      }`}
    >
      <div className="relative flex-shrink-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="w-10 h-10 rounded-full" />
        ) : session.sessionType === 'agent' ? (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
            {displayName[0]?.toUpperCase()}
          </div>
        )}
        {session.sessionType === 'private' && otherMembers.length === 1 && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-bg ${
              onlineUsers.has(otherMembers[0].user.id) ? 'bg-green-500' : 'bg-text-secondary'
            }`}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-sm truncate ${isActive ? 'font-semibold text-primary-700 dark:text-primary-300' : ''}`}>
            {displayName}
          </span>
          {lastMessage && (
            <span className="text-xs text-text-secondary flex-shrink-0 ml-2">
              {formatDistanceToNow(new Date(lastMessage.createdAt), { addSuffix: false })}
            </span>
          )}
        </div>
        {lastMessage && (
          <p className="text-xs text-text-secondary truncate mt-0.5">
            {lastMessage.senderId === currentUserId ? 'You: ' : ''}
            {lastMessage.contentType === 'ai_response' ? '[AI Response]' :
             lastMessage.contentType === 'image' ? '[Image]' :
             lastMessage.contentType === 'file' ? '[File]' :
             lastMessage.isRecalled ? '[Recalled]' :
             lastMessage.content}
          </p>
        )}
      </div>

      {session.unreadCount > 0 && (
        <span className="px-1.5 py-0.5 min-w-[20px] text-center bg-primary-600 text-white text-xs rounded-full">
          {session.unreadCount > 99 ? '99+' : session.unreadCount}
        </span>
      )}
    </button>
  );
}
