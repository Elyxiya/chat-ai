import { Controller, Get, Patch, Post, Body, Param, UseGuards, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/user.dto';
import { success } from '../common/result';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':userId')
  @ApiOperation({ summary: '获取指定用户的公开资料' })
  async getProfile(@Param('userId') userId: string) {
    return success(await this.userService.getProfile(userId));
  }

  @Get('profile/me')
  @ApiOperation({ summary: '获取当前登录用户的个人资料' })
  async getMyProfile(@CurrentUser('id') userId: string) {
    return success(await this.userService.getProfile(userId));
  }

  @Patch('profile')
  @ApiOperation({ summary: '更新当前用户的个人资料' })
  async updateProfile(
    @CurrentUser('id') currentUserId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return success(await this.userService.updateProfile(currentUserId, dto));
  }

  @Patch('status')
  @ApiOperation({ summary: '更新用户在线状态' })
  async updateStatus(
    @CurrentUser('id') userId: string,
    @Body() body: { status: string },
  ) {
    return success(await this.userService.updateStatus(userId, body.status));
  }

  @Post('avatar')
  @ApiOperation({ summary: '上传头像（multipart/form-data，限制 5MB）' })
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return success(await this.userService.uploadAvatar(userId, file));
  }
}
