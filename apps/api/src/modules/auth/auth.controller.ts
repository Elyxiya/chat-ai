import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Get,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto, SendCodeDto, ResetPasswordDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { Request } from 'express';
import { success } from '../common/result';
import { UserPayload } from './dto/auth.dto';

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
  async githubAuth() {
    return success({ url: this.authService.getGithubAuthUrl() });
  }

  @Post('oauth/github/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  async githubCallback(@Body() body: { code: string }) {
    return success(await this.authService.handleGithubCallback(body.code));
  }
}
