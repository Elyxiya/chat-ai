import { Module } from '@nestjs/common';
import { ChatGateway } from '../../gateways/chat.gateway';
import { ChatGatewayService } from '../../gateways/chat-gateway.service';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    UserModule,
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService, ChatGatewayService],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
