import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { chatApi } from '@/api/client';
import { useChatStore } from '@/stores/chat.store';

interface DiscoveredChannel {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  joinApproval: string;
  createdAt: string;
  owner: { id: string; username: string; avatarUrl: string | null };
  _count: { members: number };
}

export default function ChannelDiscoveryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [channels, setChannels] = useState<DiscoveredChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [subscribing, setSubscribing] = useState<Set<string>>(new Set());
  const limit = 20;

  const loadChannels = useCallback(async (q?: string, p: number = 1) => {
    setLoading(true);
    try {
      const res: any = await chatApi.discoverChannels({ q, page: p, limit });
      const data = res.data || { items: [], total: 0, page: 1, limit: 20 };
      setChannels(data.items || []);
      setTotal(data.total || 0);
      setPage(data.page || 1);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(searchInput.trim());
    loadChannels(searchInput.trim(), 1);
  };

  const handleSubscribe = async (channelId: string) => {
    setSubscribing((prev) => new Set(prev).add(channelId));
    try {
      await chatApi.subscribeChannel(channelId);
      useChatStore.getState().triggerChannelRefresh();
      useChatStore.getState().loadSessions();
      navigate(`/channel/${channelId}`);
    } catch { /* ignore */ }
    setSubscribing((prev) => { const next = new Set(prev); next.delete(channelId); return next; });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <header className="h-14 px-4 border-b border-border flex items-center gap-3 bg-surface flex-shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="p-1 hover:bg-border rounded transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-semibold text-sm">{t('chat.discoverTitle')}</h2>

        <form onSubmit={handleSearch} className="ml-auto flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('chat.searchChannels')}
            className="input-field w-64 text-xs"
          />
          <button type="submit" className="btn-primary px-3 py-1 text-xs">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </form>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-text-secondary text-sm">{t('common.loading')}</p>
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-secondary">
            <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
            <p className="text-sm">{query ? t('chat.noChannelsFound') : t('chat.noPublicChannels')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {channels.map((ch) => (
                <div key={ch.id} className="card p-4 flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">
                      {ch.name?.charAt(0)?.toUpperCase() || '#'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{ch.name || 'Unnamed'}</h3>
                      <p className="text-xs text-text-secondary">
                        {ch._count.members} {t('chat.subscribersCount')}
                        {ch.joinApproval !== 'none' && (
                          <span className="ml-2 px-1 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px]">
                            {ch.joinApproval === 'approval' ? t('chat.joinApprovalRequired') : t('chat.inviteOnly')}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {ch.description && (
                    <p className="text-xs text-text-secondary mb-3 line-clamp-2">{ch.description}</p>
                  )}

                  <div className="flex items-center gap-2 text-xs text-text-secondary mb-3 mt-auto">
                    <div className="w-5 h-5 rounded-full bg-border flex items-center justify-center overflow-hidden">
                      {ch.owner?.avatarUrl ? (
                        <img src={ch.owner.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </div>
                    <span className="truncate">{ch.owner?.username || 'Unknown'}</span>
                  </div>

                  <button
                    onClick={() => handleSubscribe(ch.id)}
                    disabled={subscribing.has(ch.id)}
                    className="btn-primary w-full text-xs py-1.5 disabled:opacity-50"
                  >
                    {subscribing.has(ch.id) ? t('chat.subscribing') : t('chat.subscribe')}
                  </button>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => { const p = Math.max(1, page - 1); loadChannels(query, p); }}
                  disabled={page <= 1}
                  className="px-3 py-1 text-xs border border-border rounded hover:bg-border disabled:opacity-30 transition-colors"
                >
                  {t('common.previousPage')}
                </button>
                <span className="text-xs text-text-secondary">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => { const p = Math.min(totalPages, page + 1); loadChannels(query, p); }}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-xs border border-border rounded hover:bg-border disabled:opacity-30 transition-colors"
                >
                  {t('common.nextPage')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
