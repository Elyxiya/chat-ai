import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Body,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { UploadService } from './upload.service';
import { UploadFileDto } from './dto/upload.dto';

@Controller('api/v1/upload')
@UseGuards(AuthGuard('jwt'))
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('file')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async uploadFile(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.uploadService.uploadFile(req.user.id, file, dto.description);
  }

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadImage(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.uploadService.uploadImage(req.user.id, file);
  }

  @Get('files')
  async listFiles(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.uploadService.getUserFiles(
      req.user.id,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  @Delete('files/:id')
  async deleteFile(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.uploadService.deleteFile(req.user.id, id);
    return { message: 'File deleted' };
  }
}
