import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ChatGatewayService } from './chat-gateway.service';
import { PrismaService } from '../config/prisma.service';
import { RedisService } from '../modules/common/redis.service';

describe('ChatGatewayService', () => {
  let service: ChatGatewayService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockJwtService: any;

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      chatSession: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      chatSessionMember: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      message: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    mockRedis = {
      set: jest.fn(),
      del: jest.fn(),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(true),
    };

    mockJwtService = {
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGatewayService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<ChatGatewayService>(ChatGatewayService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should return null when no token provided', async () => {
      const result = await service.authenticate('');
      expect(result).toBeNull();
    });

    it('should return null when token is undefined', async () => {
      const result = await service.authenticate(undefined as any);
      expect(result).toBeNull();
    });

    it('should return user when token is valid', async () => {
      const mockUser = { id: 'user-1', username: 'testuser', avatarUrl: null, status: 'offline', userType: 'human' };
      mockJwtService.verify.mockReturnValue({ sub: 'user-1' });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.authenticate('valid-token');

      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { id: true, username: true, avatarUrl: true, status: true, userType: true },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when token verification fails', async () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error('Invalid token'); });

      const result = await service.authenticate('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null when user not found', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'nonexistent' });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.authenticate('valid-token');

      expect(result).toBeNull();
    });
  });

  describe('setUserOnline', () => {
    it('should update user status to online and set redis key', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1', status: 'online' });
      mockRedis.set.mockResolvedValue('OK');

      await service.setUserOnline('user-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'online', lastSeenAt: expect.any(Date) },
      });
      expect(mockRedis.set).toHaveBeenCalledWith(
        'online:user-1',
        expect.any(String),
        24 * 60 * 60 * 1000,
      );
    });

    it('should still proceed when redis is unavailable', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1', status: 'online' });
      mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));

      await expect(service.setUserOnline('user-1')).resolves.not.toThrow();
    });
  });

  describe('setUserOffline', () => {
    it('should update user status to offline and delete redis key', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1', status: 'offline' });
      mockRedis.del.mockResolvedValue(1);

      await service.setUserOffline('user-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'offline' },
      });
      expect(mockRedis.del).toHaveBeenCalledWith('online:user-1');
    });

    it('should still proceed when redis is unavailable', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1', status: 'offline' });
      mockRedis.del.mockRejectedValue(new Error('Redis connection failed'));

      await expect(service.setUserOffline('user-1')).resolves.not.toThrow();
    });
  });

  describe('canJoinSession', () => {
    it('should return true when user is a member', async () => {
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue({ userId: 'user-1', sessionId: 'session-1' });

      const result = await service.canJoinSession('user-1', 'session-1');

      expect(result).toBe(true);
      expect(mockPrisma.chatSessionMember.findUnique).toHaveBeenCalledWith({
        where: { sessionId_userId: { sessionId: 'session-1', userId: 'user-1' } },
      });
    });

    it('should return false when user is not a member', async () => {
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(null);

      const result = await service.canJoinSession('user-1', 'session-1');

      expect(result).toBe(false);
    });
  });

  describe('getOrCreateAgentSession', () => {
    it('should return existing agent session', async () => {
      const existingSession = { id: 'agent-1', sessionType: 'agent', ownerId: 'user-1' };
      mockPrisma.chatSession.findFirst.mockResolvedValue(existingSession);

      const result = await service.getOrCreateAgentSession('user-1');

      expect(result).toBe('agent-1');
      expect(mockPrisma.chatSession.create).not.toHaveBeenCalled();
    });

    it('should create new agent session when none exists', async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue(null);
      const newSession = { id: 'new-agent-1' };
      mockPrisma.chatSession.create.mockResolvedValue(newSession);

      const result = await service.getOrCreateAgentSession('user-1');

      expect(result).toBe('new-agent-1');
      expect(mockPrisma.chatSession.create).toHaveBeenCalledWith({
        data: {
          sessionType: 'agent',
          name: 'AI Assistant',
          owner: { connect: { id: 'user-1' } },
          members: {
            create: { userId: 'user-1', role: 'owner' },
          },
        },
      });
    });
  });

  describe('sendMessage', () => {
    it('should create a message in the database', async () => {
      const createdMessage = {
        id: 'msg-1',
        sessionId: 'session-1',
        content: 'Hello',
        contentType: 'text',
        metadata: { seq: 1 },
        sender: { id: 'user-1', username: 'testuser', avatarUrl: null, nickname: null },
        reactions: [],
      };
      mockPrisma.message.create.mockResolvedValue(createdMessage);

      const result = await service.sendMessage('user-1', 'session-1', { content: 'Hello' });

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-1',
          senderId: 'user-1',
          content: 'Hello',
          contentType: 'text',
          metadata: { seq: 1 },
        },
        include: {
          sender: { select: { id: true, username: true, avatarUrl: true, nickname: true } },
          reactions: true,
        },
      });
      expect(result).toEqual(createdMessage);
    });

    it('should use defaults when dto fields are missing', async () => {
      mockPrisma.message.create.mockResolvedValue({ id: 'msg-1', metadata: { seq: 1 } });

      await service.sendMessage('user-1', 'session-1', {});

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-1',
          senderId: 'user-1',
          content: '',
          contentType: 'text',
          metadata: { seq: 1 },
        },
        include: expect.any(Object),
      });
    });
  });

  describe('recallMessage', () => {
    it('should mark message as recalled', async () => {
      const recalledMessage = { id: 'msg-1', isRecalled: true };
      mockPrisma.message.update.mockResolvedValue(recalledMessage);

      const result = await service.recallMessage('user-1', 'msg-1');

      expect(mockPrisma.message.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { isRecalled: true, recalledAt: expect.any(Date), recalledById: 'user-1' },
      });
      expect(result).toEqual(recalledMessage);
    });
  });

  describe('getMessageById', () => {
    it('should return message with id and sessionId', async () => {
      const message = { id: 'msg-1', sessionId: 'session-1' };
      mockPrisma.message.findUnique.mockResolvedValue(message);

      const result = await service.getMessageById('msg-1');

      expect(mockPrisma.message.findUnique).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        select: { id: true, sessionId: true },
      });
      expect(result).toEqual(message);
    });

    it('should return null when message not found', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      const result = await service.getMessageById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('markRead', () => {
    it('should update lastReadAt for session member', async () => {
      mockPrisma.chatSessionMember.update.mockResolvedValue({ userId: 'user-1', sessionId: 'session-1' });

      await service.markRead('user-1', 'session-1', 'msg-5');

      expect(mockPrisma.chatSessionMember.update).toHaveBeenCalledWith({
        where: { sessionId_userId: { sessionId: 'session-1', userId: 'user-1' } },
        data: { lastReadAt: expect.any(Date) },
      });
    });
  });

  describe('streamAIResponse', () => {
    it('should yield response chunks from DeepSeek provider', async () => {
      // Mock the dynamic import to return a fake provider
      jest.isolateModules(async () => {
        const mockProvider = {
          chatStream: jest.fn().mockImplementation(async function* () {
            yield 'Hello';
            yield ' world';
          }),
        };

        jest.mock('../modules/llm/providers/deepseek.provider', () => ({
          DeepSeekProvider: jest.fn().mockImplementation(() => mockProvider),
        }));

        const { ChatGatewayService: Svc } = await import('./chat-gateway.service');
        const tempService = new Svc(mockPrisma, mockRedis, mockJwtService);
        const chunks: string[] = [];
        for await (const chunk of tempService.streamAIResponse('user-1', 'Hi')) {
          chunks.push(chunk);
        }
        expect(chunks).toEqual(['Hello', ' world']);
      });
    });
  });
});
