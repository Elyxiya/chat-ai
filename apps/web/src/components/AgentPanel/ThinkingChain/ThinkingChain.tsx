import { useState } from 'react';

interface ThinkingChainProps {
  reasoning: string;
}

export default function ThinkingChain({ reasoning }: ThinkingChainProps) {
  const [expanded, setExpanded] = useState(false);

  if (!reasoning) return null;

  const lines = reasoning.trim().split('\n').filter(Boolean);

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
        Thinking Chain ({lines.length} steps)
      </button>

      {expanded && (
        <div className="space-y-2">
          {lines.map((line, idx) => (
            <div key={idx} className="flex gap-2 text-xs">
              <span className="text-primary-500 font-mono flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary-100 dark:bg-primary-900/50 rounded">
                {idx + 1}
              </span>
              <span className="text-primary-700 dark:text-primary-300 whitespace-pre-wrap">
                {line.replace(/^\[Step \d+\]\s*/, '')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
