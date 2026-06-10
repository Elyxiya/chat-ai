import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { makeUser } from '../../test/factories/entities.factory';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: any;
  let mockRequest: any;

  beforeEach(async () => {
    mockAuthService = {
      register: jest.fn(),
      validateUser: jest.fn(),
      login: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
      sendVerificationCode: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
      deleteAccount: jest.fn(),
      getGithubAuthUrl: jest.fn(),
      getGoogleAuthUrl: jest.fn(),
      handleGithubCallback: jest.fn(),
      handleGoogleCallback: jest.fn(),
    };

    mockRequest = {
      user: makeUser({ id: 'user-1', username: 'testuser', email: 'test@example.com' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(LocalAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('AUTH-CTRL-01: should register user and return tokens', async () => {
      const dto = { username: 'newuser', email: 'new@example.com', password: 'Password123' };
      const tokens = { accessToken: 'token', refreshToken: 'refresh', user: { id: 'user-2' } };
      mockAuthService.register.mockResolvedValue(tokens);

      const result = await controller.register(dto);

      expect((result as any).data).toEqual(tokens);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    });

    it('AUTH-CTRL-02: should throw on duplicate registration', async () => {
      const dto = { username: 'existing', email: 'existing@example.com', password: 'Password123' };
      mockAuthService.register.mockRejectedValue(new ConflictException('Username or email already exists'));

      await expect(controller.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('AUTH-CTRL-03: should login with correct credentials', async () => {
      const userPayload = { id: 'user-1', username: 'testuser', email: 'test@example.com', userType: 'human' as const };
      const tokens = { accessToken: 'token', refreshToken: 'refresh', user: userPayload };
      mockRequest.user = userPayload;
      mockAuthService.login.mockResolvedValue(tokens);

      const result = await controller.login({ identifier: 'test@example.com', password: 'password123' }, mockRequest);

      expect((result as any).data).toEqual(tokens);
    });

    it('AUTH-CTRL-04: should throw on wrong password', async () => {
      const { InvalidCredentialsException } = require('./auth.service');
      mockAuthService.validateUser.mockRejectedValue(new InvalidCredentialsException('wrong_password'));

      await expect(controller.login({ identifier: 'test@example.com', password: 'wrong' }, mockRequest)).rejects.toThrow(UnauthorizedException);
    });

    it('AUTH-CTRL-05: should throw on non-existent user', async () => {
      const { InvalidCredentialsException } = require('./auth.service');
      mockAuthService.validateUser.mockRejectedValue(new InvalidCredentialsException('user_not_found'));

      await expect(controller.login({ identifier: 'nonexistent@example.com', password: 'password123' }, mockRequest)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('AUTH-CTRL-06: should refresh tokens with valid token', async () => {
      const dto = { refreshToken: 'valid-refresh-token' };
      const tokens = { accessToken: 'new-token', refreshToken: 'new-refresh', user: {} };
      mockAuthService.refreshTokens.mockResolvedValue(tokens);

      const result = await controller.refresh(dto);

      expect((result as any).data).toEqual(tokens);
    });

    it('AUTH-CTRL-07: should throw on expired token', async () => {
      const dto = { refreshToken: 'expired-token' };
      mockAuthService.refreshTokens.mockRejectedValue(new UnauthorizedException('Invalid refresh token'));

      await expect(controller.refresh(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('AUTH-CTRL-08: should logout successfully', async () => {
      const dto = { refreshToken: 'refresh-token' };
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(dto);

      expect((result as any).message).toBe('Logged out successfully');
      expect(mockAuthService.logout).toHaveBeenCalledWith(dto.refreshToken);
    });
  });

  describe('me', () => {
    it('AUTH-CTRL-09: should return current user info with valid JWT', async () => {
      const result = await controller.me(mockRequest);

      expect((result as any).data).toEqual(mockRequest.user);
    });
  });

  describe('sendCode', () => {
    it('AUTH-CTRL-13: should send verification code', async () => {
      const dto = { email: 'test@example.com' };
      mockAuthService.sendVerificationCode.mockResolvedValue(undefined);

      const result = await controller.sendCode(dto);

      expect((result as any).message).toBe('Verification code sent');
      expect(mockAuthService.sendVerificationCode).toHaveBeenCalledWith(dto.email);
    });
  });

  describe('resetPassword', () => {
    it('AUTH-CTRL-14: should reset password with valid code', async () => {
      const dto = { email: 'test@example.com', code: 'ABC123', newPassword: 'NewPass123' };
      mockAuthService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword(dto);

      expect((result as any).message).toBe('Password reset successfully');
    });
  });

  describe('changePassword', () => {
    it('AUTH-CTRL-11: should change password with correct old password', async () => {
      const dto = { currentPassword: 'OldPassword123', newPassword: 'NewPassword456' };
      mockAuthService.changePassword.mockResolvedValue(undefined);

      const result = await controller.changePassword('user-1', dto);

      expect((result as any).message).toBe('Password changed successfully');
    });

    it('AUTH-CTRL-12: should throw on wrong old password', async () => {
      const dto = { currentPassword: 'WrongPassword', newPassword: 'NewPassword456' };
      mockAuthService.changePassword.mockRejectedValue(
        new UnauthorizedException('Current password is incorrect'),
      );

      await expect(controller.changePassword('user-1', dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('oauth', () => {
    it('AUTH-CTRL-10: should return Google OAuth URL', async () => {
      mockAuthService.getGoogleAuthUrl.mockReturnValue(
        'https://accounts.google.com/o/oauth2/v2/auth?client_id=test',
      );

      const result = await controller.googleAuth({ state: 'test-state' });
      expect((result as any).data).toHaveProperty('url');
      expect((result as any).data).toHaveProperty('state');
    });

    it('AUTH-CTRL-15: should return GitHub OAuth URL', async () => {
      mockAuthService.getGithubAuthUrl.mockReturnValue(
        'https://github.com/login/oauth/authorize?client_id=test',
      );

      const result = await controller.githubAuth({ state: 'test-state' });

      expect((result as any).data).toHaveProperty('url');
      expect((result as any).data).toHaveProperty('state');
    });

    it('AUTH-CTRL-17: should generate random state when not provided', async () => {
      mockAuthService.getGithubAuthUrl.mockReturnValue('https://github.com/login/oauth/authorize');

      const result = await controller.githubAuth({});

      expect((result as any).data).toHaveProperty('state');
      expect((result as any).data.state).toBeTruthy();
    });
  });

  describe('oauth callback', () => {
    it('AUTH-CTRL-18: should return tokens on successful GitHub callback', async () => {
      const tokens = { accessToken: 'token', refreshToken: 'refresh', user: {} };
      mockAuthService.handleGithubCallback.mockResolvedValue(tokens);

      const result = await controller.githubCallback({ code: 'github-code' });

      expect(mockAuthService.handleGithubCallback).toHaveBeenCalledWith('github-code', undefined);
      expect((result as any).data).toEqual(tokens);
    });

    it('AUTH-CTRL-19: should return tokens on successful Google callback', async () => {
      const tokens = { accessToken: 'token', refreshToken: 'refresh', user: {} };
      mockAuthService.handleGoogleCallback.mockResolvedValue(tokens);

      const result = await controller.googleCallback({ code: 'google-code' });

      expect(mockAuthService.handleGoogleCallback).toHaveBeenCalledWith('google-code', undefined);
      expect((result as any).data).toEqual(tokens);
    });

    it('should pass state parameter to GitHub callback', async () => {
      const tokens = { accessToken: 'token', refreshToken: 'refresh', user: {} };
      mockAuthService.handleGithubCallback.mockResolvedValue(tokens);

      await controller.githubCallback({ code: 'github-code', state: 'test-state' });

      expect(mockAuthService.handleGithubCallback).toHaveBeenCalledWith('github-code', 'test-state');
    });
  });

  describe('deleteAccount', () => {
    it('AUTH-CTRL-16: should delete account', async () => {
      mockAuthService.deleteAccount.mockResolvedValue(undefined);

      const result = await controller.deleteAccount('user-1', { password: 'Password123' });

      expect((result as any).message).toBe('Account deleted');
    });

    it('should pass password to service', async () => {
      mockAuthService.deleteAccount.mockResolvedValue(undefined);

      await controller.deleteAccount('user-1', { password: 'Password123' });

      expect(mockAuthService.deleteAccount).toHaveBeenCalledWith('user-1', 'Password123');
    });
  });
});
