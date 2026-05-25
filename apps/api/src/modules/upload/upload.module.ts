import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { FileDownloadController } from './file-download.controller';
import { UploadService } from './upload.service';
import { PrismaService } from '../../config/prisma.service';

@Module({
  controllers: [UploadController, FileDownloadController],
  providers: [UploadService, PrismaService],
  exports: [UploadService],
})
export class UploadModule {}
