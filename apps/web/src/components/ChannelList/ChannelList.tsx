import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { chatApi } from '@/api/client';
import { useChatStore } from '@/stores/chat.store';

export default function ChannelList() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const res: any = await chatApi.getChannels();
      setChannels(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    loadChannels();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res: any = await chatApi.createChannel({ name: newName.trim(), description: newDesc.trim() || undefined });
      if (res?.data?.id) {
        navigate(`/chat/channel/${res.data.id}`);
      }
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      await loadChannels();
    } catch { /* ignore */ }
    setCreating(false);
  };

  const handleSubscribe = async (channelId: string) => {
    try {
      await chatApi.subscribeChannel(channelId);
      navigate(`/chat/channel/${channelId}`);
      await loadChannels();
    } catch { /* ignore */ }
  };

  const handleUnsubscribe = async (channelId: string) => {
    try {
      await chatApi.unsubscribeChannel(channelId);
      if (sessionId === channelId) {
        navigate('/chat');
      }
      await loadChannels();
    } catch { /* ignore */ }
  };

  return (
    <div className="py-2">
      <div className="px-3 flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Channels</h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="p-1 hover:bg-border rounded transition-colors"
          title="Create channel"
        >
          <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {showCreate && (
        <div className="px-3 pb-2 space-y-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Channel name"
            className="input-field w-full text-xs"
            autoFocus
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="input-field w-full text-xs"
          />
          <div className="flex gap-1">
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); }}
              className="px-2 py-1 text-xs border border-border rounded hover:bg-border transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-0.5">
        {loading ? (
          <p className="text-xs text-text-secondary px-3 py-1">Loading...</p>
        ) : channels.length === 0 ? (
          <p className="text-xs text-text-secondary px-3 py-1 italic">No channels yet</p>
        ) : (
          channels.map((ch: any) => {
            const isActive = sessionId === ch.id;
            return (
              <div
                key={ch.id}
                className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
                  isActive ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700' : 'hover:bg-border/50'
                }`}
                onClick={() => navigate(`/chat/channel/${ch.id}`)}
              >
                <svg className="w-4 h-4 flex-shrink-0 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{ch.name || 'Unnamed'}</p>
                  <p className="text-xs text-text-secondary">{ch._count?.members || 0} subscribers</p>
                </div>
                {ch.myRole === 'owner' && (
                  <span className="text-[10px] px-1 py-0.5 bg-yellow-100 text-yellow-700 rounded flex-shrink-0">Owner</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
