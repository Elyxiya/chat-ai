import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockSessions = [
  {
    session: { id: 'session-1', name: 'Work Chat', sessionType: 'group' },
    messages: [
      {
        message: {
          id: 'msg-1', content: 'Meeting at 3pm tomorrow',
          contentType: 'text', createdAt: '2025-01-15T10:00:00Z',
          sender: { id: 'user-1', username: 'Alice', avatarUrl: null, nickname: null },
        },
        session: { id: 'session-1', name: 'Work Chat', sessionType: 'group' },
        highlight: 'Meeting at 3pm tomorrow',
      },
    ],
    matchCount: 1,
    lastMessageAt: '2025-01-15T10:00:00Z',
  },
];

const { mockGlobalSearch } = vi.hoisted(() => ({ mockGlobalSearch: vi.fn() }));

vi.mock('@/api/client', () => ({
  chatApi: { globalSearch: mockGlobalSearch },
}));

const mockSetActiveSession = vi.fn();
vi.mock('@/stores/chat.store', () => ({
  useChatStore: (selector?: any) => {
    const state = { setActiveSession: mockSetActiveSession };
    return selector ? selector(state) : state;
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const onClose = vi.fn();
import GlobalSearchModal from './GlobalSearchModal';

describe('GlobalSearchModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGlobalSearch.mockResolvedValue({
      data: { sessions: mockSessions, results: mockSessions[0].messages, total: 1, page: 1, limit: 30 },
    });
  });

  it('SEARCH-WEB-01: should render with search input', () => {
    render(<GlobalSearchModal onClose={onClose} />);
    expect(screen.getByPlaceholderText('Search messages across all chats...')).toBeInTheDocument();
  });

  it('SEARCH-WEB-02: should show initial empty state', () => {
    render(<GlobalSearchModal onClose={onClose} />);
    expect(screen.getByText('Type to search across all your conversations')).toBeInTheDocument();
  });

  it('SEARCH-WEB-03: should call search API when typing', async () => {
    render(<GlobalSearchModal onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('Search messages across all chats...'), { target: { value: 'meeting' } });
    await waitFor(() => {
      expect(mockGlobalSearch).toHaveBeenCalledWith({ q: 'meeting', limit: 30 });
    }, { timeout: 2000 });
  });

  it('SEARCH-WEB-04: should display search results', async () => {
    render(<GlobalSearchModal onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('Search messages across all chats...'), { target: { value: 'meeting' } });
    await waitFor(() => {
      // Check for session name (not affected by highlight splitting)
      expect(screen.getByText('Work Chat')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('SEARCH-WEB-05: should show no results message', async () => {
    mockGlobalSearch.mockResolvedValue({ data: { sessions: [], results: [], total: 0, page: 1, limit: 30 } });
    render(<GlobalSearchModal onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('Search messages across all chats...'), { target: { value: 'nonexistent' } });
    await waitFor(() => {
      expect(screen.getByText(/No messages found/)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('SEARCH-WEB-06: should navigate on result click', async () => {
    render(<GlobalSearchModal onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('Search messages across all chats...'), { target: { value: 'meeting' } });
    await waitFor(() => {
      expect(screen.getByText('Work Chat')).toBeInTheDocument();
    }, { timeout: 2000 });
    // Click the button containing "Work Chat" session name
    const sessionBtns = screen.getAllByRole('button').filter(b => b.textContent?.includes('Work Chat') || b.textContent?.includes('Meeting'));
    if (sessionBtns.length > 0) fireEvent.click(sessionBtns[0]);
    expect(mockSetActiveSession).toHaveBeenCalledWith('session-1');
    expect(mockNavigate).toHaveBeenCalledWith('/chat/session-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('SEARCH-WEB-07: should close on backdrop click', () => {
    render(<GlobalSearchModal onClose={onClose} />);
    const backdrop = document.querySelector('.fixed.inset-0.-z-10');
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('SEARCH-WEB-08: should show result count and session count', async () => {
    render(<GlobalSearchModal onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('Search messages across all chats...'), { target: { value: 'meeting' } });
    await waitFor(() => {
      expect(screen.getByText(/1 result/)).toBeInTheDocument();
    }, { timeout: 2000 });
    expect(screen.getByText(/1 session/)).toBeInTheDocument();
  });

  it('SEARCH-WEB-09: should handle API failure gracefully', async () => {
    mockGlobalSearch.mockRejectedValue(new Error('Network error'));
    render(<GlobalSearchModal onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('Search messages across all chats...'), { target: { value: 'meeting' } });
    await waitFor(() => {
      // Should show no results state, not crash
      expect(screen.getByText(/No messages found/)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('SEARCH-WEB-10: should handle rapid typing without excessive API calls', async () => {
    render(<GlobalSearchModal onClose={onClose} />);
    const input = screen.getByPlaceholderText('Search messages across all chats...');
    // Type rapidly (debounce should prevent multiple API calls)
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.change(input, { target: { value: 'abc' } });
    await waitFor(() => {
      // Should only make 1 API call due to debounce
      expect(mockGlobalSearch).toHaveBeenCalledTimes(1);
    }, { timeout: 2000 });
  });
});
