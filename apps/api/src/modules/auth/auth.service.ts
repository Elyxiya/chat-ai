import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../config/prisma.service';
import { RedisService } from '../common/redis.service';
import { v4 as uuidv4 } from 'uuid';
import {
  LoginDto,
  RegisterDto,
  AuthTokens,
  UserPayload,
  SendCodeDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly BCRYPT_ROUNDS = 12;
  private readonly CODE_TTL = 300;
  private readonly REFRESH_TTL_DAYS = 7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.username }, { email: dto.email }],
      },
    });
    if (existing) {
      throw new ConflictException('Username or email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash,
        nickname: dto.nickname || dto.username,
      },
    });

    return this.generateTokens(user);
  }

  async validateUser(
    identifier: string,
    password: string,
  ): Promise<UserPayload | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }],
      },
    });

    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      userType: user.userType,
    };
  }

  async login(user: UserPayload): Promise<AuthTokens> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'online', lastSeenAt: new Date() },
    });

    return this.generateTokens(user);
  }

  async refreshTokens(
    refreshToken: string,
  ): Promise<AuthTokens> {
    const tokenHash = await this.hashToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.revokedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const user: UserPayload = {
      id: storedToken.user.id,
      username: storedToken.user.username,
      email: storedToken.user.email,
      nickname: storedToken.user.nickname,
      avatarUrl: storedToken.user.avatarUrl,
      userType: storedToken.user.userType,
    };

    return this.generateTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = await this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  async sendVerificationCode(email: string): Promise<void> {
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    await this.redis.set(`verify:${email}`, code, this.CODE_TTL * 1000);
    console.log(`[DEV] Verification code for ${email}: ${code}`);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const storedCode = await this.redis.get(`verify:${dto.email}`);

    if (!storedCode || storedCode !== dto.code.toUpperCase()) {
      throw new BadRequestException('Invalid verification code');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    await this.redis.del(`verify:${dto.email}`);
  }

  getGithubAuthUrl(state?: string): string {
    const clientId = this.config.get('GITHUB_CLIENT_ID');
    const redirectUri = this.config.get('GITHUB_CALLBACK_URL');
    const stateParam = state ? `&state=${state}` : '';
    return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user,user:email${stateParam}`;
  }

  async handleGithubCallback(code: string, state?: string): Promise<AuthTokens> {
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: this.config.get('GITHUB_CLIENT_ID'),
          client_secret: this.config.get('GITHUB_CLIENT_SECRET'),
          code,
        }),
      },
    ).then((r) => r.json()) as Record<string, string>;

    const accessToken = tokenResponse.access_token;

    const githubUser = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then((r) => r.json()) as Record<string, any>;

    const githubEmail = githubUser.email;
    if (!githubEmail) {
      throw new BadRequestException(
        'GitHub account does not have a public email address. Please make your email public or link an email manually.',
      );
    }

    let user = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider: 'github', providerUserId: String(githubUser.id) } },
      include: { user: true },
    });

    if (!user) {
      user = await this.prisma.oAuthAccount.create({
        data: {
          provider: 'github',
          providerUserId: String(githubUser.id),
          accessToken,
          user: {
            create: {
              username: `github_${githubUser.id}`,
              email: githubEmail,
              passwordHash: await bcrypt.hash(uuidv4(), this.BCRYPT_ROUNDS),
              nickname: githubUser.name || githubUser.login,
              avatarUrl: githubUser.avatar_url,
              userType: 'human',
            },
          },
        },
        include: { user: true },
      });
    }

    return this.generateTokens({
      id: user.user.id,
      username: user.user.username,
      email: user.user.email,
      nickname: user.user.nickname,
      avatarUrl: user.user.avatarUrl,
      userType: user.user.userType,
    });
  }

  getGoogleAuthUrl(state?: string): string {
    const clientId = this.config.get('GOOGLE_CLIENT_ID');
    const redirectUri = this.config.get('GOOGLE_CALLBACK_URL');
    const stateParam = state ? `&state=${state}` : '';
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid email profile${stateParam}`;
  }

  async handleGoogleCallback(code: string, state?: string): Promise<AuthTokens> {
    const tokenResponse = await fetch(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.config.get('GOOGLE_CLIENT_ID') || '',
          client_secret: this.config.get('GOOGLE_CLIENT_SECRET') || '',
          redirect_uri: this.config.get('GOOGLE_CALLBACK_URL') || '',
          grant_type: 'authorization_code',
        }),
      },
    ).then((r) => r.json()) as Record<string, any>;

    const accessToken = tokenResponse.access_token;

    const googleUser = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then((r) => r.json()) as Record<string, any>;

    let user = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider: 'google', providerUserId: googleUser.id } },
      include: { user: true },
    });

    if (!user) {
      user = await this.prisma.oAuthAccount.create({
        data: {
          provider: 'google',
          providerUserId: String(googleUser.id),
          accessToken,
          refreshToken: tokenResponse.refresh_token,
          tokenExpiresAt: tokenResponse.expires_in
            ? new Date(Date.now() + tokenResponse.expires_in * 1000)
            : null,
          user: {
            create: {
              username: `google_${googleUser.id}`,
              email: googleUser.email,
              passwordHash: await bcrypt.hash(uuidv4(), this.BCRYPT_ROUNDS),
              nickname: googleUser.name || googleUser.given_name,
              avatarUrl: googleUser.picture,
              userType: 'human',
            },
          },
        },
        include: { user: true },
      });
    }

    return this.generateTokens({
      id: user.user.id,
      username: user.user.username,
      email: user.user.email,
      nickname: user.user.nickname,
      avatarUrl: user.user.avatarUrl,
      userType: user.user.userType,
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.passwordHash) {
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  async deleteAccount(userId: string, password?: string): Promise<void> {
    if (password) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.passwordHash) {
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) throw new UnauthorizedException('Password is incorrect');
      }
    }
    await this.prisma.user.delete({ where: { id: userId } });
  }

  private async generateTokens(user: UserPayload): Promise<AuthTokens> {
    const payload = { sub: user.id, username: user.username };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = uuidv4();
    const tokenHash = await this.hashToken(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + this.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken, user };
  }

  private async hashToken(token: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
