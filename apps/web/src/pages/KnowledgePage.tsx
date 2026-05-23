import { useEffect, useState } from 'react';
import { useKnowledgeStore } from '@/stores/knowledge.store';

export default function KnowledgePage() {
  const { bases, currentBase, searchQuery, searchResults, isSearching, fetchBases, createBase, deleteBase, addText, search, setCurrentBase, setSearchQuery } = useKnowledgeStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newBaseName, setNewBaseName] = useState('');
  const [newBaseDesc, setNewBaseDesc] = useState('');
  const [addTextContent, setAddTextContent] = useState('');
  const [activeTab, setActiveTab] = useState<'bases' | 'search'>('bases');

  useEffect(() => { fetchBases(); }, [fetchBases]);

  const handleCreate = async () => {
    if (!newBaseName.trim()) return;
    await createBase({ name: newBaseName, description: newBaseDesc });
    setNewBaseName('');
    setNewBaseDesc('');
    setShowCreate(false);
  };

  return (
    <div className="flex h-full">
      {/* Left sidebar */}
      <div className="w-72 border-r border-border flex flex-col bg-surface">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Knowledge Bases</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button onClick={() => setActiveTab('bases')} className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'bases' ? 'border-primary-600 text-primary-600' : 'border-transparent text-text-secondary'}`}>
            Bases
          </button>
          <button onClick={() => setActiveTab('search')} className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'search' ? 'border-primary-600 text-primary-600' : 'border-transparent text-text-secondary'}`}>
            Search
          </button>
        </div>

        {activeTab === 'bases' && (
          <div className="flex-1 overflow-y-auto">
            {bases.length === 0 ? (
              <div className="p-4 text-center text-text-secondary text-sm">
                No knowledge bases yet
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {bases.map((kb) => (
                  <button
                    key={kb.id}
                    onClick={() => setCurrentBase(kb)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${currentBase?.id === kb.id ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-bg'}`}
                  >
                    <p className="font-medium text-sm truncate">{kb.name}</p>
                    <p className="text-xs text-text-secondary mt-0.5 truncate">{kb.description || 'No description'}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs text-text-secondary">{kb._count?.documents || 0} docs</span>
                      <span className="text-xs text-text-secondary">{kb._count?.chunks || 0} chunks</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="flex-1 p-3 space-y-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across all knowledge bases..."
              className="input-field"
              onKeyDown={(e) => { if (e.key === 'Enter') search(searchQuery); }}
            />
            <button
              onClick={() => search(searchQuery)}
              disabled={!searchQuery.trim() || isSearching}
              className="btn-primary w-full disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
            {searchResults.length > 0 && (
              <div className="space-y-2 overflow-y-auto">
                {searchResults.map((result: any, i: number) => (
                  <div key={i} className="p-3 bg-bg rounded-lg border border-border">
                    <p className="text-xs text-text-secondary mb-1">{result.metadata?.source || 'Unknown source'}</p>
                    <p className="text-sm whitespace-pre-wrap">{result.content}</p>
                    {result.score && (
                      <p className="text-xs text-text-secondary mt-1">Score: {(result.score * 100).toFixed(1)}%</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {currentBase ? (
          <>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{currentBase.name}</h2>
                <p className="text-sm text-text-secondary">{currentBase.description}</p>
              </div>
              <button
                onClick={() => { deleteBase(currentBase.id); setCurrentBase(null); }}
                className="px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
            </div>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              <div>
                <h3 className="text-sm font-medium mb-2">Add Text Content</h3>
                <textarea
                  value={addTextContent}
                  onChange={(e) => setAddTextContent(e.target.value)}
                  placeholder="Paste or type content to add to this knowledge base..."
                  className="input-field w-full h-32 resize-none"
                />
                <button
                  onClick={() => { if (addTextContent.trim()) { addText(currentBase.id, addTextContent); setAddTextContent(''); } }}
                  disabled={!addTextContent.trim()}
                  className="btn-primary mt-2 disabled:opacity-50"
                >
                  Add Content
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-secondary">
            <div className="text-center">
              <span className="text-5xl mb-3 block">📚</span>
              <p className="text-lg font-medium mb-1">Knowledge Base</p>
              <p className="text-sm">Select a knowledge base or create a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-surface rounded-xl p-6 w-full max-w-md shadow-xl border border-border">
            <h3 className="font-semibold text-lg mb-4">Create Knowledge Base</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={newBaseName}
                  onChange={(e) => setNewBaseName(e.target.value)}
                  className="input-field"
                  placeholder="e.g. Product Documentation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newBaseDesc}
                  onChange={(e) => setNewBaseDesc(e.target.value)}
                  className="input-field resize-none h-20"
                  placeholder="Optional description..."
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleCreate} disabled={!newBaseName.trim()} className="btn-primary flex-1 disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
