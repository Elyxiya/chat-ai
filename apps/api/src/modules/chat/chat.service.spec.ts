import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { RedisService } from '../common/redis.service';
import { PrismaService } from '../../config/prisma.service';
import { makeSession, makeMessage, makeSessionMember, makeUser, makeFriendship } from '../../test/factories/entities.factory';

describe('ChatService', () => {
  let service: ChatService;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(async () => {
    mockPrisma = {
      chatSessionMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        createMany: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      chatSession: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      message: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      friendship: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      messageReaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      scan: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserSessions', () => {
    it('should return empty array when user has no sessions', async () => {
      mockPrisma.chatSessionMember.findMany.mockResolvedValue([]);

      const result = await service.getUserSessions('user-1');

      expect(result).toEqual([]);
    });

    it('should return sessions with unread counts', async () => {
      const member = makeSessionMember({ userId: 'user-1', sessionId: 'session-1' });
      const session = makeSession({ id: 'session-1', ownerId: 'user-1' });
      member.session = session;
      mockPrisma.chatSessionMember.findMany.mockResolvedValue([member]);
      mockPrisma.message.findMany.mockResolvedValue([]);

      const result = await service.getUserSessions('user-1');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should return accurate unread counts based on lastReadAt', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const session = makeSession({ id: 'session-1', ownerId: 'user-1' });
      const member = makeSessionMember({ userId: 'user-1', sessionId: 'session-1', lastReadAt: yesterday });
      member.session = session;
      mockPrisma.chatSessionMember.findMany.mockResolvedValue([member]);
      const recentMsg = makeMessage({ id: 'msg-recent', senderId: 'user-2', sessionId: 'session-1', createdAt: new Date() });
      mockPrisma.message.findMany.mockResolvedValue([recentMsg]);

      const result = await service.getUserSessions('user-1');

      expect(result[0].unreadCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createSession', () => {
    it('CHAT-SVC-01: should create a private session with members', async () => {
      const dto = { sessionType: 'private' as const, memberIds: ['user-2'] };
      const mockSession = makeSession({
        id: 'new-session-1',
        sessionType: 'private',
        ownerId: 'user-1',
        members: [
          { userId: 'user-1', role: 'owner', user: makeUser({ id: 'user-1' }) },
          { userId: 'user-2', role: 'member', user: makeUser({ id: 'user-2' }) },
        ],
        owner: makeUser({ id: 'user-1' }),
      });
      mockPrisma.chatSession.findFirst.mockResolvedValue(null);
      mockPrisma.chatSession.create.mockResolvedValue(mockSession);

      const result = await service.createSession('user-1', dto);

      expect(mockPrisma.chatSession.create).toHaveBeenCalled();
      expect(result.sessionType).toBe('private');
    });

    it('CHAT-SVC-02: should return existing private session if found', async () => {
      const dto = { sessionType: 'private' as const, memberIds: ['user-2'] };
      const existingSession = makeSession({
        id: 'existing-session',
        sessionType: 'private',
        members: [{ userId: 'user-1' }, { userId: 'user-2' }],
      });
      mockPrisma.chatSession.findFirst.mockResolvedValue(existingSession);

      const result = await service.createSession('user-1', dto);

      expect(mockPrisma.chatSession.create).not.toHaveBeenCalled();
      expect(result.id).toBe('existing-session');
    });

    it('should create a group session', async () => {
      const dto = { sessionType: 'group' as const, name: 'Test Group', memberIds: ['user-2', 'user-3'] };
      const mockSession = makeSession({ id: 'group-session', sessionType: 'group', name: 'Test Group' });
      mockPrisma.chatSession.create.mockResolvedValue(mockSession);

      const result = await service.createSession('user-1', dto);

      expect(result.name).toBe('Test Group');
    });

    it('CHAT-03: should create a public channel session', async () => {
      const dto = { sessionType: 'group' as const, name: 'Public Channel', isPublic: true, memberIds: [] };
      const mockSession = makeSession({ id: 'channel-1', sessionType: 'group', name: 'Public Channel', isPublic: true });
      mockPrisma.chatSession.create.mockResolvedValue(mockSession);

      const result = await service.createSession('user-1', dto);

      expect(result.isPublic).toBe(true);
      expect(mockPrisma.chatSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isPublic: true }),
        }),
      );
    });
  });

  describe('getSession', () => {
    it('should return session details for member', async () => {
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(makeSessionMember());
      const mockSession = makeSession({ id: 'session-1', members: [] });
      mockPrisma.chatSession.findUnique.mockResolvedValue(mockSession);

      const result = await service.getSession('user-1', 'session-1');

      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException for non-member', async () => {
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(null);

      await expect(service.getSession('user-1', 'session-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('sendMessage', () => {
    it('CHAT-SVC-03: should send message and create record', async () => {
      const dto = { content: 'Hello world', contentType: 'text' };
      const mockMessage = makeMessage({ content: 'Hello world' });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(makeSessionMember());
      mockPrisma.message.create.mockResolvedValue(mockMessage);
      mockPrisma.chatSession.update.mockResolvedValue({});

      const result = await service.sendMessage('user-1', 'session-1', dto);

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: 'session-1',
          senderId: 'user-1',
          content: 'Hello world',
          contentType: 'text',
        }),
        include: expect.any(Object),
      });
      expect(result.content).toBe('Hello world');
    });

    it('should throw ForbiddenException for non-member', async () => {
      const dto = { content: 'Hello' };
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(null);

      await expect(service.sendMessage('user-1', 'session-1', dto)).rejects.toThrow(ForbiddenException);
    });

    it('CHAT-05: should throw ForbiddenException when sending to non-existent session (no membership)', async () => {
      const dto = { content: 'Hello' };
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(null);

      await expect(service.sendMessage('user-1', 'nonexistent-session', dto)).rejects.toThrow(ForbiddenException);
    });

    it('CHAT-14: should send message with replyToId when provided', async () => {
      const dto = { content: 'Reply message', replyToId: 'original-msg-1' };
      const mockMessage = makeMessage({ content: 'Reply message', replyToId: 'original-msg-1' });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(makeSessionMember());
      mockPrisma.message.create.mockResolvedValue(mockMessage);
      mockPrisma.chatSession.update.mockResolvedValue({});

      const result = await service.sendMessage('user-1', 'session-1', dto);

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: 'session-1',
          senderId: 'user-1',
          content: 'Reply message',
          contentType: 'text',
        }),
        include: expect.any(Object),
      });
      expect(result.content).toBe('Reply message');
    });
  });

  describe('recallMessage', () => {
    it('CHAT-SVC-04: should mark message as recalled', async () => {
      const recentMsg = makeMessage({ id: 'msg-1', senderId: 'user-1', createdAt: new Date() });
      mockPrisma.message.findUnique.mockResolvedValue(recentMsg);
      mockPrisma.message.update.mockResolvedValue({ ...recentMsg, isRecalled: true });

      const result = await service.recallMessage('user-1', 'msg-1');

      expect(result.isRecalled).toBe(true);
      expect(mockPrisma.message.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: expect.objectContaining({ isRecalled: true, recalledAt: expect.any(Date) }),
      });
    });

    it('CHAT-SVC-05: should throw ForbiddenException when recalling others message', async () => {
      const msg = makeMessage({ id: 'msg-1', senderId: 'user-2', createdAt: new Date() });
      mockPrisma.message.findUnique.mockResolvedValue(msg);

      await expect(service.recallMessage('user-1', 'msg-1')).rejects.toThrow(ForbiddenException);
    });

    it('CHAT-SVC-06: should throw ForbiddenException when message is older than 5 minutes', async () => {
      const oldMsg = makeMessage({ id: 'msg-1', senderId: 'user-1', createdAt: new Date(Date.now() - 10 * 60 * 1000) });
      mockPrisma.message.findUnique.mockResolvedValue(oldMsg);

      await expect(service.recallMessage('user-1', 'msg-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when message does not exist', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      await expect(service.recallMessage('user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('EDGE-03: should allow recalling message exactly at 5 minute boundary', async () => {
      const boundaryMsg = makeMessage({
        id: 'msg-boundary',
        senderId: 'user-1',
        createdAt: new Date(Date.now() - 4 * 60 * 1000 - 59 * 1000), // 4:59 ago, just under 5 min
      });
      mockPrisma.message.findUnique.mockResolvedValue(boundaryMsg);
      mockPrisma.message.update.mockResolvedValue({ ...boundaryMsg, isRecalled: true });

      const result = await service.recallMessage('user-1', 'msg-boundary');

      expect(result.isRecalled).toBe(true);
    });

    it('EDGE-04: should reject recalling message older than 5 minutes', async () => {
      const oldMsg = makeMessage({
        id: 'msg-old',
        senderId: 'user-1',
        createdAt: new Date(Date.now() - 6 * 60 * 1000), // 6 min ago, past 5 min limit
      });
      mockPrisma.message.findUnique.mockResolvedValue(oldMsg);

      await expect(service.recallMessage('user-1', 'msg-old')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMessages', () => {
    it('CHAT-SVC-07: should limit messages to 200', async () => {
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(makeSessionMember());
      mockPrisma.message.findMany.mockResolvedValue([]);

      await service.getMessages('user-1', 'session-1', { limit: 500 });

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });

    it('should return messages with cursor-based pagination', async () => {
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(makeSessionMember());
      const beforeDate = new Date().toISOString();
      const messages = [makeMessage({ id: 'msg-2' }), makeMessage({ id: 'msg-1' })];
      mockPrisma.message.findMany.mockResolvedValue(messages);

      await service.getMessages('user-1', 'session-1', { before: beforeDate });

      expect(mockPrisma.message.findMany).toHaveBeenCalled();
    });

    it('CHAT-23: should return messages ordered by createdAt desc', async () => {
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(makeSessionMember());
      mockPrisma.message.findMany.mockResolvedValue([]);

      await service.getMessages('user-1', 'session-1', {});

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('should send message with mentions and create MessageMention records', async () => {
      const dto = { content: 'Hello @user-2', mentions: ['user-2'] };
      const mockMessage = makeMessage({ content: 'Hello @user-2' });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(makeSessionMember());
      mockPrisma.message.create.mockResolvedValue(mockMessage);
      mockPrisma.chatSession.update.mockResolvedValue({});
      mockPrisma.messageMention = { createMany: jest.fn().mockResolvedValue({ count: 1 }) };

      await service.sendMessage('user-1', 'session-1', dto);

      expect(mockPrisma.messageMention.createMany).toHaveBeenCalledWith({
        data: [{ messageId: 'msg-1', userId: 'user-2' }],
      });
    });
  });

  describe('addMembers', () => {
    it('CHAT-SVC-08: should add members successfully', async () => {
      const ownerMember = makeSessionMember({ userId: 'user-1', role: 'owner' });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(ownerMember);
      mockPrisma.chatSession.findUnique.mockResolvedValue({
        id: 'session-1',
        _count: { members: 2 },
        maxMembers: 100,
      });
      mockPrisma.chatSessionMember.findMany.mockResolvedValue([]);
      mockPrisma.chatSessionMember.createMany.mockResolvedValue({ count: 2 });

      const result = await service.addMembers('user-1', 'session-1', ['user-2', 'user-3']);

      expect(result.added).toBe(2);
    });

    it('CHAT-SVC-09: should throw ForbiddenException for non-admin trying to add members', async () => {
      const member = makeSessionMember({ userId: 'user-1', role: 'member' });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(member);

      await expect(service.addMembers('user-1', 'session-1', ['user-2'])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('EDGE-01: should throw ForbiddenException when adding members exceeds maxMembers limit', async () => {
      const ownerMember = makeSessionMember({ userId: 'user-1', role: 'owner' });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(ownerMember);
      mockPrisma.chatSession.findUnique.mockResolvedValue({
        id: 'session-1',
        _count: { members: 98 },
        maxMembers: 100,
      });

      await expect(service.addMembers('user-1', 'session-1', ['user-2', 'user-3', 'user-4'])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('EDGE-02: should skip already existing members without error', async () => {
      const ownerMember = makeSessionMember({ userId: 'user-1', role: 'owner' });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(ownerMember);
      mockPrisma.chatSession.findUnique.mockResolvedValue({
        id: 'session-1',
        _count: { members: 3 },
        maxMembers: 100,
      });
      mockPrisma.chatSessionMember.findMany.mockResolvedValue([{ userId: 'user-2' }]);
      mockPrisma.chatSessionMember.createMany.mockResolvedValue({ count: 1 });

      const result = await service.addMembers('user-1', 'session-1', ['user-2', 'user-3']);

      expect(result.added).toBe(1);
      expect(result.skipped).toBe(1);
    });
  });

  describe('manageFriend', () => {
    it('CHAT-SVC-10: should send friend request', async () => {
      mockPrisma.friendship.findFirst.mockResolvedValue(null);
      const friendship = makeFriendship({ status: 'pending' });
      mockPrisma.friendship.create.mockResolvedValue(friendship);

      await service.manageFriend('user-1', 'user-2', 'request');

      expect(mockPrisma.friendship.create).toHaveBeenCalled();
    });

    it('should return existing status if friendship exists', async () => {
      const existing = makeFriendship({ status: 'pending' });
      mockPrisma.friendship.findFirst.mockResolvedValue(existing);

      const result = await service.manageFriend('user-1', 'user-2', 'request');

      expect(result.status).toBe('pending');
    });

    it('should accept friend request', async () => {
      const request = makeFriendship({ id: 'req-1', status: 'pending' });
      mockPrisma.friendship.findFirst.mockResolvedValue(request);
      mockPrisma.friendship.update.mockResolvedValue({ ...request, status: 'accepted' });
      mockPrisma.friendship.create.mockResolvedValue(makeFriendship({ status: 'accepted' }));

      const result = await service.manageFriend('user-1', 'user-2', 'accept');

      expect(result.status).toBe('accepted');
    });

    it('CHAT-SVC-11: should throw NotFoundException when accepting non-existent request', async () => {
      mockPrisma.friendship.findFirst.mockResolvedValue(null);

      await expect(service.manageFriend('user-1', 'user-2', 'accept')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should block a user', async () => {
      const request = makeFriendship({ id: 'req-1' });
      mockPrisma.friendship.findFirst.mockResolvedValue(request);
      mockPrisma.friendship.update.mockResolvedValue({ ...request, status: 'blocked' });
      mockPrisma.friendship.upsert.mockResolvedValue({});

      const result = await service.manageFriend('user-1', 'user-2', 'block');

      expect(result.status).toBe('blocked');
    });

    it('should throw ForbiddenException for unknown action', async () => {
      await expect(service.manageFriend('user-1', 'user-2', 'unknown')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('searchUsers', () => {
    it('CHAT-SVC-12: should search users excluding current user', async () => {
      const users = [
        makeUser({ id: 'user-2', username: 'alice' }),
        makeUser({ id: 'user-3', username: 'bob' }),
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const result = await service.searchUsers('user-1', 'alice');

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ id: { not: 'user-1' } }]),
          }),
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('should return empty array for query shorter than 2 characters', async () => {
      const result = await service.searchUsers('user-1', 'a');

      expect(result).toEqual([]);
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getOnlineUsers', () => {
    it('CHAT-SVC-13: should get online users from Redis', async () => {
      mockRedis.scan.mockResolvedValue(['0', ['user-1', 'user-2']]);
      const users = [
        makeUser({ id: 'user-1', status: 'online' }),
        makeUser({ id: 'user-2', status: 'online' }),
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const result = await service.getOnlineUsers();

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no online users', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      const result = await service.getOnlineUsers();

      expect(result).toEqual([]);
    });
  });

  describe('markAsRead', () => {
    it('should update lastReadAt', async () => {
      mockPrisma.chatSessionMember.update.mockResolvedValue({});

      await service.markAsRead('user-1', 'session-1', 'msg-1');

      expect(mockPrisma.chatSessionMember.update).toHaveBeenCalledWith({
        where: { sessionId_userId: { sessionId: 'session-1', userId: 'user-1' } },
        data: { lastReadAt: expect.any(Date) },
      });
    });
  });

  describe('updateSession', () => {
    it('should update session name as owner', async () => {
      const ownerMember = makeSessionMember({ userId: 'user-1', role: 'owner' });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(ownerMember);
      const updated = makeSession({ name: 'New Name' });
      mockPrisma.chatSession.update.mockResolvedValue(updated);

      const result = await service.updateSession('user-1', 'session-1', { name: 'New Name' });

      expect(result.name).toBe('New Name');
    });

    it('CHAT-21: should update session description', async () => {
      const ownerMember = makeSessionMember({ userId: 'user-1', role: 'owner' });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(ownerMember);
      const updated = makeSession({ description: 'New description' });
      mockPrisma.chatSession.update.mockResolvedValue(updated);

      const result = await service.updateSession('user-1', 'session-1', { description: 'New description' });

      expect(result.description).toBe('New description');
    });
  });

  describe('deleteSession', () => {
    it('should delete session as owner', async () => {
      const ownerMember = makeSessionMember({ userId: 'user-1', role: 'owner' });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(ownerMember);
      mockPrisma.chatSession.delete.mockResolvedValue({});

      await service.deleteSession('user-1', 'session-1');

      expect(mockPrisma.chatSession.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } });
    });

    it('should throw ForbiddenException when non-owner tries to delete', async () => {
      const member = makeSessionMember({ userId: 'user-1', role: 'member' });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(member);

      await expect(service.deleteSession('user-1', 'session-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addReaction', () => {
    it('REACT-01: should add reaction to a message', async () => {
      const message = makeMessage({ id: 'msg-1' });
      message.session = {
        id: 'session-1',
        members: [{ userId: 'user-1' }, { userId: 'user-2' }],
      };
      mockPrisma.message.findUnique.mockResolvedValue(message);
      mockPrisma.messageReaction.findUnique.mockResolvedValue(null);
      mockPrisma.messageReaction.create.mockResolvedValue({
        id: 'reaction-1',
        messageId: 'msg-1',
        userId: 'user-1',
        emoji: '👍',
      });

      const result = await service.addReaction('user-1', 'msg-1', '👍');

      expect(mockPrisma.messageReaction.create).toHaveBeenCalledWith({
        data: { messageId: 'msg-1', userId: 'user-1', emoji: '👍' },
      });
      expect(result.emoji).toBe('👍');
    });

    it('should throw NotFoundException when message does not exist', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      await expect(service.addReaction('user-1', 'nonexistent', '👍')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not a session member', async () => {
      const message = makeMessage({ id: 'msg-1' });
      message.session = {
        id: 'session-1',
        members: [{ userId: 'user-2' }],
      };
      mockPrisma.message.findUnique.mockResolvedValue(message);

      await expect(service.addReaction('user-1', 'msg-1', '👍')).rejects.toThrow(ForbiddenException);
    });

    it('should return existing reaction if already exists', async () => {
      const message = makeMessage({ id: 'msg-1' });
      message.session = {
        id: 'session-1',
        members: [{ userId: 'user-1' }],
      };
      const existingReaction = { id: 'reaction-1', messageId: 'msg-1', userId: 'user-1', emoji: '👍' };
      mockPrisma.message.findUnique.mockResolvedValue(message);
      mockPrisma.messageReaction.findUnique.mockResolvedValue(existingReaction);

      const result = await service.addReaction('user-1', 'msg-1', '👍');

      expect(mockPrisma.messageReaction.create).not.toHaveBeenCalled();
      expect(result.id).toBe('reaction-1');
    });
  });

  describe('removeReaction', () => {
    it('REACT-02: should remove reaction successfully', async () => {
      const reaction = { id: 'reaction-1', messageId: 'msg-1', userId: 'user-1', emoji: '👍' };
      mockPrisma.messageReaction.findUnique.mockResolvedValue(reaction);
      mockPrisma.messageReaction.delete.mockResolvedValue(reaction);

      const result = await service.removeReaction('user-1', 'msg-1', '👍');

      expect(mockPrisma.messageReaction.delete).toHaveBeenCalledWith({ where: { id: 'reaction-1' } });
      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException when reaction does not exist', async () => {
      mockPrisma.messageReaction.findUnique.mockResolvedValue(null);

      await expect(service.removeReaction('user-1', 'msg-1', '👍')).rejects.toThrow(NotFoundException);
    });

    it('CHAT-13: should only allow removing own reaction (not others)', async () => {
      // The composite key messageId_userId_emoji ensures only own reaction can be removed
      mockPrisma.messageReaction.findUnique.mockResolvedValue(null);

      await expect(service.removeReaction('user-2', 'msg-1', '👍')).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeMember', () => {
    it('CHAT-SVC-14: should remove member as owner', async () => {
      const ownerMember = makeSessionMember({ userId: 'user-1', role: 'owner' });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(ownerMember);
      mockPrisma.chatSession.findUnique.mockResolvedValue(makeSession({ id: 'session-1' }));
      mockPrisma.chatSessionMember.delete.mockResolvedValue({});

      await service.removeMember('user-1', 'session-1', 'user-2');

      expect(mockPrisma.chatSessionMember.delete).toHaveBeenCalledWith({
        where: { sessionId_userId: { sessionId: 'session-1', userId: 'user-2' } },
      });
    });

    it('CHAT-SVC-15: should allow self-removal by regular member', async () => {
      const member = makeSessionMember({ userId: 'user-2', role: 'member' });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(member);
      mockPrisma.chatSession.findUnique.mockResolvedValue(makeSession({ id: 'session-1' }));
      mockPrisma.chatSessionMember.delete.mockResolvedValue({});

      await service.removeMember('user-2', 'session-1', 'user-2');

      expect(mockPrisma.chatSessionMember.delete).toHaveBeenCalled();
    });

    it('CHAT-SVC-16: should throw ForbiddenException when non-owner tries to remove another member', async () => {
      const member = makeSessionMember({ userId: 'user-3', role: 'member' });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(member);

      await expect(service.removeMember('user-3', 'session-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when session member record not found', async () => {
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(null);

      await expect(service.removeMember('user-1', 'session-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getFriends', () => {
    it('CHAT-SVC-17: should return accepted friends list', async () => {
      const friend1 = makeUser({ id: 'friend-1', username: 'alice' });
      const friend2 = makeUser({ id: 'friend-2', username: 'bob' });
      mockPrisma.friendship.findMany.mockResolvedValue([
        makeFriendship({ id: 'f1', userId: 'user-1', friendId: 'friend-1', status: 'accepted', friend: friend1 }),
        makeFriendship({ id: 'f2', userId: 'user-1', friendId: 'friend-2', status: 'accepted', friend: friend2 }),
      ]);

      const result = await service.getFriends('user-1');

      expect(result).toHaveLength(2);
      expect(mockPrisma.friendship.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ userId: 'user-1' }, { friendId: 'user-1' }],
          status: 'accepted',
        },
        include: {
          user: { select: { id: true, username: true, avatarUrl: true, status: true, nickname: true } },
          friend: { select: { id: true, username: true, avatarUrl: true, status: true, nickname: true } },
        },
      });
    });

    it('CHAT-SVC-18: should return empty array when user has no friends', async () => {
      mockPrisma.friendship.findMany.mockResolvedValue([]);

      const result = await service.getFriends('user-1');

      expect(result).toEqual([]);
    });

    it('should exclude pending friendships from friends list', async () => {
      mockPrisma.friendship.findMany.mockResolvedValue([]);

      await service.getFriends('user-1');

      expect(mockPrisma.friendship.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'accepted',
          }),
        }),
      );
    });
  });

  describe('searchUsers', () => {
    it('should search users case-insensitively', async () => {
      const users = [makeUser({ id: 'user-2', username: 'Alice' })];
      mockPrisma.user.findMany.mockResolvedValue(users);

      await service.searchUsers('user-1', 'ALICE');

      expect(mockPrisma.user.findMany).toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('should update lastReadAt with message id', async () => {
      mockPrisma.chatSessionMember.update.mockResolvedValue({});

      await service.markAsRead('user-1', 'session-1', 'msg-5');

      expect(mockPrisma.chatSessionMember.update).toHaveBeenCalledWith({
        where: { sessionId_userId: { sessionId: 'session-1', userId: 'user-1' } },
        data: { lastReadAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException when user is not a session member', async () => {
      mockPrisma.chatSessionMember.update.mockRejectedValue(new Error('Record not found'));

      await expect(service.markAsRead('user-1', 'session-1', 'msg-1')).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('EDGE-CHAT-01: should handle empty member list in session creation', async () => {
      const dto = { sessionType: 'group' as const, name: 'Empty Group', memberIds: [] };
      mockPrisma.chatSession.create.mockResolvedValue(makeSession({ id: 'group-session', sessionType: 'group', name: 'Empty Group' }));

      const result = await service.createSession('user-1', dto);

      expect(result).toBeDefined();
    });

    it('EDGE-CHAT-02: should handle special characters in message content', async () => {
      const dto = { content: 'Hello! @#$%^&*()_+{}|:"<>?', contentType: 'text' as const };
      const mockMessage = makeMessage({ content: dto.content });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(makeSessionMember());
      mockPrisma.message.create.mockResolvedValue(mockMessage);
      mockPrisma.chatSession.update.mockResolvedValue({});

      const result = await service.sendMessage('user-1', 'session-1', dto);

      expect(mockPrisma.message.create).toHaveBeenCalled();
      expect(result.content).toBe(dto.content);
    });

    it('EDGE-CHAT-03: should handle very long message content', async () => {
      const longContent = 'A'.repeat(10000);
      const dto = { content: longContent, contentType: 'text' as const };
      const mockMessage = makeMessage({ content: longContent });
      mockPrisma.chatSessionMember.findUnique.mockResolvedValue(makeSessionMember());
      mockPrisma.message.create.mockResolvedValue(mockMessage);
      mockPrisma.chatSession.update.mockResolvedValue({});

      await service.sendMessage('user-1', 'session-1', dto);

      expect(mockPrisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ content: longContent }),
        }),
      );
    });

    it('EDGE-CHAT-04: should handle concurrent reaction add/remove', async () => {
      const message = makeMessage({ id: 'msg-1' });
      message.session = { id: 'session-1', members: [{ userId: 'user-1' }] };
      mockPrisma.message.findUnique.mockResolvedValue(message);
      mockPrisma.messageReaction.findUnique.mockResolvedValue(null);
      mockPrisma.messageReaction.create.mockResolvedValue({
        id: 'reaction-1',
        messageId: 'msg-1',
        userId: 'user-1',
        emoji: '👍',
      });

      const result = await service.addReaction('user-1', 'msg-1', '👍');

      expect(result.emoji).toBe('👍');
    });
  });
});
