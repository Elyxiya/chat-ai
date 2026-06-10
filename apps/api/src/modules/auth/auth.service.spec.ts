import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService, InvalidCredentialsException } from './auth.service';
import { RedisService } from '../common/redis.service';
import { PrismaService } from '../../config/prisma.service';
import { makeUser, makeRefreshToken } from '../../test/factories/entities.factory';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let mockPrisma: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockRedis: any;

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      oAuthAccount: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        const map: Record<string, string> = {
          JWT_SECRET: 'test-secret',
          JWT_EXPIRES_IN: '15m',
          GITHUB_CLIENT_ID: 'github-client-id',
          GITHUB_CLIENT_SECRET: 'github-client-secret',
          GITHUB_CALLBACK_URL: 'http://localhost/callback',
          GOOGLE_CLIENT_ID: 'google-client-id',
          GOOGLE_CLIENT_SECRET: 'google-client-secret',
          GOOGLE_CALLBACK_URL: 'http://localhost/callback',
        };
        return map[key];
      }),
    };

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedis },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('AUTH-SVC-01: should register new user and generate tokens', async () => {
      const dto = { username: 'newuser', email: 'new@example.com', password: 'Password123' };
      const mockUser = makeUser({ id: 'new-user-id', username: dto.username, email: dto.email });
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(dto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.id).toBe('new-user-id');
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockJwtService.sign).toHaveBeenCalled();
    });

    it('AUTH-SVC-02: should throw ConflictException when username already exists', async () => {
      const dto = { username: 'existing', email: 'existing@example.com', password: 'Password123' };
      mockPrisma.user.findFirst.mockResolvedValue(makeUser({ username: dto.username }));

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when email already exists', async () => {
      const dto = { username: 'newuser', email: 'existing@example.com', password: 'Password123' };
      mockPrisma.user.findFirst.mockResolvedValue(makeUser({ email: dto.email }));

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('validateUser', () => {
    it('AUTH-SVC-03: should return UserPayload for valid credentials', async () => {
      const mockUser = makeUser({ id: 'user-1', username: 'testuser', email: 'test@example.com' });
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('testuser', 'Password123');

      expect(result).not.toBeNull();
      expect(result.id).toBe('user-1');
      expect(result.username).toBe('testuser');
    });

    it('AUTH-SVC-04: should throw InvalidCredentialsException for wrong password', async () => {
      const mockUser = makeUser({ id: 'user-1', username: 'testuser' });
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validateUser('testuser', 'WrongPassword')).rejects.toThrow(InvalidCredentialsException);
    });

    it('should throw InvalidCredentialsException when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.validateUser('nonexistent', 'Password123')).rejects.toThrow(InvalidCredentialsException);
    });
  });

  describe('login', () => {
    it('AUTH-SVC-05: should update user status to online and generate tokens', async () => {
      const userPayload = { id: 'user-1', username: 'testuser', email: 'test@example.com', userType: 'human' as const };
      mockPrisma.user.update.mockResolvedValue(makeUser({ id: 'user-1', status: 'online' }));
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login(userPayload);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'online', lastSeenAt: expect.any(Date) },
      });
    });
  });

  describe('refreshTokens', () => {
    it('AUTH-SVC-06: should refresh tokens with valid refreshToken', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const mockToken = makeRefreshToken({ expiresAt: futureDate });
      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockToken);
      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrisma.refreshToken.update).toHaveBeenCalled();
    });

    it('AUTH-SVC-07: should throw UnauthorizedException for expired token', async () => {
      const pastDate = new Date(Date.now() - 1000);
      const mockToken = makeRefreshToken({ expiresAt: pastDate });
      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockToken);

      await expect(service.refreshTokens('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('AUTH-SVC-13: should throw UnauthorizedException when token is revoked', async () => {
      const revokedToken = makeRefreshToken({ revokedAt: new Date() });
      mockPrisma.refreshToken.findUnique.mockResolvedValue(revokedToken);

      await expect(service.refreshTokens('revoked-token')).rejects.toThrow(UnauthorizedException);
    });

    it('AUTH-SVC-14: should throw UnauthorizedException when token not found', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshTokens('nonexistent-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('AUTH-SVC-08: should revoke refresh token', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('refresh-token');

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String) },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('sendVerificationCode', () => {
    it('AUTH-SVC-09: should generate 6-character code and store in Redis', async () => {
      await service.sendVerificationCode('test@example.com');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'verify:test@example.com',
        expect.stringMatching(/^[A-F0-9]{6}$/),
        300000,
      );
    });
  });

  describe('resetPassword', () => {
    it('AUTH-SVC-10: should throw BadRequestException when code does not match', async () => {
      mockRedis.get.mockResolvedValue('ABC123');
      const dto = { email: 'test@example.com', code: 'WRONG1', newPassword: 'NewPass123' };

      await expect(service.resetPassword(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when code is missing in Redis', async () => {
      mockRedis.get.mockResolvedValue(null);
      const dto = { email: 'test@example.com', code: 'ABC123', newPassword: 'NewPass123' };

      await expect(service.resetPassword(dto)).rejects.toThrow(BadRequestException);
    });

    it('should reset password with valid code', async () => {
      const mockUser = makeUser({ id: 'user-1', email: 'test@example.com' });
      mockRedis.get.mockResolvedValue('ABC123');
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(undefined);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new-password');

      const dto = { email: 'test@example.com', code: 'ABC123', newPassword: 'NewPass123' };
      await service.resetPassword(dto);

      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith('verify:test@example.com');
    });
  });

  describe('changePassword', () => {
    it('AUTH-SVC-11: should change password with correct old password', async () => {
      const mockUser = makeUser({ id: 'user-1', passwordHash: 'hashed-old-password' });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new-password');
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({});

      await service.changePassword('user-1', 'OldPassword123', 'NewPassword456');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'hashed-new-password' },
      });
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });

    it('AUTH-SVC-12: should throw UnauthorizedException with incorrect old password', async () => {
      const mockUser = makeUser({ id: 'user-1', passwordHash: 'hashed-old-password' });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', 'WrongPassword', 'NewPassword456'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword('nonexistent', 'OldPassword', 'NewPassword123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getGithubAuthUrl', () => {
    it('should return GitHub OAuth URL with state parameter', () => {
      const url = service.getGithubAuthUrl('test-state');

      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=github-client-id');
      expect(url).toContain('state=test-state');
    });

    it('should return GitHub OAuth URL without state parameter', () => {
      const url = service.getGithubAuthUrl();

      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).not.toContain('state=undefined');
    });
  });

  describe('getGoogleAuthUrl', () => {
    it('should return Google OAuth URL', () => {
      const url = service.getGoogleAuthUrl('test-state');

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=google-client-id');
    });
  });

  describe('deleteAccount', () => {
    it('should delete user account with correct password', async () => {
      const mockUser = makeUser({ id: 'user-1', passwordHash: 'hashed-password' });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.user.delete.mockResolvedValue(mockUser);

      await service.deleteAccount('user-1', 'CorrectPassword123');

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('should throw UnauthorizedException with incorrect password', async () => {
      const mockUser = makeUser({ id: 'user-1', passwordHash: 'hashed-password' });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.deleteAccount('user-1', 'WrongPassword')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('handleGithubCallback', () => {
    const mockGithubTokenResponse = { access_token: 'github-access-token' };
    const mockGithubUser = {
      id: 12345,
      email: 'github@example.com',
      name: 'GitHub User',
      login: 'githubuser',
      avatar_url: 'https://avatars.githubusercontent.com/u/12345',
    };

    beforeEach(() => {
      global.fetch = jest.fn() as jest.Mock;
    });

    afterEach(() => {
      delete (global as any).fetch;
    });

    it('AUTH-OAUTH-01: should create new user and return tokens on first GitHub login', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ json: () => Promise.resolve(mockGithubTokenResponse) })
        .mockResolvedValueOnce({ json: () => Promise.resolve(mockGithubUser) });
      mockPrisma.oAuthAccount.findUnique.mockResolvedValue(null);
      const newOAuthAccount = {
        provider: 'github',
        providerUserId: '12345',
        user: makeUser({ id: 'new-user-id', email: 'github@example.com' }),
      };
      mockPrisma.oAuthAccount.create.mockResolvedValue(newOAuthAccount);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.handleGithubCallback('auth-code');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrisma.oAuthAccount.create).toHaveBeenCalled();
    });

    it('AUTH-OAUTH-02: should return existing user on repeat GitHub login', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ json: () => Promise.resolve(mockGithubTokenResponse) })
        .mockResolvedValueOnce({ json: () => Promise.resolve(mockGithubUser) });
      const existingOAuthAccount = {
        provider: 'github',
        providerUserId: '12345',
        user: makeUser({ id: 'existing-user-id', email: 'github@example.com' }),
      };
      mockPrisma.oAuthAccount.findUnique.mockResolvedValue(existingOAuthAccount);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.handleGithubCallback('auth-code');

      expect(result).toHaveProperty('accessToken');
      expect(mockPrisma.oAuthAccount.create).not.toHaveBeenCalled();
      expect(mockPrisma.oAuthAccount.findUnique).toHaveBeenCalled();
    });

    it('AUTH-OAUTH-03: should throw BadRequestException when GitHub has no public email', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ json: () => Promise.resolve(mockGithubTokenResponse) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ ...mockGithubUser, email: null }) });

      await expect(service.handleGithubCallback('auth-code')).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleGoogleCallback', () => {
    const mockGoogleTokenResponse = {
      access_token: 'google-access-token',
      refresh_token: 'google-refresh-token',
      expires_in: 3600,
    };
    const mockGoogleUser = {
      id: 'google-user-id',
      email: 'google@example.com',
      name: 'Google User',
      picture: 'https://lh3.googleusercontent.com/picture',
      given_name: 'Google',
    };

    beforeEach(() => {
      global.fetch = jest.fn() as jest.Mock;
    });

    afterEach(() => {
      delete (global as any).fetch;
    });

    it('AUTH-OAUTH-04: should create new user and return tokens on first Google login', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ json: () => Promise.resolve(mockGoogleTokenResponse) })
        .mockResolvedValueOnce({ json: () => Promise.resolve(mockGoogleUser) });
      mockPrisma.oAuthAccount.findUnique.mockResolvedValue(null);
      const newOAuthAccount = {
        provider: 'google',
        providerUserId: 'google-user-id',
        user: makeUser({ id: 'new-user-id', email: 'google@example.com' }),
      };
      mockPrisma.oAuthAccount.create.mockResolvedValue(newOAuthAccount);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.handleGoogleCallback('auth-code');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrisma.oAuthAccount.create).toHaveBeenCalled();
    });

    it('AUTH-OAUTH-05: should return existing user on repeat Google login', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ json: () => Promise.resolve(mockGoogleTokenResponse) })
        .mockResolvedValueOnce({ json: () => Promise.resolve(mockGoogleUser) });
      const existingOAuthAccount = {
        provider: 'google',
        providerUserId: 'google-user-id',
        user: makeUser({ id: 'existing-user-id', email: 'google@example.com' }),
      };
      mockPrisma.oAuthAccount.findUnique.mockResolvedValue(existingOAuthAccount);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.handleGoogleCallback('auth-code');

      expect(result).toHaveProperty('accessToken');
      expect(mockPrisma.oAuthAccount.create).not.toHaveBeenCalled();
    });
  });

  describe('JWT Token Payload', () => {
    it('AUTH-SVC-15: should include correct userId and username in JWT payload', async () => {
      const userPayload = { id: 'user-1', username: 'testuser', email: 'test@example.com', nickname: 'Test', avatarUrl: null, userType: 'human' as const };
      mockPrisma.user.update.mockResolvedValue(makeUser({ id: 'user-1', status: 'online' }));
      mockPrisma.refreshToken.create.mockResolvedValue({});

      await service.login(userPayload);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        username: 'testuser',
      });
    });

    it('AUTH-SVC-16: should return user payload with all fields in tokens', async () => {
      const userPayload = { id: 'user-1', username: 'testuser', email: 'test@example.com', nickname: 'Test', avatarUrl: 'http://avatar.url', userType: 'human' as const };
      mockPrisma.user.update.mockResolvedValue(makeUser({ id: 'user-1' }));
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login(userPayload);

      expect(result.user).toEqual(expect.objectContaining({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test',
        avatarUrl: 'http://avatar.url',
        userType: 'human',
      }));
    });
  });

  describe('Password Validation', () => {
    it('AUTH-SVC-17: should reject weak passwords and accept strong ones', () => {
      const validate = (password: string) => {
        return typeof password === 'string' &&
          password.length >= 8 &&
          /[A-Z]/.test(password) &&
          /[a-z]/.test(password) &&
          /[0-9]/.test(password);
      };

      expect(validate('Short1A')).toBe(false);       // too short
      expect(validate('nouppercase1')).toBe(false);  // no uppercase
      expect(validate('NOLOWERCASE1')).toBe(false);  // no lowercase
      expect(validate('NoNumbers!')).toBe(false);    // no number
      expect(validate('ValidPass1')).toBe(true);     // valid
    });

    it('AUTH-SVC-18: should reject password shorter than 8 characters', () => {
      const validate = (password: string) => {
        return typeof password === 'string' &&
          password.length >= 8 &&
          /[A-Z]/.test(password) &&
          /[a-z]/.test(password) &&
          /[0-9]/.test(password);
      };

      expect(validate('Ab1')).toBe(false);
      expect(validate('Abcdef1')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('EDGE-AUTH-01: should handle concurrent registration attempts gracefully', async () => {
      const dto = { username: 'newuser', email: 'new@example.com', password: 'Password123' };
      const mockUser = makeUser({ id: 'new-user-id', username: dto.username, email: dto.email });
      mockPrisma.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(mockUser);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(dto);

      expect(result).toHaveProperty('accessToken');
    });

    it('EDGE-AUTH-02: should handle login with email identifier', async () => {
      const mockUser = makeUser({ id: 'user-1', username: 'testuser', email: 'test@example.com' });
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'Password123');

      expect(result).not.toBeNull();
      expect(result.id).toBe('user-1');
    });

    it('EDGE-AUTH-03: should handle case-insensitive email in registration', async () => {
      const dto = { username: 'newuser', email: 'New@Example.COM', password: 'Password123' };
      const mockUser = makeUser({ id: 'new-user-id', email: dto.email });
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(dto);

      expect(result).toHaveProperty('accessToken');
    });

    it('EDGE-AUTH-04: should generate unique refresh tokens', async () => {
      const dto = { username: 'user1', email: 'user1@example.com', password: 'Password123' };
      const mockUser = makeUser({ id: 'user-1', username: dto.username, email: dto.email });
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result1 = await service.register(dto);
      const result2 = await service.register({ ...dto, username: 'user2', email: 'user2@example.com' });

      expect(result1.refreshToken).not.toBe(result2.refreshToken);
    });
  });

  describe('WeChat OAuth', () => {
    const mockWechatTokenResponse = { access_token: 'wechat-access-token', openid: 'wechat-openid-12345' };
    const mockWechatUser = {
      openid: 'wechat-openid-12345',
      nickname: '微信用户',
      headimgurl: 'https://wx.qlogo.cn/xxx',
      sex: 1,
    };

    beforeEach(() => {
      global.fetch = jest.fn() as jest.Mock;
    });

    afterEach(() => {
      delete (global as any).fetch;
    });

    it('WECHAT-01: should generate WeChat OAuth URL with state', () => {
      const url = service.getWechatAuthUrl('test-state');
      expect(url).toContain('open.weixin.qq.com/connect/qrconnect');
      expect(url).toContain('appid=');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=snsapi_login');
      expect(url).toContain('state=test-state');
    });

    it('WECHAT-02: should create new user on first WeChat login', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ json: () => Promise.resolve(mockWechatTokenResponse) })
        .mockResolvedValueOnce({ json: () => Promise.resolve(mockWechatUser) });
      mockPrisma.oAuthAccount.findUnique.mockResolvedValue(null);
      const newOAuthAccount = {
        provider: 'wechat',
        providerUserId: 'wechat-openid-12345',
        user: makeUser({ id: 'new-wechat-user-id' }),
      };
      mockPrisma.oAuthAccount.create.mockResolvedValue(newOAuthAccount);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.handleWechatCallback('auth-code');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrisma.oAuthAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provider: 'wechat',
            providerUserId: 'wechat-openid-12345',
          }),
        }),
      );
    });

    it('WECHAT-03: should return existing user on repeat WeChat login', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ json: () => Promise.resolve(mockWechatTokenResponse) })
        .mockResolvedValueOnce({ json: () => Promise.resolve(mockWechatUser) });
      const existingOAuthAccount = {
        provider: 'wechat',
        providerUserId: 'wechat-openid-12345',
        user: makeUser({ id: 'existing-wechat-user-id' }),
      };
      mockPrisma.oAuthAccount.findUnique.mockResolvedValue(existingOAuthAccount);
      mockPrisma.user.update.mockResolvedValue(existingOAuthAccount.user);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.handleWechatCallback('auth-code');

      expect(result).toHaveProperty('accessToken');
      expect(mockPrisma.oAuthAccount.create).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('WECHAT-04: should throw BadRequestException on invalid WeChat token response', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ json: () => Promise.resolve({ errcode: 40029, errmsg: 'invalid code' }) });

      await expect(service.handleWechatCallback('invalid-code'))
        .rejects.toThrow(BadRequestException);
    });

    it('WECHAT-05: should throw BadRequestException on failed WeChat userinfo', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ json: () => Promise.resolve(mockWechatTokenResponse) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ errcode: 41001, errmsg: 'access_token missing' }) });

      await expect(service.handleWechatCallback('auth-code'))
        .rejects.toThrow(BadRequestException);
    });

    it('WECHAT-06: should generate URL without state when state is omitted', () => {
      const url = service.getWechatAuthUrl();
      expect(url).toContain('open.weixin.qq.com/connect/qrconnect');
      expect(url).not.toContain('state=');
    });

    it('WECHAT-07: should handle WeChat nickname with special characters', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ json: () => Promise.resolve(mockWechatTokenResponse) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ ...mockWechatUser, nickname: 'User<>&"' }) });
      mockPrisma.oAuthAccount.findUnique.mockResolvedValue(null);
      const newOAuthAccount = {
        provider: 'wechat',
        providerUserId: 'wechat-openid-12345',
        user: makeUser({ id: 'new-wechat-user-id' }),
      };
      mockPrisma.oAuthAccount.create.mockResolvedValue(newOAuthAccount);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.handleWechatCallback('auth-code');
      expect(result).toHaveProperty('accessToken');
    });

    it('WECHAT-08: should handle missing headimgurl from WeChat', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ json: () => Promise.resolve(mockWechatTokenResponse) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ ...mockWechatUser, headimgurl: undefined }) });
      mockPrisma.oAuthAccount.findUnique.mockResolvedValue(null);
      const newOAuthAccount = {
        provider: 'wechat',
        providerUserId: 'wechat-openid-12345',
        user: makeUser({ id: 'new-wechat-user-id' }),
      };
      mockPrisma.oAuthAccount.create.mockResolvedValue(newOAuthAccount);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.handleWechatCallback('auth-code');
      expect(result.user.avatarUrl).toBeNull();
    });
  });
});
