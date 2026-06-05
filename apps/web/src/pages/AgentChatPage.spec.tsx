import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockSendStreamMessage = vi.fn();
const mockStopStream = vi.fn();
const mockClearMessages = vi.fn();
const mockLoadHistory = vi.fn();
const mockSetMode = vi.fn();
const mockSetTypingSpeed = vi.fn();

let mockMessages: any[] = [];
let mockIsStreaming = false;
let mockMode: 'react' | 'planner' | 'reasoner' = 'react';
let mockStreamingContent = '';
let mockTypingSpeed = 8;

vi.mock('@/stores/agent.store', () => ({
  useAgentStore: (selector?: any) => {
    const state = {
      messages: mockMessages,
      streamingContent: mockStreamingContent,
      isStreaming: mockIsStreaming,
      mode: mockMode,
      error: null,
      typingSpeed: mockTypingSpeed,
      setMode: mockSetMode,
      setTypingSpeed: mockSetTypingSpeed,
      sendStreamMessage: mockSendStreamMessage,
      stopStream: mockStopStream,
      clearMessages: mockClearMessages,
      loadHistory: mockLoadHistory,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/components/AgentPanel/StreamingText/StreamingText', () => ({
  default: ({ content, className }: { content: string; className?: string }) =>
    <div data-testid="streaming-text" className={className}>{content}</div>,
}));

vi.mock('@/components/AgentPanel/ThinkingChain/ThinkingChain', () => ({
  default: () => <div data-testid="thinking-chain">Thinking chain</div>,
}));

vi.mock('@/components/AgentPanel/ToolCallLog/ToolCallLog', () => ({
  default: () => <div data-testid="tool-call-log">Tool call log</div>,
}));

import AgentChatPage from './AgentChatPage';

describe('AgentChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMessages = [];
    mockIsStreaming = false;
    mockMode = 'react';
    mockStreamingContent = '';
    mockTypingSpeed = 8;
  });

  it('should render header with AI Agent title', () => {
    render(<AgentChatPage />);
    const headers = screen.getAllByText('AI Agent');
    expect(headers.length).toBe(2); // h2 in header + h3 in empty state
    const poweredByElements = screen.getAllByText(/Powered by DeepSeek/);
    expect(poweredByElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should show empty state with suggestions when no messages', () => {
    render(<AgentChatPage />);
    const suggestions = screen.getAllByText(/分析|规划|搜索/);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('should show mode selector with three modes', () => {
    render(<AgentChatPage />);
    expect(screen.getByText('Quick')).toBeInTheDocument();
    expect(screen.getByText('Planner')).toBeInTheDocument();
    expect(screen.getByText('Deep Think')).toBeInTheDocument();
  });

  it('should call setMode when mode button clicked', () => {
    render(<AgentChatPage />);
    const plannerButton = screen.getByText('Planner');
    fireEvent.click(plannerButton);
    expect(mockSetMode).toHaveBeenCalledWith('planner');
  });

  it('should show generating status when streaming', () => {
    mockIsStreaming = true;
    render(<AgentChatPage />);
    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });

  it('should render user messages', () => {
    mockMessages = [
      { role: 'user', content: 'Hello AI', timestamp: 1000 },
    ];
    render(<AgentChatPage />);
    expect(screen.getByText('Hello AI')).toBeInTheDocument();
  });

  it('should render assistant messages', () => {
    mockMessages = [
      { role: 'assistant', content: 'Hello human', timestamp: 2000 },
    ];
    render(<AgentChatPage />);
    expect(screen.getByTestId('streaming-text')).toBeInTheDocument();
  });

  it('should have textarea for input', () => {
    render(<AgentChatPage />);
    expect(screen.getByPlaceholderText('Ask the AI agent anything...')).toBeInTheDocument();
  });

  it('should show stop button when streaming', () => {
    mockIsStreaming = true;
    render(<AgentChatPage />);
    const stopBtn = document.querySelector('button svg path[d="M6 6h12v12H6z"]');
    expect(stopBtn).toBeInTheDocument();
  });

  it('should display mode label below input', () => {
    render(<AgentChatPage />);
    const modeLabels = screen.getAllByText(/Quick/);
    expect(modeLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('should show clear conversation button', () => {
    render(<AgentChatPage />);
    const clearButton = screen.getByTitle('Clear history');
    expect(clearButton).toBeInTheDocument();
    fireEvent.click(clearButton);
    expect(mockClearMessages).toHaveBeenCalled();
  });
});
