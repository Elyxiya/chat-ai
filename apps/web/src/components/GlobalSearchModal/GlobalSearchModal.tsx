import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatApi } from '@/api/client';
import { useChatStore } from '@/stores/chat.store';

interface SearchMessage {
  id: string;
  content: string;
  contentType: string;
  createdAt: string;
  sender: { id: string; username: string; avatarUrl?: string | null; nickname?: string | null };
}

interface SearchSession {
  id: string;
  name: string | null;
  sessionType: string;
}

interface FlatResult {
  message: SearchMessage;
  session: SearchSession;
  highlight: string;
}

interface SearchSessionGroup {
  session: SearchSession;
  messages: FlatResult[];
  matchCount: number;
  lastMessageAt: string;
}

interface GlobalSearchResponse {
  sessions: SearchSessionGroup[];
  results: FlatResult[];
  total: number;
  page: number;
  limit: number;
}

export default function GlobalSearchModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { setActiveSession } = useChatStore();
  const [query, setQuery] = useState('');
  const [sessions, setSessions] = useState<SearchSessionGroup[]>([]);
  const [results, setResults] = useState<FlatResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSessions([]);
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const res = await chatApi.globalSearch({ q, limit: 30 });
      const data = res.data as unknown as GlobalSearchResponse;
      setSessions(data.sessions || []);
      setResults(data.results || []);
      setTotal(data.total || 0);
      setSelectedIdx(-1);
    } catch {
      setSessions([]);
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

  // Build flat list from sessions for keyboard navigation
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

  const getSessionIcon = (type: string) => {
    switch (type) {
      case 'group':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'channel':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
    }
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

          {!loading && query && results.length === 0 && (
            <div className="py-8 text-center text-text-secondary text-sm">
              <p>No messages found for "<span className="font-medium text-text">{query}</span>"</p>
              <p className="mt-1 text-xs">Try different keywords or check your search spelling</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs text-text-secondary border-b border-border flex items-center justify-between">
                <span>{total} result{total !== 1 ? 's' : ''} for "<span className="font-medium text-text">{query}</span>"</span>
                <span className="text-text-secondary">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
              </div>
              {sessions.map((group) => (
                <div key={group.session.id}>
                  {/* Session header */}
                  <div className="px-4 py-1.5 text-xs font-medium text-text-secondary bg-bg/50 sticky top-0 flex items-center gap-1.5">
                    <span className="opacity-60">{getSessionIcon(group.session.sessionType)}</span>
                    <span>{group.session.name || (group.session.sessionType === 'private' ? 'Private Chat' : 'Group')}</span>
                    <span className="ml-auto text-[10px] opacity-60">{group.matchCount} match{group.matchCount !== 1 ? 'es' : ''}</span>
                  </div>
                  {group.messages.map((item) => {
                    const globalIdx = results.indexOf(item);
                    return (
                      <button
                        key={item.message.id}
                        onClick={() => handleSelect(group.session.id)}
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
