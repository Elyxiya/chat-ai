import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MessageBubble from './MessageBubble';
import { ChatMessage } from '@/types';

const mockMessage: ChatMessage = {
  id: 'msg-1',
  sessionId: 'session-1',
  senderId: 'user-2',
  content: 'Hello there!',
  contentType: 'text',
  metadata: {},
  isRecalled: false,
  isPinned: false,
  createdAt: '2025-01-15T10:30:00Z',
  updatedAt: '2025-01-15T10:30:00Z',
  reactions: [],
  sender: {
    id: 'user-2',
    username: 'Alice',
    nickname: 'Ali',
    avatarUrl: null,
    status: 'online',
  },
};

const mockOwnMessage: ChatMessage = {
  ...mockMessage,
  id: 'msg-2',
  senderId: 'user-1',
  content: 'Hi Alice!',
};

const mockRecalledMessage: ChatMessage = {
  ...mockMessage,
  id: 'msg-3',
  isRecalled: true,
  recalledAt: '2025-01-15T10:31:00Z',
};

const mockImageMessage: ChatMessage = {
  ...mockMessage,
  id: 'msg-4',
  contentType: 'image',
  content: 'https://example.com/image.jpg',
};

const mockAiResponseMessage: ChatMessage = {
  ...mockMessage,
  id: 'msg-5',
  contentType: 'ai_response',
  content: '**Markdown** content',
};

