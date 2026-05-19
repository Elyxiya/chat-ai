import { Module, Global } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { RedisService } from '../common/redis.service';

@Global()
@Module({
  providers: [PrismaService, RedisService],
  exports: [PrismaService, RedisService],
})
export class CommonModule {}
