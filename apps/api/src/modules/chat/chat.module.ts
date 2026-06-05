import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ChatGateway } from '../../gateways/chat.gateway';
import { ChatGatewayService } from '../../gateways/chat-gateway.service';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatQueueService } from './chat-queue.service';
import { ChatQueueProcessor } from './chat-queue.processor';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    UserModule,
    forwardRef(() => NotificationModule),
    BullModule.registerQueue({
      name: 'chat:messages',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    }),
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService, ChatGatewayService, ChatQueueService, ChatQueueProcessor],
  exports: [ChatService, ChatGateway, ChatQueueService],
})
export class ChatModule {}
