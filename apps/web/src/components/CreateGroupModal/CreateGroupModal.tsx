import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatApi } from '@/api/client';
import { useChatStore } from '@/stores/chat.store';

export default function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await chatApi.searchUsers(query);
      setResults((res.data || []).filter((u: any) => !selected.has(u.id)));
    } catch { setResults([]); }
    setLoading(false);
  };

  const toggleSelect = (user: any) => {
    const next = new Map(selected);
    if (next.has(user.id)) {
      next.delete(user.id);
    } else {
      next.set(user.id, user);
    }
    setSelected(next);
    // Re-filter results
    setResults((prev) => prev.filter((u) => u.id !== user.id || next.has(user.id)));
  };

  const handleCreate = async () => {
    if (selected.size === 0) return;
    setCreating(true);
    try {
      const memberIds = Array.from(selected.keys());
      const data: any = { sessionType: 'group', memberIds };
      if (groupName.trim()) data.name = groupName.trim();
      const res: any = await chatApi.createSession(data);
      if (res?.data?.id) {
        await useChatStore.getState().loadSessions();
        navigate(`/chat/${res.data.id}`);
        onClose();
      }
    } catch { /* ignore */ }
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
      <div className="bg-surface rounded-xl w-full max-w-lg shadow-xl border border-border">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Create Group</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-border rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Group name */}
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name (optional)"
            className="input-field w-full"
          />

          {/* Search users */}
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users to add..."
              className="input-field flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              autoFocus
            />
            <button onClick={handleSearch} disabled={loading} className="btn-primary px-4">
              {loading ? '...' : 'Search'}
            </button>
          </div>

          {/* Selected users */}
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from(selected.values()).map((u) => (
                <span key={u.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary-50 text-primary-700 rounded-full">
                  {u.nickname || u.username}
                  <button onClick={() => toggleSelect(u)} className="hover:text-primary-900">&times;</button>
                </span>
              ))}
            </div>
          )}

          {/* Search results */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-bg hover:bg-border transition-colors cursor-pointer"
                onClick={() => toggleSelect(u)}
              >
                <img
                  src={u.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}`}
                  alt={u.username}
                  className="w-9 h-9 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.nickname || u.username}</p>
                  <p className="text-xs text-text-secondary">@{u.username}</p>
                </div>
                <input
                  type="checkbox"
                  checked={selected.has(u.id)}
                  readOnly
                  className="accent-primary-600"
                />
              </div>
            ))}
            {query && results.length === 0 && !loading && (
              <p className="text-center text-text-secondary text-sm py-4">No users found</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-border transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={selected.size === 0 || creating}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {creating ? 'Creating...' : `Create Group (${selected.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
