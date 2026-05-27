import { create } from 'zustand';
import { ChatSession, ChatMessage, WsMessageType } from '@/types';
import { chatApi } from '@/api/client';
import { io, Socket } from 'socket.io-client';
import { useNotificationStore } from './notification.store';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: Record<string, ChatMessage[]>;
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
  addMessageReaction: (sessionId: string, messageId: string, reaction: { id: string; emoji: string; userId: string; messageId: string; createdAt: string }) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: {},
  onlineUsers: new Set(),
  typingUsers: {},
  isLoading: false,
  socket: null,

  connect: (token) => {
    const socket = io(`${WS_URL}/chat`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
    });

    socket.on('message', (msg: ChatMessage) => {
      const { messages, activeSessionId } = get();
      const sessionMsgs = messages[msg.sessionId] || [];
      set({
        messages: {
          ...messages,
          [msg.sessionId]: [...sessionMsgs, msg],
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

    socket.on('notification', (notification: any) => {
      useNotificationStore.getState().addNotification(notification);
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
      set({ sessions: res.data || [], isLoading: false });
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
      const res: any = await chatApi.getMessages(sessionId, params);
      const msgs = (res.data || []).reverse();
      set((state) => ({
        messages: { ...state.messages, [sessionId]: msgs },
      }));
    } catch {
      // ignore
    }
  },

  sendMessage: (sessionId, content, contentType = 'text') => {
    const { socket } = get();
    if (!socket) return;
    socket.emit('message', {
      type: WsMessageType.TEXT,
      data: { sessionId, content, contentType },
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
}));
