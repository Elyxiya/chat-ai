import { PrismaClient } from '@prisma/client';
import { INestApplication, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

export const PRISMA_CLIENT = 'PRISMA_CLIENT';

export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    console.log('PostgreSQL connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    // no-op: shutdown hooks handled via onModuleDestroy
  }
}
