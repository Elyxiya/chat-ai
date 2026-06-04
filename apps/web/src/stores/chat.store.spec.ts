import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChatStore } from './chat.store';

// Must use vi.hoisted so mockSocket exists when vi.mock factory runs (hoisted)
const mockSocket = vi.hoisted(() => ({
  on: vi.fn().mockReturnThis(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: true,
}));

const mockSessions = [
  {
    id: 'session-1',
    sessionType: 'private' as const,
    name: null,
    isPublic: false,
    unreadCount: 0,
    members: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'session-2',
    sessionType: 'group' as const,
    name: 'Test Group',
    isPublic: false,
    unreadCount: 2,
    members: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
];

const mockMessages = [
  { id: 'msg-1', sessionId: 'session-1', senderId: 'user-1', content: 'Hello', contentType: 'text', metadata: {}, isRecalled: false, isPinned: false, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
  { id: 'msg-2', sessionId: 'session-1', senderId: 'user-2', content: 'Hi', contentType: 'text', metadata: {}, isRecalled: false, isPinned: false, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
];

vi.mock('@/api/client', () => ({
  chatApi: {
    getSessions: vi.fn(),
    getMessages: vi.fn(),
    createSession: vi.fn(),
    recallMessage: vi.fn(),
    markRead: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: {
    getState: () => ({
      user: { id: 'user-1', username: 'testuser', nickname: 'Test', avatarUrl: null },
    }),
  },
}));

import { chatApi } from '@/api/client';

describe('chat.store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      sessions: [],
      activeSessionId: null,
      messages: {},
      onlineUsers: new Set(),
      typingUsers: {},
      isLoading: false,
      socket: null,
    });
  });

  describe('initial state', () => {
    it('CHAT-WEB-01: should have initial state', () => {
      const state = useChatStore.getState();
      expect(state.sessions).toEqual([]);
      expect(state.activeSessionId).toBeNull();
      expect(state.messages).toEqual({});
      expect(state.socket).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.onlineUsers.size).toBe(0);
    });
  });

  describe('connect / disconnect', () => {
    it('CHAT-WEB-02: should connect socket with token', async () => {
      // Dynamically import the mocked io to verify it was called
      const socketModule = await import('socket.io-client');
      const ioSpy = socketModule.io as any;

      useChatStore.getState().connect('test-token');

      expect(ioSpy).toHaveBeenCalledWith(
        expect.stringContaining('/chat'),
        expect.objectContaining({
          auth: { token: 'test-token' },
          transports: ['websocket'],
        }),
      );
      expect(useChatStore.getState().socket).toBe(mockSocket);
    });

    it('CHAT-WEB-03: should disconnect socket', () => {
      useChatStore.setState({ socket: mockSocket });
      useChatStore.getState().disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(useChatStore.getState().socket).toBeNull();
    });

    it('CHAT-WEB-04: should register event handlers on connect', () => {
      useChatStore.getState().connect('token');

      const events = mockSocket.on.mock.calls.map((call: any[]) => call[0]);
      expect(events).toContain('message');
      expect(events).toContain('presence');
      expect(events).toContain('typing');
      expect(events).toContain('message_recalled');
      expect(events).toContain('read_receipt');
      expect(events).toContain('disconnect');
    });
  });

  describe('loadSessions', () => {
    it('CHAT-WEB-05: should load sessions successfully', async () => {
      vi.mocked(chatApi.getSessions).mockResolvedValue({ data: mockSessions });

      await useChatStore.getState().loadSessions();

      expect(useChatStore.getState().sessions).toEqual(mockSessions);
      expect(useChatStore.getState().isLoading).toBe(false);
    });

    it('CHAT-WEB-06: should handle loadSessions failure gracefully', async () => {
      vi.mocked(chatApi.getSessions).mockRejectedValue(new Error('Network error'));

      await useChatStore.getState().loadSessions();

      expect(useChatStore.getState().isLoading).toBe(false);
      expect(useChatStore.getState().sessions).toEqual([]);
    });
  });

  describe('loadMessages', () => {
    it('CHAT-WEB-07: should load messages for a session', async () => {
      // Use fresh copy to avoid .reverse() mutation issues
      const msgs = [...mockMessages];
      vi.mocked(chatApi.getMessages).mockResolvedValue({ data: msgs });

      await useChatStore.getState().loadMessages('session-1');

      const state = useChatStore.getState();
      // Store reverses the array: messages come in reverse-chronological from API
      expect(state.messages['session-1']).toHaveLength(2);
      expect(state.messages['session-1'][0].id).toBe('msg-2');
      expect(state.messages['session-1'][1].id).toBe('msg-1');
      expect(chatApi.getMessages).toHaveBeenCalledWith('session-1', undefined);
    });

    it('CHAT-WEB-08: should load messages with pagination params', async () => {
      vi.mocked(chatApi.getMessages).mockResolvedValue({ data: [] });

      await useChatStore.getState().loadMessages('session-1', { limit: 50, before: 'msg-10' });

      expect(chatApi.getMessages).toHaveBeenCalledWith('session-1', { limit: 50, before: 'msg-10' });
    });
  });

  describe('sendMessage (via socket)', () => {
    it('CHAT-WEB-09: should emit message via socket', () => {
      useChatStore.setState({ socket: mockSocket });

      useChatStore.getState().sendMessage('session-1', 'Hello world');

      expect(mockSocket.emit).toHaveBeenCalledWith('message', expect.objectContaining({
        type: 2,
        data: expect.objectContaining({
          sessionId: 'session-1',
          content: 'Hello world',
          contentType: 'text',
        }),
      }));
    });

    it('CHAT-WEB-10: should not emit if socket not connected', () => {
      useChatStore.setState({ socket: null });

      useChatStore.getState().sendMessage('session-1', 'Hello');

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('sendTyping', () => {
    it('CHAT-WEB-11: should emit typing event via socket', () => {
      useChatStore.setState({ socket: mockSocket });

      useChatStore.getState().sendTyping('session-1', true);

      expect(mockSocket.emit).toHaveBeenCalledWith('message', expect.objectContaining({
        type: 8,
        data: { sessionId: 'session-1', isTyping: true },
      }));
    });
  });

  describe('createSession', () => {
    it('CHAT-WEB-12: should create session and prepend to list', async () => {
      const newSession = { ...mockSessions[0], id: 'new-session' };
      vi.mocked(chatApi.createSession).mockResolvedValue({ data: newSession });

      const id = await useChatStore.getState().createSession({
        sessionType: 'private',
        memberIds: ['user-2'],
      });

      expect(id).toBe('new-session');
      expect(useChatStore.getState().sessions[0]).toEqual(newSession);
    });
  });

  describe('setActiveSession', () => {
    it('CHAT-WEB-13: should set active session and trigger join/markRead', () => {
      useChatStore.setState({
        socket: mockSocket,
        messages: { 'session-1': [{ ...mockMessages[0], id: 'msg-last' }] },
      });
      vi.mocked(chatApi.markRead).mockResolvedValue(undefined);

      useChatStore.getState().setActiveSession('session-1');

      expect(useChatStore.getState().activeSessionId).toBe('session-1');
      expect(mockSocket.emit).toHaveBeenCalledWith('join_session', { sessionId: 'session-1' });
    });

    it('CHAT-WEB-14: should clear active session when setting null', () => {
      useChatStore.setState({ activeSessionId: 'session-1', socket: mockSocket });

      useChatStore.getState().setActiveSession(null);

      expect(useChatStore.getState().activeSessionId).toBeNull();
    });
  });

  describe('WebSocket event handlers', () => {
    function triggerSocketEvent(event: string, ...args: any[]) {
      const handler = mockSocket.on.mock.calls.find((c: any[]) => c[0] === event)?.[1];
      if (handler) handler(...args);
    }

    it('CHAT-WEB-15: should handle incoming message event', () => {
      useChatStore.setState({ messages: { 'session-1': [] }, activeSessionId: 'session-1' });
      useChatStore.getState().connect('token');

      const newMsg = { id: 'msg-3', sessionId: 'session-1', content: 'New' };
      triggerSocketEvent('message', newMsg);

      expect(useChatStore.getState().messages['session-1']).toContainEqual(newMsg);
    });

    it('CHAT-WEB-16: should handle presence event (user online)', () => {
      useChatStore.getState().connect('token');
      triggerSocketEvent('presence', { userId: 'user-5', status: 'online' });

      expect(useChatStore.getState().onlineUsers.has('user-5')).toBe(true);
    });

    it('CHAT-WEB-17: should handle presence event (user offline)', () => {
      useChatStore.setState({ onlineUsers: new Set(['user-5']) });
      useChatStore.getState().connect('token');
      triggerSocketEvent('presence', { userId: 'user-5', status: 'offline' });

      expect(useChatStore.getState().onlineUsers.has('user-5')).toBe(false);
    });

    it('CHAT-WEB-18: should handle message_recalled event', () => {
      useChatStore.setState({
        messages: {
          'session-1': [{ ...mockMessages[0], id: 'msg-1', isRecalled: false }],
        },
      });
      useChatStore.getState().connect('token');
      triggerSocketEvent('message_recalled', { messageId: 'msg-1' });

      expect(useChatStore.getState().messages['session-1'][0].isRecalled).toBe(true);
    });

    it('CHAT-WEB-19: should handle read_receipt event (clear unread)', () => {
      useChatStore.setState({
        sessions: [{ ...mockSessions[1], unreadCount: 5 }],
      });
      useChatStore.getState().connect('token');
      triggerSocketEvent('read_receipt', { sessionId: 'session-2' });

      const session = useChatStore.getState().sessions.find((s) => s.id === 'session-2');
      expect(session?.unreadCount).toBe(0);
    });

    it('CHAT-WEB-20: should handle typing event (start typing)', () => {
      useChatStore.setState({ activeSessionId: 'session-1' });
      useChatStore.getState().connect('token');
      triggerSocketEvent('typing', { userId: 'user-3', username: 'Alice', isTyping: true });

      expect(useChatStore.getState().typingUsers['session-1']).toHaveLength(1);
      expect(useChatStore.getState().typingUsers['session-1'][0].userId).toBe('user-3');
    });

    it('CHAT-WEB-21: should handle typing event (stop typing)', () => {
      useChatStore.setState({
        activeSessionId: 'session-1',
        typingUsers: { 'session-1': [{ userId: 'user-3', username: 'Alice' }] },
      });
      useChatStore.getState().connect('token');
      triggerSocketEvent('typing', { userId: 'user-3', username: 'Alice', isTyping: false });

      expect(useChatStore.getState().typingUsers['session-1']).toHaveLength(0);
    });
  });

  describe('recallMessage', () => {
    it('CHAT-WEB-22: should call recallMessage API', async () => {
      vi.mocked(chatApi.recallMessage).mockResolvedValue(undefined);
      await useChatStore.getState().recallMessage('msg-1');
      expect(chatApi.recallMessage).toHaveBeenCalledWith('msg-1');
    });
  });
});
