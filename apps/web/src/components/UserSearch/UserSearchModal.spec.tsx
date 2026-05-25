import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockUsers = [
  { id: 'user-1', username: 'alice', nickname: 'Alice', avatarUrl: null },
  { id: 'user-2', username: 'bob', nickname: null, avatarUrl: null },
];

const { mockSearchUsers, mockManageFriend, mockCreateSession, mockUseChatStore, mockUseAuthStore } = vi.hoisted(() => {
  const searchUsers = vi.fn();
  const manageFriend = vi.fn();
  const createSession = vi.fn();

  const chatFn: any = (selector?: any) => {
    const state = { sessions: [], createSession };
    return selector ? selector(state) : state;
  };
  chatFn.getState = () => ({ createSession, sessions: [] });

  const authFn: any = (selector?: any) => {
    const state = { user: { id: 'current-user', username: 'me' } };
    return selector ? selector(state) : state;
  };
  authFn.getState = () => ({ user: { id: 'current-user', username: 'me' } });

  return { mockSearchUsers: searchUsers, mockManageFriend: manageFriend, mockCreateSession: createSession, mockUseChatStore: chatFn, mockUseAuthStore: authFn };
});

vi.mock('@/api/client', () => ({
  chatApi: {
    searchUsers: mockSearchUsers,
    manageFriend: mockManageFriend,
  },
}));

vi.mock('@/stores/chat.store', () => ({
  useChatStore: mockUseChatStore,
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: mockUseAuthStore,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const onClose = vi.fn();
import UserSearchModal from './UserSearchModal';

describe('UserSearchModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal with title', () => {
    render(<UserSearchModal onClose={onClose} />);
    expect(screen.getByText('Search Users')).toBeInTheDocument();
  });

  it('should have search input and button', () => {
    render(<UserSearchModal onClose={onClose} />);
    expect(screen.getByPlaceholderText('Search by username or email...')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
  });

  it('should call searchUsers when search button is clicked', async () => {
    mockSearchUsers.mockResolvedValue({ data: [] });
    render(<UserSearchModal onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('Search by username or email...'), { target: { value: 'alice' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(mockSearchUsers).toHaveBeenCalledWith('alice');
    });
  });

  it('should show "No users found" when query has no results', async () => {
    mockSearchUsers.mockResolvedValue({ data: [] });
    render(<UserSearchModal onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('Search by username or email...'), { target: { value: 'nonexistent' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument();
    });
  });

  it('should search on Enter key press', async () => {
    mockSearchUsers.mockResolvedValue({ data: [] });
    render(<UserSearchModal onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('Search by username or email...'), { target: { value: 'alice' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Search by username or email...'), { key: 'Enter' });

    await waitFor(() => {
      expect(mockSearchUsers).toHaveBeenCalledWith('alice');
    });
  });

  it('should call onClose when close button is clicked', () => {
    render(<UserSearchModal onClose={onClose} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('should render user search results', async () => {
    mockSearchUsers.mockResolvedValue({ data: mockUsers });
    render(<UserSearchModal onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('Search by username or email...'), { target: { value: 'test' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Search by username or email...'), { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });
});
