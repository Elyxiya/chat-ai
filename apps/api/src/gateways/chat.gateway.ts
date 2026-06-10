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
import { MetricsService } from '../modules/common/metrics.service';
import { RedisService } from '../modules/common/redis.service';
import { ChatQueueService } from '../modules/chat/chat-queue.service';

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

  private readonly queueEnabled = process.env.QUEUE_ENABLED === 'true';

  constructor(
    private readonly chatGatewayService: ChatGatewayService,
    private readonly metrics: MetricsService,
    private readonly redis: RedisService,
    private readonly chatQueueService: ChatQueueService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    const start = Date.now();
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      const user = await this.chatGatewayService.authenticate(token);

      if (!user) {
        this.logger.warn(`Unauthorized connection attempt from ${client.id}`);
        client.emit('error', { message: 'Unauthorized' });
        client.disconnect();
        this.metrics.incrementCounter('ws_connections_rejected');
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

      // Send the currently online user IDs to the newly connected client
      // so they don't start with an empty online list after a refresh
      const onlineUserIds = Array.from(this.userSockets.keys());
      client.emit('initial_online_users', { userIds: onlineUserIds });

      client.emit('connected', { userId: user.id, sessionId: client.id });
      this.metrics.setGauge('ws_connections_active', this.userSockets.size);
      this.metrics.incrementCounter('ws_connections_total');
      this.metrics.recordDuration('ws_connection_duration_ms', Date.now() - start);
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

    this.metrics.setGauge('ws_connections_active', this.userSockets.size);
    this.logger.log(`User ${user.username} disconnected (${client.id})`);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: Date.now() });
  }

  /** Per-user: 5 msg/s, per-session: 20 msg/s. Returns true if allowed. */
  private async checkRateLimit(userId: string, sessionId?: string): Promise<boolean> {
    try {
      const now = Math.floor(Date.now() / 1000);

      // Per-user limit
      const userKey = `rate:user:${userId}:${now}`;
      const userCount = await this.redis.incr(userKey);
      if (userCount === 1) await this.redis.expire(userKey, 2);
      if (userCount > 5) return false;

      // Per-session limit
      if (sessionId) {
        const sessionKey = `rate:sess:${sessionId}:${now}`;
        const sessionCount = await this.redis.incr(sessionKey);
        if (sessionCount === 1) await this.redis.expire(sessionKey, 2);
        if (sessionCount > 20) return false;
      }

      return true;
    } catch {
      return true; // rate limiter failure — allow through
    }
  }

  @SubscribeMessage('message')
  async handleMessage(
    @MessageBody() payload: WsIncomingMessage,
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as any;
    if (!user) return;

    const start = Date.now();
    const typeName = WsMessageType[payload.type] || 'UNKNOWN';

    // Rate limit TEXT/IMAGE/FILE/AUDIO/VIDEO messages only
    if (payload.type >= WsMessageType.TEXT && payload.type <= WsMessageType.VIDEO) {
      const sessionId = payload.data?.sessionId;
      const allowed = await this.checkRateLimit(user.id, sessionId);
      if (!allowed) {
        client.emit('error', { message: '发送过快，请稍后再试', code: 'RATE_LIMITED' });
        this.metrics.incrementCounter('ws_rate_limited_total', { type: typeName });
        return;
      }
    }

    switch (payload.type) {
      case WsMessageType.TEXT:
      case WsMessageType.IMAGE:
      case WsMessageType.FILE:
      case WsMessageType.AUDIO:
      case WsMessageType.VIDEO: {
        const { sessionId, content, metadata, mentions, replyToId, clientMsgId } = payload.data;

        if (this.queueEnabled && clientMsgId) {
          // ── 队列模式：消息入 BullMQ，由 Processor 批量写入 + 广播 ──
          const seq = await this.chatGatewayService.assignSeq(sessionId);
          const enrichedMetadata = { ...(metadata || {}), clientMsgId, seq };

          await this.chatQueueService.addToQueue({
            clientMsgId,
            sessionId,
            senderId: user.id,
            content,
            contentType: WsMessageType[payload.type].toLowerCase(),
            metadata: enrichedMetadata,
            mentions,
            replyToId,
            seq,
            timestamp: Date.now(),
          });

          // Immediate ACK — message is queued, not yet persisted
          client.emit('message_ack', { clientMsgId, seq, status: 'queued' });
        } else {
          // ── 直写模式：现有逻辑 ──
          const enrichedMetadata = clientMsgId
            ? { ...(metadata || {}), clientMsgId }
            : metadata;

          const message = await this.chatGatewayService.sendMessage(
            user.id,
            sessionId,
            { content, contentType: WsMessageType[payload.type].toLowerCase(), metadata: enrichedMetadata, mentions, replyToId },
          );

          if (clientMsgId) {
            const seq = (message.metadata as any)?.seq;
            client.emit('message_ack', { clientMsgId, serverMsgId: message.id, seq, status: 'sent' });
          }

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

    this.metrics.incrementCounter('ws_messages_total', { type: typeName });
    this.metrics.recordDuration('ws_message_duration_ms', Date.now() - start, { type: typeName });
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
    const user = client.data?.user as any;
    if (!user?.id) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
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

  // ==================== WebRTC Call Signaling ====================

  @SubscribeMessage('call:offer')
  async handleCallOffer(
    @MessageBody() data: { targetUserId: string; sdp: any; callType: 'audio' | 'video' },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as any;
    if (!user) return;

    const targetSockets = this.userSockets.get(data.targetUserId);
    if (!targetSockets || targetSockets.size === 0) {
      client.emit('call:ended', { userId: data.targetUserId, reason: 'offline' });
      return;
    }

    targetSockets.forEach((socketId) => {
      this.server.to(socketId).emit('call:incoming', {
        callerId: user.id,
        callerName: user.username,
        callerAvatar: user.avatarUrl,
        sdp: data.sdp,
        callType: data.callType,
      });
    });
  }

  @SubscribeMessage('call:answer')
  async handleCallAnswer(
    @MessageBody() data: { targetUserId: string; sdp: any },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as any;
    if (!user) return;

    const targetSockets = this.userSockets.get(data.targetUserId);
    if (targetSockets) {
      targetSockets.forEach((socketId) => {
        this.server.to(socketId).emit('call:accepted', {
          calleeId: user.id,
          calleeName: user.username,
          sdp: data.sdp,
        });
      });
    }
  }

  @SubscribeMessage('call:ice-candidate')
  async handleIceCandidate(
    @MessageBody() data: { targetUserId: string; candidate: any },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as any;
    if (!user) return;

    const targetSockets = this.userSockets.get(data.targetUserId);
    if (targetSockets) {
      targetSockets.forEach((socketId) => {
        this.server.to(socketId).emit('call:ice-candidate', {
          userId: user.id,
          candidate: data.candidate,
        });
      });
    }
  }

  @SubscribeMessage('call:reject')
  async handleCallReject(
    @MessageBody() data: { targetUserId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as any;
    if (!user) return;

    const targetSockets = this.userSockets.get(data.targetUserId);
    if (targetSockets && targetSockets.size > 0) {
      const firstSocket = [...targetSockets][0];
      this.server.to(firstSocket).emit('call:ended', {
        userId: user.id,
        reason: 'reject',
      });
    }
  }

  @SubscribeMessage('call:end')
  async handleCallEnd(
    @MessageBody() data: { targetUserId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as any;
    if (!user) return;

    const targetSockets = this.userSockets.get(data.targetUserId);
    if (targetSockets && targetSockets.size > 0) {
      const firstSocket = [...targetSockets][0];
      this.server.to(firstSocket).emit('call:ended', {
        userId: user.id,
        reason: 'hangup',
      });
    }
  }

  @SubscribeMessage('call:toggle')
  async handleCallToggle(
    @MessageBody() data: { targetUserId: string; type: 'audio' | 'video'; enabled: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as any;
    if (!user) return;

    const targetSockets = this.userSockets.get(data.targetUserId);
    if (targetSockets) {
      targetSockets.forEach((socketId) => {
        this.server.to(socketId).emit('call:toggle', {
          userId: user.id,
          type: data.type,
          enabled: data.enabled,
        });
      });
    }
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
