import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { makeSession, makeMessage, makeUser } from '../../test/factories/entities.factory';

describe('ChatController', () => {
  let controller: ChatController;
  let mockChatService: any;

  beforeEach(async () => {
    mockChatService = {
      getUserSessions: jest.fn(),
      createSession: jest.fn(),
      getSession: jest.fn(),
      updateSession: jest.fn(),
      deleteSession: jest.fn(),
      getMessages: jest.fn(),
      sendMessage: jest.fn(),
      recallMessage: jest.fn(),
      markAsRead: jest.fn(),
      addMembers: jest.fn(),
      removeMember: jest.fn(),
      getFriends: jest.fn(),
      manageFriend: jest.fn(),
      searchUsers: jest.fn(),
      getOnlineUsers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: mockChatService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ChatController>(ChatController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /chat/sessions', () => {
    it('CHAT-CTRL-01: should return user sessions', async () => {
      const sessions = [makeSession({ id: 'session-1' })];
      mockChatService.getUserSessions.mockResolvedValue(sessions);

      const result = await controller.getSessions('user-1');

      expect((result as any).data).toEqual(sessions);
    });
  });

  describe('POST /chat/sessions', () => {
    it('CHAT-CTRL-02: should create private session', async () => {
      const dto = { sessionType: 'private' as const, memberIds: ['user-2'] };
      const session = makeSession({ id: 'new-session', sessionType: 'private' });
      mockChatService.createSession.mockResolvedValue(session);

      const result = await controller.createSession('user-1', dto);

      expect((result as any).data).toEqual(session);
    });

    it('CHAT-CTRL-03: should create group session', async () => {
      const dto = { sessionType: 'group' as const, name: 'Test Group', memberIds: ['user-2', 'user-3'] };
      const session = makeSession({ id: 'group-1', sessionType: 'group', name: 'Test Group' });
      mockChatService.createSession.mockResolvedValue(session);

      const result = await controller.createSession('user-1', dto);

      expect((result as any).data.name).toBe('Test Group');
    });
  });

  describe('GET /chat/sessions/:id', () => {
    it('CHAT-CTRL-04: should return session details', async () => {
      const session = makeSession({ id: 'session-1', members: [] });
      mockChatService.getSession.mockResolvedValue(session);

      const result = await controller.getSession('user-1', 'session-1');

      expect((result as any).data).toEqual(session);
    });

    it('CHAT-CTRL-05: should throw when non-member tries to access', async () => {
      mockChatService.getSession.mockRejectedValue(new ForbiddenException('Not a member of this session'));

      await expect(controller.getSession('user-1', 'session-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('PATCH /chat/sessions/:id', () => {
    it('CHAT-CTRL-06: should update session name', async () => {
      const dto = { name: 'New Name' };
      const updated = makeSession({ name: 'New Name' });
      mockChatService.updateSession.mockResolvedValue(updated);

      const result = await controller.updateSession('user-1', 'session-1', dto);

      expect((result as any).data.name).toBe('New Name');
    });
  });

  describe('DELETE /chat/sessions/:id', () => {
    it('CHAT-CTRL-07: should delete session', async () => {
      mockChatService.deleteSession.mockResolvedValue(undefined);

      const result = await controller.deleteSession('user-1', 'session-1');

      expect((result as any).message).toBe('Session deleted');
    });
  });

  describe('GET /chat/sessions/:id/messages', () => {
    it('CHAT-CTRL-08: should return messages with pagination', async () => {
      const messages = [makeMessage(), makeMessage({ id: 'msg-2' })];
      mockChatService.getMessages.mockResolvedValue(messages);

      const result = await controller.getMessages('user-1', 'session-1', { limit: 50 });

      expect((result as any).data).toEqual(messages);
    });

    it('CHAT-CTRL-09: should pass limit to service (service caps at 200 internally)', async () => {
      mockChatService.getMessages.mockResolvedValue([]);

      await controller.getMessages('user-1', 'session-1', { limit: 500 });

      // Controller passes the DTO object to service, service applies cap internally
      expect(mockChatService.getMessages).toHaveBeenCalledWith('user-1', 'session-1', { limit: 500 });
    });
  });

  describe('POST /chat/sessions/:id/messages', () => {
    it('CHAT-CTRL-10: should send message', async () => {
      const dto = { content: 'Hello' };
      const message = makeMessage({ content: 'Hello' });
      mockChatService.sendMessage.mockResolvedValue(message);

      const result = await controller.sendMessage('user-1', 'session-1', dto);

      expect((result as any).data.content).toBe('Hello');
    });
  });

  describe('POST /chat/messages/recall', () => {
    it('CHAT-CTRL-11: should recall own message', async () => {
      const dto = { messageId: 'msg-1' };
      const recalled = makeMessage({ isRecalled: true });
      mockChatService.recallMessage.mockResolvedValue(recalled);

      const result = await controller.recallMessage('user-1', dto);

      expect((result as any).data.isRecalled).toBe(true);
    });

    it('CHAT-CTRL-12: should throw when trying to recall others message', async () => {
      const dto = { messageId: 'msg-1' };
      mockChatService.recallMessage.mockRejectedValue(new ForbiddenException('Cannot recall others message'));

      await expect(controller.recallMessage('user-1', dto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('POST /chat/sessions/:id/members', () => {
    it('CHAT-CTRL-13: should add members', async () => {
      const dto = { userIds: ['user-2'] };
      mockChatService.addMembers.mockResolvedValue({ added: 1, skipped: 0 });

      const result = await controller.addMembers('user-1', 'session-1', dto);

      expect((result as any).data.added).toBe(1);
    });
  });

  describe('DELETE /chat/sessions/:id/members/:userId', () => {
    it('CHAT-CTRL-14: should remove member', async () => {
      mockChatService.removeMember.mockResolvedValue(undefined);

      const result = await controller.removeMember('user-1', 'session-1', 'user-2');

      // success() defaults message to 'Success'
      expect((result as any).message).toBe('Success');
    });

    it('should throw when non-owner tries to remove member', async () => {
      mockChatService.removeMember.mockRejectedValue(new ForbiddenException('Insufficient permissions'));

      await expect(controller.removeMember('user-1', 'session-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('GET /chat/friends', () => {
    it('CHAT-CTRL-15: should return friends list', async () => {
      const friends = [makeUser({ id: 'user-2', username: 'friend' })];
      mockChatService.getFriends.mockResolvedValue(friends);

      const result = await controller.getFriends('user-1');

      expect((result as any).data).toEqual(friends);
    });
  });

  describe('POST /chat/friends/:id', () => {
    it('CHAT-CTRL-16: should send friend request', async () => {
      mockChatService.manageFriend.mockResolvedValue({ status: 'pending' });

      const result = await controller.manageFriend('user-1', 'user-2', { action: 'request' });

      expect((result as any).data.status).toBe('pending');
    });

    it('CHAT-CTRL-17: should accept friend request', async () => {
      mockChatService.manageFriend.mockResolvedValue({ status: 'accepted' });

      const result = await controller.manageFriend('user-1', 'user-2', { action: 'accept' });

      expect((result as any).data.status).toBe('accepted');
    });
  });

  describe('GET /chat/users/search', () => {
    it('CHAT-CTRL-18: should search users', async () => {
      const users = [makeUser({ id: 'user-2', username: 'alice' })];
      mockChatService.searchUsers.mockResolvedValue(users);

      const result = await controller.searchUsers('user-1', 'alice');

      expect((result as any).data).toEqual(users);
    });
  });

  describe('GET /chat/online-users', () => {
    it('CHAT-CTRL-19: should return online users', async () => {
      const users = [makeUser({ id: 'user-2', status: 'online' })];
      mockChatService.getOnlineUsers.mockResolvedValue(users);

      const result = await controller.getOnlineUsers();

      expect((result as any).data).toEqual(users);
    });
  });
});
