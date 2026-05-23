import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import {
  CreateSessionDto,
  SendMessageDto,
  RecallMessageDto,
  ReadReceiptDto,
  QueryMessagesDto,
  UpdateSessionDto,
  AddMembersDto,
  AddReactionDto,
  RemoveReactionDto,
} from './dto/chat.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { success } from '../common/result';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'chat', version: '1' })
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('sessions')
  @ApiOperation({ summary: 'Get all chat sessions for current user' })
  async getSessions(@CurrentUser('id') userId: string) {
    return success(await this.chatService.getUserSessions(userId));
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create a new chat session' })
  async createSession(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSessionDto,
  ) {
    return success(await this.chatService.createSession(userId, dto));
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Get session details' })
  async getSession(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return success(await this.chatService.getSession(userId, sessionId));
  }

  @Patch('sessions/:sessionId')
  @ApiOperation({ summary: 'Update session (name, avatar, etc.)' })
  async updateSession(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return success(await this.chatService.updateSession(userId, sessionId, dto));
  }

  @Delete('sessions/:sessionId')
  @ApiOperation({ summary: 'Leave/delete a chat session' })
  async deleteSession(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    await this.chatService.deleteSession(userId, sessionId);
    return success(null, 'Session deleted');
  }

  @Get('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Get message history for a session' })
  async getMessages(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
    @Query() query: QueryMessagesDto,
  ) {
    return success(
      await this.chatService.getMessages(userId, sessionId, query),
    );
  }

  @Post('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Send a message' })
  async sendMessage(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: SendMessageDto,
  ) {
    return success(
      await this.chatService.sendMessage(userId, sessionId, dto),
    );
  }

  @Post('messages/recall')
  @ApiOperation({ summary: 'Recall a message' })
  async recallMessage(
    @CurrentUser('id') userId: string,
    @Body() dto: RecallMessageDto,
  ) {
    return success(await this.chatService.recallMessage(userId, dto.messageId));
  }

  @Post('messages/read')
  @ApiOperation({ summary: 'Mark messages as read' })
  async markRead(
    @CurrentUser('id') userId: string,
    @Body() dto: ReadReceiptDto,
  ) {
    await this.chatService.markAsRead(userId, dto.sessionId, dto.lastMessageId);
    return success(null);
  }

  @Post('sessions/:sessionId/members')
  @ApiOperation({ summary: 'Add members to a session' })
  async addMembers(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: AddMembersDto,
  ) {
    return success(
      await this.chatService.addMembers(userId, sessionId, dto.userIds),
    );
  }

  @Delete('sessions/:sessionId/members/:targetUserId')
  @ApiOperation({ summary: 'Remove member from session' })
  async removeMember(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    await this.chatService.removeMember(userId, sessionId, targetUserId);
    return success(null);
  }

  @Get('friends')
  @ApiOperation({ summary: 'Get friend list' })
  async getFriends(@CurrentUser('id') userId: string) {
    return success(await this.chatService.getFriends(userId));
  }

  @Post('friends/:friendId')
  @ApiOperation({ summary: 'Send or accept friend request' })
  async manageFriend(
    @CurrentUser('id') userId: string,
    @Param('friendId') friendId: string,
    @Body() body: { action: 'request' | 'accept' | 'reject' | 'block' },
  ) {
    return success(
      await this.chatService.manageFriend(userId, friendId, body.action),
    );
  }

  @Get('users/search')
  @ApiOperation({ summary: 'Search users' })
  async searchUsers(
    @CurrentUser('id') userId: string,
    @Query('q') query: string,
  ) {
    return success(await this.chatService.searchUsers(userId, query));
  }

  @Get('online-users')
  @ApiOperation({ summary: 'Get online users' })
  async getOnlineUsers() {
    return success(await this.chatService.getOnlineUsers());
  }

  @Post('reactions')
  @ApiOperation({ summary: 'Add reaction to a message' })
  async addReaction(
    @CurrentUser('id') userId: string,
    @Body() dto: AddReactionDto,
  ) {
    return success(
      await this.chatService.addReaction(userId, dto.messageId, dto.emoji),
    );
  }

  @Delete('reactions')
  @ApiOperation({ summary: 'Remove reaction from a message' })
  async removeReaction(
    @CurrentUser('id') userId: string,
    @Body() dto: RemoveReactionDto,
  ) {
    return success(
      await this.chatService.removeReaction(userId, dto.messageId, dto.emoji),
    );
  }
}
