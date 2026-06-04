import { PrismaClient } from '@prisma/client';
import { INestApplication, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';

export const PRISMA_CLIENT = 'PRISMA_CLIENT';

export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('PostgreSQL connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(_app: INestApplication) {
    // no-op: shutdown hooks handled via onModuleDestroy
  }
}
