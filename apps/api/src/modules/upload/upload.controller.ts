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
  Res,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { UploadFileDto } from './dto/upload.dto';

@ApiTags('Upload')
@ApiBearerAuth()
@Controller({ path: 'upload', version: '1' })
@UseGuards(AuthGuard('jwt'))
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('file')
  @ApiOperation({ summary: '上传文件（最大 50MB，multipart/form-data）' })
  @ApiConsumes('multipart/form-data')
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
  @ApiOperation({ summary: '上传图片（最大 10MB，自动生成缩略图）' })
  @ApiConsumes('multipart/form-data')
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
  @ApiOperation({ summary: '获取当前用户的上传文件列表（分页）' })
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

  @Get('files/:id')
  @ApiOperation({ summary: '获取文件详情' })
  async getFileInfo(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.uploadService.getFileInfo(req.user.id, id);
  }

  @Get('files/:id/download')
  @ApiOperation({ summary: '下载文件流' })
  async downloadFile(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: any,
  ) {
    const { stream, fileName, mimeType } = await this.uploadService.downloadFile(req.user.id, id);
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    stream.pipe(res);
  }

  @Delete('files/:id')
  @ApiOperation({ summary: '删除已上传的文件' })
  async deleteFile(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.uploadService.deleteFile(req.user.id, id);
    return { message: 'File deleted' };
  }
}
