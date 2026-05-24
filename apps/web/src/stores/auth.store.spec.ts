import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage BEFORE any module imports (vi.hoisted runs before all code)
const localStorageMock = vi.hoisted(() => {
  let store: Record<string, string> = {};
  const mock = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
  Object.defineProperty(window, 'localStorage', { value: mock, writable: true });
  return mock;
});

const mockUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  userType: 'human' as const,
  status: 'online' as const,
  createdAt: '2025-01-01T00:00:00Z',
};

// authApi uses noAuthClient (no response interceptor), so res.data.data?.user
const mockLoginResponse = {
  data: {
    data: {
      user: mockUser,
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    },
  },
};

const mockRegisterResponse = {
  data: {
    user: mockUser,
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  },
};

const mockMeResponse = { data: mockUser };

vi.mock('@/api/client', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(() => Promise.resolve()),
    me: vi.fn(),
  },
}));

import { useAuthStore } from './auth.store';
import { authApi } from '@/api/client';

const mockLocation = { href: '' };
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('auth.store', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
    });
  });

  it('AUTH-WEB-01: should have initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(true);
  });

  describe('login', () => {
    it('AUTH-WEB-02: should login successfully and update state', async () => {
      vi.mocked(authApi.login).mockResolvedValue(mockLoginResponse as any);

      await useAuthStore.getState().login('testuser', 'password123');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.accessToken).toBe('mock-access-token');
      expect(state.refreshToken).toBe('mock-refresh-token');
      expect(state.isAuthenticated).toBe(true);
      expect(authApi.login).toHaveBeenCalledWith('testuser', 'password123');
    });

    it('AUTH-WEB-03: should handle login failure', async () => {
      vi.mocked(authApi.login).mockRejectedValue(new Error('Invalid credentials'));

      await expect(useAuthStore.getState().login('wrong', 'wrong')).rejects.toThrow('Invalid credentials');

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('register', () => {
    it('AUTH-WEB-04: should register successfully and update state', async () => {
      vi.mocked(authApi.register).mockResolvedValue(mockRegisterResponse as any);

      const registerData = { username: 'newuser', email: 'new@example.com', password: 'pass123' };
      await useAuthStore.getState().register(registerData);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(authApi.register).toHaveBeenCalledWith(registerData);
    });
  });

  describe('logout', () => {
    it('AUTH-WEB-05: should clear state and redirect on manual logout', () => {
      useAuthStore.setState({
        user: mockUser,
        accessToken: 'token',
        refreshToken: 'refresh',
        isAuthenticated: true,
        isLoading: false,
      });

      useAuthStore.getState().logout('manual');

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(window.location.href).toBe('/login');
    });

    it('AUTH-WEB-06: should redirect with expired param when session expired', () => {
      useAuthStore.setState({
        user: mockUser,
        accessToken: 'token',
        refreshToken: 'refresh',
        isAuthenticated: true,
        isLoading: false,
      });

      useAuthStore.getState().logout('expired');

      expect(window.location.href).toBe('/login?reason=expired');
    });

    it('AUTH-WEB-07: should call logout API if refreshToken exists', () => {
      useAuthStore.setState({
        user: mockUser,
        accessToken: 'token',
        refreshToken: 'refresh-token',
        isAuthenticated: true,
        isLoading: false,
      });

      useAuthStore.getState().logout('manual');

      expect(authApi.logout).toHaveBeenCalledWith('refresh-token');
    });

    it('AUTH-WEB-08: should not call logout API if no refreshToken', () => {
      useAuthStore.setState({
        user: mockUser,
        accessToken: 'token',
        refreshToken: null,
        isAuthenticated: true,
        isLoading: false,
      });

      useAuthStore.getState().logout('manual');

      expect(authApi.logout).not.toHaveBeenCalled();
    });
  });

  describe('setTokens', () => {
    it('AUTH-WEB-09: should set tokens and mark authenticated', () => {
      useAuthStore.getState().setTokens('new-access', 'new-refresh');

      expect(useAuthStore.getState().accessToken).toBe('new-access');
      expect(useAuthStore.getState().refreshToken).toBe('new-refresh');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
  });

  describe('checkAuth', () => {
    it('AUTH-WEB-10: should set isLoading false when no token', async () => {
      useAuthStore.setState({ accessToken: null, isLoading: true });

      await useAuthStore.getState().checkAuth();

      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(authApi.me).not.toHaveBeenCalled();
    });

    it('AUTH-WEB-11: should verify token and set user on success', async () => {
      vi.mocked(authApi.me).mockResolvedValue(mockMeResponse);

      useAuthStore.setState({
        accessToken: 'valid-token',
        isLoading: true,
        user: null,
        isAuthenticated: false,
      });

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(authApi.me).toHaveBeenCalled();
    });

    it('AUTH-WEB-12: should clear state on auth failure', async () => {
      vi.mocked(authApi.me).mockRejectedValue(new Error('Unauthorized'));

      useAuthStore.setState({
        accessToken: 'expired-token',
        refreshToken: 'refresh',
        user: mockUser,
        isAuthenticated: true,
        isLoading: true,
      });

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('persistence', () => {
    it('AUTH-WEB-13: should persist auth state to localStorage', async () => {
      useAuthStore.setState({
        user: mockUser,
        accessToken: 'persist-token',
        refreshToken: 'persist-refresh',
        isAuthenticated: true,
        isLoading: false,
      });

      // Use waitFor to handle async zustand persist storage writes
      await vi.waitFor(() => {
        const calls = localStorageMock.setItem.mock.calls;
        // Get the last write to 'auth-storage' (skip initial state from beforeEach)
        const persistCalls = calls.filter((c) => c[0] === 'auth-storage');
        expect(persistCalls.length).toBeGreaterThan(0);
        const lastCall = persistCalls[persistCalls.length - 1];
        const persisted = JSON.parse(lastCall[1]);
        expect(persisted.state.user).toEqual(mockUser);
        expect(persisted.state.accessToken).toBe('persist-token');
        expect(persisted.state.isAuthenticated).toBe(true);
      }, { timeout: 500, interval: 10 });
    });
  });
});
