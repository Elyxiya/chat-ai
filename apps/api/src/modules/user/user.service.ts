import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { UpdateProfileDto } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        bio: true,
        userType: true,
        status: true,
        lastSeenAt: true,
        createdAt: true,
        _count: { select: { friendships: { where: { status: 'accepted' } }, sentMessages: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: dto.nickname,
        bio: dto.bio,
        avatarUrl: dto.avatarUrl,
      },
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        bio: true,
      },
    });
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
    return { avatarUrl };
  }
}
