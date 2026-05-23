import { WsMessageType } from './chat.gateway';

const createMockSocket = (overrides: Record<string, any> = {}) =>
  ({
    id: 'socket-1',
    handshake: {
      auth: {},
      headers: {},
      ...overrides.handshake,
    },
    data: { user: null },
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    disconnect: jest.fn(),
    // client.to() returns an object with emit() for TYPING events
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    ...overrides,
  }) as any;

const createMockServer = () => {
  const mockTo = jest.fn().mockReturnThis();
  const server: any = {
    to: mockTo,
    emit: jest.fn(),
  };
  return { server, mockTo };
};

jest.mock('./chat-gateway.service', () => ({
  ChatGatewayService: jest.fn().mockImplementation(() => ({
    authenticate: jest.fn(),
    setUserOnline: jest.fn(),
    setUserOffline: jest.fn(),
    canJoinSession: jest.fn(),
    getOrCreateAgentSession: jest.fn(),
    sendMessage: jest.fn(),
    recallMessage: jest.fn(),
    getMessageById: jest.fn(),
    markRead: jest.fn(),
    streamAIResponse: jest.fn(),
  })),
}));

import { ChatGateway } from './chat.gateway';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let mockGatewayService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGatewayService = {
      authenticate: jest.fn(),
      setUserOnline: jest.fn(),
      setUserOffline: jest.fn(),
      canJoinSession: jest.fn(),
      getOrCreateAgentSession: jest.fn(),
      sendMessage: jest.fn(),
      recallMessage: jest.fn(),
      getMessageById: jest.fn(),
      markRead: jest.fn(),
      streamAIResponse: jest.fn(),
    };

    gateway = new ChatGateway(mockGatewayService as any);
    const { server } = createMockServer();
    gateway.server = server;

    (gateway as any).userSockets = new Map();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleConnection', () => {
    it('GW-01: should authenticate and set user online with valid token', async () => {
      const mockUser = { id: 'user-1', username: 'testuser', avatarUrl: null, status: 'offline', userType: 'human' };
      mockGatewayService.authenticate.mockResolvedValue(mockUser);
      mockGatewayService.setUserOnline.mockResolvedValue(undefined);

      const socket = createMockSocket({ data: { user: mockUser } });
      await gateway.handleConnection(socket);

      expect(mockGatewayService.authenticate).toHaveBeenCalled();
      expect(mockGatewayService.setUserOnline).toHaveBeenCalledWith('user-1');
      expect(socket.emit).toHaveBeenCalledWith('connected', { userId: 'user-1', sessionId: 'socket-1' });
    });

    it('GW-02: should disconnect unauthorized connection with no token', async () => {
      mockGatewayService.authenticate.mockResolvedValue(null);

      const socket = createMockSocket();
      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Unauthorized' });
      expect(socket.disconnect).toHaveBeenCalledWith();
    });

    it('should read token from Authorization header', async () => {
      const mockUser = { id: 'user-1', username: 'testuser', avatarUrl: null, status: 'offline', userType: 'human' };
      mockGatewayService.authenticate.mockResolvedValue(mockUser);

      const socket = createMockSocket({
        handshake: { auth: {}, headers: { authorization: 'Bearer valid-token' } },
        data: { user: mockUser },
      });
      await gateway.handleConnection(socket);

      expect(mockGatewayService.authenticate).toHaveBeenCalledWith('valid-token');
    });

    it('should store socket in userSockets map', async () => {
      const mockUser = { id: 'user-1', username: 'testuser', avatarUrl: null, status: 'offline', userType: 'human' };
      mockGatewayService.authenticate.mockResolvedValue(mockUser);
      mockGatewayService.setUserOnline.mockResolvedValue(undefined);

      const socket = createMockSocket({ data: { user: mockUser } });
      await gateway.handleConnection(socket);

      const sockets = (gateway as any).userSockets.get('user-1');
      expect(sockets?.size).toBe(1);
    });

    it('should handle multiple connections from same user', async () => {
      const mockUser = { id: 'user-1', username: 'testuser', avatarUrl: null, status: 'offline', userType: 'human' };
      mockGatewayService.authenticate.mockResolvedValue(mockUser);
      mockGatewayService.setUserOnline.mockResolvedValue(undefined);

      const socket1 = createMockSocket({ id: 'socket-1', data: { user: mockUser } });
      const socket2 = createMockSocket({ id: 'socket-2', data: { user: mockUser } });

      await gateway.handleConnection(socket1);
      await gateway.handleConnection(socket2);

      const sockets = (gateway as any).userSockets.get('user-1');
      expect(sockets?.size).toBe(2);
    });
  });

  describe('handleDisconnect', () => {
    it('GW-03: should set user offline when last socket disconnects', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      (gateway as any).userSockets.set('user-1', new Set(['socket-1']));
      mockGatewayService.setUserOffline.mockResolvedValue(undefined);

      const socket = createMockSocket({ id: 'socket-1', data: { user: mockUser } });
      await gateway.handleDisconnect(socket);

      expect(mockGatewayService.setUserOffline).toHaveBeenCalledWith('user-1');
      expect(gateway.server.emit).toHaveBeenCalledWith('presence', { userId: 'user-1', status: 'offline' });
    });

    it('should not set offline when user has other active sockets', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      (gateway as any).userSockets.set('user-1', new Set(['socket-1', 'socket-2']));

      const socket = createMockSocket({ id: 'socket-1', data: { user: mockUser } });
      await gateway.handleDisconnect(socket);

      expect(mockGatewayService.setUserOffline).not.toHaveBeenCalled();
    });

    it('should handle disconnect with no user data', async () => {
      const socket = createMockSocket({ data: { user: null } });
      await gateway.handleDisconnect(socket);

      expect(gateway.server.emit).not.toHaveBeenCalled();
    });
  });

  describe('handlePing', () => {
    it('should emit pong response', () => {
      const socket = createMockSocket();
      gateway.handlePing(socket);

      expect(socket.emit).toHaveBeenCalledWith('pong', { timestamp: expect.any(Number) });
    });
  });

  describe('handleMessage', () => {
    const createUserSocket = () =>
      createMockSocket({
        data: {
          user: { id: 'user-1', username: 'testuser', avatarUrl: null, status: 'online', userType: 'human' },
        },
      });

    it('GW-04: should broadcast TEXT message to session room', async () => {
      const socket = createUserSocket();
      const message: any = {
        id: 'msg-1',
        content: 'Hello world',
        senderId: 'user-1',
        sessionId: 'session-1',
        reactions: [],
        sender: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockGatewayService.sendMessage.mockResolvedValue(message);

      const payload = {
        type: WsMessageType.TEXT,
        data: { sessionId: 'session-1', content: 'Hello world' },
      };

      await gateway.handleMessage(payload, socket);

      expect(mockGatewayService.sendMessage).toHaveBeenCalled();
      expect(gateway.server.to).toHaveBeenCalledWith('session:session-1');
      expect(gateway.server.emit).toHaveBeenCalledWith('message', message);
    });

    it('GW-05: should broadcast TYPING status to room', async () => {
      const socket = createUserSocket();

      const payload = {
        type: WsMessageType.TYPING,
        data: { sessionId: 'session-1', isTyping: true },
      };

      await gateway.handleMessage(payload, socket);

      // TYPING uses client.to() not server.to()
      expect(socket.to).toHaveBeenCalledWith('session:session-1');
      // socket.to() was configured to return { emit: fn }
      const toReturn = (socket.to as jest.Mock).mock.results[0].value;
      expect(toReturn.emit).toHaveBeenCalledWith('typing', {
        userId: 'user-1',
        username: 'testuser',
        isTyping: true,
      });
    });

    it('GW-06: should handle RECALL message', async () => {
      const socket = createUserSocket();
      const recalledMsg: any = {
        id: 'msg-1',
        sessionId: 'session-1',
        isRecalled: true,
        reactions: [],
        sender: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        content: '',
        contentType: 'text',
        metadata: null,
        replyToId: null,
        recalledAt: new Date(),
        recalledById: 'user-1',
        isPinned: false,
      };
      mockGatewayService.recallMessage.mockResolvedValue(recalledMsg);
      mockGatewayService.getMessageById.mockResolvedValue({ id: 'msg-1', sessionId: 'session-1' });

      const payload = {
        type: WsMessageType.RECALL,
        data: { messageId: 'msg-1' },
      };

      await gateway.handleMessage(payload, socket);

      expect(mockGatewayService.recallMessage).toHaveBeenCalledWith('user-1', 'msg-1');
      expect(gateway.server.emit).toHaveBeenCalledWith(
        'message_recalled',
        { messageId: 'msg-1', recalledBy: 'user-1' },
      );
    });

    it('should broadcast mentions to mentioned users', async () => {
      const socket = createUserSocket();
      const message: any = {
        id: 'msg-1',
        content: 'Hello',
        senderId: 'user-1',
        sessionId: 'session-1',
        reactions: [],
        sender: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockGatewayService.sendMessage.mockResolvedValue(message);
      (gateway as any).userSockets.set('user-2', new Set(['socket-2']));

      const payload = {
        type: WsMessageType.TEXT,
        data: { sessionId: 'session-1', content: 'Hello @user-2', mentions: ['user-2'] },
      };

      await gateway.handleMessage(payload, socket);

      expect(gateway.server.emit).toHaveBeenCalledWith(
        'mention',
        expect.objectContaining({ mentionedBy: 'testuser' }),
      );
    });
  });

  describe('handleJoinSession', () => {
    it('GW-07: should join session room when user has access', async () => {
      const socket = createMockSocket({
        data: { user: { id: 'user-1', username: 'testuser', avatarUrl: null, status: 'online', userType: 'human' } },
      });
      mockGatewayService.canJoinSession.mockResolvedValue(true);

      await gateway.handleJoinSession({ sessionId: 'session-1' }, socket);

      expect(socket.join).toHaveBeenCalledWith('session:session-1');
      expect(socket.emit).toHaveBeenCalledWith('joined_session', { sessionId: 'session-1' });
    });

    it('should reject join when user lacks access', async () => {
      const socket = createMockSocket({
        data: { user: { id: 'user-1', username: 'testuser', avatarUrl: null, status: 'online', userType: 'human' } },
      });
      mockGatewayService.canJoinSession.mockResolvedValue(false);

      await gateway.handleJoinSession({ sessionId: 'session-1' }, socket);

      expect(socket.join).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Cannot join this session' });
    });
  });

  describe('handleLeaveSession', () => {
    it('should leave session room', () => {
      const socket = createMockSocket();
      gateway.handleLeaveSession({ sessionId: 'session-1' }, socket);

      expect(socket.leave).toHaveBeenCalledWith('session:session-1');
    });
  });

  describe('emitToUser', () => {
    it('GW-08: should emit event to all user sockets', () => {
      (gateway as any).userSockets.set('user-1', new Set(['socket-1', 'socket-2']));

      gateway.emitToUser('user-1', 'custom_event', { data: 'test' });

      expect(gateway.server.to).toHaveBeenCalledWith('socket-1');
      expect(gateway.server.to).toHaveBeenCalledWith('socket-2');
      expect(gateway.server.emit).toHaveBeenCalled();
    });

    it('should do nothing if user has no sockets', () => {
      gateway.emitToUser('nonexistent-user', 'event', {});

      expect(gateway.server.to).not.toHaveBeenCalled();
    });
  });

  describe('emitToSession', () => {
    it('should emit event to all sockets in session room', () => {
      gateway.emitToSession('session-1', 'session_event', { data: 'broadcast' });

      expect(gateway.server.to).toHaveBeenCalledWith('session:session-1');
      expect(gateway.server.emit).toHaveBeenCalledWith('session_event', { data: 'broadcast' });
    });
  });

  describe('getOnlineCount', () => {
    it('should return number of unique online users', () => {
      (gateway as any).userSockets.set('user-1', new Set(['socket-1']));
      (gateway as any).userSockets.set('user-2', new Set(['socket-2', 'socket-3']));

      expect(gateway.getOnlineCount()).toBe(2);
    });

    it('should return 0 when no users online', () => {
      expect(gateway.getOnlineCount()).toBe(0);
    });
  });
});
