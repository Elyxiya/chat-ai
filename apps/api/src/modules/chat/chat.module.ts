import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from '../../gateways/chat.gateway';
import { ChatGatewayService } from '../../gateways/chat-gateway.service';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    UserModule,
    JwtModule.register({}),
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService, ChatGatewayService],
  exports: [ChatService],
})
export class ChatModule {}
