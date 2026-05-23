import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { makeUser } from '../../test/factories/entities.factory';

describe('UserController', () => {
  let controller: UserController;
  let mockUserService: any;

  beforeEach(async () => {
    mockUserService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      uploadAvatar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserController>(UserController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users/:userId', () => {
    it('USER-CTRL-01: should return user profile', async () => {
      const user = makeUser({ id: 'user-2', username: 'otheruser' });
      mockUserService.getProfile.mockResolvedValue(user);

      const result = await controller.getProfile('user-2');

      expect((result as any).data.username).toBe('otheruser');
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockUserService.getProfile.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.getProfile('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('PATCH /users/profile', () => {
    it('USER-CTRL-02: should update current user profile', async () => {
      const dto = { nickname: 'New Name', bio: 'Updated bio' };
      const updated = makeUser({ nickname: 'New Name', bio: 'Updated bio' });
      mockUserService.updateProfile.mockResolvedValue(updated);

      const result = await controller.updateProfile('user-1', dto);

      expect((result as any).data.nickname).toBe('New Name');
      expect(mockUserService.updateProfile).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('POST /users/avatar', () => {
    it('USER-CTRL-03: should upload avatar and return new URL', async () => {
      const mockFile = { filename: 'new-avatar.png' } as Express.Multer.File;
      const updated = makeUser({ avatarUrl: '/uploads/avatars/new-avatar.png' });
      mockUserService.uploadAvatar.mockResolvedValue(updated);

      const result = await controller.uploadAvatar('user-1', mockFile);

      expect((result as any).data.avatarUrl).toContain('new-avatar.png');
    });
  });
});
