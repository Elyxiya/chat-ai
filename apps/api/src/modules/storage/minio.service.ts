import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';

export interface UploadResult {
  url: string;
  objectName: string;
  bucket: string;
}

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Minio.Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    const endPoint = this.config.get('MINIO_ENDPOINT', 'localhost');
    const port = Number(this.config.get('MINIO_PORT', '9000'));
    const useSSL = this.config.get('MINIO_USE_SSL', 'false') === 'true';
    const accessKey = this.config.get('MINIO_ACCESS_KEY', 'minioadmin');
    const secretKey = this.config.get('MINIO_SECRET_KEY', 'minioadmin');
    this.bucket = this.config.get('MINIO_BUCKET', 'minichat-files');

    this.client = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });

    const protocol = useSSL ? 'https' : 'http';
    const consolePort = Number(this.config.get('MINIO_CONSOLE', '9001'));
    this.publicUrl = `${protocol}://${endPoint}:${consolePort}/api/v1/buckets/${this.bucket}/objects/download`;
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`Created bucket: ${this.bucket}`);
      }
    } catch (error: any) {
      this.logger.warn(`Cannot initialize MinIO bucket: ${error.message}. File uploads will fail.`);
    }
  }

  async uploadFile(
    buffer: Buffer,
    objectName: string,
    mimeType?: string,
  ): Promise<UploadResult> {
    await this.client.putObject(this.bucket, objectName, buffer, buffer.length, {
      'Content-Type': mimeType || 'application/octet-stream',
    });

    const url = `${this.publicUrl}/${objectName}`;
    return { url, objectName, bucket: this.bucket };
  }

  async deleteFile(objectName: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectName);
  }

  async getFileUrl(objectName: string): Promise<string> {
    const url = await this.client.presignedGetObject(this.bucket, objectName, 24 * 60 * 60);
    return url;
  }

  async fileExists(objectName: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, objectName);
      return true;
    } catch {
      return false;
    }
  }
}
