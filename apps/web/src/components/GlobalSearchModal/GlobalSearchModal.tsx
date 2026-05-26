import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatApi } from '@/api/client';
import { useChatStore } from '@/stores/chat.store';

interface SearchResult {
  message: {
    id: string;
    content: string;
    contentType: string;
    createdAt: string;
    sender: { id: string; username: string; avatarUrl?: string | null; nickname?: string | null };
  };
  session: { id: string; name: string | null; sessionType: string };
  highlight: string;
}

interface GlobalSearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
}

export default function GlobalSearchModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { setActiveSession } = useChatStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const groupedResults = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const key = r.session.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const res = await chatApi.globalSearch({ q, limit: 20 });
      const data = res as unknown as GlobalSearchResponse;
      setResults(data.results || []);
      setTotal(data.total || 0);
      setSelectedIdx(-1);
    } catch {
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSelect = (sessionId: string) => {
    setActiveSession(sessionId);
    navigate(`/chat/${sessionId}`);
    onClose();
  };

  const flatResults = results;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && selectedIdx >= 0) {
      e.preventDefault();
      const item = flatResults[selectedIdx];
      if (item) handleSelect(item.session.id);
    }
  };

  const highlightMatch = (text: string) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="bg-yellow-200/70 text-black rounded px-0.5">{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const getSessionLabel = (session: { name: string | null; sessionType: string; id: string }) => {
    if (session.name) return session.name;
    const members = session.id; // fallback
    return session.sessionType === 'private' ? 'Private Chat' : 'Group';
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-[15vh]">
      <div className="bg-surface rounded-xl w-full max-w-xl shadow-2xl border border-border overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <svg className="w-5 h-5 text-text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search messages across all chats..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-text-secondary"
          />
          <button onClick={onClose} className="p-1 hover:bg-border rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto" onKeyDown={handleKeyDown}>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && query && flatResults.length === 0 && (
            <div className="py-8 text-center text-text-secondary text-sm">
              <p>No messages found for "<span className="font-medium text-text">{query}</span>"</p>
              <p className="mt-1 text-xs">Try different keywords or check your search spelling</p>
            </div>
          )}

          {!loading && flatResults.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs text-text-secondary border-b border-border">
                {total} result{total !== 1 ? 's' : ''} for "<span className="font-medium text-text">{query}</span>"
              </div>
              {Object.entries(groupedResults).map(([sessionId, msgs]) => (
                <div key={sessionId}>
                  <div className="px-4 py-1.5 text-xs font-medium text-text-secondary bg-bg/50 sticky top-0">
                    {getSessionLabel(msgs[0].session)}
                  </div>
                  {msgs.map((item, i) => {
                    const globalIdx = flatResults.indexOf(item);
                    return (
                      <button
                        key={item.message.id}
                        onClick={() => handleSelect(sessionId)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-border/50 transition-colors ${
                          globalIdx === selectedIdx ? 'bg-primary-500/10 border-l-2 border-primary-500' : 'border-l-2 border-transparent'
                        }`}
                      >
                        <img
                          src={item.message.sender.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${item.message.sender.username}`}
                          alt={item.message.sender.username}
                          className="w-8 h-8 rounded-full mt-0.5 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium text-text">{item.message.sender.nickname || item.message.sender.username}</span>
                            <span className="text-text-secondary">
                              {new Date(item.message.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-text-secondary mt-0.5 line-clamp-2">
                            {highlightMatch(item.highlight)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}

          {!loading && !query && (
            <div className="py-8 text-center text-text-secondary text-sm">
              <p>Type to search across all your conversations</p>
              <div className="mt-3 flex items-center justify-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-border rounded text-[10px] font-mono">↑</kbd>
                  <kbd className="px-1.5 py-0.5 bg-border rounded text-[10px] font-mono">↓</kbd>
                  <span>navigate</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-border rounded text-[10px] font-mono">Enter</kbd>
                  <span>open</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-border rounded text-[10px] font-mono">Esc</kbd>
                  <span>close</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click backdrop to close */}
      <div className="fixed inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
