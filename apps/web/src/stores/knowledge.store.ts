import { create } from 'zustand';
import { KnowledgeBase, KnowledgeDocument } from '@/types';
import { useAuthStore } from './auth.store';

interface DocumentChunk {
  id: string;
  content: string;
  chunk_index: number;
}

interface KnowledgeState {
  bases: KnowledgeBase[];
  currentBase: KnowledgeBase | null;
  documents: KnowledgeDocument[];
  documentsLoading: boolean;
  documentChunks: Record<string, DocumentChunk[]>;
  chunksLoading: string | null;  // document ID being loaded
  searchQuery: string;
  searchResults: any[];
  isSearching: boolean;
  fetchBases: () => Promise<void>;
  fetchDocuments: (kbId: string) => Promise<void>;
  fetchDocumentChunks: (kbId: string, docId: string) => Promise<void>;
  createBase: (data: { name: string; description?: string; isPublic?: boolean }) => Promise<void>;
  deleteBase: (kbId: string) => Promise<void>;
  addText: (kbId: string, content: string) => Promise<void>;
  deleteDocument: (kbId: string, docId: string) => Promise<void>;
  search: (query: string, topK?: number) => Promise<void>;
  setCurrentBase: (kb: KnowledgeBase | null) => void;
  refreshCurrentBase: () => Promise<void>;
  setSearchQuery: (q: string) => void;
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  bases: [],
  currentBase: null,
  documents: [],
  documentsLoading: false,
  documentChunks: {},
  chunksLoading: null,
  searchQuery: '',
  searchResults: [],
  isSearching: false,

  fetchBases: async () => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    try {
      const res = await fetch('/api/v1/knowledge/bases', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      set({ bases: data.data || [] });
    } catch { /* ignore */ }
  },

  fetchDocuments: async (kbId) => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    set({ documentsLoading: true });
    try {
      const res = await fetch(`/api/v1/knowledge/bases/${kbId}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      // The listDocuments endpoint returns all documents for this KB
      set({ documents: data.data || [] });
    } catch { /* ignore */ }
    finally { set({ documentsLoading: false }); }
  },

  fetchDocumentChunks: async (kbId, docId) => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    set({ chunksLoading: docId });
    try {
      const res = await fetch(`/api/v1/knowledge/bases/${kbId}/documents/${docId}/chunks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      set((state) => ({
        documentChunks: { ...state.documentChunks, [docId]: data.data || [] },
        chunksLoading: null,
      }));
    } catch {
      set({ chunksLoading: null });
    }
  },

  createBase: async (data) => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    try {
      await fetch('/api/v1/knowledge/bases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      await useKnowledgeStore.getState().fetchBases();
    } catch { /* ignore */ }
  },

  deleteBase: async (kbId) => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    try {
      await fetch(`/api/v1/knowledge/bases/${kbId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      set((state) => ({
        bases: state.bases.filter((b) => b.id !== kbId),
        currentBase: state.currentBase?.id === kbId ? null : state.currentBase,
      }));
    } catch { /* ignore */ }
  },

  addText: async (kbId, content) => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    try {
      await fetch(`/api/v1/knowledge/bases/${kbId}/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });
      // Refresh document list after adding text
      await get().fetchDocuments(kbId);
    } catch { /* ignore */ }
  },

  deleteDocument: async (kbId, docId) => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    try {
      await fetch(`/api/v1/knowledge/bases/${kbId}/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      set((state) => ({
        documents: state.documents.filter((d) => d.id !== docId),
      }));
    } catch { /* ignore */ }
  },

  search: async (query, topK = 5) => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    set({ isSearching: true });
    try {
      const res = await fetch(`/api/v1/knowledge/search?query=${encodeURIComponent(query)}&topK=${topK}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      set({ searchResults: data.data || [], isSearching: false });
    } catch {
      set({ isSearching: false });
    }
  },

  setCurrentBase: (kb) => {
    set({ currentBase: kb });
    if (kb) {
      // Auto-fetch documents when selecting a base
      get().fetchDocuments(kb.id);
    } else {
      set({ documents: [] });
    }
  },

  refreshCurrentBase: async () => {
    const kb = get().currentBase;
    if (kb) {
      await get().fetchDocuments(kb.id);
      await get().fetchBases();
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
}));
