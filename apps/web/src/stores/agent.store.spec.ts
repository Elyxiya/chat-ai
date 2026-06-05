import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAgentStore } from './agent.store';
import { useAuthStore } from './auth.store';

vi.mock('@/api/client', () => ({
  agentApi: {
    chat: vi.fn(),
    clearMemory: vi.fn(() => Promise.resolve()),
    getHistory: vi.fn(),
  },
}));

import { agentApi } from '@/api/client';

// Helper to create SSE data: lines.
// The store parses JSON from each "data: " prefixed line.
// For 'start' event, store reads event.sessionId (top-level),
// so we need to put sessionId at the top level, not under data.
const rawEvent = (type: string, payload: Record<string, any>) =>
  `data: ${JSON.stringify({ type, ...payload })}\n\n`;

const streamEvent = (type: string, data?: any) =>
  `data: ${JSON.stringify({ type, data })}\n\n`;

function createMockReader(chunks: string[]): ReadableStreamDefaultReader {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    read: vi.fn(async () => {
      if (index < chunks.length) {
        const value = encoder.encode(chunks[index++]);
        return { done: false, value };
      }
      return { done: true, value: undefined as any };
    }),
    cancel: vi.fn(),
    releaseLock: vi.fn(),
    closed: Promise.resolve(undefined),
  } as any;
}

