import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockSessions = [
  {
    id: 'session-1', name: 'Work Chat', sessionType: 'group',
    members: [{ user: { id: 'u1', username: 'Alice', nickname: 'Ali' } }],
  },
  {
    id: 'session-2', name: null, sessionType: 'private',
    members: [{ user: { id: 'u2', username: 'Bob', nickname: null } }],
  },
];

const { mockForwardMessage, mockBatchForwardMessages } = vi.hoisted(() => ({
  mockForwardMessage: vi.fn().mockResolvedValue({}),
  mockBatchForwardMessages: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/api/client', () => ({
  chatApi: {
    forwardMessage: mockForwardMessage,
    batchForwardMessages: mockBatchForwardMessages,
  },
}));

vi.mock('@/stores/chat.store', () => ({
  useChatStore: (selector?: any) => {
    const state = { sessions: mockSessions };
    return selector ? selector(state) : state;
  },
}));

const onClose = vi.fn();
const onDone = vi.fn();
import ForwardModal from './ForwardModal';

describe('ForwardModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('FORWARD-WEB-01: should render with title', () => {
    render(<ForwardModal messageId="msg-1" onClose={onClose} onDone={onDone} />);
    expect(screen.getByText('Forward Message')).toBeInTheDocument();
  });

  it('FORWARD-WEB-02: should display session list', () => {
    render(<ForwardModal messageId="msg-1" onClose={onClose} onDone={onDone} />);
    expect(screen.getByText('Work Chat')).toBeInTheDocument();
  });

  it('FORWARD-WEB-03: should filter sessions by search', () => {
    render(<ForwardModal messageId="msg-1" onClose={onClose} onDone={onDone} />);
    const input = screen.getByPlaceholderText('Search chats...');
    fireEvent.change(input, { target: { value: 'Work' } });
    expect(screen.getByText('Work Chat')).toBeInTheDocument();
    expect(screen.queryByText(/Bob/)).not.toBeInTheDocument();
  });

  it('FORWARD-WEB-04: should select session on click', () => {
    render(<ForwardModal messageId="msg-1" onClose={onClose} onDone={onDone} />);
    fireEvent.click(screen.getByText('Work Chat'));
    expect(screen.getByText(/Forward \(1\)/)).toBeInTheDocument();
  });

  it('FORWARD-WEB-05: should call forwardMessage on Forward click', async () => {
    mockForwardMessage.mockResolvedValue({});
    render(<ForwardModal messageId="msg-1" onClose={onClose} onDone={onDone} />);
    fireEvent.click(screen.getByText('Work Chat'));
    fireEvent.click(screen.getByText(/Forward \(1\)/));
    await waitFor(() => expect(mockForwardMessage).toHaveBeenCalled());
    expect(onDone).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('FORWARD-WEB-06: should call batchForwardMessages with messageIds', async () => {
    mockBatchForwardMessages.mockResolvedValue({});
    render(<ForwardModal messageIds={['msg-1', 'msg-2']} onClose={onClose} onDone={onDone} />);
    fireEvent.click(screen.getByText('Work Chat'));
    fireEvent.click(screen.getByText(/Forward \(1\)/));
    await waitFor(() => expect(mockBatchForwardMessages).toHaveBeenCalled());
  });

  it('FORWARD-WEB-07: should show empty state when no sessions match', () => {
    render(<ForwardModal messageId="msg-1" onClose={onClose} onDone={onDone} />);
    const input = screen.getByPlaceholderText('Search chats...');
    fireEvent.change(input, { target: { value: 'ZZZZZZ' } });
    expect(screen.getByText('No chats found')).toBeInTheDocument();
  });

  it('FORWARD-WEB-08: should disable Forward button when nothing selected', () => {
    render(<ForwardModal messageId="msg-1" onClose={onClose} onDone={onDone} />);
    const forwardBtn = screen.getByText('Forward (0)').closest('button') as HTMLButtonElement;
    expect(forwardBtn.disabled).toBe(true);
  });
});
