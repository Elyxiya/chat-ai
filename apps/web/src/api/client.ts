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
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),
  wechatAuth: (state?: string) =>
    noAuthClient.post('/auth/oauth/wechat', { state }),
  wechatCallback: (code: string, state?: string) =>
    noAuthClient.post('/auth/oauth/wechat/callback', { code, state }),
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
  setMemberRole: (sessionId: string, targetUserId: string, role: string) =>
    apiClient.patch(`/chat/sessions/${sessionId}/members/${targetUserId}/role`, { role }),

  getFriends: () => apiClient.get('/chat/friends'),
  searchUsers: (query: string) =>
    apiClient.get('/chat/users/search', { params: { q: query } }),
  getOnlineUsers: () => apiClient.get('/chat/online-users'),
  manageFriend: (friendId: string, data: { action: 'request' | 'accept' | 'reject' | 'block' }) =>
    apiClient.post(`/chat/friends/${friendId}`, data),
  removeFriend: (friendId: string) =>
    apiClient.delete(`/chat/friends/${friendId}`),
  globalSearch: (params: { q: string; sessionId?: string; types?: string; page?: number; limit?: number }) =>
    apiClient.get('/chat/search', { params }),
  forwardMessage: (messageId: string, targetSessionIds: string[]) =>
    apiClient.post('/chat/messages/forward', { messageId, targetSessionIds }),
  batchForwardMessages: (messageIds: string[], targetSessionId: string) =>
    apiClient.post('/chat/messages/batch/forward', { messageIds, targetSessionId }),
  batchDeleteMessages: (messageIds: string[], type: 'self' | 'everyone') =>
    apiClient.post('/chat/messages/batch/delete', { messageIds, type }),
  getSessionMembers: (sessionId: string) =>
    apiClient.get(`/chat/sessions/${sessionId}/members`),
  setAnnouncement: (sessionId: string, content: string) =>
    apiClient.post(`/chat/sessions/${sessionId}/announcement`, { content }),
  removeAnnouncement: (sessionId: string) =>
    apiClient.delete(`/chat/sessions/${sessionId}/announcement`),
  generateInviteLink: (sessionId: string) =>
    apiClient.post(`/chat/sessions/${sessionId}/invite-link`),
  joinByLink: (code: string) =>
    apiClient.post('/chat/sessions/join-by-link', { code }),
  toggleBookmark: (messageId: string) =>
    apiClient.post(`/chat/messages/${messageId}/bookmark`),
  getBookmarks: (limit?: number) =>
    apiClient.get('/chat/bookmarks', { params: { limit } }),
  updateBookmark: (messageId: string, data: { tags?: string[]; note?: string }) =>
    apiClient.patch(`/chat/messages/${messageId}/bookmark`, data),
  searchBookmarks: (params?: { tag?: string; q?: string }) =>
    apiClient.get('/chat/bookmarks/search', { params }),
  togglePinSession: (sessionId: string) =>
    apiClient.patch(`/chat/sessions/${sessionId}/pin`),
  muteSession: (sessionId: string, muted: boolean, muteUntil?: string) =>
    apiClient.patch(`/chat/sessions/${sessionId}/mute`, { muted, muteUntil }),
  getReadReceipts: (messageId: string, page?: number, limit?: number) =>
    apiClient.get(`/chat/messages/${messageId}/read-receipts`, { params: { page, limit } }),
  editMessage: (messageId: string, content: string) =>
    apiClient.patch(`/chat/messages/${messageId}`, { content }),
  getEditHistory: (messageId: string) =>
    apiClient.get(`/chat/messages/${messageId}/edit-history`),
  addReaction: (messageId: string, emoji: string) =>
    apiClient.post('/chat/reactions', { messageId, emoji }),
  removeReaction: (messageId: string, emoji: string) =>
    apiClient.delete('/chat/reactions', { data: { messageId, emoji } }),

  // Channel APIs
  getChannels: () => apiClient.get('/chat/channels'),
  createChannel: (data: { name: string; description?: string; isPublic?: boolean }) =>
    apiClient.post('/chat/channels', data),
  updateChannel: (channelId: string, data: { name?: string; description?: string; avatarUrl?: string; whoCanPost?: string }) =>
    apiClient.patch(`/chat/channels/${channelId}`, data),
  deleteChannel: (channelId: string) =>
    apiClient.delete(`/chat/channels/${channelId}`),
  subscribeChannel: (channelId: string) =>
    apiClient.post(`/chat/channels/${channelId}/subscribe`),
  unsubscribeChannel: (channelId: string) =>
    apiClient.post(`/chat/channels/${channelId}/unsubscribe`),
  discoverChannels: (params?: { q?: string; page?: number; limit?: number }) =>
    apiClient.get('/chat/channels/discover', { params }),
  inviteToChannel: (channelId: string, userId: string) =>
    apiClient.post(`/chat/channels/${channelId}/invite`, { userId }),
  getChannelInvitations: () =>
    apiClient.get('/chat/channels/invitations'),
  acceptChannelInvitation: (invitationId: string) =>
    apiClient.post(`/chat/channels/invitations/${invitationId}/accept`),
  rejectChannelInvitation: (invitationId: string) =>
    apiClient.post(`/chat/channels/invitations/${invitationId}/reject`),
  applyToJoinChannel: (channelId: string, reason?: string) =>
    apiClient.post(`/chat/channels/${channelId}/apply`, { reason }),
  getPendingApplications: (channelId: string) =>
    apiClient.get(`/chat/channels/${channelId}/applications`),
  approveJoinApplication: (channelId: string, userId: string) =>
    apiClient.post(`/chat/channels/${channelId}/applications/${userId}/approve`),
  rejectJoinApplication: (channelId: string, userId: string) =>
    apiClient.post(`/chat/channels/${channelId}/applications/${userId}/reject`),
  updateChannelJoinApproval: (channelId: string, mode: string) =>
    apiClient.patch(`/chat/channels/${channelId}/join-approval`, { mode }),
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
  updateStatus: (status: string) =>
    apiClient.patch('/users/status', { status }),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return apiClient.post('/users/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const knowledgeApi = {
  listBases: () => apiClient.get('/knowledge/bases'),
  createBase: (data: { name: string; description?: string; isPublic?: boolean }) =>
    apiClient.post('/knowledge/bases', data),
  getBase: (kbId: string) => apiClient.get(`/knowledge/bases/${kbId}`),
  deleteBase: (kbId: string) => apiClient.delete(`/knowledge/bases/${kbId}`),
  addText: (kbId: string, content: string, metadata?: Record<string, any>) =>
    apiClient.post(`/knowledge/bases/${kbId}/text`, { content, metadata }),
  uploadDocument: (kbId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post(`/knowledge/bases/${kbId}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  search: (query: string, topK?: number) =>
    apiClient.get('/knowledge/search', { params: { query, topK } }),
};

export const uploadApi = {
  uploadFile: (file: File, onProgress?: (pct: number) => void, description?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (description) form.append('description', description);
    return apiClient.post('/upload/file', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
  },
  uploadImage: (file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post('/upload/image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
  },
  getFileInfo: (id: string) => apiClient.get(`/upload/files/${id}`),
  getDownloadUrl: (id: string) => `/api/v1/upload/files/${id}/download`,
  listFiles: (page?: number, pageSize?: number) =>
    apiClient.get('/upload/files', { params: { page, pageSize } }),
  deleteFile: (id: string) => apiClient.delete(`/upload/files/${id}`),
};

export const adminApi = {
  listUsers: (params?: { page?: number; limit?: number; search?: string; status?: string; role?: string }) =>
    apiClient.get('/admin/users', { params }),
  updateUserStatus: (userId: string, status: string) =>
    apiClient.patch(`/admin/users/${userId}/status`, { status }),
  updateUserRole: (userId: string, role: string) =>
    apiClient.patch(`/admin/users/${userId}/role`, { role }),
  deleteUser: (userId: string) =>
    apiClient.delete(`/admin/users/${userId}`),
  listAuditLogs: (params?: { page?: number; limit?: number; action?: string }) =>
    apiClient.get('/admin/audit-logs', { params }),
  getSettings: () => apiClient.get('/admin/settings'),
  updateSetting: (key: string, value: any, description?: string) =>
    apiClient.patch('/admin/settings', { key, value, description }),
  getStats: () => apiClient.get('/admin/stats'),
};
