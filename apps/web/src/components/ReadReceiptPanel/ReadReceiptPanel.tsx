import { useState, useEffect } from 'react';
import { chatApi } from '@/api/client';
import LazyImage from '../LazyImage/LazyImage';

interface ReadUser {
  userId: string;
  username: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  status: string;
  readAt?: string;
}

interface ReadReceiptPanelProps {
  messageId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ReadReceiptPanel({ messageId, isOpen, onClose }: ReadReceiptPanelProps) {
  const [readUsers, setReadUsers] = useState<ReadUser[]>([]);
  const [unreadUsers, setUnreadUsers] = useState<ReadUser[]>([]);
  const [readCount, setReadCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'read' | 'unread'>('read');

  useEffect(() => {
    if (!isOpen) return;
    loadReceipts();
  }, [isOpen, messageId]);

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const res: any = await chatApi.getReadReceipts(messageId);
      const data = res.data || res;
      setReadUsers(data.readUsers || []);
      setUnreadUsers(data.unreadUsers || []);
      setReadCount(data.readCount || 0);
      setUnreadCount(data.unreadCount || 0);
    } catch { /* ignore */ }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-[15vh]">
      <div className="bg-surface rounded-xl w-full max-w-sm shadow-xl border border-border max-h-[60vh] flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-base">Read Receipts</h3>
          <button onClick={onClose} className="p-1 hover:bg-border rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab('read')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'read' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-text-secondary hover:text-text'}`}
          >
            Read ({readCount})
          </button>
          <button
            onClick={() => setTab('unread')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'unread' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-text-secondary hover:text-text'}`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="text-center text-sm text-text-secondary py-8">Loading...</p>
          ) : tab === 'read' && readUsers.length === 0 ? (
            <p className="text-center text-sm text-text-secondary py-8">No one has read this yet</p>
          ) : tab === 'unread' && unreadUsers.length === 0 ? (
            <p className="text-center text-sm text-text-secondary py-8">Everyone has read this</p>
          ) : (
            <div className="space-y-1">
              {(tab === 'read' ? readUsers : unreadUsers).map((u) => (
                <div key={u.userId} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-border/50 transition-colors">
                  <LazyImage
                    src={u.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}`}
                    alt={u.username}
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{u.nickname || u.username}</span>
                      {u.status === 'online' && <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />}
                    </div>
                    <p className="text-xs text-text-secondary">@{u.username}</p>
                  </div>
                  {u.readAt && (
                    <span className="text-xs text-text-secondary flex-shrink-0">
                      {new Date(u.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
