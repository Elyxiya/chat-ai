import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth.store';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    console.log('[Interceptor] response.data:', response.data);
    return response.data;
  },
  async (error: AxiosError<{ message: string }>) => {
    if (error.response?.status === 401) {
      const store = useAuthStore.getState();
      if (store.refreshToken && !error.config?.url?.includes('auth/refresh')) {
        try {
          const res = await apiClient.post('/auth/refresh', {
            refreshToken: store.refreshToken,
          });
          store.setTokens(res.data.accessToken, res.data.refreshToken);
          if (error.config) {
            error.config.headers.Authorization = `Bearer ${res.data.accessToken}`;
            return apiClient(error.config);
          }
        } catch {
          store.logout('expired');
        }
      } else {
        store.logout('expired');
      }
    }
    return Promise.reject(error);
  },
);

const noAuthClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export { noAuthClient };

export const authApi = {
  login: (identifier: string, password: string) =>
    noAuthClient.post('/auth/login', { identifier, password }),
  register: (data: { username: string; email: string; password: string; nickname?: string }) =>
    noAuthClient.post('/auth/register', data),
  refresh: (refreshToken: string) =>
    noAuthClient.post('/auth/refresh', { refreshToken }),
  logout: (refreshToken: string) =>
    noAuthClient.post('/auth/logout', { refreshToken }),
  sendCode: (email: string) =>
    noAuthClient.post('/auth/send-code', { email }),
  resetPassword: (data: { email: string; code: string; newPassword: string }) =>
    noAuthClient.post('/auth/reset-password', data),
  me: () => apiClient.get('/auth/me'),
};

export const chatApi = {
  getSessions: () => apiClient.get('/chat/sessions'),
  createSession: (data: { sessionType: string; name?: string; memberIds?: string[] }) =>
    apiClient.post('/chat/sessions', data),
  getSession: (sessionId: string) => apiClient.get(`/chat/sessions/${sessionId}`),
  updateSession: (sessionId: string, data: any) =>
    apiClient.patch(`/chat/sessions/${sessionId}`, data),
  deleteSession: (sessionId: string) =>
    apiClient.delete(`/chat/sessions/${sessionId}`),

  getMessages: (sessionId: string, params?: { limit?: number; before?: string }) =>
    apiClient.get(`/chat/sessions/${sessionId}/messages`, { params }),
  sendMessage: (sessionId: string, data: { content: string; contentType?: string; mentions?: string[] }) =>
    apiClient.post(`/chat/sessions/${sessionId}/messages`, data),

  recallMessage: (messageId: string) =>
    apiClient.post('/chat/messages/recall', { messageId }),
  markRead: (sessionId: string, lastMessageId: string) =>
    apiClient.post('/chat/messages/read', { sessionId, lastMessageId }),

  addMembers: (sessionId: string, userIds: string[]) =>
    apiClient.post(`/chat/sessions/${sessionId}/members`, { userIds }),
  removeMember: (sessionId: string, targetUserId: string) =>
    apiClient.delete(`/chat/sessions/${sessionId}/members/${targetUserId}`),

  getFriends: () => apiClient.get('/chat/friends'),
  searchUsers: (query: string) =>
    apiClient.get('/chat/users/search', { params: { q: query } }),
  getOnlineUsers: () => apiClient.get('/chat/online-users'),
};

export const agentApi = {
  chat: (message: string, sessionId?: string) =>
    apiClient.post('/agent/chat', { message, sessionId }),
  getHistory: (limit?: number) =>
    apiClient.get('/agent/history', { params: { limit } }),
  clearMemory: () => apiClient.delete('/agent/memory'),
  summarizeMemory: () => apiClient.post('/agent/memory/summarize'),
  getStatus: () => apiClient.get('/agent/status'),
};

export const userApi = {
  getProfile: (userId: string) => apiClient.get(`/users/${userId}`),
  updateProfile: (data: { nickname?: string; bio?: string; avatarUrl?: string }) =>
    apiClient.patch('/users/profile', data),
};

export const knowledgeApi = {
  listBases: () => apiClient.get('/knowledge/bases'),
  createBase: (data: { name: string; description?: string; isPublic?: boolean }) =>
    apiClient.post('/knowledge/bases', data),
  getBase: (kbId: string) => apiClient.get(`/knowledge/bases/${kbId}`),
  deleteBase: (kbId: string) => apiClient.delete(`/knowledge/bases/${kbId}`),
  addText: (kbId: string, content: string, metadata?: Record<string, any>) =>
    apiClient.post(`/knowledge/bases/${kbId}/text`, { content, metadata }),
  search: (query: string, topK?: number) =>
    apiClient.get('/knowledge/search', { params: { query, topK } }),
};
