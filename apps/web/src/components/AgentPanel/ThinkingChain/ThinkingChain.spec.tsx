import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThinkingChain from './ThinkingChain';

vi.mock('@/stores/agent.store', () => ({
  useAgentStore: vi.fn(),
}));

import { useAgentStore } from '@/stores/agent.store';

const mockStoreDefault = {
  reasoningSteps: [],
  messages: [],
  isStreaming: false,
};

describe('ThinkingChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAgentStore as any).mockReturnValue(mockStoreDefault);
  });

  it('THINK-WEB-01: should show thinking state when no steps', () => {
    render(<ThinkingChain steps={[]} />);
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
  });

  it('THINK-WEB-02: should render reasoning steps', () => {
    const steps = [
      { step: 1, reasoning: 'Analyzing the question' },
      { step: 2, reasoning: 'Searching knowledge base' },
    ];

    render(<ThinkingChain steps={steps} />);

    expect(screen.getByText('Thinking Chain (2 steps)')).toBeInTheDocument();
    expect(screen.getByText('Analyzing the question')).toBeInTheDocument();
    expect(screen.getByText('Searching knowledge base')).toBeInTheDocument();
  });

  it('THINK-WEB-03: should toggle expand/collapse', () => {
    const steps = [{ step: 1, reasoning: 'Test reasoning' }];

    render(<ThinkingChain steps={steps} />);

    expect(screen.getByText('Test reasoning')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(screen.getByText(/Thinking Chain/));

    expect(screen.queryByText('Test reasoning')).not.toBeInTheDocument();
  });

  it('THINK-WEB-04: should show step numbers', () => {
    const steps = [{ step: 1, reasoning: 'Step one' }];

    render(<ThinkingChain steps={steps} />);

    // Step number "1" should be rendered (in the circle element)
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('THINK-WEB-05: should render with messages metadata reasoning', () => {
    (useAgentStore as any).mockReturnValue({
      ...mockStoreDefault,
      messages: [
        {
          role: 'assistant',
          content: 'Final answer',
          metadata: { reasoning: '[Step 1] First reason\n[Step 2] Second reason' },
        },
      ],
    });

    render(<ThinkingChain />);

    expect(screen.getByText('Thinking Chain (2 steps)')).toBeInTheDocument();
    expect(screen.getByText('First reason')).toBeInTheDocument();
    expect(screen.getByText('Second reason')).toBeInTheDocument();
  });

  it('THINK-WEB-06: should show streaming indicator', () => {
    (useAgentStore as any).mockReturnValue({
      ...mockStoreDefault,
      isStreaming: true,
    });

    const { container } = render(<ThinkingChain steps={[{ step: 1, reasoning: 'Thinking...' }]} />);

    const pulseDot = container.querySelector('.animate-pulse');
    expect(pulseDot).toBeInTheDocument();
  });
});
