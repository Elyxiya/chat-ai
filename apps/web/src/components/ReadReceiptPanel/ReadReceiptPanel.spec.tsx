import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockReadUsers = [
  { userId: 'u1', username: 'alice', nickname: 'Alice', avatarUrl: null, status: 'online', readAt: '2025-01-15T10:05:00Z' },
  { userId: 'u2', username: 'bob', nickname: null, avatarUrl: null, status: 'offline', readAt: '2025-01-15T10:03:00Z' },
];
const mockUnreadUsers = [
  { userId: 'u3', username: 'charlie', nickname: 'Charlie', avatarUrl: null, status: 'offline' },
];

const { mockGetReadReceipts } = vi.hoisted(() => ({ mockGetReadReceipts: vi.fn() }));

vi.mock('@/api/client', () => ({
  chatApi: { getReadReceipts: mockGetReadReceipts },
}));

vi.mock('../LazyImage/LazyImage', () => ({
  default: ({ src, alt, className }: any) => <img src={src} alt={alt} className={className} />,
}));

const onClose = vi.fn();
import ReadReceiptPanel from './ReadReceiptPanel';

describe('ReadReceiptPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetReadReceipts.mockResolvedValue({
      data: { readUsers: mockReadUsers, unreadUsers: mockUnreadUsers, readCount: 2, unreadCount: 1 },
    });
  });

  it('READ-WEB-01: should not render when isOpen is false', () => {
    const { container } = render(<ReadReceiptPanel messageId="msg-1" isOpen={false} onClose={onClose} />);
    expect(container.innerHTML).toBe('');
  });

  it('READ-WEB-02: should render when isOpen is true', async () => {
    render(<ReadReceiptPanel messageId="msg-1" isOpen={true} onClose={onClose} />);
    expect(screen.getByText('Read Receipts')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Read (2)')).toBeInTheDocument();
      expect(screen.getByText('Unread (1)')).toBeInTheDocument();
    });
  });

  it('READ-WEB-03: should display read users list', async () => {
    render(<ReadReceiptPanel messageId="msg-1" isOpen={true} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
    });
  });

  it('READ-WEB-04: should switch to unread tab', async () => {
    render(<ReadReceiptPanel messageId="msg-1" isOpen={true} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Read (2)')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Unread (1)'));
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('READ-WEB-05: should load receipts on mount', async () => {
    render(<ReadReceiptPanel messageId="msg-1" isOpen={true} onClose={onClose} />);
    await waitFor(() => {
      expect(mockGetReadReceipts).toHaveBeenCalledWith('msg-1');
    });
  });

  it('READ-WEB-06: should show loading state', () => {
    mockGetReadReceipts.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<ReadReceiptPanel messageId="msg-1" isOpen={true} onClose={onClose} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('READ-WEB-07: should show empty state for read tab', async () => {
    mockGetReadReceipts.mockResolvedValue({
      data: { readUsers: [], unreadUsers: mockUnreadUsers, readCount: 0, unreadCount: 1 },
    });
    render(<ReadReceiptPanel messageId="msg-1" isOpen={true} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('No one has read this yet')).toBeInTheDocument();
    });
  });

  it('READ-WEB-08: should show empty state for unread tab', async () => {
    mockGetReadReceipts.mockResolvedValue({
      data: { readUsers: mockReadUsers, unreadUsers: [], readCount: 2, unreadCount: 0 },
    });
    render(<ReadReceiptPanel messageId="msg-1" isOpen={true} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Read (2)')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Unread (0)'));
    expect(screen.getByText('Everyone has read this')).toBeInTheDocument();
  });

  it('READ-WEB-09: should show online indicator', async () => {
    render(<ReadReceiptPanel messageId="msg-1" isOpen={true} onClose={onClose} />);
    await waitFor(() => {
      const onlineIndicator = document.querySelector('.bg-green-500');
      expect(onlineIndicator).toBeInTheDocument();
    });
  });
});
