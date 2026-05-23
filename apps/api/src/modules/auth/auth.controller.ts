import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto, RegisterDto, RefreshTokenDto, SendCodeDto, ResetPasswordDto, ChangePasswordDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { Request } from 'express';
import { success } from '../common/result';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register new user' })
  async register(@Body() dto: RegisterDto) {
    return success(await this.authService.register(dto));
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with username/email and password' })
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.identifier, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return success(await this.authService.login(user));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return success(await this.authService.refreshTokens(dto.refreshToken));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
    return success(null, 'Logged out successfully');
  }

  @Post('send-code')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Send email verification code' })
  async sendCode(@Body() dto: SendCodeDto) {
    await this.authService.sendVerificationCode(dto.email);
    return success(null, 'Verification code sent');
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with verification code' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return success(null, 'Password reset successfully');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user info' })
  async me(@Req() req: Request) {
    return success(req.user);
  }

  @Post('oauth/github')
  @ApiOperation({ summary: 'Initiate GitHub OAuth flow' })
  async githubAuth(@Body() body: { state?: string }) {
    const state = body.state || crypto.randomBytes(16).toString('hex');
    return success({ url: this.authService.getGithubAuthUrl(state), state });
  }

  @Post('oauth/github/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  async githubCallback(@Body() body: { code: string; state?: string }) {
    return success(await this.authService.handleGithubCallback(body.code, body.state));
  }

  @Post('oauth/google')
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  async googleAuth(@Body() body: { state?: string }) {
    const state = body.state || crypto.randomBytes(16).toString('hex');
    return success({ url: this.authService.getGoogleAuthUrl(state), state });
  }

  @Post('oauth/google/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(@Body() body: { code: string; state?: string }) {
    return success(await this.authService.handleGoogleCallback(body.code, body.state));
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change current password' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(userId, dto.currentPassword, dto.newPassword);
    return success(null, 'Password changed successfully');
  }

  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete account (requires password confirmation)' })
  async deleteAccount(
    @CurrentUser('id') userId: string,
    @Body() body: { password: string },
  ) {
    await this.authService.deleteAccount(userId, body.password);
    return success(null, 'Account deleted');
  }
}
