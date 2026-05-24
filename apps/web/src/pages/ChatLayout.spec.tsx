import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatLayout from './ChatLayout';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...(actual as any),
    useNavigate: () => mockNavigate,
    Outlet: () => <div data-testid="outlet">Main Content</div>,
  };
});

const mockConnect = vi.fn();
const mockLoadSessions = vi.fn();
const mockSetOpen = vi.fn();
const mockFetchUnreadCount = vi.fn();
const mockSetTheme = vi.fn();

// Build the mock hook with getState support using vi.hoisted
const { mockUseAuthStore, mockCheckAuth } = vi.hoisted(() => {
  const checkAuth = vi.fn(async () => {});
  const mockAuthState = {
    user: { id: 'user-1', username: 'TestUser', nickname: 'Test', avatarUrl: null, email: 'test@example.com', userType: 'human' as const, status: 'online' as const, createdAt: '2025-01-01T00:00:00Z' },
    accessToken: 'token',
    checkAuth,
  };
  const hook = Object.assign(
    vi.fn(() => mockAuthState),
    { getState: vi.fn(() => mockAuthState) },
  );
  return { mockUseAuthStore: hook, mockAuthState, mockCheckAuth: checkAuth };
});

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: mockUseAuthStore,
}));

vi.mock('@/stores/chat.store', () => ({
  useChatStore: vi.fn(() => ({
    connect: mockConnect,
    loadSessions: mockLoadSessions,
  })),
}));

vi.mock('@/stores/theme.store', () => ({
  useThemeStore: vi.fn(() => ({
    resolvedTheme: 'light',
    setTheme: mockSetTheme,
  })),
}));

vi.mock('@/stores/notification.store', () => ({
  useNotificationStore: vi.fn(() => ({
    unreadCount: 0,
    setOpen: mockSetOpen,
    fetchUnreadCount: mockFetchUnreadCount,
  })),
}));

vi.mock('@/components/SessionList/SessionList', () => ({
  default: () => <div data-testid="session-list">SessionList</div>,
}));

vi.mock('@/components/NotificationPanel/NotificationPanel', () => ({
  default: () => <div data-testid="notification-panel">NotificationPanel</div>,
}));

vi.mock('@/components/UserSearch/UserSearchModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="user-search-modal">
      UserSearch
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

describe('ChatLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure mocks return proper state
    mockUseAuthStore.mockReturnValue(mockUseAuthStore.getState());
  });

  it('LAYOUT-WEB-01: should render sidebar with user info', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <ChatLayout />
        </MemoryRouter>,
      );
    });

    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('TestUser')).toBeInTheDocument();
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('LAYOUT-WEB-02: should call checkAuth on mount', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <ChatLayout />
        </MemoryRouter>,
      );
    });

    expect(mockCheckAuth).toHaveBeenCalled();
  });

  it('LAYOUT-WEB-03: should navigate to login if no accessToken', async () => {
    const noTokenState = {
      user: null,
      accessToken: null,
      checkAuth: mockCheckAuth,
    };
    mockUseAuthStore.mockReturnValue(noTokenState);
    mockUseAuthStore.getState.mockReturnValue(noTokenState);

    await act(async () => {
      render(
        <MemoryRouter>
          <ChatLayout />
        </MemoryRouter>,
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('LAYOUT-WEB-04: should render navigation items', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <ChatLayout />
        </MemoryRouter>,
      );
    });

    expect(screen.getByText('Chats')).toBeInTheDocument();
    expect(screen.getByText('AI Agent')).toBeInTheDocument();
    expect(screen.getByText('Knowledge Base')).toBeInTheDocument();
  });

  it('LAYOUT-WEB-05: should show AI badge on agent nav', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <ChatLayout />
        </MemoryRouter>,
      );
    });

    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('LAYOUT-WEB-06: should navigate on nav item click', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
        <ChatLayout />
        </MemoryRouter>,
      );
    });

    fireEvent.click(screen.getByText('Knowledge Base'));
    expect(mockNavigate).toHaveBeenCalledWith('/knowledge');
  });

  it('LAYOUT-WEB-07: should toggle theme on button click', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <ChatLayout />
        </MemoryRouter>,
      );
    });

    fireEvent.click(screen.getByTitle('Switch to dark mode'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('LAYOUT-WEB-08: should show user search modal', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <ChatLayout />
        </MemoryRouter>,
      );
    });

    expect(screen.queryByTestId('user-search-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Search users'));
    expect(screen.getByTestId('user-search-modal')).toBeInTheDocument();
  });

  it('LAYOUT-WEB-09: should close user search modal', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <ChatLayout />
        </MemoryRouter>,
      );
    });

    fireEvent.click(screen.getByText('Search users'));
    expect(screen.getByTestId('user-search-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByTestId('user-search-modal')).not.toBeInTheDocument();
  });

  it('LAYOUT-WEB-10: should open notification panel', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <ChatLayout />
        </MemoryRouter>,
      );
    });

    fireEvent.click(screen.getByTitle('Notifications'));
    expect(mockSetOpen).toHaveBeenCalledWith(true);
  });

  it('LAYOUT-WEB-11: should show notification badge when unread', async () => {
    // Override the notification mock
    const useNotificationStoreModule = await import('@/stores/notification.store');
    vi.mocked(useNotificationStoreModule.useNotificationStore).mockReturnValue({
      unreadCount: 5,
      setOpen: mockSetOpen,
      fetchUnreadCount: mockFetchUnreadCount,
    } as any);

    await act(async () => {
      render(
        <MemoryRouter>
          <ChatLayout />
        </MemoryRouter>,
      );
    });

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('LAYOUT-WEB-12: should navigate to settings', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <ChatLayout />
        </MemoryRouter>,
      );
    });

    fireEvent.click(screen.getByTitle('Settings'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });
});
