import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { MinioService } from '../storage/minio.service';
import { UpdateProfileDto } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

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

  async updateStatus(userId: string, status: string) {
    const validStatuses = ['online', 'offline', 'away', 'busy', 'invisible'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status. Must be one of: ' + validStatuses.join(', '));
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, username: true, status: true },
    });
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
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    const ext = file.originalname.split('.').pop() || 'png';
    const objectName = `avatars/${userId}/${Date.now()}.${ext}`;

    const result = await this.minio.uploadFile(file.buffer, objectName, file.mimetype);

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: result.url },
    });

    return { avatarUrl: result.url };
  }
}
