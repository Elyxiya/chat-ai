import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockToken = 'mock-token';

vi.mock('./auth.store', () => ({
  useAuthStore: {
    getState: () => ({ accessToken: mockToken }),
  },
}));

import { useKnowledgeStore } from './knowledge.store';

const mockBases = [
  { id: 'kb-1', name: 'Docs', description: 'Documentation', isPublic: false, chunkSize: 500, chunkOverlap: 50, embeddingModel: 'text-embedding-3-small', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z', _count: { documents: 2, chunks: 10 } },
  { id: 'kb-2', name: 'FAQ', description: null, isPublic: true, chunkSize: 500, chunkOverlap: 50, embeddingModel: 'text-embedding-3-small', createdAt: '2025-01-02T00:00:00Z', updatedAt: '2025-01-02T00:00:00Z', _count: { documents: 1, chunks: 5 } },
];

const mockSearchResults = [
  { content: 'Result 1', metadata: { source: 'Docs' }, score: 0.95 },
  { content: 'Result 2', metadata: { source: 'FAQ' }, score: 0.82 },
];

describe('knowledge.store', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    useKnowledgeStore.setState({
      bases: [],
      currentBase: null,
      searchQuery: '',
      searchResults: [],
      isSearching: false,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should have initial state', () => {
    const state = useKnowledgeStore.getState();
    expect(state.bases).toEqual([]);
    expect(state.currentBase).toBeNull();
    expect(state.searchQuery).toBe('');
    expect(state.searchResults).toEqual([]);
    expect(state.isSearching).toBe(false);
  });

  describe('fetchBases', () => {
    it('should fetch and set bases on success', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ data: mockBases }),
      });

      await useKnowledgeStore.getState().fetchBases();

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/knowledge/bases', {
        headers: { Authorization: `Bearer ${mockToken}` },
      });
      expect(useKnowledgeStore.getState().bases).toEqual(mockBases);
    });

    it('should handle fetch failure gracefully', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await useKnowledgeStore.getState().fetchBases();

      expect(useKnowledgeStore.getState().bases).toEqual([]);
    });
  });

  describe('createBase', () => {
    it('should POST to create a base', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({}) });

      await useKnowledgeStore.getState().createBase({ name: 'New KB', description: 'Desc' });

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/knowledge/bases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockToken}`,
        },
        body: JSON.stringify({ name: 'New KB', description: 'Desc' }),
      });
    });
  });

  describe('deleteBase', () => {
    it('should delete a base and remove it from state', async () => {
      useKnowledgeStore.setState({ bases: mockBases, currentBase: mockBases[0] });
      globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({}) });

      await useKnowledgeStore.getState().deleteBase('kb-1');

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/knowledge/bases/kb-1', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${mockToken}` },
      });
      const state = useKnowledgeStore.getState();
      expect(state.bases).toHaveLength(1);
      expect(state.bases[0].id).toBe('kb-2');
      expect(state.currentBase).toBeNull();
    });
  });

  describe('addText', () => {
    it('should POST text content to the API', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({}) });

      await useKnowledgeStore.getState().addText('kb-1', 'Sample content');

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/knowledge/bases/kb-1/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockToken}`,
        },
        body: JSON.stringify({ content: 'Sample content' }),
      });
    });
  });

  describe('search', () => {
    it('should set search results on success', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ data: mockSearchResults }),
      });

      await useKnowledgeStore.getState().search('test query', 5);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/v1/knowledge/search?query=test%20query&topK=5',
        { headers: { Authorization: `Bearer ${mockToken}` } },
      );
      const state = useKnowledgeStore.getState();
      expect(state.searchResults).toEqual(mockSearchResults);
      expect(state.isSearching).toBe(false);
    });

    it('should handle search failure gracefully', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('API error'));

      await useKnowledgeStore.getState().search('test');

      expect(useKnowledgeStore.getState().searchResults).toEqual([]);
      expect(useKnowledgeStore.getState().isSearching).toBe(false);
    });
  });

  describe('setCurrentBase / setSearchQuery', () => {
    it('should set current base', () => {
      useKnowledgeStore.getState().setCurrentBase(mockBases[0]);
      expect(useKnowledgeStore.getState().currentBase).toEqual(mockBases[0]);
    });

    it('should set current base to null', () => {
      useKnowledgeStore.getState().setCurrentBase(null);
      expect(useKnowledgeStore.getState().currentBase).toBeNull();
    });

    it('should set search query', () => {
      useKnowledgeStore.getState().setSearchQuery('hello');
      expect(useKnowledgeStore.getState().searchQuery).toBe('hello');
    });
  });
});
