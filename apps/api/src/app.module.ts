import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { AgentModule } from './modules/agent/agent.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { LLMModule } from './modules/llm/llm.module';
import { UserModule } from './modules/user/user.module';
import { CommonModule } from './modules/common/common.module';
import { RedisModule } from './modules/common/redis.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

const ENV_PATH = 'e:\\桌面\\web-txt\\xm\\chat\\new\\new-chat-system\\.env';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [ENV_PATH],
      cache: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_TTL) || 60000,
        limit: Number(process.env.RATE_LIMIT_MAX) || 100,
      },
    ]),
    RedisModule,
    CommonModule,
    AuthModule,
    ChatModule,
    AgentModule,
    KnowledgeModule,
    LLMModule,
    UserModule,
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