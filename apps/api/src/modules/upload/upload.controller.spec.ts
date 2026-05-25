import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { FileDownloadController } from './file-download.controller';
import { UploadService } from './upload.service';
import { MinioService } from '../storage/minio.service';
import { PrismaService } from '../../config/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('UploadController', () => {
  let controller: UploadController;
  let mockUploadService: any;

  beforeEach(async () => {
    mockUploadService = {
      uploadFile: jest.fn(),
      uploadImage: jest.fn(),
      getUserFiles: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [{ provide: UploadService, useValue: mockUploadService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UploadController>(UploadController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /upload/file', () => {
    it('should upload a file and return file info', async () => {
      const mockFile = {
        originalname: 'test.txt',
        size: 1024,
        mimetype: 'text/plain',
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      const mockResult = {
        id: 'file-1',
        fileName: 'test.txt',
        fileSize: 1024,
        mimeType: 'text/plain',
        url: '/api/v1/upload/file/download?path=test',
        createdAt: new Date(),
      };
      mockUploadService.uploadFile.mockResolvedValue(mockResult);

      const result = await controller.uploadFile({ user: { id: 'user-1' } } as any, mockFile, { description: 'Test file' });

      expect(mockUploadService.uploadFile).toHaveBeenCalledWith('user-1', mockFile, 'Test file');
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException when no file', async () => {
      await expect(
        controller.uploadFile({ user: { id: 'user-1' } } as any, undefined as any, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /upload/image', () => {
    it('should upload an image file', async () => {
      const mockImage = {
        originalname: 'photo.png',
        size: 2048,
        mimetype: 'image/png',
        buffer: Buffer.from('image-data'),
      } as Express.Multer.File;

      const mockResult = {
        id: 'img-1',
        fileName: 'photo.png',
        fileSize: 2048,
        mimeType: 'image/png',
        url: '/api/v1/upload/file/download?path=img',
        createdAt: new Date(),
      };
      mockUploadService.uploadImage.mockResolvedValue(mockResult);

      const result = await controller.uploadImage({ user: { id: 'user-1' } } as any, mockImage);

      expect(mockUploadService.uploadImage).toHaveBeenCalledWith('user-1', mockImage);
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException when no image file', async () => {
      await expect(
        controller.uploadImage({ user: { id: 'user-1' } } as any, undefined as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /upload/files', () => {
    it('should list user files with default pagination', async () => {
      const mockResult = { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
      mockUploadService.getUserFiles.mockResolvedValue(mockResult);

      const result = await controller.listFiles({ user: { id: 'user-1' } } as any, undefined, undefined);

      expect(mockUploadService.getUserFiles).toHaveBeenCalledWith('user-1', 1, 20);
      expect(result).toEqual(mockResult);
    });

    it('should list user files with custom pagination', async () => {
      const mockResult = { items: [], total: 0, page: 2, pageSize: 10, totalPages: 0 };
      mockUploadService.getUserFiles.mockResolvedValue(mockResult);

      const result = await controller.listFiles({ user: { id: 'user-1' } } as any, '2', '10');

      expect(mockUploadService.getUserFiles).toHaveBeenCalledWith('user-1', 2, 10);
      expect(result).toEqual(mockResult);
    });
  });

  describe('DELETE /upload/files/:id', () => {
    it('should delete a file', async () => {
      mockUploadService.deleteFile.mockResolvedValue(undefined);

      const result = await controller.deleteFile({ user: { id: 'user-1' } } as any, 'file-1');

      expect(mockUploadService.deleteFile).toHaveBeenCalledWith('user-1', 'file-1');
      expect(result).toEqual({ message: 'File deleted' });
    });
  });
});

describe('FileDownloadController', () => {
  let controller: FileDownloadController;
  let mockMinio: any;
  let mockPrisma: any;
  let mockResponse: any;

  beforeEach(async () => {
    mockMinio = {
      getFileStream: jest.fn(),
    };

    mockPrisma = {
      fileUpload: { findUnique: jest.fn() },
    };

    mockResponse = {
      setHeader: jest.fn(),
      pipe: jest.fn(),
    };

    // FileDownloadController doesn't use @UseGuards, so we test it directly
    controller = new FileDownloadController(mockMinio as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /upload/file/download', () => {
    it('should throw BadRequestException when path is missing', async () => {
      await expect(
        controller.downloadFile('', mockResponse as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should stream file when path is valid', async () => {
      const mockStream = { pipe: jest.fn() };
      mockMinio.getFileStream.mockResolvedValue({ stream: mockStream, mimeType: 'text/plain' });

      await controller.downloadFile('uploads/test.txt', mockResponse as any);

      expect(mockMinio.getFileStream).toHaveBeenCalledWith('uploads/test.txt');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
      expect(mockStream.pipe).toHaveBeenCalledWith(mockResponse);
    });

    it('should stream file without mimeType when not provided', async () => {
      const mockStream = { pipe: jest.fn() };
      mockMinio.getFileStream.mockResolvedValue({ stream: mockStream, mimeType: undefined });

      await controller.downloadFile('uploads/test.bin', mockResponse as any);

      expect(mockResponse.setHeader).not.toHaveBeenCalled();
      expect(mockStream.pipe).toHaveBeenCalledWith(mockResponse);
    });

    it('should throw NotFoundException when file not found in MinIO', async () => {
      mockMinio.getFileStream.mockRejectedValue(new Error('Not found'));

      await expect(
        controller.downloadFile('nonexistent', mockResponse as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
