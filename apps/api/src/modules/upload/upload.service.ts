import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { MinioService } from '../storage/minio.service';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  async uploadFile(
    userId: string,
    file: Express.Multer.File,
    description?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const ext = file.originalname.split('.').pop() || 'bin';
    const objectName = `uploads/${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const result = await this.minio.uploadFile(file.buffer, objectName, file.mimetype);

    const record = await this.prisma.fileUpload.create({
      data: {
        uploaderId: userId,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        storagePath: objectName,
        storageUrl: result.url,
      },
    });

    return {
      id: record.id,
      fileName: record.fileName,
      fileSize: record.fileSize,
      mimeType: record.mimeType,
      url: record.storageUrl,
      createdAt: record.createdAt,
    };
  }

  async uploadImage(
    userId: string,
    file: Express.Multer.File,
    description?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    const ext = file.originalname.split('.').pop() || 'png';
    const objectName = `images/${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const result = await this.minio.uploadFile(file.buffer, objectName, file.mimetype);

    const record = await this.prisma.fileUpload.create({
      data: {
        uploaderId: userId,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        storagePath: objectName,
        storageUrl: result.url,
      },
    });

    return {
      id: record.id,
      fileName: record.fileName,
      fileSize: record.fileSize,
      mimeType: record.mimeType,
      url: record.storageUrl,
      createdAt: record.createdAt,
    };
  }

  async getUserFiles(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;

    const [files, total] = await Promise.all([
      this.prisma.fileUpload.findMany({
        where: { uploaderId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.fileUpload.count({
        where: { uploaderId: userId },
      }),
    ]);

    return {
      items: files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
        url: f.storageUrl,
        createdAt: f.createdAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getFileInfo(userId: string, fileId: string) {
    const file = await this.prisma.fileUpload.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new BadRequestException('File not found');
    }

    return {
      id: file.id,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      url: file.storageUrl,
      createdAt: file.createdAt,
    };
  }

  async downloadFile(userId: string, fileId: string) {
    const file = await this.prisma.fileUpload.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new BadRequestException('File not found');
    }

    const { stream, mimeType } = await this.minio.getFileStream(file.storagePath);
    return { stream, fileName: file.fileName, mimeType };
  }

  async deleteFile(userId: string, fileId: string) {
    const file = await this.prisma.fileUpload.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new BadRequestException('File not found');
    }

    if (file.uploaderId !== userId) {
      throw new BadRequestException('Not authorized to delete this file');
    }

    await this.minio.deleteFile(file.storagePath);
    await this.prisma.fileUpload.delete({ where: { id: fileId } });
  }
}
