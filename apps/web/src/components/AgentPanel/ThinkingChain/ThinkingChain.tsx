import { useState } from 'react';
import { useAgentStore } from '@/stores/agent.store';

export default function ThinkingChain() {
  const { reasoningSteps, messages, isStreaming } = useAgentStore();
  const [expanded, setExpanded] = useState(true);

  const allSteps = [
    ...reasoningSteps,
    ...messages
      .filter((m) => m.metadata?.reasoning)
      .flatMap((m) => {
        const lines = (m.metadata.reasoning || '').trim().split('\n').filter(Boolean);
        return lines.map((line: string) => {
          const stepMatch = line.match(/^\[Step (\d+)\]\s*(.*)/);
          return stepMatch
            ? { step: parseInt(stepMatch[1]), reasoning: stepMatch[2] }
            : { step: 0, reasoning: line };
        });
      }),
  ]
    .filter((s, i, arr) => arr.findIndex((x) => x.step === s.step && x.reasoning === s.reasoning) === i)
    .sort((a, b) => a.step - b.step);

  if (allSteps.length === 0) {
    return (
      <div className="mb-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800 opacity-60">
        <div className="flex items-center gap-2 text-xs font-medium text-primary-700 dark:text-primary-300">
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Thinking...
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-xs font-medium text-primary-700 dark:text-primary-300 mb-2"
      >
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Thinking Chain ({allSteps.length} steps)
        {isStreaming && (
          <span className="ml-2 inline-block w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2">
          {allSteps.map((step, idx) => (
            <div key={idx} className="flex gap-2 text-xs">
              <span className="text-primary-500 font-mono flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary-100 dark:bg-primary-900/50 rounded">
                {step.step || idx + 1}
              </span>
              <span className="text-primary-700 dark:text-primary-300 whitespace-pre-wrap">
                {step.reasoning}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
