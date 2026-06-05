import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MinioService } from './minio.service';

// Mock Minio client
const mockMinioClient = {
  bucketExists: jest.fn(),
  makeBucket: jest.fn(),
  putObject: jest.fn(),
  getObject: jest.fn(),
  statObject: jest.fn(),
  removeObject: jest.fn(),
  presignedGetObject: jest.fn(),
};

jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => mockMinioClient),
}));

describe('MinioService', () => {
  let service: MinioService;
  let mockConfig: any;

  beforeEach(async () => {
    mockConfig = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          MINIO_ENDPOINT: 'localhost',
          MINIO_PORT: '9000',
          MINIO_USE_SSL: 'false',
          MINIO_ACCESS_KEY: 'minioadmin',
          MINIO_SECRET_KEY: 'minioadmin',
          MINIO_BUCKET: 'minichat-files',
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinioService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<MinioService>(MinioService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('MINIO-01: should create Minio client with config values', () => {
      expect(mockConfig.get).toHaveBeenCalledWith('MINIO_ENDPOINT', 'localhost');
      expect(mockConfig.get).toHaveBeenCalledWith('MINIO_PORT', '9000');
      expect(mockConfig.get).toHaveBeenCalledWith('MINIO_ACCESS_KEY', 'minioadmin');
    });
  });

  describe('onModuleInit', () => {
    it('MINIO-02: should create bucket if it does not exist', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(false);
      mockMinioClient.makeBucket.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(mockMinioClient.bucketExists).toHaveBeenCalledWith('minichat-files');
      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith('minichat-files', 'us-east-1');
    });

    it('MINIO-03: should not create bucket if it already exists', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(true);

      await service.onModuleInit();

      expect(mockMinioClient.makeBucket).not.toHaveBeenCalled();
    });

    it('MINIO-04: should handle initialization errors gracefully', async () => {
      mockMinioClient.bucketExists.mockRejectedValue(new Error('Connection refused'));

      // Should not throw
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('uploadFile', () => {
    it('MINIO-05: should upload buffer with content type', async () => {
      mockMinioClient.putObject.mockResolvedValue(undefined);

      const buffer = Buffer.from('test data');
      const result = await service.uploadFile(buffer, 'uploads/test.txt', 'text/plain');

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'minichat-files',
        'uploads/test.txt',
        buffer,
        buffer.length,
        { 'Content-Type': 'text/plain' },
      );
      expect(result.objectName).toBe('uploads/test.txt');
      expect(result.url).toContain('/api/v1/upload/file/download');
    });

    it('MINIO-06: should use default content type when not specified', async () => {
      mockMinioClient.putObject.mockResolvedValue(undefined);

      const buffer = Buffer.from('data');
      await service.uploadFile(buffer, 'file.bin');

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'minichat-files',
        'file.bin',
        buffer,
        buffer.length,
        { 'Content-Type': 'application/octet-stream' },
      );
    });
  });

  describe('getFileStream', () => {
    it('MINIO-07: should return stream and mime type from stat', async () => {
      const mockStream = { on: jest.fn() };
      mockMinioClient.getObject.mockResolvedValue(mockStream);
      mockMinioClient.statObject.mockResolvedValue({
        metaData: { 'content-type': 'image/png' },
      });

      const result = await service.getFileStream('images/test.png');

      expect(result.stream).toBe(mockStream);
      expect(result.mimeType).toBe('image/png');
    });

    it('MINIO-08: should return stream without mime type when stat has no content-type', async () => {
      const mockStream = { on: jest.fn() };
      mockMinioClient.getObject.mockResolvedValue(mockStream);
      mockMinioClient.statObject.mockResolvedValue({ metaData: {} });

      const result = await service.getFileStream('test.bin');

      expect(result.mimeType).toBeUndefined();
    });

    it('MINIO-09: should throw when file not found', async () => {
      mockMinioClient.getObject.mockRejectedValue(new Error('Not found'));

      await expect(service.getFileStream('nonexistent')).rejects.toThrow('Not found');
    });
  });

  describe('deleteFile', () => {
    it('MINIO-10: should remove object from bucket', async () => {
      mockMinioClient.removeObject.mockResolvedValue(undefined);

      await service.deleteFile('uploads/test.txt');

      expect(mockMinioClient.removeObject).toHaveBeenCalledWith('minichat-files', 'uploads/test.txt');
    });
  });

  describe('getFileUrl', () => {
    it('MINIO-11: should return presigned URL', async () => {
      mockMinioClient.presignedGetObject.mockResolvedValue('https://minio.example.com/presigned-url');

      const result = await service.getFileUrl('uploads/test.txt');

      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        'minichat-files',
        'uploads/test.txt',
        24 * 60 * 60,
      );
      expect(result).toBe('https://minio.example.com/presigned-url');
    });
  });

  describe('fileExists', () => {
    it('MINIO-12: should return true when file exists', async () => {
      mockMinioClient.statObject.mockResolvedValue({});

      const result = await service.fileExists('uploads/test.txt');

      expect(result).toBe(true);
    });

    it('MINIO-13: should return false when file does not exist', async () => {
      mockMinioClient.statObject.mockRejectedValue(new Error('Not found'));

      const result = await service.fileExists('nonexistent');

      expect(result).toBe(false);
    });
  });
});
