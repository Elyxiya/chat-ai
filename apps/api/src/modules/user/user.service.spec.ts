import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '../../config/prisma.service';

describe('UserService', () => {
  let service: UserService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('USER-SVC-01: should return user profile (passwordHash excluded by Prisma select)', async () => {
      // This is what Prisma returns with select - no passwordHash
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test',
        avatarUrl: null,
        bio: null,
        userType: 'human',
        status: 'offline',
        lastSeenAt: null,
        createdAt: new Date(),
        _count: { friendships: 5, sentMessages: 100 },
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getProfile('user-1');

      expect(result.id).toBe('user-1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('username');
      expect(result).toHaveProperty('_count');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should include lastSeenAt and createdAt', async () => {
      const now = new Date();
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test',
        avatarUrl: null,
        bio: null,
        userType: 'human',
        status: 'offline',
        lastSeenAt: now,
        createdAt: now,
        _count: { friendships: 0, sentMessages: 0 },
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getProfile('user-1');

      expect(result).toHaveProperty('lastSeenAt');
      expect(result).toHaveProperty('createdAt');
    });
  });

  describe('updateProfile', () => {
    it('USER-SVC-02: should update and return new profile', async () => {
      const dto = { nickname: 'New Nickname', bio: 'New bio' };
      const updated = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'New Nickname',
        bio: 'New bio',
        avatarUrl: null,
      };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateProfile('user-1', dto);

      expect(result.nickname).toBe('New Nickname');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: dto,
        select: expect.objectContaining({
          id: true,
          username: true,
          nickname: true,
        }),
      });
    });

    it('should update avatarUrl', async () => {
      const dto = { avatarUrl: '/uploads/avatars/new-avatar.png' };
      const updated = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test',
        bio: null,
        avatarUrl: '/uploads/avatars/new-avatar.png',
      };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateProfile('user-1', dto);

      expect(result.avatarUrl).toBe('/uploads/avatars/new-avatar.png');
    });
  });

  describe('uploadAvatar', () => {
    it('USER-SVC-03: should upload avatar and return URL', async () => {
      const mockFile = { filename: 'avatar-123.png' } as Express.Multer.File;
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test',
        bio: null,
        avatarUrl: '/uploads/avatars/avatar-123.png',
      });

      const result = await service.uploadAvatar('user-1', mockFile);

      expect(result.avatarUrl).toContain('/uploads/avatars/');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { avatarUrl: '/uploads/avatars/avatar-123.png' },
      });
    });
  });
});
