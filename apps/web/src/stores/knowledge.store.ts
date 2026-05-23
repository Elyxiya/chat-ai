import { create } from 'zustand';
import { KnowledgeBase } from '@/types';
import { useAuthStore } from './auth.store';

interface KnowledgeState {
  bases: KnowledgeBase[];
  currentBase: KnowledgeBase | null;
  searchQuery: string;
  searchResults: any[];
  isSearching: boolean;
  fetchBases: () => Promise<void>;
  createBase: (data: { name: string; description?: string; isPublic?: boolean }) => Promise<void>;
  deleteBase: (kbId: string) => Promise<void>;
  addText: (kbId: string, content: string) => Promise<void>;
  search: (query: string, topK?: number) => Promise<void>;
  setCurrentBase: (kb: KnowledgeBase | null) => void;
  setSearchQuery: (q: string) => void;
}

export const useKnowledgeStore = create<KnowledgeState>((set) => ({
  bases: [],
  currentBase: null,
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

  setCurrentBase: (kb) => set({ currentBase: kb }),
  setSearchQuery: (q) => set({ searchQuery: q }),
}));
