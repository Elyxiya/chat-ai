import { create } from 'zustand';
import { ChatSession, ChatMessage, WsMessageType } from '@/types';
import { chatApi } from '@/api/client';
import { io, Socket } from 'socket.io-client';
import { useNotificationStore } from './notification.store';
import { useFriendStore } from './friend.store';
import { useAuthStore } from './auth.store';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: Record<string, ChatMessage[]>;
  messagesError: string | null;
  onlineUsers: Set<string>;
  typingUsers: Record<string, { userId: string; username: string }[]>;
  isLoading: boolean;
  socket: Socket | null;

  connect: (token: string) => void;
  disconnect: () => void;
  loadSessions: () => Promise<void>;
  setActiveSession: (sessionId: string | null) => void;
  loadMessages: (sessionId: string, params?: { limit?: number; before?: string }) => Promise<void>;
  sendMessage: (sessionId: string, content: string, contentType?: string) => void;
  sendFileMessage: (sessionId: string, url: string, fileType: string, fileName?: string, fileSize?: number) => void;
  sendTyping: (sessionId: string, isTyping: boolean) => void;
  recallMessage: (messageId: string) => Promise<void>;
  markRead: (sessionId: string) => void;
  joinSession: (sessionId: string) => void;
  leaveSession: (sessionId: string) => void;
  createSession: (data: { sessionType: string; name?: string; memberIds?: string[] }) => Promise<string>;
  editMessage: (sessionId: string, messageId: string, content: string) => Promise<void>;
  addMessageReaction: (sessionId: string, messageId: string, reaction: { id: string; emoji: string; userId: string; messageId: string; createdAt: string }) => void;

  // Batch selection
  batchMode: boolean;
  selectedMessageIds: Set<string>;
  toggleBatchMode: () => void;
  toggleMessageSelection: (messageId: string) => void;
  clearSelection: () => void;

  // Used by ChannelList and ChannelDiscoveryPage to trigger sidebar refresh
  channelRefreshKey: number;
  triggerChannelRefresh: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: {},
  messagesError: null,
  onlineUsers: new Set(),
  typingUsers: {},
  isLoading: false,
  socket: null,
  batchMode: false,
  selectedMessageIds: new Set<string>(),
  channelRefreshKey: 0,

  triggerChannelRefresh: () => set((state) => ({ channelRefreshKey: state.channelRefreshKey + 1 })),

  connect: (token) => {
    const existing = get().socket;
    if (existing?.connected) {
      // Already connected — just update auth token if needed
      if (existing.auth && (existing.auth as any).token !== token) {
        existing.auth = { token };
      }
      return;
    }
    if (existing) {
      existing.disconnect();
    }

    const socket = io(`${WS_URL}/chat`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      // Re-join all session rooms on (re)connect — Socket.IO loses rooms on disconnect
      const currentSessions = get().sessions;
      for (const s of currentSessions) {
        socket.emit('join_session', { sessionId: s.id });
      }
    });

    socket.on('initial_online_users', ({ userIds }: { userIds: string[] }) => {
      set({ onlineUsers: new Set(userIds) });
    });

    socket.on('message', (msg: ChatMessage) => {
      const state = get();
      const { messages, activeSessionId } = state;
      const sessionMsgs = messages[msg.sessionId] || [];

      // Remove optimistic temp messages from the same sender in this session
      const filtered = sessionMsgs.filter(
        (m) => !(m.id.startsWith('temp-') && m.senderId === msg.senderId),
      );

      set({
        messages: {
          ...messages,
          [msg.sessionId]: [...filtered, msg],
        },
      });
      if (msg.sessionId !== activeSessionId) {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === msg.sessionId ? { ...s, unreadCount: s.unreadCount + 1 } : s,
          ),
        }));
      }
    });

    socket.on('presence', ({ userId, status }: { userId: string; status: string }) => {
      set((state) => {
        const newOnline = new Set(state.onlineUsers);
        if (status === 'online') newOnline.add(userId);
        else newOnline.delete(userId);
        return { onlineUsers: newOnline };
      });
    });

    socket.on('typing', ({ userId, username, isTyping }: { userId: string; username: string; isTyping: boolean }) => {
      const { activeSessionId } = get();
      if (!activeSessionId) return;
      set((state) => {
        const current = state.typingUsers[activeSessionId] || [];
        return {
          typingUsers: {
            ...state.typingUsers,
            [activeSessionId]: isTyping
              ? [...current.filter((u) => u.userId !== userId), { userId, username }]
              : current.filter((u) => u.userId !== userId),
          },
        };
      });
    });

    socket.on('message_recalled', ({ messageId }: { messageId: string }) => {
      set((state) => {
        const newMessages: Record<string, ChatMessage[]> = {};
        for (const [sid, msgs] of Object.entries(state.messages)) {
          newMessages[sid] = msgs.map((m) =>
            m.id === messageId ? { ...m, isRecalled: true } : m,
          );
        }
        return { messages: newMessages };
      });
    });

    socket.on('read_receipt', ({ sessionId }: { sessionId: string; userId?: string; lastMessageId?: string }) => {
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? { ...s, unreadCount: 0 } : s,
        ),
      }));
    });

    socket.on('reaction', ({ messageId, sessionId, emoji, userId: rUserId }: { messageId: string; sessionId: string; emoji: string; userId: string }) => {
      set((state) => {
        const msgs = state.messages[sessionId];
        if (!msgs) return state;
        return {
          messages: {
            ...state.messages,
            [sessionId]: msgs.map((m) => {
              if (m.id !== messageId) return m;
              const existing = m.reactions?.some((r) => r.userId === rUserId && r.emoji === emoji);
              if (existing) return m;
              return {
                ...m,
                reactions: [
                  ...(m.reactions || []),
                  { id: `${messageId}_${rUserId}_${emoji}`, emoji, userId: rUserId, messageId, createdAt: new Date().toISOString() },
                ],
              };
            }),
          },
        };
      });
    });

    socket.on('message_edited', ({ messageId, sessionId, content, editCount }: { messageId: string; sessionId: string; content: string; editCount: number }) => {
      set((state) => {
        const msgs = state.messages[sessionId];
        if (!msgs) return state;
        return {
          messages: {
            ...state.messages,
            [sessionId]: msgs.map((m) =>
              m.id === messageId ? { ...m, content, editCount } : m,
            ),
          },
        };
      });
    });

    socket.on('notification', (notification: any) => {
      useNotificationStore.getState().addNotification(notification);
    });

    socket.on('friendship_updated', (_data: any) => {
      // Friendship status changed — reload sessions and friend list
      get().loadSessions();
      useFriendStore.getState().fetchFriends();
    });

    socket.on('disconnect', () => {
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    socket?.disconnect();
    set({ socket: null });
  },

  loadSessions: async () => {
    set({ isLoading: true });
    try {
      const res: any = await chatApi.getSessions();
      const sessions = res.data || [];
      set({ sessions, isLoading: false });
      // Auto-join all session rooms so the user receives real-time messages
      // without needing to click into each session first
      const socket = get().socket;
      if (socket?.connected) {
        for (const s of sessions) {
          socket.emit('join_session', { sessionId: s.id });
        }
      }
    } catch {
      set({ isLoading: false });
    }
  },

  setActiveSession: (sessionId) => {
    set({ activeSessionId: sessionId });
    if (sessionId) {
      get().markRead(sessionId);
      get().joinSession(sessionId);
    }
  },

  loadMessages: async (sessionId, params) => {
    try {
      set({ messagesError: null });
      const res: any = await chatApi.getMessages(sessionId, params);
      const msgs = (res.data || []).reverse();
      set((state) => ({
        messages: { ...state.messages, [sessionId]: msgs },
        messagesError: null,
      }));
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load messages';
      set({ messagesError: msg });
    }
  },

  sendMessage: (sessionId, content, contentType = 'text') => {
    const { socket, messages } = get();
    if (!socket) return;

    // Optimistic update — show message immediately in the UI
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = useAuthStore.getState().user;
    const optimisticMsg = {
      id: tempId,
      sessionId,
      senderId: user?.id || null,
      content,
      contentType: contentType as any,
      metadata: {},
      isRecalled: false,
      isPinned: false,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      reactions: [],
      sender: user ? {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
      } : null,
    } as unknown as ChatMessage;

    set({
      messages: {
        ...messages,
        [sessionId]: [...(messages[sessionId] || []), optimisticMsg],
      },
    });

    // Emit to server
    socket.emit('message', {
      type: WsMessageType.TEXT,
      data: { sessionId, content, contentType, _tempId: tempId },
      timestamp: Date.now(),
    });
  },

  sendFileMessage: (sessionId, url, fileType, fileName, fileSize) => {
    const { socket } = get();
    if (!socket) return;
    const wsType = fileType === 'image' ? WsMessageType.IMAGE : WsMessageType.FILE;
    socket.emit('message', {
      type: wsType,
      data: { sessionId, content: url, contentType: fileType, fileName, fileSize },
      timestamp: Date.now(),
    });
  },

  sendTyping: (sessionId, isTyping) => {
    const { socket } = get();
    if (!socket) return;
    socket.emit('message', {
      type: WsMessageType.TYPING,
      data: { sessionId, isTyping },
    });
  },

  recallMessage: async (messageId) => {
    await chatApi.recallMessage(messageId);
  },

  markRead: (sessionId) => {
    const { messages } = get();
    const msgs = messages[sessionId];
    if (!msgs?.length) return;
    chatApi.markRead(sessionId, msgs[msgs.length - 1].id).catch(() => {});
  },

  editMessage: async (sessionId, messageId, content) => {
    const { socket } = get();
    // Optimistic update — show edited content immediately
    set((state) => {
      const msgs = state.messages[sessionId];
      if (!msgs) return state;
      return {
        messages: {
          ...state.messages,
          [sessionId]: msgs.map((m) =>
            m.id === messageId ? { ...m, content, editCount: (m.editCount || 0) + 1 } : m,
          ),
        },
      };
    });
    if (socket?.connected) {
      socket.emit('edit_message', { messageId, sessionId, content });
    } else {
      await chatApi.editMessage(messageId, content);
    }
  },

  joinSession: (sessionId) => {
    const { socket } = get();
    socket?.emit('join_session', { sessionId });
  },

  leaveSession: (sessionId) => {
    const { socket } = get();
    socket?.emit('leave_session', { sessionId });
  },

  createSession: async (data) => {
    const res: any = await chatApi.createSession(data);
    const session: ChatSession = res.data;
    set((state) => ({ sessions: [session, ...state.sessions] }));
    return session.id;
  },

  addMessageReaction: (sessionId, messageId, reaction) => {
    set((state) => {
      const msgs = state.messages[sessionId];
      if (!msgs) return state;
      return {
        messages: {
          ...state.messages,
          [sessionId]: msgs.map((m) =>
            m.id === messageId
              ? { ...m, reactions: [...(m.reactions || []), reaction] }
              : m,
          ),
        },
      };
    });
  },

  // Batch selection
  toggleBatchMode: () => {
    set((state) => ({
      batchMode: !state.batchMode,
      selectedMessageIds: new Set<string>(),
    }));
  },

  toggleMessageSelection: (messageId) => {
    set((state) => {
      const newSet = new Set(state.selectedMessageIds);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return { selectedMessageIds: newSet };
    });
  },

  clearSelection: () => {
    set({ selectedMessageIds: new Set<string>(), batchMode: false });
  },
}));
