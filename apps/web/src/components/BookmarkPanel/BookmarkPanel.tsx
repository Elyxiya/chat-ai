import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatApi } from '@/api/client';

interface BookmarkItem {
  id: string;
  bookmarkedAt: string;
  message: {
    id: string;
    content: string;
    contentType: string;
    createdAt: string;
    sender: { id: string; username: string; avatarUrl?: string | null; nickname?: string | null };
    session: { id: string; name: string | null; sessionType: string };
  };
}

export default function BookmarkPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    setLoading(true);
    try {
      const res: any = await chatApi.getBookmarks();
      setBookmarks(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleRemove = async (messageId: string) => {
    try {
      await chatApi.toggleBookmark(messageId);
      setBookmarks((prev) => prev.filter((b) => b.message.id !== messageId));
    } catch { /* ignore */ }
  };

  const handleNavigate = (sessionId: string) => {
    navigate(`/chat/${sessionId}`);
    onClose();
  };

  const getSessionLabel = (session: BookmarkItem['message']['session']) => {
    return session.name || `${session.sessionType} chat`;
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-[10vh]">
      <div className="bg-surface rounded-xl w-full max-w-lg shadow-xl border border-border max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Bookmarks
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-border rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="py-12 text-center text-text-secondary text-sm">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <p>No bookmarks yet</p>
              <p className="text-xs mt-1">Bookmark messages to find them later</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {bookmarks.map((bm) => (
                <div key={bm.id} className="px-4 py-3 hover:bg-border/30 transition-colors">
                  <button
                    onClick={() => handleNavigate(bm.message.session.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-text-secondary">{getSessionLabel(bm.message.session)}</span>
                      <span className="text-[10px] text-text-secondary">
                        {new Date(bm.message.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <img
                        src={bm.message.sender.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${bm.message.sender.username}`}
                        alt=""
                        className="w-5 h-5 rounded-full mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{bm.message.sender.nickname || bm.message.sender.username}</p>
                        <p className="text-sm text-text-secondary line-clamp-2">{bm.message.content}</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleRemove(bm.message.id)}
                    className="mt-1 text-xs text-red-500 hover:text-red-600 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fixed inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
