import {
  Controller, Get, Patch, Delete, Body, Param, Query, UseGuards,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { success } from '../common/result';
import {
  QueryUsersDto, UpdateUserStatusDto, UpdateUserRoleDto,
  QueryAuditLogsDto, UpdateSettingDto,
} from './dto/admin.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users with pagination' })
  async listUsers(@Query() dto: QueryUsersDto) {
    return success(await this.adminService.listUsers(dto));
  }

  @Patch('users/:userId/status')
  @ApiOperation({ summary: 'Update user status (ban/unban)' })
  async updateUserStatus(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() currentUser: any,
  ) {
    const result = await this.adminService.updateUserStatus(userId, dto);
    await this.adminService['prisma'].auditLog.create({
      data: {
        userId: currentUser.sub,
        action: 'update_user_status',
        resourceType: 'user',
        resourceId: userId,
        metadata: { newStatus: dto.status },
      },
    });
    return success(result);
  }

  @Patch('users/:userId/role')
  @ApiOperation({ summary: 'Update user role' })
  async updateUserRole(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() currentUser: any,
  ) {
    const result = await this.adminService.updateUserRole(userId, dto);
    await this.adminService['prisma'].auditLog.create({
      data: {
        userId: currentUser.sub,
        action: 'update_user_role',
        resourceType: 'user',
        resourceId: userId,
        metadata: { newRole: dto.role },
      },
    });
    return success(result);
  }

  @Delete('users/:userId')
  @ApiOperation({ summary: 'Delete a user' })
  async deleteUser(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: any,
  ) {
    const result = await this.adminService.deleteUser(userId);
    await this.adminService['prisma'].auditLog.create({
      data: {
        userId: currentUser.sub,
        action: 'delete_user',
        resourceType: 'user',
        resourceId: userId,
      },
    });
    return success(result);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get audit logs' })
  async listAuditLogs(@Query() dto: QueryAuditLogsDto) {
    return success(await this.adminService.listAuditLogs(dto));
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get system settings' })
  async getSettings() {
    return success(await this.adminService.getSettings());
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update a system setting' })
  async updateSetting(
    @Body() dto: UpdateSettingDto,
    @CurrentUser() currentUser: any,
  ) {
    const result = await this.adminService.updateSetting(dto);
    await this.adminService['prisma'].auditLog.create({
      data: {
        userId: currentUser.sub,
        action: 'update_setting',
        resourceType: 'system_setting',
        resourceId: dto.key,
        metadata: { key: dto.key },
      },
    });
    return success(result);
  }
}

@ApiTags('Admin - Stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller({ path: 'admin', version: '1' })
export class AdminStatsController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getStats() {
    const [userCount, sessionCount, messageCount, recentUsers, recentLogs] = await Promise.all([
      this.adminService['prisma'].user.count(),
      this.adminService['prisma'].chatSession.count(),
      this.adminService['prisma'].message.count(),
      this.adminService['prisma'].user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, username: true, role: true, status: true, createdAt: true },
      }),
      this.adminService['prisma'].auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { username: true } } },
      }),
    ]);
    return success({ userCount, sessionCount, messageCount, recentUsers, recentLogs });
  }
}
