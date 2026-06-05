import { Test, TestingModule } from '@nestjs/testing';
import { AdminController, AdminStatsController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../../config/prisma.service';
import { AdminGuard } from './admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('AdminController', () => {
  let controller: AdminController;
  let mockAdminService: any;

  const mockUser = { sub: 'admin-1', username: 'admin', role: 'admin' };
  const mockPrisma = {
    auditLog: { create: jest.fn() },
    user: { findMany: jest.fn(), count: jest.fn() },
  };

  beforeEach(async () => {
    mockAdminService = {
      listUsers: jest.fn(),
      updateUserStatus: jest.fn(),
      updateUserRole: jest.fn(),
      deleteUser: jest.fn(),
      listAuditLogs: jest.fn(),
      getSettings: jest.fn(),
      updateSetting: jest.fn(),
    };
    (mockAdminService as any).prisma = mockPrisma;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('ADMIN-CTRL-01: should list users with pagination', async () => {
    const dto = { page: 1, limit: 20 };
    const expected = { items: [], total: 0 };
    mockAdminService.listUsers.mockResolvedValue(expected);

    const result = await controller.listUsers(dto);
    expect(result.data).toEqual(expected);
    expect(mockAdminService.listUsers).toHaveBeenCalledWith(dto);
  });

  it('ADMIN-CTRL-02: should update user status with audit log', async () => {
    const dto = { status: 'banned' };
    mockAdminService.updateUserStatus.mockResolvedValue({ id: 'user-1', status: 'banned' });

    const result = await controller.updateUserStatus('user-1', dto, mockUser);

    expect(result.data).toBeDefined();
    expect(mockAdminService.updateUserStatus).toHaveBeenCalledWith('user-1', dto);
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it('ADMIN-CTRL-03: should update user role with audit log', async () => {
    const dto = { role: 'admin' };
    mockAdminService.updateUserRole.mockResolvedValue({ id: 'user-1', role: 'admin' });

    const result = await controller.updateUserRole('user-1', dto, mockUser);

    expect(result.data).toBeDefined();
    expect(mockAdminService.updateUserRole).toHaveBeenCalledWith('user-1', dto);
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it('ADMIN-CTRL-04: should delete user with audit log', async () => {
    mockAdminService.deleteUser.mockResolvedValue({ deleted: true });

    const result = await controller.deleteUser('user-1', mockUser);

    expect(result).toBeDefined();
    expect(mockAdminService.deleteUser).toHaveBeenCalledWith('user-1');
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it('ADMIN-CTRL-05: should list audit logs', async () => {
    const dto = { page: 1, limit: 20, action: 'login' };
    const expected = { items: [], total: 0 };
    mockAdminService.listAuditLogs.mockResolvedValue(expected);

    const result = await controller.listAuditLogs(dto);
    expect(result.data).toEqual(expected);
    expect(mockAdminService.listAuditLogs).toHaveBeenCalledWith(dto);
  });

  it('ADMIN-CTRL-06: should get settings', async () => {
    const expected = [{ key: 'site_name', value: 'Chat' }];
    mockAdminService.getSettings.mockResolvedValue(expected);

    const result = await controller.getSettings();
    expect(result.data).toEqual(expected);
    expect(mockAdminService.getSettings).toHaveBeenCalled();
  });

  it('ADMIN-CTRL-07: should update setting with audit log', async () => {
    const dto = { key: 'site_name', value: 'New Chat' };
    mockAdminService.updateSetting.mockResolvedValue({ key: 'site_name', value: 'New Chat' });

    const result = await controller.updateSetting(dto, mockUser);
    expect(result.data).toBeDefined();
    expect(mockAdminService.updateSetting).toHaveBeenCalledWith(dto);
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });
});

describe('AdminStatsController', () => {
  let statsController: AdminStatsController;
  let mockAdminService: any;

  const mockPrisma = {
    user: { count: jest.fn(), findMany: jest.fn() },
    chatSession: { count: jest.fn() },
    message: { count: jest.fn() },
    auditLog: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    mockAdminService = {};
    (mockAdminService as any).prisma = mockPrisma;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminStatsController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    statsController = module.get<AdminStatsController>(AdminStatsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('ADMIN-CTRL-08: should get dashboard stats', async () => {
    mockPrisma.user.count.mockResolvedValue(100);
    mockPrisma.chatSession.count.mockResolvedValue(50);
    mockPrisma.message.count.mockResolvedValue(1000);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    const result = await statsController.getStats();

    expect(result.data).toHaveProperty('userCount', 100);
    expect(result.data).toHaveProperty('sessionCount', 50);
    expect(result.data).toHaveProperty('messageCount', 1000);
  });
});