describe('agent.store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAgentStore.setState({
      isAgentMode: false,
      messages: [],
      streamingContent: '',
      isStreaming: false,
      typingSpeed: 8,
      mode: 'react',
      toolCalls: [],
      reasoningSteps: [],
      currentStep: 0,
      error: null,
      sessionId: null,
      pendingMessage: null,
    });
  });

  describe('initial state', () => {
    it('AGENT-WEB-01: should have initial state', () => {
      const state = useAgentStore.getState();
      expect(state.isAgentMode).toBe(false);
      expect(state.messages).toEqual([]);
      expect(state.streamingContent).toBe('');
      expect(state.isStreaming).toBe(false);
      expect(state.mode).toBe('react');
      expect(state.toolCalls).toEqual([]);
      expect(state.error).toBeNull();
    });
  });

  describe('setMode / setTypingSpeed', () => {
    it('AGENT-WEB-02: should set mode', () => {
      useAgentStore.getState().setMode('planner');
      expect(useAgentStore.getState().mode).toBe('planner');
    });

    it('AGENT-WEB-03: should set typing speed', () => {
      useAgentStore.getState().setTypingSpeed(5);
      expect(useAgentStore.getState().typingSpeed).toBe(5);
    });
  });

  describe('sendMessage (non-streaming)', () => {
    it('AGENT-WEB-04: should send message and receive response', async () => {
      const mockResponse = {
        data: {
          content: 'Hi there!',
          type: 'final',
          reasoning: '',
          toolCalls: [],
        },
      };
      vi.mocked(agentApi.chat).mockResolvedValue(mockResponse as any);

      await useAgentStore.getState().sendMessage('Hello');

      const state = useAgentStore.getState();
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].role).toBe('user');
      expect(state.messages[0].content).toBe('Hello');
      expect(state.messages[1].role).toBe('assistant');
      expect(state.messages[1].content).toBe('Hi there!');
      expect(state.isAgentMode).toBe(true);
    });

    it('AGENT-WEB-05: should handle API error', async () => {
      vi.mocked(agentApi.chat).mockRejectedValue({
        response: { data: { message: 'API Error' } },
      });

      await useAgentStore.getState().sendMessage('Hello');

      expect(useAgentStore.getState().error).toBe('API Error');
    });

    it('AGENT-WEB-06: should handle network error', async () => {
      vi.mocked(agentApi.chat).mockRejectedValue(new Error('Network error'));

      await useAgentStore.getState().sendMessage('Hello');

      expect(useAgentStore.getState().error).toBe('Network error');
    });
  });

  describe('sendStreamMessage', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: null,
        accessToken: 'mock-token',
        refreshToken: null,
        isAuthenticated: true,
        isLoading: false,
      });
    });

    it('AGENT-WEB-07: should deduplicate when already streaming', async () => {
      useAgentStore.setState({ isStreaming: true });

      await useAgentStore.getState().sendStreamMessage('Hello');

      expect(useAgentStore.getState().messages).toHaveLength(0);
    });

    it('AGENT-WEB-08: should deduplicate when pendingMessage matches', async () => {
      useAgentStore.setState({ pendingMessage: 'Hello' });

      await useAgentStore.getState().sendStreamMessage('Hello');

      expect(useAgentStore.getState().messages).toHaveLength(0);
    });

    it('AGENT-WEB-09: should handle streaming with chunk and done events', async () => {
      const chunks = [
        streamEvent('chunk', { content: 'Hello' }),
        streamEvent('chunk', { content: ' world' }),
        streamEvent('done'),
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        body: { getReader: () => createMockReader(chunks) },
      } as any);

      await useAgentStore.getState().sendStreamMessage('Hi');

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/agent/chat/stream/enhanced', {
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
        }),
        body: JSON.stringify({ message: 'Hi', mode: 'react' }),
      });

      const state = useAgentStore.getState();
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].content).toBe('Hi');
      expect(state.messages[1].content).toBe('Hello world');
      expect(state.isStreaming).toBe(false);
    });

    it('AGENT-WEB-10: should handle reasoning events', async () => {
      // 'start' event: store reads event.sessionId (top-level)
      const chunks = [
        rawEvent('start', { sessionId: 'sess-1' }),
        streamEvent('reasoning', { step: 1, reasoning: 'Thinking...' }),
        streamEvent('chunk', { content: 'Answer' }),
        streamEvent('done'),
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        body: { getReader: () => createMockReader(chunks) },
      } as any);

      await useAgentStore.getState().sendStreamMessage('Why?');

      const state = useAgentStore.getState();
      expect(state.sessionId).toBe('sess-1');
      expect(state.reasoningSteps.length).toBeGreaterThan(0);
      expect(state.reasoningSteps[0].reasoning).toContain('Thinking');
      expect(state.messages[1].content).toBe('Answer');
    });

    it('AGENT-WEB-11: should handle tool_call and tool_result events', async () => {
      const chunks = [
        streamEvent('tool_call', { name: 'get_time', args: {} }),
        streamEvent('tool_result', { result: { result: '12:00', success: true } }),
        streamEvent('done'),
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        body: { getReader: () => createMockReader(chunks) },
      } as any);

      await useAgentStore.getState().sendStreamMessage('Time?');

      const state = useAgentStore.getState();
      expect(state.toolCalls).toHaveLength(1);
      expect(state.toolCalls[0].name).toBe('get_time');
      expect(state.toolCalls[0].result).toBe('12:00');
    });

    it('AGENT-WEB-12: should handle error event from stream', async () => {
      const chunks = [
        streamEvent('error', { message: 'Stream error occurred' }),
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        body: { getReader: () => createMockReader(chunks) },
      } as any);

      await useAgentStore.getState().sendStreamMessage('Hi');

      expect(useAgentStore.getState().error).toBe('Stream error occurred');
      expect(useAgentStore.getState().isStreaming).toBe(false);
    });

    it('AGENT-WEB-13: should handle fetch failure gracefully', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Fetch failed'));

      await useAgentStore.getState().sendStreamMessage('Hi');

      expect(useAgentStore.getState().error).toBe('Fetch failed');
      expect(useAgentStore.getState().isStreaming).toBe(false);
    });

    it('AGENT-WEB-14: should handle thinking_done event (does not leak reasoning to content)', async () => {
      // thinking_done is deliberately skipped — reasoning goes to reasoningSteps, not fullContent
      const chunks = [
        streamEvent('chunk', { content: 'Answer' }),
        streamEvent('thinking_done', { reasoning: ' Step by step' }),
        streamEvent('done'),
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        body: { getReader: () => createMockReader(chunks) },
      } as any);

      await useAgentStore.getState().sendStreamMessage('Hi');

      // Content should NOT include "Step by step" — only the chunk content
      expect(useAgentStore.getState().messages[1].content).toBe('Answer');
    });

    it('AGENT-WEB-15: should handle final event with content and reasoning', async () => {
      const chunks = [
        streamEvent('chunk', { content: 'Final answer' }),
        streamEvent('final', { content: 'Final answer', reasoning: 'My reasoning' }),
        streamEvent('done'),
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        body: { getReader: () => createMockReader(chunks) },
      } as any);

      await useAgentStore.getState().sendStreamMessage('Hi');

      expect(useAgentStore.getState().messages[1].content).toBe('Final answer');
    });
  });

  describe('stopStream / clearMessages / clearHistory', () => {
    it('AGENT-WEB-16: should stop stream and clear streaming state', () => {
      useAgentStore.setState({
        isStreaming: true,
        streamingContent: 'partial',
        pendingMessage: 'msg',
      });

      useAgentStore.getState().stopStream();

      const state = useAgentStore.getState();
      expect(state.isStreaming).toBe(false);
      expect(state.streamingContent).toBe('');
      expect(state.pendingMessage).toBeNull();
    });

    it('AGENT-WEB-17: should clear messages only', () => {
      useAgentStore.setState({
        messages: [{ role: 'user', content: 'Hi', timestamp: 1 }],
        streamingContent: 'partial',
        toolCalls: [{ name: 'test', args: {}, timestamp: 1 }],
        reasoningSteps: [{ step: 1, reasoning: 'test' }],
      });

      useAgentStore.getState().clearMessages();

      const state = useAgentStore.getState();
      expect(state.messages).toEqual([]);
      expect(state.streamingContent).toBe('');
      expect(state.toolCalls).toEqual([]);
      expect(state.reasoningSteps).toEqual([]);
    });

    it('AGENT-WEB-18: should clear all history', () => {
      useAgentStore.setState({
        messages: [{ role: 'user', content: 'Hi', timestamp: 1 }],
        sessionId: 'sess-1',
        isStreaming: false,
        streamingContent: '',
      });

      useAgentStore.getState().clearHistory();

      const state = useAgentStore.getState();
      expect(state.messages).toEqual([]);
      expect(state.sessionId).toBeNull();
      expect(state.toolCalls).toEqual([]);
      expect(state.reasoningSteps).toEqual([]);
    });
  });

  describe('clearMemory', () => {
    it('AGENT-WEB-19: should call clearMemory API and reset state', async () => {
      vi.mocked(agentApi.clearMemory).mockResolvedValue(undefined);
      useAgentStore.setState({
        messages: [{ role: 'user', content: 'test', timestamp: 1 }],
        streamingContent: 'x',
      });

      await useAgentStore.getState().clearMemory();

      expect(agentApi.clearMemory).toHaveBeenCalled();
      expect(useAgentStore.getState().messages).toEqual([]);
      expect(useAgentStore.getState().streamingContent).toBe('');
    });
  });

  describe('loadHistory', () => {
    it('AGENT-WEB-20: should load history from API', async () => {
      const history = [{ role: 'assistant' as const, content: 'Previous', timestamp: 1 }];
      vi.mocked(agentApi.getHistory).mockResolvedValue({ data: history });

      await useAgentStore.getState().loadHistory();

      expect(useAgentStore.getState().messages).toEqual(history);
    });

    it('AGENT-WEB-21: should handle loadHistory failure silently', async () => {
      vi.mocked(agentApi.getHistory).mockRejectedValue(new Error('Failed'));

      await useAgentStore.getState().loadHistory();

      expect(useAgentStore.getState().messages).toEqual([]);
    });
  });
});
