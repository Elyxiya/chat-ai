import { useAgentStore } from '@/stores/agent.store';

function formatResult(result: unknown): string {
  if (result === undefined || result === null) return '';
  if (typeof result === 'string') return result;
  if (typeof result === 'object') {
    const str = JSON.stringify(result, null, 2);
    return str.length > 300 ? str.slice(0, 300) + '\n...' : str;
  }
  return String(result);
}

export default function ToolCallLog() {
  const { toolCalls, isStreaming } = useAgentStore();

  if (toolCalls.length === 0) {
    return (
      <div className="text-center py-8 text-text-secondary text-sm">
        No tool calls yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Tool Calls</h3>
        {isStreaming && (
          <span className="inline-block w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
        )}
      </div>
      {toolCalls.map((call, idx) => (
        <div
          key={idx}
          className={`p-3 rounded-lg border text-xs transition-all ${
            call.success === true
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : call.success === false
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-green-700 dark:text-green-300">
              {call.name}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              call.success === true
                ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                : call.success === false
                  ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                  : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300'
            }`}>
              {call.success === true ? 'Success' : call.success === false ? 'Failed' : 'Running'}
            </span>
          </div>
          {call.args && Object.keys(call.args).length > 0 && (
            <pre className="text-text-secondary font-mono whitespace-pre-wrap break-all text-[11px]">
              {JSON.stringify(call.args, null, 2).slice(0, 200)}
              {JSON.stringify(call.args).length > 200 ? '...' : ''}
            </pre>
          )}
          {call.result !== undefined && (
            <pre className="mt-1 text-green-600 dark:text-green-400 font-mono whitespace-pre-wrap break-all text-[11px]">
              {'Result: '}
              {formatResult(call.result)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
