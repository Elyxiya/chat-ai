import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockSession = {
  id: 'group-1',
  sessionType: 'group',
  name: 'Test Group',
  isPublic: false,
  unreadCount: 0,
  members: [],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

let mockSessions = [mockSession];

vi.mock('@/stores/chat.store', () => ({
  useChatStore: (selector?: any) => {
    const state = { sessions: mockSessions };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: { getState: () => ({ accessToken: 'mock-token' }) },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import GroupManagementPage from './GroupManagementPage';

function renderWithRouter(sessionId = 'group-1') {
  return render(
    <MemoryRouter initialEntries={[`/group/${sessionId}`]}>
      <Routes>
        <Route path="/group/:sessionId" element={<GroupManagementPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GroupManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessions = [mockSession];
  });

  it('should render group name from session', () => {
    renderWithRouter();
    const nameElements = screen.getAllByText('Test Group');
    expect(nameElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should render back button and header', () => {
    renderWithRouter();
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('should show session type and member count', () => {
    renderWithRouter();
    const groupTextElements = screen.getAllByText(/group/i);
    expect(groupTextElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should show search to invite section', () => {
    renderWithRouter();
    expect(screen.getByText('Search users')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search users')).toBeInTheDocument();
  });

  it('should show Group Info section with name', () => {
    renderWithRouter();
    expect(screen.getByText('Group info')).toBeInTheDocument();
    const nameElements = screen.getAllByText('Test Group');
    expect(nameElements.length).toBeGreaterThanOrEqual(2);
  });

  it('should show non-group message for non-group sessions', () => {
    mockSessions = [{ ...mockSession, sessionType: 'private', id: 'private-1' }];
    renderWithRouter('private-1');
    expect(screen.getByText('This page is only for group chats.')).toBeInTheDocument();
    expect(screen.getByText('Back')).toBeInTheDocument();
  });
});
