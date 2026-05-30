import { useEffect, useState, useRef } from 'react';
import { useKnowledgeStore } from '@/stores/knowledge.store';
import { knowledgeApi } from '@/api/client';
import { KnowledgeDocument } from '@/types';

function formatFileSize(bytes?: number | null): string {
  if (bytes == null) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentStatusBadge({ status }: { status: KnowledgeDocument['status'] }) {
  const styles: Record<KnowledgeDocument['status'], string> = {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  const labels: Record<KnowledgeDocument['status'], string> = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function KnowledgePage() {
  const {
    bases, currentBase, documents, documentsLoading,
    documentChunks, chunksLoading,
    searchQuery, searchResults, isSearching,
    fetchBases, fetchDocuments, fetchDocumentChunks, createBase, deleteBase,
    addText, deleteDocument, search,
    setCurrentBase, setSearchQuery, refreshCurrentBase,
  } = useKnowledgeStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newBaseName, setNewBaseName] = useState('');
  const [newBaseDesc, setNewBaseDesc] = useState('');
  const [addTextContent, setAddTextContent] = useState('');
  const [activeTab, setActiveTab] = useState<'bases' | 'search'>('bases');
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<string | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchBases(); }, [fetchBases]);

  const handleCreate = async () => {
    if (!newBaseName.trim()) return;
    await createBase({ name: newBaseName, description: newBaseDesc });
    setNewBaseName('');
    setNewBaseDesc('');
    setShowCreate(false);
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentBase) return;
    setUploading(true);
    try {
      await knowledgeApi.uploadDocument(currentBase.id, file);
      // Refresh both the base list and the document list
      await fetchDocuments(currentBase.id);
    } catch (err) {
      console.error('Document upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!currentBase) return;
    await deleteDocument(currentBase.id, docId);
    setConfirmDeleteDoc(null);
  };

  const handleAddText = async () => {
    if (!addTextContent.trim() || !currentBase) return;
    await addText(currentBase.id, addTextContent);
    setAddTextContent('');
  };

  const handleViewContent = (docId: string) => {
    if (expandedDoc === docId) {
      setExpandedDoc(null);
    } else {
      setExpandedDoc(docId);
      if (!documentChunks[docId] && currentBase) {
        fetchDocumentChunks(currentBase.id, docId);
      }
    }
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
              <div className="flex items-center gap-2">
                <button
                  onClick={refreshCurrentBase}
                  className="p-1.5 text-text-secondary hover:text-text rounded-lg hover:bg-bg transition-colors"
                  title="Refresh"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={() => { deleteBase(currentBase.id); setCurrentBase(null); }}
                  className="px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {/* Document list */}
              <div>
                <h3 className="text-sm font-medium mb-2">
                  Documents
                  {documentsLoading && <span className="ml-2 text-xs text-text-secondary">Loading...</span>}
                </h3>
                {documents.length === 0 && !documentsLoading ? (
                  <div className="text-sm text-text-secondary text-center py-8 border border-dashed border-border rounded-lg">
                    No documents yet. Upload a file or add text content below.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div key={doc.id}>
                        <div className="flex items-center gap-3 p-3 bg-bg rounded-lg border border-border">
                          {/* File icon */}
                          <div className="flex-shrink-0 w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded flex items-center justify-center">
                            <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          {/* Doc info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.fileName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-text-secondary">{formatFileSize(doc.fileSize)}</span>
                              {doc.status === 'completed' && doc.totalChunks > 0 && (
                                <span className="text-xs text-text-secondary">{doc.totalChunks} chunks</span>
                              )}
                              {doc.status === 'processing' && (
                                <span className="text-xs text-text-secondary">
                                  {doc.processedChunks}/{doc.totalChunks} chunks
                                </span>
                              )}
                            </div>
                            {doc.status === 'failed' && doc.errorMessage && (
                              <p className="text-xs text-red-500 mt-0.5">{doc.errorMessage}</p>
                            )}
                          </div>
                          {/* View content button */}
                          {doc.status === 'completed' && (
                            <button
                              onClick={() => handleViewContent(doc.id)}
                              className={`p-1.5 rounded transition-colors ${expandedDoc === doc.id ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30' : 'text-text-secondary hover:text-text hover:bg-bg'}`}
                              title="View extracted content"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          )}
                          {/* Status badge */}
                          <DocumentStatusBadge status={doc.status} />
                          {/* Delete button */}
                          <div className="relative">
                            <button
                              onClick={() => setConfirmDeleteDoc(confirmDeleteDoc === doc.id ? null : doc.id)}
                              className="p-1 text-text-secondary hover:text-red-500 rounded transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                            {/* Confirm tooltip */}
                            {confirmDeleteDoc === doc.id && (
                              <div className="absolute right-0 top-full mt-1 z-10 bg-surface border border-border rounded-lg shadow-lg p-2 w-48">
                                <p className="text-xs text-text-secondary mb-2">Delete this document? The chunks will also be removed.</p>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => setConfirmDeleteDoc(null)}
                                    className="flex-1 px-2 py-1 text-xs rounded bg-bg hover:bg-border transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDocument(doc.id)}
                                    className="flex-1 px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Expandable chunk preview */}
                        {expandedDoc === doc.id && (
                          <div className="ml-11 mt-1 p-3 bg-surface rounded-lg border border-border text-sm space-y-2">
                            {chunksLoading === doc.id ? (
                              <p className="text-text-secondary text-xs">Loading content...</p>
                            ) : documentChunks[doc.id]?.length > 0 ? (
                              documentChunks[doc.id].map((chunk) => (
                                <div key={chunk.id} className="p-2 bg-bg rounded border border-border">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-text-secondary">
                                      Chunk {chunk.chunk_index + 1}
                                    </span>
                                  </div>
                                  <p className="text-xs text-text whitespace-pre-wrap line-clamp-4">
                                    {chunk.content}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-text-secondary text-xs">No content extracted (document may be image-based).</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upload section */}
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-medium mb-2">Upload Document</h3>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.pdf,.csv,.json"
                  onChange={handleDocumentUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="btn-secondary w-full disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload Document'}
                </button>
                <p className="text-xs text-text-secondary mt-1.5">
                  Supported: .txt, .md, .pdf (text-based), .csv, .json. Max 10MB.
                </p>
              </div>

              {/* Add text section */}
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-medium mb-2">Add Text Content</h3>
                <textarea
                  value={addTextContent}
                  onChange={(e) => setAddTextContent(e.target.value)}
                  placeholder="Paste or type content to add to this knowledge base..."
                  className="input-field w-full h-32 resize-none"
                />
                <button
                  onClick={handleAddText}
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
