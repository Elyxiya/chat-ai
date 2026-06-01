import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockSession = {
  id: 'session-1',
  name: 'Work Group',
  sessionType: 'group',
  announcement: 'Welcome to the group!',
  ownerId: 'user-1',
  muted: false,
  members: [
    { user: { id: 'user-1', username: 'admin', nickname: 'Admin' }, role: 'owner' },
    { user: { id: 'user-2', username: 'alice', nickname: null }, role: 'member' },
  ],
};

const mockMembers = [
  { id: 'm1', user: { id: 'user-1', username: 'admin', nickname: 'Admin', avatarUrl: null, status: 'online' }, role: 'owner' },
  { id: 'm2', user: { id: 'user-2', username: 'alice', nickname: null, avatarUrl: null, status: 'offline' }, role: 'member' },
];

const { mockGetSessionMembers, mockSetAnnouncement, mockRemoveAnnouncement, mockGenerateInviteLink, mockMuteSession } = vi.hoisted(() => ({
  mockGetSessionMembers: vi.fn(),
  mockSetAnnouncement: vi.fn(),
  mockRemoveAnnouncement: vi.fn(),
  mockGenerateInviteLink: vi.fn(),
  mockMuteSession: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  chatApi: {
    getSessionMembers: mockGetSessionMembers,
    setAnnouncement: mockSetAnnouncement,
    removeAnnouncement: mockRemoveAnnouncement,
    generateInviteLink: mockGenerateInviteLink,
    muteSession: mockMuteSession,
  },
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (selector?: any) => {
    const state = { user: { id: 'user-1', username: 'admin' } };
    return selector ? selector(state) : state;
  },
}));

const onClose = vi.fn();
import GroupDetailPanel from './GroupDetailPanel';

describe('GroupDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessionMembers.mockResolvedValue({ data: mockMembers });
  });

  it('GROUP-WEB-01: should not render when isOpen is false', () => {
    const { container } = render(<GroupDetailPanel session={mockSession} isOpen={false} onClose={onClose} />);
    expect(container.innerHTML).toBe('');
  });

  it('GROUP-WEB-02: should render when isOpen is true', () => {
    render(<GroupDetailPanel session={mockSession} isOpen={true} onClose={onClose} />);
    expect(screen.getByText('Work Group')).toBeInTheDocument();
    expect(screen.getByText('Announcement')).toBeInTheDocument();
    expect(screen.getByText('Invite Link')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    // Members appears in header and count - use getAllByText
    expect(screen.getAllByText(/Members?/).length).toBeGreaterThanOrEqual(1);
  });

  it('GROUP-WEB-03: should display announcement', () => {
    render(<GroupDetailPanel session={mockSession} isOpen={true} onClose={onClose} />);
    expect(screen.getByText('Welcome to the group!')).toBeInTheDocument();
  });

  it('GROUP-WEB-04: should allow admin to edit announcement', () => {
    render(<GroupDetailPanel session={mockSession} isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Remove')).toBeInTheDocument();
  });

  it('GROUP-WEB-05: should load members on open', async () => {
    render(<GroupDetailPanel session={mockSession} isOpen={true} onClose={onClose} />);
    await waitFor(() => {
      expect(mockGetSessionMembers).toHaveBeenCalledWith('session-1');
    });
  });

  it('GROUP-WEB-06: should display member list', async () => {
    render(<GroupDetailPanel session={mockSession} isOpen={true} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('@admin')).toBeInTheDocument();
      expect(screen.getByText('@alice')).toBeInTheDocument();
    });
  });

  it('GROUP-WEB-07: should show Owner badge for owner', async () => {
    render(<GroupDetailPanel session={mockSession} isOpen={true} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Owner')).toBeInTheDocument();
    });
  });

  it('GROUP-WEB-08: should allow admin to generate invite link', async () => {
    mockGenerateInviteLink.mockResolvedValue({ data: { code: 'invite-code-123' } });
    render(<GroupDetailPanel session={mockSession} isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Generate invite link'));
    await waitFor(() => {
      expect(screen.getByText('invite-code-123')).toBeInTheDocument();
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });
  });

  it('GROUP-WEB-09: should close on backdrop click', () => {
    render(<GroupDetailPanel session={mockSession} isOpen={true} onClose={onClose} />);
    const backdrop = document.querySelector('.fixed.inset-0.-z-10');
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});
