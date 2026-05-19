import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, AuthTokens } from '@/types';
import { authApi } from '@/api/client';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (identifier: string, password: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; nickname?: string }) => Promise<void>;
  logout: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
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
        // #region debug log
        fetch('http://127.0.0.1:7327/ingest/804a4ea0-edf2-4cdf-8542-0c7db0a68a39',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7dd50'},body:JSON.stringify({sessionId:'d7dd50',location:'auth.store.ts:30',message:'login start',data:{identifier},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        const res: any = await authApi.login(identifier, password);
        // #region debug log
        fetch('http://127.0.0.1:7327/ingest/804a4ea0-edf2-4cdf-8542-0c7db0a68a39',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7dd50'},body:JSON.stringify({sessionId:'d7dd50',location:'auth.store.ts:31',message:'login response',data:{resKeys:Object.keys(res),resHasData:!!res.data,resAccessToken:res.accessToken?.substring(0,20),resDataAccessToken:res.data?.accessToken?.substring(0,20)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        const data = res.data as AuthTokens;
        set({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          isAuthenticated: true,
        });
      },

      register: async (data) => {
        const res: any = await authApi.register(data);
        const tokens = res.data as AuthTokens;
        set({
          user: tokens.user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          isAuthenticated: true,
        });
      },

      logout: async () => {
        const { refreshToken } = get();
        if (refreshToken) {
          try {
            await authApi.logout(refreshToken);
          } catch {
            // ignore
          }
        }
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken, isAuthenticated: true });
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
