import { create } from 'zustand';
import { ChatSession, ChatMessage, WsMessageType } from '@/types';
import { chatApi } from '@/api/client';
import { io, Socket } from 'socket.io-client';
import { useNotificationStore } from './notification.store';
import { useFriendStore } from './friend.store';
import { useAuthStore } from './auth.store';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
const MAX_VISIBLE_MESSAGES = 500;
const ACK_TIMEOUT = 5000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

interface PendingEntry {
  clientMsgId: string;
  wsType: number;
  data: Record<string, any>;
  retryCount: number;
  timer: ReturnType<typeof setTimeout> | null;
}

/** 等待 ACK 的消息队列（模块级别，供 connect/sendMessage 共享） */
const _pendingAcks = new Map<string, PendingEntry>();

function scheduleRetry(entry: PendingEntry) {
  if (entry.retryCount >= MAX_RETRIES) {
    _pendingAcks.delete(entry.clientMsgId);
    useChatStore.setState((state) => {
      const newMessages = { ...state.messages };
      for (const sid of Object.keys(newMessages)) {
        newMessages[sid] = newMessages[sid].map((m: any) =>
          (m as any).clientMsgId === entry.clientMsgId
            ? { ...m, status: 'failed' as const }
            : m,
        );
      }
      return { messages: newMessages };
    });
    return;
  }
  const socket = useChatStore.getState().socket;
  if (!socket?.connected) return;
  socket.emit('message', {
    type: entry.wsType,
    data: { ...entry.data, clientMsgId: entry.clientMsgId, isRetry: true },
    timestamp: Date.now(),
  });
  entry.retryCount++;
  entry.timer = setTimeout(
    () => scheduleRetry(entry),
    RETRY_DELAYS[Math.min(entry.retryCount, RETRY_DELAYS.length - 1)],
  );
}

