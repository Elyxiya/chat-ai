import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockBookmarks = [
  {
    id: 'bm1',
    bookmarkedAt: '2025-01-15T10:30:00Z',
    tags: ['work', 'important'],
    note: 'Follow up on this',
    message: {
      id: 'msg1',
      content: 'Meeting at 3pm tomorrow',
      contentType: 'text',
      createdAt: '2025-01-15T10:00:00Z',
      sender: { id: 'user2', username: 'Alice', avatarUrl: null, nickname: 'Ali' },
      session: { id: 'session1', name: 'Work Chat', sessionType: 'group' },
    },
  },
  {
    id: 'bm2',
    bookmarkedAt: '2025-01-14T09:00:00Z',
    tags: ['personal'],
    note: null,
    message: {
      id: 'msg2',
      content: 'Dinner at 7pm',
      contentType: 'text',
      createdAt: '2025-01-14T08:00:00Z',
      sender: { id: 'user3', username: 'Bob', avatarUrl: null, nickname: null },
      session: { id: 'session2', name: null, sessionType: 'private' },
    },
  },
];

const { mockGetBookmarks, mockToggleBookmark, mockUpdateBookmark, mockSearchBookmarks } = vi.hoisted(() => ({
  mockGetBookmarks: vi.fn(),
  mockToggleBookmark: vi.fn(),
  mockUpdateBookmark: vi.fn(),
  mockSearchBookmarks: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  chatApi: {
    getBookmarks: mockGetBookmarks,
    toggleBookmark: mockToggleBookmark,
    updateBookmark: mockUpdateBookmark,
    searchBookmarks: mockSearchBookmarks,
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const onClose = vi.fn();
import BookmarkPanel from './BookmarkPanel';

describe('BookmarkPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBookmarks.mockResolvedValue({ data: mockBookmarks });
  });

  it('BOOK-WEB-01: should render with title and loading state', async () => {
    render(<BookmarkPanel onClose={onClose} />);
    expect(screen.getByText('Bookmarks')).toBeInTheDocument();
    expect(mockGetBookmarks).toHaveBeenCalledTimes(1);
  });

  it('BOOK-WEB-02: should render bookmark list after loading', async () => {
    render(<BookmarkPanel onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Meeting at 3pm tomorrow')).toBeInTheDocument();
    });
    expect(screen.getByText('Dinner at 7pm')).toBeInTheDocument();
  });

  it('BOOK-WEB-03: should display tags on bookmark items', async () => {
    render(<BookmarkPanel onClose={onClose} />);
    await waitFor(() => {
      // Tags appear both in filter bar and on items, use getAllByText
      const tags = screen.getAllByText('work');
      expect(tags.length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('important').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('personal').length).toBeGreaterThanOrEqual(1);
  });

  it('BOOK-WEB-04: should display note on bookmark item', async () => {
    render(<BookmarkPanel onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Follow up on this')).toBeInTheDocument();
    });
  });

  it('BOOK-WEB-05: should show tag filter bar with unique tags', async () => {
    render(<BookmarkPanel onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument();
    });
    // Check filter buttons exist - use queryAllByRole to find filter buttons
    const filterButtons = screen.getAllByText('work').filter(
      (el) => el.tagName === 'BUTTON' && el.classList.contains('rounded-full'),
    );
    expect(filterButtons.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('important').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('personal').length).toBeGreaterThanOrEqual(1);
  });

  it('BOOK-WEB-06: should filter by tag when tag button clicked', async () => {
    mockSearchBookmarks.mockResolvedValue({ data: [mockBookmarks[0]] });
    render(<BookmarkPanel onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getAllByText('work').length).toBeGreaterThanOrEqual(1);
    });
    // Click the first "work" button (the filter tag)
    const workButtons = screen.getAllByText('work').filter(
      (el) => el.tagName === 'BUTTON' && el.classList.contains('rounded-full'),
    );
    fireEvent.click(workButtons[0]);
    await waitFor(() => {
      expect(mockSearchBookmarks).toHaveBeenCalledWith({ tag: 'work', q: undefined });
    });
  });

  it('BOOK-WEB-07: should search bookmarks when typing in search box', async () => {
    mockSearchBookmarks.mockResolvedValue({ data: [mockBookmarks[0]] });
    render(<BookmarkPanel onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search bookmarks...')).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText('Search bookmarks...');
    fireEvent.change(searchInput, { target: { value: 'meeting' } });
    await waitFor(() => {
      expect(mockSearchBookmarks).toHaveBeenCalled();
    });
  });

  it('BOOK-WEB-08: should remove bookmark when remove button clicked', async () => {
    mockToggleBookmark.mockResolvedValue({ data: { bookmarked: false } });
    render(<BookmarkPanel onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getAllByText('Remove')).toHaveLength(2);
    });
    fireEvent.click(screen.getAllByText('Remove')[0]);
    await waitFor(() => {
      expect(mockToggleBookmark).toHaveBeenCalledWith('msg1');
    });
  });

  it('BOOK-WEB-09: should show empty state when no bookmarks', async () => {
    mockGetBookmarks.mockResolvedValue({ data: [] });
    render(<BookmarkPanel onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('No bookmarks yet')).toBeInTheDocument();
    });
  });

  it('BOOK-WEB-10: should navigate to session on bookmark click', async () => {
    render(<BookmarkPanel onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Meeting at 3pm tomorrow')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Meeting at 3pm tomorrow'));
    expect(mockNavigate).toHaveBeenCalledWith('/chat/session1');
    expect(onClose).toHaveBeenCalled();
  });
});
