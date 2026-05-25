import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { authApi } from '@/api/client';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (identifier: string, password: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; nickname?: string }) => Promise<void>;
  logout: (reason?: 'expired' | 'manual') => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (data: Partial<User>) => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (identifier, password) => {
        const res: any = await authApi.login(identifier, password);
        set({
          user: res.data.data?.user,
          accessToken: res.data.data?.accessToken,
          refreshToken: res.data.data?.refreshToken,
          isAuthenticated: true,
        });
      },

      register: async (data) => {
        const res: any = await authApi.register(data);
        set({
          user: res.data.user,
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken,
          isAuthenticated: true,
        });
      },

      logout: (reason?: 'expired' | 'manual') => {
        const { refreshToken } = get();
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
        if (refreshToken) {
          authApi.logout(refreshToken).catch(() => {});
        }
        const params = reason === 'expired' ? '?reason=expired' : '';
        window.location.href = `/login${params}`;
      },

      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken, isAuthenticated: true });
      },

      updateUser: (data) => {
        set((state) => ({ user: state.user ? { ...state.user, ...data } : null }));
      },

      checkAuth: async () => {
        const { accessToken } = get();
        if (!accessToken) {
          set({ isLoading: false });
          return;
        }
        try {
          const res: any = await authApi.me();
          set({ user: res.data, isAuthenticated: true, isLoading: false });
        } catch {
          set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
