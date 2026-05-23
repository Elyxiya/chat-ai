import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatApi } from '@/api/client';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';

export default function UserSearchModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { sessions } = useChatStore();
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [friendStatus, setFriendStatus] = useState<Record<string, string>>({});

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await chatApi.searchUsers(query);
      setResults(res.data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (targetUserId: string, action: string) => {
    try {
      if ((chatApi as any).manageFriend) {
        await (chatApi as any).manageFriend(targetUserId, { action });
      }
      setFriendStatus((prev) => ({ ...prev, [targetUserId]: action === 'request' ? 'pending' : 'accepted' }));
    } catch { /* ignore */ }
  };

  const handleStartChat = async (userId: string) => {
    const existing = sessions.find((s) =>
      s.sessionType === 'private' && s.members.some((m) => m.user.id === userId),
    );
    if (existing) {
      navigate(`/chat/${existing.id}`);
    } else {
      const id = await useChatStore.getState().createSession({ sessionType: 'private', memberIds: [userId] });
      navigate(`/chat/${id}`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
      <div className="bg-surface rounded-xl w-full max-w-lg shadow-xl border border-border">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Search Users</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-border rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username or email..."
              className="input-field flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              autoFocus
            />
            <button onClick={handleSearch} disabled={loading} className="btn-primary px-4">
              {loading ? '...' : 'Search'}
            </button>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {results.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg bg-bg hover:bg-border transition-colors">
                <img
                  src={u.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}`}
                  alt={u.username}
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{u.nickname || u.username}</p>
                  <p className="text-xs text-text-secondary truncate">@{u.username}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleStartChat(u.id)}
                    className="px-3 py-1 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Chat
                  </button>
                  {u.id !== user?.id && (
                    <button
                      onClick={() => handleAction(u.id, friendStatus[u.id] === 'accepted' ? 'block' : 'request')}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        friendStatus[u.id] === 'accepted'
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : friendStatus[u.id] === 'pending'
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                      disabled={friendStatus[u.id] === 'pending'}
                    >
                      {friendStatus[u.id] === 'accepted' ? 'Blocked' : friendStatus[u.id] === 'pending' ? 'Pending' : 'Add Friend'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {query && results.length === 0 && !loading && (
              <p className="text-center text-text-secondary text-sm py-4">No users found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
