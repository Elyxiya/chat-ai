import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...(actual as any), useNavigate: () => mockNavigate };
});

let mockIsOpen = true;
const mockNotifications = [
  { id: 'n1', type: 'friend_request', title: 'Friend Request', content: 'User wants to be friends', data: {}, isRead: false, createdAt: '2025-01-01T10:00:00Z' },
  { id: 'n2', type: 'message', title: 'New Message', content: 'Hello!', data: {}, isRead: true, createdAt: '2025-01-01T09:00:00Z' },
  { id: 'n3', type: 'system', title: 'System', content: 'Maintenance', data: {}, isRead: false, createdAt: '2025-01-01T08:00:00Z' },
];

const mockSetOpen = vi.fn();
const mockFetchNotifications = vi.fn();
const mockFetchUnreadCount = vi.fn();
const mockMarkAsRead = vi.fn();
const mockMarkAllAsRead = vi.fn();
const mockDeleteNotification = vi.fn();

const { mockUseNotificationStore } = vi.hoisted(() => {
  const mockFn: any = (selector?: any) => {
    const state = {
      notifications: mockNotifications,
      unreadCount: 2,
      isOpen: mockIsOpen,
      setOpen: mockSetOpen,
      fetchNotifications: mockFetchNotifications,
      fetchUnreadCount: mockFetchUnreadCount,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      deleteNotification: mockDeleteNotification,
    };
    return selector ? selector(state) : state;
  };
  return { mockUseNotificationStore: mockFn };
});

vi.mock('@/stores/notification.store', () => ({
  useNotificationStore: mockUseNotificationStore,
}));

import NotificationPanel from './NotificationPanel';

describe('NotificationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOpen = true;
  });

  it('should render panel with title', () => {
    render(<MemoryRouter><NotificationPanel /></MemoryRouter>);
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('should show unread count badge', () => {
    render(<MemoryRouter><NotificationPanel /></MemoryRouter>);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should render notification list items', () => {
    render(<MemoryRouter><NotificationPanel /></MemoryRouter>);
    expect(screen.getByText('Friend Request')).toBeInTheDocument();
    expect(screen.getByText('New Message')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('should show Mark all read button when unread exists', () => {
    render(<MemoryRouter><NotificationPanel /></MemoryRouter>);
    expect(screen.getByText('Mark all read')).toBeInTheDocument();
  });

  it('should call markAllAsRead when button clicked', () => {
    render(<MemoryRouter><NotificationPanel /></MemoryRouter>);
    fireEvent.click(screen.getByText('Mark all read'));
    expect(mockMarkAllAsRead).toHaveBeenCalled();
  });

  it('should call setOpen(false) when backdrop is clicked', () => {
    render(<MemoryRouter><NotificationPanel /></MemoryRouter>);
    const backdrop = document.querySelector('.fixed.inset-0');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockSetOpen).toHaveBeenCalledWith(false);
    }
  });

  it('should render notification content text', () => {
    render(<MemoryRouter><NotificationPanel /></MemoryRouter>);
    expect(screen.getByText('User wants to be friends')).toBeInTheDocument();
    expect(screen.getByText('Hello!')).toBeInTheDocument();
  });

  it('should return null when isOpen is false', () => {
    mockIsOpen = false;
    const { container } = render(<MemoryRouter><NotificationPanel /></MemoryRouter>);
    expect(container.innerHTML).toBe('');
  });
});
