import { create } from 'zustand';
import { AgentMessage, AgentResponse } from '@/types';
import { agentApi } from '@/api/client';
import { useAuthStore } from './auth.store';

interface ToolCallEntry {
  name: string;
  args: Record<string, any>;
  result?: any;
  success?: boolean;
  timestamp: number;
}

interface ReasoningStep {
  step: number;
  reasoning: string;
}

interface AgentState {
  isAgentMode: boolean;
  messages: AgentMessage[];
  streamingContent: string;
  isStreaming: boolean;
  typingSpeed: number;
  mode: 'react' | 'planner' | 'reasoner';
  toolCalls: ToolCallEntry[];
  reasoningSteps: ReasoningStep[];
  currentStep: number;
  error: string | null;
  sessionId: string | null;
  pendingMessage: string | null;

  setMode: (mode: 'react' | 'planner' | 'reasoner') => void;
  setTypingSpeed: (speed: number) => void;
  sendMessage: (content: string) => Promise<void>;
  sendStreamMessage: (content: string) => Promise<void>;
  stopStream: () => void;
  clearMessages: () => void;
  streamMessage: (content: string, modeOverride?: string) => Promise<void>;
  clearHistory: () => void;
  clearMemory: () => Promise<void>;
  loadHistory: () => Promise<void>;
}

export const useAgentStore = create<AgentState>()((set, get) => ({
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

  setMode: (mode) => set({ mode }),
  setTypingSpeed: (speed) => set({ typingSpeed: speed }),
  streamMessage: async (content, modeOverride) => {
    const mode = modeOverride || get().mode;
    set({ mode: mode as 'react' | 'planner' | 'reasoner' });
    await get().sendStreamMessage(content);
  },
  clearHistory: () => {
    set({
      messages: [],
      streamingContent: '',
      toolCalls: [],
      reasoningSteps: [],
      currentStep: 0,
      error: null,
      sessionId: null,
      pendingMessage: null,
      isStreaming: false,
    });
  },

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
    const { messages, isStreaming, pendingMessage } = get();
    // Deduplication: ignore if same message is already streaming or pending
    if (isStreaming) return;
    if (pendingMessage === content) return;
    const userMsg: AgentMessage = { role: 'user', content, timestamp: Date.now() };
    set({
      messages: [...messages, userMsg],
      isAgentMode: true,
      isStreaming: true,
      streamingContent: '',
      toolCalls: [],
      reasoningSteps: [],
      currentStep: 0,
      error: null,
      pendingMessage: content,
    });

    const token = useAuthStore.getState().accessToken;

    try {
      const response = await fetch('/api/v1/agent/chat/stream/enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: content, mode: get().mode }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let fullReasoning = '';
      let hasFinalized = false; // guard against double-finalize from duplicate 'done'

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          // split by newline but preserve empty lines for robustness
          const lines = text.split(/\r?\n/);

          for (const rawLine of lines) {
            if (!rawLine.startsWith('data: ')) continue;
            const line = rawLine.slice(6).trim();
            if (!line) continue;

            try {
              const event = JSON.parse(line);

              switch (event.type) {
                case 'start':
                  set({ sessionId: event.sessionId });
                  break;

                case 'step':
                  set({ currentStep: event.data?.step || 0 });
                  break;

                // Handle 'reasoning' events from backend (alias for 'thinking')
                case 'reasoning':
                case 'thinking':
                  fullReasoning += `\n[Step ${event.data?.step || '?'}] ${event.data?.reasoning || event.data?.content || ''}`;
                  set((state) => ({
                    reasoningSteps: [
                      ...state.reasoningSteps.filter((s) => s.step !== event.data?.step),
                      { step: event.data?.step || state.reasoningSteps.length + 1, reasoning: event.data?.reasoning || event.data?.content || '' },
                    ],
                  }));
                  break;

                case 'tool_call':
                  set((state) => ({
                    toolCalls: [
                      ...state.toolCalls,
                      { name: event.data?.name || '', args: event.data?.args || {}, timestamp: Date.now() },
                    ],
                  }));
                  break;

                case 'tool_result': {
                  set((state) => ({
                    toolCalls: state.toolCalls.map((tc, idx) =>
                      idx === state.toolCalls.length - 1
                        ? {
                            ...tc,
                            result: event.data?.result?.result,
                            success: event.data?.result?.success,
                          }
                        : tc,
                    ),
                  }));
                  break;
                }

                case 'chunk':
                  if (!hasFinalized) {
                    fullContent += event.data?.content || '';
                    set({ streamingContent: fullContent });
                  }
                  break;

                // 'final' events also carry content — emit as chunk first
                case 'final':
                case 'thinking_done':
                  if (!hasFinalized) {
                    const incoming = event.type === 'final' ? event.data?.content : event.data?.reasoning;
                    if (incoming) {
                      fullContent += incoming;
                      set({ streamingContent: fullContent });
                    }
                    if (event.type === 'final') {
                      fullReasoning = event.data?.reasoning || fullReasoning;
                      hasFinalized = true;
                    }
                  }
                  break;

                case 'done': {
                  if (hasFinalized || fullContent) {
                    const assistantMsg: AgentMessage = {
                      role: 'assistant',
                      content: fullContent,
                      timestamp: Date.now(),
                      metadata: {
                        reasoning: fullReasoning,
                        toolCalls: get().toolCalls,
                      },
                    };
                    set((state) => ({
                      messages: [...state.messages, assistantMsg],
                      isStreaming: false,
                      streamingContent: '',
                      pendingMessage: null,
                    }));
                    hasFinalized = true;
                  } else {
                    set({ isStreaming: false, streamingContent: '', pendingMessage: null });
                  }
                  break;
                }

                case 'error':
                  set({ error: event.data?.message || 'Unknown error', isStreaming: false, pendingMessage: null });
                  break;
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      }
    } catch (err: any) {
      set({ error: err.message, isStreaming: false, pendingMessage: null });
    }
  },

  stopStream: () => {
    set({ isStreaming: false, streamingContent: '', pendingMessage: null });
  },

  clearMessages: () => set({ messages: [], streamingContent: '', toolCalls: [], reasoningSteps: [], pendingMessage: null }),

  clearMemory: async () => {
    await agentApi.clearMemory();
    set({ messages: [], streamingContent: '', toolCalls: [], reasoningSteps: [] });
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
