import { Module } from '@nestjs/common';
import { AdminController, AdminStatsController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController, AdminStatsController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
