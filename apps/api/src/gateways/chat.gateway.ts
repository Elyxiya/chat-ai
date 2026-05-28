import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatGatewayService } from './chat-gateway.service';

export enum WsMessageType {
  LOGIN = 0,
  PING = 1,
  TEXT = 2,
  IMAGE = 3,
  FILE = 4,
  AUDIO = 5,
  VIDEO = 6,
  RECALL = 7,
  TYPING = 8,
  AT = 9,
  READ = 10,
  NOTICE = 11,
  AI_CHAT = 12,
}

export interface WsIncomingMessage {
  type: WsMessageType;
  data: any;
  timestamp?: number;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private userSockets = new Map<string, Set<string>>();

  constructor(private readonly chatGatewayService: ChatGatewayService) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      const user = await this.chatGatewayService.authenticate(token);

      if (!user) {
        this.logger.warn(`Unauthorized connection attempt from ${client.id}`);
        client.emit('error', { message: 'Unauthorized' });
        client.disconnect();
        return;
      }

      client.data.user = user;

      const existing = this.userSockets.get(user.id);
      if (existing) {
        existing.add(client.id);
      } else {
        this.userSockets.set(user.id, new Set([client.id]));
      }

      await this.chatGatewayService.setUserOnline(user.id);
      this.server.emit('presence', { userId: user.id, status: 'online' });

      client.emit('connected', { userId: user.id, sessionId: client.id });
      this.logger.log(`User ${user.username} connected (${client.id})`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const user = client.data.user as any;
    if (!user) return;

    const sockets = this.userSockets.get(user.id);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSockets.delete(user.id);
        await this.chatGatewayService.setUserOffline(user.id);
        this.server.emit('presence', { userId: user.id, status: 'offline' });
      }
    }

    this.logger.log(`User ${user.username} disconnected (${client.id})`);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: Date.now() });
  }

  @SubscribeMessage('message')
  async handleMessage(
    @MessageBody() payload: WsIncomingMessage,
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as any;
    if (!user) return;

    switch (payload.type) {
      case WsMessageType.TEXT:
      case WsMessageType.IMAGE:
      case WsMessageType.FILE:
      case WsMessageType.AUDIO:
      case WsMessageType.VIDEO: {
        const { sessionId, content, metadata, mentions, replyToId } = payload.data;
        const message = await this.chatGatewayService.sendMessage(
          user.id,
          sessionId,
          { content, contentType: WsMessageType[payload.type].toLowerCase(), metadata, mentions, replyToId },
        );

        this.server.to(`session:${sessionId}`).emit('message', message);

        if (mentions?.length) {
          for (const mentionedId of mentions) {
            const userSocks = this.userSockets.get(mentionedId);
            if (userSocks) {
              userSocks.forEach((socketId) => {
                this.server.to(socketId).emit('mention', { message, mentionedBy: user.username });
              });
            }
          }
        }
        break;
      }

      case WsMessageType.TYPING: {
        const { sessionId, isTyping } = payload.data;
        const room = `session:${sessionId}`;
        client.to(room).emit('typing', { userId: user.id, username: user.username, isTyping });
        break;
      }

      case WsMessageType.RECALL: {
        const { messageId } = payload.data;
        await this.chatGatewayService.recallMessage(user.id, messageId);

        const msg = await this.chatGatewayService.getMessageById(messageId);
        if (msg) {
          this.server.to(`session:${msg.sessionId}`).emit('message_recalled', { messageId, recalledBy: user.id });
        }
        break;
      }

      case WsMessageType.READ: {
        const { sessionId, lastMessageId } = payload.data;
        await this.chatGatewayService.markRead(user.id, sessionId, lastMessageId);
        client.to(`session:${sessionId}`).emit('read_receipt', {
          userId: user.id,
          sessionId,
          lastMessageId,
        });
        break;
      }

      case WsMessageType.AI_CHAT: {
        const { sessionId, content } = payload.data;
        client.to(`session:${sessionId}`).emit('ai_typing', { sessionId });

        let fullResponse = '';
        const stream = await this.chatGatewayService.streamAIResponse(user.id, content);

        for await (const chunk of stream) {
          fullResponse += chunk;
          client.emit('ai_chunk', { sessionId, content: chunk });
        }

        const aiMessage = await this.chatGatewayService.sendMessage(
          user.id,
          sessionId,
          { content: fullResponse, contentType: 'ai_response', metadata: { source: 'deepseek' } },
        );

        this.server.to(`session:${sessionId}`).emit('message', aiMessage);
        client.emit('ai_done', { sessionId, messageId: aiMessage.id });
        break;
      }
    }
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(
    @MessageBody() data: { messageId: string; sessionId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as any;
    if (!user) return;

    try {
      const updated = await this.chatGatewayService.editMessage(user.id, data.messageId, data.content);
      this.server.to(`session:${data.sessionId}`).emit('message_edited', {
        messageId: data.messageId,
        sessionId: data.sessionId,
        content: updated.content,
        editCount: updated.editCount,
        editedBy: user.id,
        updatedAt: updated.updatedAt,
      });
    } catch (err: any) {
      client.emit('error', { message: err.message || 'Failed to edit message' });
    }
  }

  @SubscribeMessage('reaction')
  async handleReaction(
    @MessageBody() data: { messageId: string; sessionId: string; emoji: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as any;
    if (!user) return;

    this.server.to(`session:${data.sessionId}`).emit('reaction', {
      messageId: data.messageId,
      sessionId: data.sessionId,
      emoji: data.emoji,
      userId: user.id,
      username: user.username,
    });
  }

  @SubscribeMessage('join_session')
  async handleJoinSession(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as any;
    const canJoin = await this.chatGatewayService.canJoinSession(user.id, data.sessionId);

    if (canJoin) {
      await client.join(`session:${data.sessionId}`);
      client.emit('joined_session', { sessionId: data.sessionId });
    } else {
      client.emit('error', { message: 'Cannot join this session' });
    }
  }

  @SubscribeMessage('leave_session')
  handleLeaveSession(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`session:${data.sessionId}`);
  }

  @SubscribeMessage('join_agent')
  async handleJoinAgent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId?: string },
  ) {
    const user = client.data.user as any;
    const sessionId = data.sessionId || await this.chatGatewayService.getOrCreateAgentSession(user.id);
    await client.join(`agent:${sessionId}`);
    client.data.agentSessionId = sessionId;
    client.emit('joined_agent', { sessionId });
  }

  emitToUser(userId: string, event: string, data: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
    }
  }

  emitToSession(sessionId: string, event: string, data: any) {
    this.server.to(`session:${sessionId}`).emit(event, data);
  }

  getOnlineCount(): number {
    return this.userSockets.size;
  }
}
