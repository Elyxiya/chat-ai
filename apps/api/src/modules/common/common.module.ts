import { Module, Global } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  providers: [MetricsService, PrismaService],
  exports: [MetricsService, PrismaService],
})
export class CommonModule {}
