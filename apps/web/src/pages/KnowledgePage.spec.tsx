import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

let mockBasesValue: any[] = [
  { id: 'kb-1', name: 'Docs', description: 'Documentation', isPublic: false, chunkSize: 500, chunkOverlap: 50, embeddingModel: 'text-embedding-3-small', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z', _count: { documents: 2, chunks: 10 } },
  { id: 'kb-2', name: 'FAQ', description: null, isPublic: true, chunkSize: 500, chunkOverlap: 50, embeddingModel: 'text-embedding-3-small', createdAt: '2025-01-02T00:00:00Z', updatedAt: '2025-01-02T00:00:00Z', _count: { documents: 1, chunks: 5 } },
];

const mockFetchBases = vi.fn();
const mockSetCurrentBase = vi.fn();

vi.mock('@/stores/knowledge.store', () => ({
  useKnowledgeStore: (selector?: any) => {
    const state = {
      bases: mockBasesValue,
      currentBase: null,
      searchQuery: '',
      searchResults: [],
      isSearching: false,
      fetchBases: mockFetchBases,
      createBase: vi.fn(),
      deleteBase: vi.fn(),
      addText: vi.fn(),
      search: vi.fn(),
      setCurrentBase: mockSetCurrentBase,
      setSearchQuery: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

import KnowledgePage from './KnowledgePage';

describe('KnowledgePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBasesValue = [
      { id: 'kb-1', name: 'Docs', description: 'Documentation', isPublic: false, chunkSize: 500, chunkOverlap: 50, embeddingModel: 'text-embedding-3-small', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z', _count: { documents: 2, chunks: 10 } },
      { id: 'kb-2', name: 'FAQ', description: null, isPublic: true, chunkSize: 500, chunkOverlap: 50, embeddingModel: 'text-embedding-3-small', createdAt: '2025-01-02T00:00:00Z', updatedAt: '2025-01-02T00:00:00Z', _count: { documents: 1, chunks: 5 } },
    ];
  });

  it('should render page header', () => {
    render(<KnowledgePage />);
    expect(screen.getByText('Knowledge Bases')).toBeInTheDocument();
  });

  it('should render knowledge base list', () => {
    render(<KnowledgePage />);
    expect(screen.getByText('Docs')).toBeInTheDocument();
    expect(screen.getByText('FAQ')).toBeInTheDocument();
  });

  it('should show document and chunk counts', () => {
    render(<KnowledgePage />);
    expect(screen.getByText('2 docs')).toBeInTheDocument();
    expect(screen.getByText('10 chunks')).toBeInTheDocument();
    expect(screen.getByText('1 docs')).toBeInTheDocument();
    expect(screen.getByText('5 chunks')).toBeInTheDocument();
  });

  it('should click on a base to set it as current', () => {
    render(<KnowledgePage />);
    // Find the button containing the text "Docs"
    const docButton = screen.getByText('Docs').closest('button');
    expect(docButton).toBeTruthy();
    if (docButton) fireEvent.click(docButton);
    expect(mockSetCurrentBase).toHaveBeenCalledWith(mockBasesValue[0]);
  });

  it('should show empty state when no knowledge bases', () => {
    mockBasesValue = [];
    render(<KnowledgePage />);
    expect(screen.getByText('No knowledge bases yet')).toBeInTheDocument();
  });

  it('should show empty state in main content when no base selected', () => {
    render(<KnowledgePage />);
    expect(screen.getByText('Knowledge Base')).toBeInTheDocument();
    expect(screen.getByText(/Select a knowledge base/)).toBeInTheDocument();
  });

  it('should have tabs for Bases and Search', () => {
    render(<KnowledgePage />);
    expect(screen.getByText('Bases')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
  });
});
