import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFriendStore, Friend } from '@/stores/friend.store';
import { useChatStore } from '@/stores/chat.store';
import { chatApi } from '@/api/client';

export default function FriendList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const { friends, isLoading, fetchFriends } = useFriendStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const handleFriendClick = async (friend: Friend) => {
    try {
      // Create or navigate to a private chat session with this friend
      const res: any = await chatApi.createSession({
        sessionType: 'private',
        memberIds: [friend.id],
      });
      const sessionId: string = res?.data?.id || res?.id;
      if (sessionId) {
        navigate(`/chat/${sessionId}`);
      }
    } catch {
      // Ignore — session may already exist
    }
  };

  const filtered = searchQuery.trim()
    ? friends.filter(
        (f) =>
          (f.nickname || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.username.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : friends;

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-2 border-b border-border">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('chat.searchFriends')}
          className="w-full px-2.5 py-1.5 text-sm bg-bg border border-border rounded-lg outline-none focus:border-primary-500 transition-colors"
        />
      </div>

      {/* Friend list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading && friends.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-text-secondary">
            {t('common.loading')}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary px-4">
            <span className="text-3xl mb-2">👥</span>
            <p className="text-sm">
              {searchQuery ? t('chat.noFriendsMatch') : t('chat.noFriends')}
            </p>
            {!searchQuery && (
              <p className="text-xs mt-1 opacity-60">{t('chat.addFriendsHint')}</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((friend) => {
              const isOnline = onlineUsers.has(friend.id);
              return (
                <button
                  key={friend.id}
                  onClick={() => handleFriendClick(friend)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg transition-colors text-left"
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={
                        friend.avatarUrl ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${friend.username}`
                      }
                      alt={friend.nickname || friend.username}
                      className="w-9 h-9 rounded-full"
                    />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface ${
                        isOnline ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {friend.nickname || friend.username}
                    </p>
                    <p className="text-xs text-text-secondary truncate">
                      @{friend.username}
                      {isOnline ? ` · ${t('chat.online')}` : ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
