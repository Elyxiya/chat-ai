import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAgentStore } from '@/stores/agent.store';
import StreamingText from '@/components/AgentPanel/StreamingText/StreamingText';
import ThinkingChain from '@/components/AgentPanel/ThinkingChain/ThinkingChain';
import ToolCallLog from '@/components/AgentPanel/ToolCallLog/ToolCallLog';

export default function AgentChatPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const {
    messages,
    streamingContent,
    isStreaming,
    mode,
    error,
    typingSpeed,
    setMode,
    setTypingSpeed,
    sendMessage,
    sendStreamMessage,
    stopStream,
    clearMessages,
    loadHistory,
  } = useAgentStore();

  const [input, setInput] = useState('');
  const [showThinking, setShowThinking] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;
    const msg = input.trim();
    setInput('');
    await sendStreamMessage(msg);
  }, [input, isStreaming, sendStreamMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      {/* Header */}
      <header className="h-14 px-4 border-b border-border flex items-center gap-3 bg-surface">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-sm">AI Agent</h2>
          <p className="text-xs text-text-secondary">
            {isStreaming ? 'Generating response...' : 'Powered by DeepSeek V3 + R1'}
          </p>
        </div>

        {/* Mode selector */}
        <div className="flex gap-1 bg-bg rounded-lg p-1">
          {(['react', 'planner', 'reasoner'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                mode === m
                  ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              {m === 'react' ? 'ReAct' : m === 'planner' ? '规划' : '推理'}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowThinking(!showThinking)}
          className={`p-2 rounded-lg transition-colors ${showThinking ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600' : 'hover:bg-bg text-text-secondary'}`}
          title="Show reasoning chain"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </button>

        {/* Speed control */}
        <div className="flex items-center gap-1.5 group relative" title={`Typing speed: ${typingSpeed}ms`}>
          <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <input
            type="range"
            min="0"
            max="50"
            value={50 - typingSpeed}
            onChange={(e) => setTypingSpeed(50 - Number(e.target.value))}
            className="w-16 h-1 appearance-none bg-border rounded-full cursor-pointer accent-primary-500 opacity-80 hover:opacity-100 transition-opacity"
          />
        </div>

        <button
          onClick={() => setShowTools(!showTools)}
          className={`p-2 rounded-lg transition-colors ${showTools ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600' : 'hover:bg-bg text-text-secondary'}`}
          title="Tool calls"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <button
          onClick={clearMessages}
          className="p-2 hover:bg-bg rounded-lg text-text-secondary transition-colors"
          title="Clear conversation"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Messages area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {messages.length === 0 && !isStreaming && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">AI Agent</h3>
                  <p className="text-text-secondary text-sm">
                    Powered by DeepSeek V3 + R1. Try asking complex questions, planning tasks,
                    or searching the knowledge base.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {['帮我分析一下最近的业务数据', '用规划模式帮我组织本周工作', '搜索一下知识库中关于产品功能的文档'].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setInput(suggestion)}
                        className="px-3 py-1.5 text-xs bg-bg border border-border rounded-full hover:border-primary-300 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                  {msg.role === 'user' ? (
                    <div className="bg-primary-600 text-white px-4 py-2.5 rounded-2xl rounded-br-md">
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="bg-surface border border-border px-4 py-3 rounded-2xl rounded-bl-md">
                      {msg.metadata?.reasoning && showThinking && (
                        <ThinkingChain />
                      )}
                      <StreamingText
                        content={msg.content}
                        className="text-sm whitespace-pre-wrap"
                        isStreaming={false}
                      />
                    </div>
                  )}
                  <p className="text-xs text-text-secondary mt-1 px-1">
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}
                  </p>
                </div>
              </div>
            ))}

            {/* Streaming */}
            {isStreaming && (
              <div className="flex justify-start">
                <div className="max-w-[70%] bg-surface border border-border px-4 py-3 rounded-2xl rounded-bl-md space-y-2">
                  {showThinking && <ThinkingChain />}
                  <StreamingText
                    content={streamingContent}
                    className="text-sm whitespace-pre-wrap"
                    typingSpeed={typingSpeed}
                    isStreaming={true}
                  />
                  {!streamingContent && (
                    <span className="inline-block w-2 h-4 bg-primary-500 animate-pulse ml-1" />
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border bg-surface">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                className="input-field resize-none max-h-40"
                rows={1}
                placeholder="Ask the AI Agent anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
              />
              {isStreaming ? (
                <button
                  onClick={stopStream}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg flex-shrink-0 transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h12v12H6z" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={() => handleSubmit()}
                  disabled={!input.trim()}
                  className="btn-primary px-4 py-2 flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-xs text-text-secondary mt-2">
              Mode: {mode === 'react' ? 'ReAct (快速响应)' : mode === 'planner' ? 'Plan-and-Execute (规划执行)' : 'Reasoner (深度推理)'}
            </p>
          </div>
        </div>

        {/* Side panel */}
        {(showThinking || showTools) && (
          <div className="w-80 border-l border-border p-4 overflow-y-auto scrollbar-thin">
            {showThinking && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold">Reasoning Chain</h3>
                  {isStreaming && (
                    <span className="inline-block w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
                  )}
                </div>
                <ThinkingChain />
              </div>
            )}
            {showTools && <ToolCallLog />}
          </div>
        )}
      </div>
    </>
  );
}
