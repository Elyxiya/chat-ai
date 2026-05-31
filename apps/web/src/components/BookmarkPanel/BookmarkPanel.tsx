import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatApi } from '@/api/client';
import type { Bookmark } from '@/types';

interface BookmarkPanelProps {
  onClose: () => void;
}

export default function BookmarkPanel({ onClose }: BookmarkPanelProps) {
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');

  useEffect(() => {
    loadBookmarks();
  }, []);

  const extractAllTags = useCallback((items: Bookmark[]) => {
    const tagSet = new Set<string>();
    items.forEach((b) => b.tags?.forEach((t) => tagSet.add(t)));
    setAllTags(Array.from(tagSet).sort());
  }, []);

  const loadBookmarks = async () => {
    setLoading(true);
    try {
      const res: any = await chatApi.getBookmarks();
      const items = res.data || [];
      setBookmarks(items);
      extractAllTags(items);
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  const handleRemove = async (messageId: string) => {
    try {
      await chatApi.toggleBookmark(messageId);
      const updated = bookmarks.filter((b) => b.message.id !== messageId);
      setBookmarks(updated);
      extractAllTags(updated);
    } catch {
      /* ignore */
    }
  };

  const handleNavigate = (sessionId: string) => {
    navigate(`/chat/${sessionId}`);
    onClose();
  };

  const handleSaveNote = async (messageId: string) => {
    try {
      const res: any = await chatApi.updateBookmark(messageId, { note: noteDraft });
      setBookmarks((prev) => prev.map((b) => (b.message.id === messageId ? { ...b, note: res.data?.note ?? noteDraft } : b)));
      setEditingNote(null);
    } catch {
      /* ignore */
    }
  };

  const handleAddTag = async (messageId: string) => {
    const tag = tagDraft.trim();
    if (!tag) return;
    const bm = bookmarks.find((b) => b.message.id === messageId);
    const newTags = [...(bm?.tags || []), tag];
    try {
      const res: any = await chatApi.updateBookmark(messageId, { tags: newTags });
      const savedTags = res.data?.tags ?? newTags;
      setBookmarks((prev) => prev.map((b) => (b.message.id === messageId ? { ...b, tags: savedTags } : b)));
      setAllTags((prev) => (prev.includes(tag) ? prev : [...prev, tag].sort()));
      setTagDraft('');
    } catch {
      /* ignore */
    }
  };

  const handleRemoveTag = async (messageId: string, tag: string) => {
    const bm = bookmarks.find((b) => b.message.id === messageId);
    const newTags = (bm?.tags || []).filter((t) => t !== tag);
    try {
      const res: any = await chatApi.updateBookmark(messageId, { tags: newTags });
      const savedTags = res.data?.tags ?? newTags;
      setBookmarks((prev) => prev.map((b) => (b.message.id === messageId ? { ...b, tags: savedTags } : b)));
      // Refresh all tags
      const updated = bookmarks.map((b) => (b.message.id === messageId ? { ...b, tags: savedTags } : b));
      extractAllTags(updated);
    } catch {
      /* ignore */
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim() && !activeTag) {
      loadBookmarks();
      return;
    }
    try {
      const res: any = await chatApi.searchBookmarks({ q: query.trim() || undefined, tag: activeTag || undefined });
      setBookmarks(res.data || []);
    } catch {
      /* ignore */
    }
  };

  const handleTagFilter = async (tag: string | null) => {
    setActiveTag(tag);
    try {
      const res: any = await chatApi.searchBookmarks({ tag: tag || undefined, q: searchQuery.trim() || undefined });
      setBookmarks(res.data || []);
    } catch {
      /* ignore */
    }
  };

  const getSessionLabel = (session: Bookmark['message']['session']) => {
    return session.name || `${session.sessionType} chat`;
  };

  const filteredBookmarks = bookmarks;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-[10vh]">
      <div className="bg-surface rounded-xl w-full max-w-lg shadow-xl border border-border max-h-[80vh] flex flex-col">
        {/* Header */}
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

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search bookmarks..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-bg border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Tag Filter */}
        {allTags.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            <button
              onClick={() => handleTagFilter(null)}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                activeTag === null
                  ? 'bg-primary-500 text-white'
                  : 'bg-border/50 text-text-secondary hover:bg-border'
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagFilter(tag)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  activeTag === tag
                    ? 'bg-primary-500 text-white'
                    : 'bg-border/50 text-text-secondary hover:bg-border'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Bookmark List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredBookmarks.length === 0 ? (
            <div className="py-12 text-center text-text-secondary text-sm">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <p>No bookmarks yet</p>
              <p className="text-xs mt-1">Bookmark messages to find them later</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredBookmarks.map((bm) => (
                <div key={bm.id} className="px-4 py-3 hover:bg-border/30 transition-colors">
                  {/* Message content (clickable) */}
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

                  {/* Tags */}
                  {bm.tags && bm.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {bm.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-primary-500/10 text-primary-500 rounded-full"
                        >
                          {tag}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveTag(bm.message.id, tag); }}
                            className="hover:text-red-500 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Add tag input */}
                  {editingTags === bm.message.id && (
                    <div className="mt-2 flex items-center gap-1">
                      <input
                        type="text"
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { handleAddTag(bm.message.id); } }}
                        placeholder="Add tag..."
                        className="flex-1 px-2 py-1 text-xs bg-bg border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        autoFocus
                      />
                      <button
                        onClick={() => { setEditingTags(null); setTagDraft(''); }}
                        className="text-xs text-text-secondary hover:text-text"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Note */}
                  {editingNote === bm.message.id ? (
                    <div className="mt-2">
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-bg border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
                        rows={2}
                        placeholder="Add a personal note..."
                        autoFocus
                      />
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => handleSaveNote(bm.message.id)}
                          className="text-xs text-primary-500 hover:text-primary-600 font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingNote(null)}
                          className="text-xs text-text-secondary hover:text-text"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : bm.note ? (
                    <div className="mt-1.5 flex items-start gap-1">
                      <svg className="w-3.5 h-3.5 mt-0.5 text-text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <p className="text-xs text-text-secondary flex-1">{bm.note}</p>
                      <button
                        onClick={() => { setEditingNote(bm.message.id); setNoteDraft(bm.note || ''); }}
                        className="text-[10px] text-primary-500 hover:text-primary-600 flex-shrink-0"
                      >
                        Edit
                      </button>
                    </div>
                  ) : null}

                  {/* Actions row */}
                  <div className="mt-1.5 flex items-center gap-3">
                    <button
                      onClick={() => { setEditingTags(editingTags === bm.message.id ? null : bm.message.id); setTagDraft(''); }}
                      className="text-xs text-primary-500 hover:text-primary-600 transition-colors"
                    >
                      + Tag
                    </button>
                    <button
                      onClick={() => { setEditingNote(editingNote === bm.message.id ? null : bm.message.id); setNoteDraft(bm.note || ''); }}
                      className="text-xs text-primary-500 hover:text-primary-600 transition-colors"
                    >
                      {bm.note ? 'Edit Note' : '+ Note'}
                    </button>
                    <button
                      onClick={() => handleRemove(bm.message.id)}
                      className="text-xs text-red-500 hover:text-red-600 transition-colors ml-auto"
                    >
                      Remove
                    </button>
                  </div>
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
