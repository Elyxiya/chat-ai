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

    const mockMetricsService = {
      incrementCounter: jest.fn(),
      setGauge: jest.fn(),
      recordDuration: jest.fn(),
      export: jest.fn().mockReturnValue(''),
    };
    gateway = new ChatGateway(mockGatewayService as any, mockMetricsService as any);
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

  describe('Edge Cases', () => {
    it('WS-14: should emit DM-type message only to session room (not globally)', async () => {
      const socket = createMockSocket({
        data: {
          user: { id: 'user-1', username: 'testuser', avatarUrl: null, status: 'online', userType: 'human' },
        },
      });
      const message: any = {
        id: 'msg-dm',
        content: 'Direct message',
        senderId: 'user-1',
        sessionId: 'dm-session',
        reactions: [],
        sender: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockGatewayService.sendMessage.mockResolvedValue(message);

      const payload = {
        type: WsMessageType.TEXT,
        data: { sessionId: 'dm-session', content: 'Direct message' },
      };

      await gateway.handleMessage(payload, socket);

      // Should broadcast to session room, not globally
      expect(gateway.server.to).toHaveBeenCalledWith('session:dm-session');
      expect(gateway.server.emit).toHaveBeenCalledWith('message', message);
    });

    it('WS-08: should not broadcast message to clients outside the session room', async () => {
      const socket = createMockSocket({
        data: {
          user: { id: 'user-1', username: 'testuser', avatarUrl: null, status: 'online', userType: 'human' },
        },
      });
      const message: any = {
        id: 'msg-private',
        content: 'Private',
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
        data: { sessionId: 'session-1', content: 'Private' },
      };

      await gateway.handleMessage(payload, socket);

      // server.to('session:session-1') was called, not a different room
      expect(gateway.server.to).toHaveBeenCalledWith('session:session-1');
      expect(gateway.server.to).not.toHaveBeenCalledWith('session:other-session');
    });

    it('WS-11: should handle READ receipt broadcast to session room', async () => {
      const socket = createMockSocket({
        data: {
          user: { id: 'user-1', username: 'testuser', avatarUrl: null, status: 'online', userType: 'human' },
        },
      });
      mockGatewayService.markRead.mockResolvedValue(undefined);

      const payload = {
        type: WsMessageType.READ,
        data: { sessionId: 'session-1', lastMessageId: 'msg-5' },
      };

      await gateway.handleMessage(payload, socket);

      expect(mockGatewayService.markRead).toHaveBeenCalledWith('user-1', 'session-1', 'msg-5');
      // Read receipt is sent to others in room (client.to), not back to sender
      expect(socket.to).toHaveBeenCalledWith('session:session-1');
    });

    it('EDGE-GW-01: should handle emitToUser when user has no sockets', () => {
      gateway.emitToUser('nonexistent-user', 'event', { data: 'test' });

      expect(gateway.server.to).not.toHaveBeenCalled();
    });

    it('EDGE-GW-02: should only call setUserOffline once when last socket disconnects', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      (gateway as any).userSockets.set('user-1', new Set(['socket-1', 'socket-2']));
      mockGatewayService.setUserOffline.mockResolvedValue(undefined);

      const socket1 = createMockSocket({ id: 'socket-1', data: { user: mockUser } });
      const socket2 = createMockSocket({ id: 'socket-2', data: { user: mockUser } });

      await gateway.handleDisconnect(socket1);
      // After socket1 disconnects, user-1 still has socket-2 → not offline yet
      expect(mockGatewayService.setUserOffline).not.toHaveBeenCalled();

      await gateway.handleDisconnect(socket2);
      // After socket2 disconnects, user-1 has no more sockets → offline
      expect(mockGatewayService.setUserOffline).toHaveBeenCalledTimes(1);
    });

    it('EDGE-GW-03: should handle mention event without existing user socket', async () => {
      const socket = createMockSocket({
        data: {
          user: { id: 'user-1', username: 'testuser', avatarUrl: null, status: 'online', userType: 'human' },
        },
      });
      const message: any = {
        id: 'msg-1',
        content: 'Hello @nonexistent',
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
        data: { sessionId: 'session-1', content: 'Hello @nonexistent', mentions: ['nonexistent'] },
      };

      await gateway.handleMessage(payload, socket);

      expect(gateway.server.emit).toHaveBeenCalledWith('message', message);
    });

    it('EDGE-GW-04: should handle handleJoinSession without sessionId', async () => {
      const socket = createMockSocket({
        data: { user: { id: 'user-1', username: 'testuser', avatarUrl: null, status: 'online', userType: 'human' } },
      });

      await gateway.handleJoinSession({ sessionId: '' }, socket);

      expect(socket.join).not.toHaveBeenCalled();
    });
  });

  describe('WebRTC Call Signaling', () => {
    const createCallerSocket = () => createMockSocket({
      id: 'caller-socket',
      data: { user: { id: 'caller-1', username: 'caller', avatarUrl: null, status: 'online', userType: 'human' } },
    });

    const createCalleeSocket = () => createMockSocket({
      id: 'callee-socket',
      data: { user: { id: 'callee-1', username: 'callee', avatarUrl: null, status: 'online', userType: 'human' } },
    });

    const setupConnectedUsers = () => {
      (gateway as any).userSockets.set('callee-1', new Set(['callee-socket']));
      (gateway as any).userSockets.set('caller-1', new Set(['caller-socket']));
    };

    it('CALL-01: should emit call:incoming to target user sockets on call:offer', async () => {
      setupConnectedUsers();
      const socket = createCallerSocket();

      await gateway.handleCallOffer(
        { targetUserId: 'callee-1', sdp: { type: 'offer', sdp: 'test-sdp' }, callType: 'video' },
        socket,
      );

      expect(gateway.server.to).toHaveBeenCalledWith('callee-socket');
      expect(gateway.server.emit).toHaveBeenCalledWith('call:incoming', expect.objectContaining({
        callerId: 'caller-1',
        callerName: 'caller',
        callType: 'video',
      }));
    });

    it('CALL-02: should emit call:ended when target user is offline', async () => {
      const socket = createCallerSocket();
      // Don't set up callee sockets → offline

      const clientEmit = jest.fn();
      socket.emit = clientEmit;

      await gateway.handleCallOffer(
        { targetUserId: 'callee-1', sdp: {}, callType: 'audio' },
        socket,
      );

      expect(clientEmit).toHaveBeenCalledWith('call:ended', {
        userId: 'callee-1',
        reason: 'offline',
      });
    });

    it('CALL-03: should emit call:accepted to caller on call:answer', async () => {
      setupConnectedUsers();
      const socket = createCalleeSocket();

      await gateway.handleCallAnswer(
        { targetUserId: 'caller-1', sdp: { type: 'answer', sdp: 'answer-sdp' } },
        socket,
      );

      expect(gateway.server.to).toHaveBeenCalledWith('caller-socket');
      expect(gateway.server.emit).toHaveBeenCalledWith('call:accepted', expect.objectContaining({
        calleeId: 'callee-1',
      }));
    });

    it('CALL-04: should do nothing on call:answer when caller is offline', async () => {
      const socket = createCalleeSocket();

      await gateway.handleCallAnswer(
        { targetUserId: 'caller-1', sdp: {} },
        socket,
      );

      // No call:accepted emitted since caller has no sockets
      expect(gateway.server.to).not.toHaveBeenCalledWith('caller-socket');
    });

    it('CALL-05: should forward ICE candidate to target', async () => {
      setupConnectedUsers();
      const socket = createCallerSocket();

      await gateway.handleIceCandidate(
        { targetUserId: 'callee-1', candidate: { candidate: 'test-ice', sdpMid: '0' } },
        socket,
      );

      expect(gateway.server.to).toHaveBeenCalledWith('callee-socket');
      expect(gateway.server.emit).toHaveBeenCalledWith('call:ice-candidate', {
        userId: 'caller-1',
        candidate: { candidate: 'test-ice', sdpMid: '0' },
      });
    });

    it('CALL-06: should do nothing on ICE candidate when target offline', async () => {
      const socket = createCallerSocket();

      await gateway.handleIceCandidate(
        { targetUserId: 'callee-1', candidate: {} },
        socket,
      );

      expect(gateway.server.to).not.toHaveBeenCalled();
    });

    it('CALL-07: should emit call:ended with reject reason on call:reject', async () => {
      setupConnectedUsers();
      const socket = createCalleeSocket();

      await gateway.handleCallReject({ targetUserId: 'caller-1' }, socket);

      expect(gateway.server.to).toHaveBeenCalledWith('caller-socket');
      expect(gateway.server.emit).toHaveBeenCalledWith('call:ended', {
        userId: 'callee-1',
        reason: 'reject',
      });
    });

    it('CALL-08: should emit call:ended with hangup reason on call:end', async () => {
      setupConnectedUsers();
      const socket = createCallerSocket();

      await gateway.handleCallEnd({ targetUserId: 'callee-1' }, socket);

      expect(gateway.server.to).toHaveBeenCalledWith('callee-socket');
      expect(gateway.server.emit).toHaveBeenCalledWith('call:ended', {
        userId: 'caller-1',
        reason: 'hangup',
      });
    });

    it('CALL-09: should forward toggle event to target', async () => {
      setupConnectedUsers();
      const socket = createCallerSocket();

      await gateway.handleCallToggle(
        { targetUserId: 'callee-1', type: 'audio', enabled: false },
        socket,
      );

      expect(gateway.server.to).toHaveBeenCalledWith('callee-socket');
      expect(gateway.server.emit).toHaveBeenCalledWith('call:toggle', {
        userId: 'caller-1',
        type: 'audio',
        enabled: false,
      });
    });

    it('CALL-10: should do nothing on call:toggle when target offline', async () => {
      const socket = createCallerSocket();

      await gateway.handleCallToggle(
        { targetUserId: 'callee-1', type: 'video', enabled: true },
        socket,
      );

      expect(gateway.server.to).not.toHaveBeenCalled();
    });

    it('CALL-11: should handle call:offer to multiple target sockets', async () => {
      // Simulate target connected from 2 devices
      (gateway as any).userSockets.set('callee-1', new Set(['callee-socket', 'callee-socket-2']));
      const socket = createCallerSocket();

      await gateway.handleCallOffer(
        { targetUserId: 'callee-1', sdp: {}, callType: 'audio' },
        socket,
      );

      expect(gateway.server.to).toHaveBeenCalledWith('callee-socket');
      expect(gateway.server.to).toHaveBeenCalledWith('callee-socket-2');
    });

    it('CALL-12: should handle concurrent call:offer and call:end', async () => {
      setupConnectedUsers();
      const socket = createCallerSocket();

      // Simulate offer and immediate end
      await Promise.all([
        gateway.handleCallOffer({ targetUserId: 'callee-1', sdp: {}, callType: 'video' }, socket),
        gateway.handleCallEnd({ targetUserId: 'callee-1' }, socket),
      ]);

      // Both operations should complete without error
      expect(gateway.server.emit).toHaveBeenCalled();
    });

    it('CALL-13: should handle self-targeting call:offer gracefully', async () => {
      const socket = createCallerSocket();
      (gateway as any).userSockets.set('caller-1', new Set(['caller-socket']));

      await gateway.handleCallOffer(
        { targetUserId: 'caller-1', sdp: {}, callType: 'audio' },
        socket,
      );

      expect(gateway.server.to).toHaveBeenCalledWith('caller-socket');
    });
  });
});
