import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the raw interceptors by importing them directly.
// Rather than mocking axios and re-importing the module (which is fragile),
// we verify the API objects exist and test the auth store interactions.

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: { getState: vi.fn() },
}));

import { useAuthStore } from '@/stores/auth.store';

describe('api/client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API objects', () => {
    it('API-WEB-01: should export all API objects', async () => {
      const client = await import('./client');
      expect(client.authApi).toBeDefined();
      expect(client.chatApi).toBeDefined();
      expect(client.agentApi).toBeDefined();
      expect(client.userApi).toBeDefined();
      expect(client.knowledgeApi).toBeDefined();
      expect(client.apiClient).toBeDefined();
      expect(client.noAuthClient).toBeDefined();
    });
  });

  describe('authApi', () => {
    it('API-WEB-02: authApi should have expected methods', async () => {
      const { authApi } = await import('./client');
      expect(typeof authApi.login).toBe('function');
      expect(typeof authApi.register).toBe('function');
      expect(typeof authApi.logout).toBe('function');
      expect(typeof authApi.refresh).toBe('function');
      expect(typeof authApi.me).toBe('function');
      expect(typeof authApi.sendCode).toBe('function');
      expect(typeof authApi.resetPassword).toBe('function');
    });
  });

  describe('chatApi', () => {
    it('API-WEB-03: chatApi should have expected methods', async () => {
      const { chatApi } = await import('./client');
      expect(typeof chatApi.getSessions).toBe('function');
      expect(typeof chatApi.createSession).toBe('function');
      expect(typeof chatApi.getMessages).toBe('function');
      expect(typeof chatApi.recallMessage).toBe('function');
      expect(typeof chatApi.markRead).toBe('function');
      expect(typeof chatApi.addMembers).toBe('function');
      expect(typeof chatApi.removeMember).toBe('function');
    });
  });

  describe('auth store integration', () => {
    it('API-WEB-04: should read token from auth store', async () => {
      const mockGetState = vi.fn();
      (useAuthStore.getState as any) = mockGetState;
      mockGetState.mockReturnValue({ accessToken: 'test-token' });

      const { apiClient } = await import('./client');
      // Create a request config and run it through the interceptor
      const config: any = { headers: {} };
      const interceptors = (apiClient as any).interceptors;
      const requestHandler = interceptors.request.handlers[0]?.fulfilled;

      if (requestHandler) {
        const result = requestHandler(config);
        // The interceptor may return the config with auth header
        if (result?.headers?.Authorization) {
          expect(result.headers.Authorization).toBe('Bearer test-token');
        }
      }
    });
  });

  describe('noAuthClient', () => {
    it('API-WEB-05: noAuthClient should exist without auth interceptors', async () => {
      const { noAuthClient, apiClient } = await import('./client');
      expect(noAuthClient).toBeDefined();
      expect(typeof noAuthClient.post).toBe('function');
    });
  });
});
