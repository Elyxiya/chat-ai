import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';
import { MinioService } from '../storage/minio.service';
import { PrismaService } from '../../config/prisma.service';

describe('UploadService', () => {
  let service: UploadService;
  let mockPrisma: any;
  let mockMinio: any;

  beforeEach(async () => {
    mockPrisma = {
      fileUpload: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    mockMinio = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MinioService, useValue: mockMinio },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    const mockFile = {
      originalname: 'test.txt',
      size: 1024,
      mimetype: 'text/plain',
      buffer: Buffer.from('test content'),
    } as Express.Multer.File;

    it('UPLOAD-SVC-01: should upload file and create database record', async () => {
      const mockMinioResult = { url: '/api/v1/upload/file/download?path=obj', objectName: 'uploads/user-1/obj' };
      const mockDbRecord = {
        id: 'file-1',
        uploaderId: 'user-1',
        fileName: 'test.txt',
        fileSize: 1024,
        mimeType: 'text/plain',
        storagePath: 'uploads/user-1/obj',
        storageUrl: mockMinioResult.url,
        createdAt: new Date(),
      };

      mockMinio.uploadFile.mockResolvedValue(mockMinioResult);
      mockPrisma.fileUpload.create.mockResolvedValue(mockDbRecord);

      const result = await service.uploadFile('user-1', mockFile, 'A test file');

      expect(mockMinio.uploadFile).toHaveBeenCalled();
      expect(mockPrisma.fileUpload.create).toHaveBeenCalledWith({
        data: {
          uploaderId: 'user-1',
          fileName: 'test.txt',
          fileSize: 1024,
          mimeType: 'text/plain',
          storagePath: expect.any(String),
          storageUrl: mockMinioResult.url,
        },
      });
      expect(result.id).toBe('file-1');
      expect(result.url).toBe(mockMinioResult.url);
    });

    it('UPLOAD-SVC-02: should throw BadRequestException when file is null', async () => {
      await expect(service.uploadFile('user-1', null as any)).rejects.toThrow(BadRequestException);
    });

    it('UPLOAD-SVC-03: should handle files without description', async () => {
      mockMinio.uploadFile.mockResolvedValue({ url: 'url', objectName: 'obj' });
      mockPrisma.fileUpload.create.mockResolvedValue({
        id: 'file-1',
        fileName: 'test.txt',
        fileSize: 1024,
        mimeType: 'text/plain',
        storageUrl: 'url',
        createdAt: new Date(),
      });

      const result = await service.uploadFile('user-1', mockFile);

      expect(result.fileName).toBe('test.txt');
    });

    it('UPLOAD-SVC-04: should handle file with no extension', async () => {
      const noExtFile = { ...mockFile, originalname: 'noext' };
      mockMinio.uploadFile.mockResolvedValue({ url: 'url', objectName: 'uploads/user-1/obj' });
      mockPrisma.fileUpload.create.mockResolvedValue({
        id: 'file-1',
        fileName: 'noext',
        fileSize: 1024,
        mimeType: 'text/plain',
        storageUrl: 'url',
        createdAt: new Date(),
      });

      const result = await service.uploadFile('user-1', noExtFile);

      expect(result.fileName).toBe('noext');
    });
  });

  describe('uploadImage', () => {
    const mockImage = {
      originalname: 'photo.png',
      size: 2048,
      mimetype: 'image/png',
      buffer: Buffer.from('image-data'),
    } as Express.Multer.File;

    it('UPLOAD-SVC-05: should upload image and create database record', async () => {
      mockMinio.uploadFile.mockResolvedValue({ url: '/api/v1/upload/file/download?path=img', objectName: 'images/user-1/img' });
      mockPrisma.fileUpload.create.mockResolvedValue({
        id: 'img-1',
        fileName: 'photo.png',
        fileSize: 2048,
        mimeType: 'image/png',
        storageUrl: '/api/v1/upload/file/download?path=img',
        createdAt: new Date(),
      });

      const result = await service.uploadImage('user-1', mockImage);

      expect(mockMinio.uploadFile).toHaveBeenCalled();
      expect(result.fileName).toBe('photo.png');
    });

    it('UPLOAD-SVC-06: should throw BadRequestException when file is null', async () => {
      await expect(service.uploadImage('user-1', null as any)).rejects.toThrow(BadRequestException);
    });

    it('UPLOAD-SVC-07: should throw BadRequestException when file is not an image', async () => {
      const nonImage = { ...mockImage, mimetype: 'application/pdf' };

      await expect(service.uploadImage('user-1', nonImage)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserFiles', () => {
    it('UPLOAD-SVC-08: should return paginated user files', async () => {
      const mockFiles = [
        { id: 'f1', fileName: 'a.txt', fileSize: 100, mimeType: 'text/plain', storageUrl: 'url1', createdAt: new Date() },
        { id: 'f2', fileName: 'b.txt', fileSize: 200, mimeType: 'text/plain', storageUrl: 'url2', createdAt: new Date() },
      ];
      mockPrisma.fileUpload.findMany.mockResolvedValue(mockFiles);
      mockPrisma.fileUpload.count.mockResolvedValue(2);

      const result = await service.getUserFiles('user-1', 1, 20);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('UPLOAD-SVC-09: should return empty list when user has no files', async () => {
      mockPrisma.fileUpload.findMany.mockResolvedValue([]);
      mockPrisma.fileUpload.count.mockResolvedValue(0);

      const result = await service.getUserFiles('user-1');

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('UPLOAD-SVC-10: should use default pagination when not specified', async () => {
      mockPrisma.fileUpload.findMany.mockResolvedValue([]);
      mockPrisma.fileUpload.count.mockResolvedValue(0);

      await service.getUserFiles('user-1');

      expect(mockPrisma.fileUpload.findMany).toHaveBeenCalledWith({
        where: { uploaderId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('UPLOAD-SVC-11: should calculate pagination correctly for page 2', async () => {
      const mockFiles = Array(5).fill(null).map((_, i) => ({
        id: `f${i}`,
        fileName: `file${i}.txt`,
        fileSize: 100,
        mimeType: 'text/plain',
        storageUrl: `url${i}`,
        createdAt: new Date(),
      }));
      mockPrisma.fileUpload.findMany.mockResolvedValue(mockFiles);
      mockPrisma.fileUpload.count.mockResolvedValue(25);

      const result = await service.getUserFiles('user-1', 2, 10);

      expect(mockPrisma.fileUpload.findMany).toHaveBeenCalledWith({
        where: { uploaderId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      });
      expect(result.totalPages).toBe(3);
    });
  });

  describe('deleteFile', () => {
    it('UPLOAD-SVC-12: should delete file from storage and database', async () => {
      const mockFile = { id: 'file-1', uploaderId: 'user-1', storagePath: 'uploads/user-1/obj' };
      mockPrisma.fileUpload.findUnique.mockResolvedValue(mockFile);
      mockMinio.deleteFile.mockResolvedValue(undefined);
      mockPrisma.fileUpload.delete.mockResolvedValue(mockFile);

      await service.deleteFile('user-1', 'file-1');

      expect(mockMinio.deleteFile).toHaveBeenCalledWith('uploads/user-1/obj');
      expect(mockPrisma.fileUpload.delete).toHaveBeenCalledWith({ where: { id: 'file-1' } });
    });

    it('UPLOAD-SVC-13: should throw BadRequestException when file not found', async () => {
      mockPrisma.fileUpload.findUnique.mockResolvedValue(null);

      await expect(service.deleteFile('user-1', 'nonexistent')).rejects.toThrow(BadRequestException);
    });

    it('UPLOAD-SVC-14: should throw BadRequestException when user is not the uploader', async () => {
      const mockFile = { id: 'file-1', uploaderId: 'other-user', storagePath: 'path' };
      mockPrisma.fileUpload.findUnique.mockResolvedValue(mockFile);

      await expect(service.deleteFile('user-2', 'file-1')).rejects.toThrow(BadRequestException);
    });
  });
});
