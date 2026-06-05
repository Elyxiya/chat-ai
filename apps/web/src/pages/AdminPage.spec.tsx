import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mockGetStats, mockListUsers, mockGetSettings, mockListAuditLogs } = vi.hoisted(() => ({
  mockGetStats: vi.fn(),
  mockListUsers: vi.fn(),
  mockGetSettings: vi.fn(),
  mockListAuditLogs: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  adminApi: {
    getStats: mockGetStats,
    listUsers: mockListUsers,
    getSettings: mockGetSettings,
    listAuditLogs: mockListAuditLogs,
    updateUserStatus: vi.fn(),
    updateUserRole: vi.fn(),
    deleteUser: vi.fn(),
    updateSetting: vi.fn(),
  },
  chatApi: {},
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (selector?: any) => {
    const state = { user: { id: 'admin-1', username: 'admin', role: 'admin' }, isAuthenticated: true };
    return selector ? selector(state) : state;
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import AdminPage from './AdminPage';

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStats.mockResolvedValue({
      data: { userCount: 100, sessionCount: 50, messageCount: 10000, recentUsers: [], recentLogs: [] },
    });
    mockListUsers.mockResolvedValue({ data: { users: [], total: 0 } });
    mockGetSettings.mockResolvedValue({ data: [] });
    mockListAuditLogs.mockResolvedValue({ data: { logs: [], total: 0 } });
  });

  it('ADMIN-WEB-01: should render admin page title', async () => {
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/Admin Panel/i)).toBeInTheDocument();
    });
  });

  it('ADMIN-WEB-02: should show tab navigation', async () => {
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('System Settings')).toBeInTheDocument();
      expect(screen.getByText('Audit Logs')).toBeInTheDocument();
    });
  });

  it('ADMIN-WEB-03b: should show Users tab content by default', async () => {
    render(<AdminPage />);
    await waitFor(() => {
      expect(mockListUsers).toHaveBeenCalled();
    });
  });

  it('ADMIN-WEB-05: should load stats on mount', async () => {
    render(<AdminPage />);
    await waitFor(() => {
      expect(mockGetStats).toHaveBeenCalled();
    });
  });
});
