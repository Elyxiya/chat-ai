import { Controller, Get, Post, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { success } from '../common/result';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'notifications', version: '1' })
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications for current user' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: number,
  ) {
    return success(await this.notificationService.findAll(userId, limit));
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    return success({ count: await this.notificationService.findUnread(userId) });
  }

  @Get('unread-since')
  @ApiOperation({ summary: '拉取指定时间之后的未读通知（用于上线时离线同步）' })
  async findUnreadSince(
    @CurrentUser('id') userId: string,
    @Query('since') since: string,
  ) {
    return success(await this.notificationService.findUnreadSince(userId, since));
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return success(await this.notificationService.markAsRead(userId, id));
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    await this.notificationService.markAllAsRead(userId);
    return success(null, 'All notifications marked as read');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.notificationService.delete(userId, id);
    return success(null, 'Notification deleted');
  }

  @Delete()
  @ApiOperation({ summary: 'Delete all notifications' })
  async deleteAll(@CurrentUser('id') userId: string) {
    await this.notificationService.deleteAll(userId);
    return success(null, 'All notifications deleted');
  }
}
