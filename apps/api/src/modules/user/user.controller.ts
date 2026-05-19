import { Controller, Get, Patch, Post, Body, Param, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
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
  async getProfile(@Param('userId') userId: string) {
    return success(await this.userService.getProfile(userId));
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser('id') currentUserId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return success(await this.userService.updateProfile(currentUserId, dto));
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiConsumes('multipart/form-data')
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return success(await this.userService.uploadAvatar(userId, file));
  }
}
