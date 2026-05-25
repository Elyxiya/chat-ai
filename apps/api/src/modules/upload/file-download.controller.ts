import { Controller, Get, Query, Res, BadRequestException, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { MinioService } from '../storage/minio.service';

@Controller({ path: 'upload', version: '1' })
export class FileDownloadController {
  constructor(private readonly minio: MinioService) {}

  @Get('file/download')
  async downloadFile(
    @Query('path') path: string,
    @Res() res: Response,
  ) {
    if (!path) throw new BadRequestException('path query parameter is required');
    try {
      const { stream, mimeType } = await this.minio.getFileStream(path);
      if (mimeType) {
        res.setHeader('Content-Type', mimeType);
      }
      stream.pipe(res);
    } catch {
      throw new NotFoundException('File not found');
    }
  }
}