describe('MessageBubble', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('MSG-WEB-01: should render text message content', () => {
    render(<MessageBubble message={mockMessage} isOwn={false} />);
    expect(screen.getByText('Hello there!')).toBeInTheDocument();
  });

  it('MSG-WEB-02: should render own message with different alignment', () => {
    const { container } = render(<MessageBubble message={mockOwnMessage} isOwn={true} />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toContain('justify-end');
  });

  it('MSG-WEB-03: should render others message with different alignment', () => {
    const { container } = render(<MessageBubble message={mockMessage} isOwn={false} />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toContain('justify-start');
  });

  it('MSG-WEB-04: should show recalled message text', () => {
    render(<MessageBubble message={mockRecalledMessage} isOwn={false} />);
    expect(screen.getByText('This message has been recalled')).toBeInTheDocument();
  });

  it('MSG-WEB-05: should render image message', () => {
    render(<MessageBubble message={mockImageMessage} isOwn={false} />);
    const img = screen.getByAltText('Shared image') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe('https://example.com/image.jpg');
  });

  it('MSG-WEB-06: should render ai_response with markdown', () => {
    const { container } = render(<MessageBubble message={mockAiResponseMessage} isOwn={false} />);
    // Should render markdown bold tag
    expect(container.innerHTML).toContain('<strong>Markdown</strong>');
  });

  it('MSG-WEB-07: should show sender info for non-own messages', () => {
    render(<MessageBubble message={mockMessage} isOwn={false} />);
    expect(screen.getByText('Ali')).toBeInTheDocument();
  });

  it('MSG-WEB-08: should not show sender info for own messages', () => {
    render(<MessageBubble message={mockOwnMessage} isOwn={true} />);
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('MSG-WEB-09: should show formatted time', () => {
    render(<MessageBubble message={mockMessage} isOwn={false} />);
    // Time format depends on CI timezone (UTC vs UTC+8)
    expect(screen.getByText(/10:30|18:30/)).toBeInTheDocument();
  });

  it('MSG-WEB-10: should toggle menu on button click', () => {
    render(<MessageBubble message={mockMessage} isOwn={false} />);
    // Menu closed initially
    expect(screen.queryByText('Add Reaction')).not.toBeInTheDocument();

    // Click menu button
    const menuButtons = screen.getAllByRole('button');
    const menuTrigger = menuButtons[0]; // the ... button
    fireEvent.click(menuTrigger);

    expect(screen.getByText('Add Reaction')).toBeInTheDocument();
    expect(screen.getByText('Reply')).toBeInTheDocument();
  });

  it('MSG-WEB-11: should call onReply callback', () => {
    const onReply = vi.fn();
    render(<MessageBubble message={mockMessage} isOwn={false} onReply={onReply} />);

    // Open menu
    const menuButtons = screen.getAllByRole('button');
    fireEvent.click(menuButtons[0]);

    // Click Reply
    fireEvent.click(screen.getByText('Reply'));

    expect(onReply).toHaveBeenCalled();
  });

  it('MSG-WEB-12: should show reaction picker and call onReaction', () => {
    const onReaction = vi.fn();
    render(<MessageBubble message={mockMessage} isOwn={false} onReaction={onReaction} />);

    // Open menu
    const menuButtons = screen.getAllByRole('button');
    fireEvent.click(menuButtons[0]);

    // Open reaction picker
    fireEvent.click(screen.getByText('Add Reaction'));

    // Click emoji
    fireEvent.click(screen.getByText('👍'));

    expect(onReaction).toHaveBeenCalledWith('👍');
  });

  it('MSG-WEB-13: should show existing reactions', () => {
    const messageWithReactions: ChatMessage = {
      ...mockMessage,
      reactions: [
        { id: 'r1', emoji: '👍', userId: 'user-3', messageId: 'msg-1', createdAt: '' },
        { id: 'r2', emoji: '❤️', userId: 'user-4', messageId: 'msg-1', createdAt: '' },
      ],
    };
    render(<MessageBubble message={messageWithReactions} isOwn={false} />);
    expect(screen.getByText('👍')).toBeInTheDocument();
    expect(screen.getByText('❤️')).toBeInTheDocument();
  });

  it('MSG-WEB-14: should show system message styling', () => {
    const systemMsg: ChatMessage = {
      ...mockMessage,
      contentType: 'system',
      content: 'User joined the group',
    };
    const { container } = render(<MessageBubble message={systemMsg} isOwn={false} />);
    // System messages have yellow styling
    const bubble = container.querySelector('.bg-yellow-50');
    expect(bubble).toBeInTheDocument();
  });

  it('MSG-WEB-15: should show bookmark dialog for unbookmarked message', () => {
    const onBookmark = vi.fn();
    const { container } = render(<MessageBubble message={mockMessage} isOwn={false} onBookmark={onBookmark} />);
    // Open menu
    const menuButtons = screen.getAllByRole('button');
    fireEvent.click(menuButtons[0]);
    // Click Bookmark
    fireEvent.click(screen.getByText('Bookmark'));
    // Should show tag input dialog
    expect(screen.getByPlaceholderText('work, important, ...')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Skip')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('MSG-WEB-16: should call onBookmark callback when Skip is clicked', () => {
    const onBookmark = vi.fn();
    render(<MessageBubble message={mockMessage} isOwn={false} onBookmark={onBookmark} />);
    // Open menu
    const menuButtons = screen.getAllByRole('button');
    fireEvent.click(menuButtons[0]);
    // Click Bookmark
    fireEvent.click(screen.getByText('Bookmark'));
    // Click Skip
    fireEvent.click(screen.getByText('Skip'));
    expect(onBookmark).toHaveBeenCalled();
  });

  it('MSG-WEB-17: should show Remove Bookmark for bookmarked message', () => {
    const onBookmark = vi.fn();
    render(<MessageBubble message={mockMessage} isOwn={false} onBookmark={onBookmark} bookmarked={true} />);
    // Open menu
    const menuButtons = screen.getAllByRole('button');
    fireEvent.click(menuButtons[0]);
    // Should show Remove Bookmark instead of Bookmark
    expect(screen.getByText('Remove Bookmark')).toBeInTheDocument();
  });

  it('MSG-WEB-18: should call onBookmark when Remove Bookmark is clicked', () => {
    const onBookmark = vi.fn();
    render(<MessageBubble message={mockMessage} isOwn={false} onBookmark={onBookmark} bookmarked={true} />);
    // Open menu
    const menuButtons = screen.getAllByRole('button');
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText('Remove Bookmark'));
    expect(onBookmark).toHaveBeenCalled();
  });
});
