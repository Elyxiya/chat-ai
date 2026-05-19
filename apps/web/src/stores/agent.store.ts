import { create } from 'zustand';
import { AgentMessage, AgentResponse } from '@/types';
import { agentApi } from '@/api/client';
import { useAuthStore } from './auth.store';

interface AgentState {
  isAgentMode: boolean;
  messages: AgentMessage[];
  streamingContent: string;
  isStreaming: boolean;
  mode: 'react' | 'planner' | 'reasoner';
  toolCalls: Array<{ name: string; args: Record<string, any>; result?: any; success?: boolean }>;
  error: string | null;
  sessionId: string | null;

  setMode: (mode: 'react' | 'planner' | 'reasoner') => void;
  sendMessage: (content: string) => Promise<void>;
  sendStreamMessage: (content: string) => Promise<void>;
  stopStream: () => void;
  clearMessages: () => void;
  clearMemory: () => Promise<void>;
  loadHistory: () => Promise<void>;
}

export const useAgentStore = create<AgentState>()((set, get) => ({
  isAgentMode: false,
  messages: [],
  streamingContent: '',
  isStreaming: false,
  mode: 'react',
  toolCalls: [],
  error: null,
  sessionId: null,

  setMode: (mode) => set({ mode }),

  sendMessage: async (content) => {
    const { messages } = get();
    const userMsg: AgentMessage = { role: 'user', content, timestamp: Date.now() };
    set({ messages: [...messages, userMsg], isAgentMode: true, error: null });

    try {
      const res: any = await agentApi.chat(content);
      const response: AgentResponse = res.data;

      const assistantMsg: AgentMessage = {
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        metadata: {
          reasoning: response.reasoning,
          type: response.type,
          toolCalls: response.toolCalls,
          ...response.metadata,
        },
      };

      set((state) => ({ messages: [...state.messages, assistantMsg] }));
    } catch (err: any) {
      set({ error: err.response?.data?.message || err.message || '请求失败' });
    }
  },

  sendStreamMessage: async (content) => {
    const { messages } = get();
    const userMsg: AgentMessage = { role: 'user', content, timestamp: Date.now() };
    set({
      messages: [...messages, userMsg],
      isAgentMode: true,
      isStreaming: true,
      streamingContent: '',
      error: null,
    });

    const token = useAuthStore.getState().accessToken;

    try {
      const response = await fetch('/api/v1/agent/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: content }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'chunk') {
                  fullContent += data.content;
                  set({ streamingContent: fullContent });
                } else if (data.type === 'done') {
                  const assistantMsg: AgentMessage = {
                    role: 'assistant',
                    content: fullContent,
                    timestamp: Date.now(),
                  };
                  set((state) => ({
                    messages: [...state.messages, assistantMsg],
                    isStreaming: false,
                    streamingContent: '',
                  }));
                } else if (data.type === 'error') {
                  set({ error: data.message, isStreaming: false });
                }
              } catch {
                // skip malformed
              }
            }
          }
        }
      }
    } catch (err: any) {
      set({ error: err.message, isStreaming: false });
    }
  },

  stopStream: () => {
    set({ isStreaming: false, streamingContent: '' });
  },

  clearMessages: () => set({ messages: [], streamingContent: '' }),

  clearMemory: async () => {
    await agentApi.clearMemory();
    set({ messages: [], streamingContent: '' });
  },

  loadHistory: async () => {
    try {
      const res: any = await agentApi.getHistory();
      set({ messages: res.data || [] });
    } catch {
      // ignore
    }
  },
}));
