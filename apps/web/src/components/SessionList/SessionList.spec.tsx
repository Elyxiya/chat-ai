import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SessionList from './SessionList';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...(actual as any),
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/stores/chat.store', () => ({
  useChatStore: vi.fn(),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';

const mockUser = {
  id: 'user-1',
  username: 'TestUser',
  email: 'test@example.com',
  userType: 'human' as const,
  status: 'online' as const,
  createdAt: '2025-01-01T00:00:00Z',
};

const mockSessions = [
  {
    id: 'sess-1',
    sessionType: 'private' as const,
    name: null,
    isPublic: false,
    unreadCount: 3,
    members: [
      {
        role: 'member',
        user: {
          id: 'user-2',
          username: 'Alice',
          nickname: null,
          avatarUrl: null,
          status: 'online' as const,
        },
      },
    ],
    lastMessage: {
      id: 'msg-1',
      sessionId: 'sess-1',
      senderId: 'user-2',
      content: 'Hey there!',
      contentType: 'text' as const,
      metadata: {},
      isRecalled: false,
      isPinned: false,
      createdAt: '2025-01-15T10:30:00Z',
      updatedAt: '2025-01-15T10:30:00Z',
      reactions: [],
    },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-15T10:30:00Z',
  },
  {
    id: 'sess-2',
    sessionType: 'group' as const,
    name: 'Project Chat',
    isPublic: false,
    unreadCount: 0,
    members: [
      { role: 'owner', user: { id: 'user-1', username: 'TestUser', nickname: null, avatarUrl: null, status: 'online' as const } },
      { role: 'member', user: { id: 'user-3', username: 'Bob', nickname: null, avatarUrl: null, status: 'offline' as const } },
    ],
    lastMessage: {
      id: 'msg-2',
      sessionId: 'sess-2',
      senderId: 'user-3',
      content: 'Meeting at 3pm',
      contentType: 'text' as const,
      metadata: {},
      isRecalled: false,
      isPinned: false,
      createdAt: '2025-01-14T10:30:00Z',
      updatedAt: '2025-01-14T10:30:00Z',
      reactions: [],
    },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-14T10:30:00Z',
  },
  {
    id: 'sess-3',
    sessionType: 'agent' as const,
    name: 'AI Assistant',
    isPublic: false,
    unreadCount: 0,
    members: [
      { role: 'member', user: { id: 'user-1', username: 'TestUser', nickname: null, avatarUrl: null, status: 'online' as const } },
    ],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
];

describe('SessionList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();

    (useChatStore as any).mockReturnValue({ sessions: [], onlineUsers: new Set() });
    (useAuthStore as any).mockReturnValue({ user: mockUser });
  });

  it('SESS-WEB-01: should show empty state when no sessions', () => {
    render(
      <MemoryRouter>
        <SessionList />
      </MemoryRouter>,
    );

    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    expect(screen.getByText('Start a chat')).toBeInTheDocument();
  });

  it('SESS-WEB-02: should render session list', () => {
    (useChatStore as any).mockReturnValue({ sessions: mockSessions, onlineUsers: new Set() });

    render(
      <MemoryRouter>
        <SessionList />
      </MemoryRouter>,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Project Chat')).toBeInTheDocument();
    expect(screen.getByText('AI Agent')).toBeInTheDocument();
  });

  it('SESS-WEB-03: should show unread badge', () => {
    (useChatStore as any).mockReturnValue({ sessions: mockSessions, onlineUsers: new Set() });

    render(
      <MemoryRouter>
        <SessionList />
      </MemoryRouter>,
    );

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('SESS-WEB-04: should display last message preview', () => {
    (useChatStore as any).mockReturnValue({ sessions: mockSessions, onlineUsers: new Set() });

    render(
      <MemoryRouter>
        <SessionList />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Hey there/)).toBeInTheDocument();
  });

  it('SESS-WEB-05: should navigate on session click', () => {
    (useChatStore as any).mockReturnValue({ sessions: mockSessions, onlineUsers: new Set() });
    // Mock window.location.pathname
    Object.defineProperty(window, 'location', {
      value: { pathname: '/' },
      writable: true,
    });

    render(
      <MemoryRouter>
        <SessionList />
      </MemoryRouter>,
    );

    // Click Alice's chat
    fireEvent.click(screen.getByText('Alice'));

    expect(mockNavigate).toHaveBeenCalledWith('/chat/sess-1');
  });

  it('SESS-WEB-06: should navigate to agent chat for agent sessions', () => {
    (useChatStore as any).mockReturnValue({ sessions: [mockSessions[2]], onlineUsers: new Set() });

    render(
      <MemoryRouter>
        <SessionList />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('AI Agent'));

    expect(mockNavigate).toHaveBeenCalledWith('/agent/sess-3');
  });

  it('SESS-WEB-07: should navigate to new chat on + button click', () => {
    (useChatStore as any).mockReturnValue({ sessions: [], onlineUsers: new Set() });

    render(
      <MemoryRouter>
        <SessionList />
      </MemoryRouter>,
    );

    const addButton = screen.getByTitle('New chat');
    fireEvent.click(addButton);

    expect(mockNavigate).toHaveBeenCalledWith('/chat');
  });

  it('SESS-WEB-08: should highlight active session', () => {
    (useChatStore as any).mockReturnValue({ sessions: mockSessions, onlineUsers: new Set() });

    // Simulate being on /chat/sess-1
    Object.defineProperty(window, 'location', {
      value: { pathname: '/chat/sess-1' },
      writable: true,
    });

    render(
      <MemoryRouter>
        <SessionList />
      </MemoryRouter>,
    );

    const aliceButton = screen.getByText('Alice').closest('button');
    expect(aliceButton?.className).toContain('bg-primary-50');
  });

  it('SESS-WEB-09: should show AI Agent with robot icon', () => {
    (useChatStore as any).mockReturnValue({ sessions: [mockSessions[2]], onlineUsers: new Set() });

    const { container } = render(
      <MemoryRouter>
        <SessionList />
      </MemoryRouter>,
    );

    const agentIcon = container.querySelector('.from-primary-400');
    expect(agentIcon).toBeInTheDocument();
  });
});
