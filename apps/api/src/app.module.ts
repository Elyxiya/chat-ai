import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import * as path from 'path';
import { existsSync } from 'fs';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { AgentModule } from './modules/agent/agent.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { LLMModule } from './modules/llm/llm.module';
import { UserModule } from './modules/user/user.module';
import { CommonModule } from './modules/common/common.module';
import { RedisModule } from './modules/common/redis.module';
import { NotificationModule } from './modules/notification/notification.module';
import { StorageModule } from './modules/storage/storage.module';
import { UploadModule } from './modules/upload/upload.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

const ENV_PATH = path.join(__dirname, '..', '..', '..', '.env');

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: existsSync(ENV_PATH) ? [ENV_PATH] : [],
      cache: true,
    }),
    RedisModule,
    CommonModule,
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_TTL) || 60000,
        limit: Number(process.env.RATE_LIMIT_MAX) || 100,
      },
    ]),
    AuthModule,
    ChatModule,
    AgentModule,
    KnowledgeModule,
    LLMModule,
    UserModule,
    UploadModule,
    NotificationModule,
    StorageModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}