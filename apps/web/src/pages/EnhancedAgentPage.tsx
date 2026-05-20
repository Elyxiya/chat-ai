import { useState, useEffect, useRef, useCallback } from 'react';
import { useAgentStore } from '@/stores/agent.store';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import ThinkingChain from '@/components/AgentPanel/ThinkingChain/ThinkingChain';
import ToolCallLog from '@/components/AgentPanel/ToolCallLog/ToolCallLog';
import StreamingText from '@/components/AgentPanel/StreamingText/StreamingText';
import { agentApi } from '@/api/client';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export default function EnhancedAgentPage() {
  const { user } = useAuthStore();
  const {
    messages,
    streamingContent,
    isStreaming,
    reasoningSteps,
    toolCalls,
    sendMessage,
    streamMessage,
    clearHistory,
  } = useAgentStore();

  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'react' | 'plan'>('react');
  const [showThinking, setShowThinking] = useState(true);
  const [showTools, setShowTools] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const content = input.trim();
    setInput('');
    await streamMessage(content, mode === 'plan' ? 'plan-execute' : 'react');
  }, [input, isStreaming, mode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full">
      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-bold">
              AI
            </div>
            <div>
              <h2 className="font-semibold">DeepSeek AI Agent</h2>
              <p className="text-xs text-text-secondary">
                {isStreaming ? 'Generating...' : 'Ready'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode selector */}
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'react' | 'plan')}
              className="text-sm bg-bg border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="react">ReAct Mode</option>
              <option value="plan">Plan & Execute</option>
            </select>

            <button
              onClick={() => setShowThinking(!showThinking)}
              className={`p-1.5 rounded-lg transition-colors ${showThinking ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30' : 'text-text-secondary hover:bg-border'}`}
              title="Toggle thinking chain"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </button>

            <button
              onClick={() => setShowTools(!showTools)}
              className={`p-1.5 rounded-lg transition-colors ${showTools ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30' : 'text-text-secondary hover:bg-border'}`}
              title="Toggle tool calls"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              </svg>
            </button>

            <button
              onClick={clearHistory}
              className="p-1.5 text-text-secondary hover:bg-border rounded-lg transition-colors"
              title="Clear history"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={msg.id || i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                {msg.role === 'user' ? (
                  <div className="px-3.5 py-2.5 bg-primary-600 text-white rounded-2xl rounded-br-md text-sm whitespace-pre-wrap">
                    {msg.content}
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
            </div>
          ))}

          {streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[80%]">
                <StreamingText text={streamingContent} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask the AI agent anything (${mode === 'react' ? 'ReAct' : 'Plan mode'})...`}
              className="input-field flex-1 resize-none min-h-[44px] max-h-32"
              rows={1}
              disabled={isStreaming}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="btn-primary px-4 disabled:opacity-50 self-end"
            >
              {isStreaming ? (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  Stop
                </span>
              ) : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {/* Right panel: Thinking + Tools */}
      {(showThinking || showTools) && (
        <aside className="w-80 border-l border-border flex flex-col overflow-hidden">
          {showThinking && (
            <div className="flex-1 border-b border-border overflow-y-auto">
              <div className="p-3 border-b border-border sticky top-0 bg-surface">
                <h3 className="text-sm font-medium">Thinking Chain</h3>
              </div>
              <div className="p-3">
                <ThinkingChain steps={reasoningSteps} />
              </div>
            </div>
          )}

          {showTools && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 border-b border-border sticky top-0 bg-surface">
                <h3 className="text-sm font-medium">Tool Calls</h3>
              </div>
              <div className="p-3">
                <ToolCallLog calls={toolCalls} />
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
