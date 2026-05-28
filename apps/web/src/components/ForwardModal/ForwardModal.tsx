import { useState, useMemo } from 'react';
import { useChatStore } from '@/stores/chat.store';
import { chatApi } from '@/api/client';

interface ForwardModalProps {
  messageId?: string;
  messageIds?: string[];
  onClose: () => void;
  onDone: () => void;
}

export default function ForwardModal({ messageId, messageIds, onClose, onDone }: ForwardModalProps) {
  const { sessions } = useChatStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const filteredSessions = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter((s) => {
      const name = s.name?.toLowerCase() || '';
      const memberNames = s.members.map((m) => m.user.username.toLowerCase()).join(' ');
      return name.includes(q) || memberNames.includes(q);
    });
  }, [sessions, search]);

  const toggleSession = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleForward = async () => {
    if (selected.size === 0) return;
    setSending(true);
    try {
      if (messageIds && messageIds.length > 0) {
        await chatApi.batchForwardMessages(messageIds, Array.from(selected)[0]);
      } else if (messageId) {
        await chatApi.forwardMessage(messageId, Array.from(selected));
      }
      onDone();
      onClose();
    } catch {
      // error
    } finally {
      setSending(false);
    }
  };

  const getSessionLabel = (s: any) => {
    if (s.name) return s.name;
    const others = s.members || [];
    return others.map((m: any) => m.user.nickname || m.user.username).join(', ') || 'Chat';
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
      <div className="bg-surface rounded-xl w-full max-w-md shadow-xl border border-border">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Forward Message</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-border rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="input-field w-full text-sm"
            autoFocus
          />
        </div>

        <div className="max-h-72 overflow-y-auto px-2 pb-2 space-y-0.5">
          {filteredSessions.map((s) => (
            <button
              key={s.id}
              onClick={() => toggleSession(s.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                selected.has(s.id) ? 'bg-primary-50 dark:bg-primary-900/30' : 'hover:bg-border'
              }`}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                selected.has(s.id)
                  ? 'bg-primary-600 border-primary-600'
                  : 'border-text-secondary'
              }`}>
                {selected.has(s.id) && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 flex-shrink-0">
                {(getSessionLabel(s)[0] || '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{getSessionLabel(s)}</p>
                <p className="text-xs text-text-secondary capitalize">{s.sessionType}</p>
              </div>
            </button>
          ))}
          {filteredSessions.length === 0 && (
            <p className="text-center text-text-secondary text-sm py-6">No chats found</p>
          )}
        </div>

        <div className="p-3 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-bg border border-border rounded-lg hover:bg-border transition-colors">
            Cancel
          </button>
          <button
            onClick={handleForward}
            disabled={selected.size === 0 || sending}
            className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {sending ? 'Forwarding...' : `Forward (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