/** Binary search to find the index to insert a message by seq order. */
function findInsertIndex(messages: ChatMessage[], seq: number): number {
  let lo = 0;
  let hi = messages.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const midSeq = (messages[mid] as any)?.metadata?.seq;
    if (midSeq == null) { lo = mid + 1; continue; }
    if (midSeq < seq) { lo = mid + 1; } else { hi = mid; }
  }
  return lo;
}

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
  /** 追加加载更早的消息（prepend），返回新增条数用于滚动补偿 */
  loadMoreMessages: (sessionId: string, before: string) => Promise<number>;
  sendMessage: (sessionId: string, content: string, contentType?: string, mentions?: string[]) => void;
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
      // Retry any messages that were in-flight when we disconnected
      for (const [, entry] of _pendingAcks) {
        if (entry.retryCount < MAX_RETRIES) {
          socket.emit('message', {
            type: entry.wsType,
            data: { ...entry.data, clientMsgId: entry.clientMsgId, isRetry: true },
            timestamp: Date.now(),
          });
          entry.retryCount++;
          entry.timer = setTimeout(() => scheduleRetry(entry), RETRY_DELAYS[Math.min(entry.retryCount, RETRY_DELAYS.length - 1)]);
        }
      }
    });

    socket.on('initial_online_users', ({ userIds }: { userIds: string[] }) => {
      set({ onlineUsers: new Set(userIds) });
    });

    socket.on('message_ack', ({ clientMsgId, serverMsgId, seq }: { clientMsgId: string; serverMsgId: string; seq?: number }) => {
      const entry = _pendingAcks.get(clientMsgId);
      if (!entry) return;
      if (entry.timer) clearTimeout(entry.timer);
      _pendingAcks.delete(clientMsgId);

      // Replace temp ID with server ID, set seq and mark as sent
      set((state) => {
        const newMessages = { ...state.messages };
        for (const sid of Object.keys(newMessages)) {
          newMessages[sid] = newMessages[sid].map((m) =>
            (m as any).clientMsgId === clientMsgId
              ? { ...m, id: serverMsgId, status: 'sent' as const, metadata: { ...m.metadata, seq } }
              : m,
          );
        }
        return { messages: newMessages };
      });
    });

    // ── Batched message processing ─────────────────────────────────
    const _msgBuffer: ChatMessage[] = [];
    let _flushHandle: number | null = null;

    const flushMessages = () => {
      _flushHandle = null;
      if (_msgBuffer.length === 0) return;

      const batch = _msgBuffer.splice(0);
      // Sort by createdAt so in-flight reordering doesn't scramble display order
      batch.sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      const state = get();
      const newMessages = { ...state.messages };
      const msgCountPerSession = new Map<string, number>();

      for (const msg of batch) {
        const sessionMsgs = newMessages[msg.sessionId] || [];
        const msgClientId = (msg as any).metadata?.clientMsgId as string | undefined;
        const filtered = sessionMsgs.filter(
          (m) =>
            !(m.id.startsWith('temp-') && m.senderId === msg.senderId) &&
            !(msgClientId && (m as any).clientMsgId === msgClientId),
        );

        // Insert in seq order (fallback to createdAt for messages without seq)
        const msgSeq = (msg as any).metadata?.seq;
        const insertIdx = msgSeq
          ? findInsertIndex(filtered, msgSeq)
          : filtered.length;
        const withMsg = [
          ...filtered.slice(0, insertIdx),
          msg,
          ...filtered.slice(insertIdx),
        ];

        newMessages[msg.sessionId] = withMsg.length > MAX_VISIBLE_MESSAGES
          ? withMsg.slice(withMsg.length - MAX_VISIBLE_MESSAGES)
          : withMsg;
        msgCountPerSession.set(
          msg.sessionId,
          (msgCountPerSession.get(msg.sessionId) || 0) + 1,
        );
      }

      set({
        messages: newMessages,
        sessions: state.sessions.map((s) => {
          const count = msgCountPerSession.get(s.id);
          return count && s.id !== state.activeSessionId
            ? { ...s, unreadCount: s.unreadCount + count }
            : s;
        }),
      });
    };

    const scheduleFlush = () => {
      if (_flushHandle === null) {
        _flushHandle = requestAnimationFrame(flushMessages);
      }
    };

    socket.on('message', (msg: ChatMessage) => {
      _msgBuffer.push(msg);
      scheduleFlush();
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

    socket.on('mention', ({ message, mentionedBy }: { message: ChatMessage; mentionedBy: string }) => {
      useNotificationStore.getState().addNotification({
        id: `mention-${message.id}`,
        type: 'mention',
        title: `@mentioned by ${mentionedBy}`,
        content: message.content.slice(0, 100),
        data: { messageId: message.id, sessionId: message.sessionId },
        createdAt: new Date().toISOString(),
        isRead: false,
      });
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

  loadMoreMessages: async (sessionId, before) => {
    try {
      const res: any = await chatApi.getMessages(sessionId, { before, limit: 50 });
      const older = (res.data || []).reverse();
      if (older.length === 0) return 0;

      let addedCount = 0;
      set((state) => {
        const existing = state.messages[sessionId] || [];
        // 只追加比现有第一条更早的消息，避免重复
        const firstExistingSeq = (existing[0] as any)?.metadata?.seq;
        const deduped = firstExistingSeq
          ? older.filter((m: any) => (m.metadata?.seq || 0) < firstExistingSeq)
          : older;
        addedCount = deduped.length;
        if (addedCount === 0) return state;
        return {
          messages: {
            ...state.messages,
            [sessionId]: [...deduped, ...existing],
          },
        };
      });
      return addedCount;
    } catch {
      return 0;
    }
  },

  sendMessage: (sessionId, content, contentType = 'text', mentions) => {
    const { socket, messages } = get();
    if (!socket) return;

    // Optimistic update — show message immediately in the UI
    const clientMsgId = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const user = useAuthStore.getState().user;
    const optimisticMsg = {
      id: `temp-${clientMsgId}`,
      sessionId,
      senderId: user?.id || null,
      content,
      contentType: contentType as any,
      metadata: { mentions },
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
      status: 'sending' as const,
      clientMsgId,
    } as unknown as ChatMessage;

    set({
      messages: {
        ...messages,
        [sessionId]: [...(messages[sessionId] || []), optimisticMsg],
      },
    });

    const payload: Record<string, any> = { sessionId, content, contentType, clientMsgId };
    if (mentions?.length) payload.mentions = mentions;

    // Track for ACK + retry
    const entry: PendingEntry = {
      clientMsgId,
      wsType: WsMessageType.TEXT,
      data: payload,
      retryCount: 0,
      timer: setTimeout(() => scheduleRetry(entry), ACK_TIMEOUT),
    };
    _pendingAcks.set(clientMsgId, entry);

    // Emit to server with clientMsgId for idempotent dedup
    socket.emit('message', {
      type: WsMessageType.TEXT,
      data: payload,
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
    const { messages, sessions } = get();
    const msgs = messages[sessionId];
    if (!msgs?.length) return;
    // Immediately clear local unread count so the badge disappears without waiting for the API
    set({
      sessions: sessions.map((s) =>
        s.id === sessionId ? { ...s, unreadCount: 0 } : s,
      ),
    });
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
