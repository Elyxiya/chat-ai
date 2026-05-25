import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockToolCalls = [
  { name: 'web_search', args: { query: 'test' }, result: 'search results', success: true, timestamp: 1000 },
  { name: 'calculate', args: { expr: '1+1' }, result: '2', success: true, timestamp: 1001 },
  { name: 'failed_tool', args: { input: 'bad' }, result: undefined, success: false, timestamp: 1002 },
  { name: 'running_tool', args: { input: 'pending' }, result: undefined, success: undefined, timestamp: 1003 },
];

let mockToolCallsState = mockToolCalls;
let mockIsStreaming = false;

vi.mock('@/stores/agent.store', () => ({
  useAgentStore: (selector?: any) => {
    const state = { toolCalls: mockToolCallsState, isStreaming: mockIsStreaming };
    return selector ? selector(state) : state;
  },
}));

import ToolCallLog from './ToolCallLog';

describe('ToolCallLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToolCallsState = mockToolCalls;
    mockIsStreaming = false;
  });

  it('should show empty state when no tool calls', () => {
    mockToolCallsState = [];
    render(<ToolCallLog />);
    expect(screen.getByText('No tool calls yet')).toBeInTheDocument();
  });

  it('should render tool call entries with names', () => {
    render(<ToolCallLog />);
    expect(screen.getByText('web_search')).toBeInTheDocument();
    expect(screen.getByText('calculate')).toBeInTheDocument();
    expect(screen.getByText('failed_tool')).toBeInTheDocument();
    expect(screen.getByText('running_tool')).toBeInTheDocument();
  });

  it('should show status labels', () => {
    render(<ToolCallLog />);
    expect(screen.getAllByText('Success').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('should show section title', () => {
    render(<ToolCallLog />);
    expect(screen.getByText('Tool Calls')).toBeInTheDocument();
  });

  it('should show streaming indicator when streaming', () => {
    mockIsStreaming = true;
    render(<ToolCallLog />);
    const pulseDots = document.querySelectorAll('.animate-pulse');
    expect(pulseDots.length).toBeGreaterThan(0);
  });

  it('should render args as JSON', () => {
    render(<ToolCallLog />);
    const preElements = document.querySelectorAll('pre');
    expect(preElements.length).toBeGreaterThan(0);
  });
});
