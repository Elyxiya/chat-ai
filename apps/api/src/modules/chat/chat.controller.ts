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

  // ======== Channel (Broadcast) Routes ========

  @Get('channels')
  @ApiOperation({ summary: 'Get all subscribed channels' })
  async getSubscribedChannels(@CurrentUser('id') userId: string) {
    return success(await this.chatService.getSubscribedChannels(userId));
  }

  @Post('channels')
  @ApiOperation({ summary: 'Create a new channel' })
  async createChannel(
    @CurrentUser('id') userId: string,
    @Body() body: { name: string; description?: string; isPublic?: boolean },
  ) {
    return success(await this.chatService.createChannel(userId, body));
  }

  @Patch('channels/:channelId')
  @ApiOperation({ summary: 'Update channel settings' })
  async updateChannel(
    @CurrentUser('id') userId: string,
    @Param('channelId') channelId: string,
    @Body() body: { name?: string; description?: string; avatarUrl?: string; whoCanPost?: string },
  ) {
    return success(await this.chatService.updateChannel(userId, channelId, body));
  }

  @Delete('channels/:channelId')
  @ApiOperation({ summary: 'Delete a channel' })
  async deleteChannel(
    @CurrentUser('id') userId: string,
    @Param('channelId') channelId: string,
  ) {
    return success(await this.chatService.deleteChannel(userId, channelId));
  }

  @Post('channels/:channelId/subscribe')
  @ApiOperation({ summary: 'Subscribe to a channel' })
  async subscribeChannel(
    @CurrentUser('id') userId: string,
    @Param('channelId') channelId: string,
  ) {
    return success(await this.chatService.subscribeChannel(userId, channelId));
  }

  @Post('channels/:channelId/unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from a channel' })
  async unsubscribeChannel(
    @CurrentUser('id') userId: string,
    @Param('channelId') channelId: string,
  ) {
    return success(await this.chatService.unsubscribeChannel(userId, channelId));
  }

  // ======== Session Routes ========

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

  @Get('sessions/:sessionId/search')
  @ApiOperation({ summary: 'Search messages within a session' })
  async searchMessages(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
    @Query('q') query: string,
  ) {
    return success(await this.chatService.searchMessages(userId, sessionId, query));
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

  @Get('sessions/:sessionId/members')
  @ApiOperation({ summary: 'Get session members' })
  async getSessionMembers(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return success(await this.chatService.getSessionMembers(userId, sessionId));
  }

  @Post('sessions/:sessionId/announcement')
  @ApiOperation({ summary: 'Set or update group announcement' })
  async setAnnouncement(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: { content: string },
  ) {
    return success(await this.chatService.setAnnouncement(userId, sessionId, body.content));
  }

  @Delete('sessions/:sessionId/announcement')
  @ApiOperation({ summary: 'Remove group announcement' })
  async removeAnnouncement(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    await this.chatService.removeAnnouncement(userId, sessionId);
    return success(null);
  }

  @Post('sessions/:sessionId/invite-link')
  @ApiOperation({ summary: 'Generate an invite link for a group session' })
  async generateInviteLink(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return success(await this.chatService.generateInviteLink(userId, sessionId));
  }

  @Post('sessions/join-by-link')
  @ApiOperation({ summary: 'Join a session via invite link' })
  async joinByLink(
    @CurrentUser('id') userId: string,
    @Body() body: { code: string },
  ) {
    return success(await this.chatService.joinByLink(userId, body.code));
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

  @Post('messages/batch/forward')
  @ApiOperation({ summary: 'Batch forward messages to another session' })
  async batchForwardMessages(
    @CurrentUser('id') userId: string,
    @Body() body: { messageIds: string[]; targetSessionId: string },
  ) {
    return success(await this.chatService.batchForwardMessages(userId, body.messageIds, body.targetSessionId));
  }

  @Post('messages/batch/delete')
  @ApiOperation({ summary: 'Batch delete messages (self or everyone)' })
  async batchDeleteMessages(
    @CurrentUser('id') userId: string,
    @Body() body: { messageIds: string[]; type: 'self' | 'everyone' },
  ) {
    return success(await this.chatService.batchDeleteMessages(userId, body.messageIds, body.type));
  }

  @Post('messages/forward')
  @ApiOperation({ summary: 'Forward a message to other sessions' })
  async forwardMessage(
    @CurrentUser('id') userId: string,
    @Body() body: { messageId: string; targetSessionIds: string[] },
  ) {
    return success(
      await this.chatService.forwardMessage(userId, body.messageId, body.targetSessionIds),
    );
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

  @Get('search')
  @ApiOperation({ summary: 'Global search messages across all sessions' })
  async globalSearch(
    @CurrentUser('id') userId: string,
    @Query('q') query: string,
    @Query('sessionId') sessionId?: string,
    @Query('types') types?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return success(
      await this.chatService.globalSearch(userId, query, {
        sessionId,
        types: types?.split(','),
        page: page || 1,
        limit: limit || 20,
      }),
    );
  }

  @Get('online-users')
  @ApiOperation({ summary: 'Get online users' })
  async getOnlineUsers() {
    return success(await this.chatService.getOnlineUsers());
  }

  @Patch('messages/:id')
  @ApiOperation({ summary: 'Edit a message' })
  async editMessage(
    @CurrentUser('id') userId: string,
    @Param('id') messageId: string,
    @Body() body: { content: string },
  ) {
    return success(await this.chatService.editMessage(userId, messageId, body.content));
  }

  @Get('messages/:id/edit-history')
  @ApiOperation({ summary: 'Get edit history of a message' })
  async getEditHistory(
    @CurrentUser('id') userId: string,
    @Param('id') messageId: string,
  ) {
    return success(await this.chatService.getEditHistory(userId, messageId));
  }

  @Get('messages/:id/read-receipts')
  @ApiOperation({ summary: 'Get read receipts for a message' })
  async getReadReceipts(
    @CurrentUser('id') userId: string,
    @Param('id') messageId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return success(await this.chatService.getReadReceipts(userId, messageId, page || 1, limit || 50));
  }

  @Post('messages/:id/bookmark')
  @ApiOperation({ summary: 'Toggle bookmark on a message' })
  async toggleBookmark(
    @CurrentUser('id') userId: string,
    @Param('id') messageId: string,
  ) {
    return success(await this.chatService.toggleBookmark(userId, messageId));
  }

  @Get('bookmarks')
  @ApiOperation({ summary: 'Get all bookmarked messages' })
  async getBookmarks(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    return success(await this.chatService.getBookmarks(userId, limit ? Number(limit) : 50));
  }

  @Patch('messages/:id/bookmark')
  @ApiOperation({ summary: 'Update bookmark tags and note' })
  async updateBookmark(
    @CurrentUser('id') userId: string,
    @Param('id') messageId: string,
    @Body() body: { tags?: string[]; note?: string },
  ) {
    return success(await this.chatService.updateBookmark(userId, messageId, body));
  }

  @Get('bookmarks/search')
  @ApiOperation({ summary: 'Search bookmarks by tag or content' })
  async searchBookmarks(
    @CurrentUser('id') userId: string,
    @Query('tag') tag?: string,
    @Query('q') query?: string,
  ) {
    return success(await this.chatService.searchBookmarksByTag(userId, tag, query));
  }

  @Patch('sessions/:sessionId/mute')
  @ApiOperation({ summary: 'Mute or unmute a session' })
  async muteSession(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: { muted: boolean; muteUntil?: string },
  ) {
    return success(await this.chatService.muteSession(userId, sessionId, body.muted, body.muteUntil));
  }

  @Patch('sessions/:sessionId/pin')
  @ApiOperation({ summary: 'Toggle pin status for a session' })
  async togglePinSession(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return success(await this.chatService.togglePinSession(userId, sessionId));
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
