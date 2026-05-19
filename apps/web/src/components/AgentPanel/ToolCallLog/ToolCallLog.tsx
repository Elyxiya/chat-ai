import { useAgentStore } from '@/stores/agent.store';

export default function ToolCallLog() {
  const { messages } = useAgentStore();

  const toolCalls = messages
    .filter((m) => m.metadata?.toolCalls?.length)
    .flatMap((m) => m.metadata.toolCalls)
    .slice(-20);

  if (toolCalls.length === 0) {
    return (
      <div className="text-center py-8 text-text-secondary text-sm">
        No tool calls yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Tool Calls</h3>
      {toolCalls.map((call: any, idx: number) => (
        <div
          key={idx}
          className={`p-3 rounded-lg border text-xs ${
            call.success !== false
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-green-700 dark:text-green-300">
              {call.name}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              call.success !== false
                ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
            }`}>
              {call.success !== false ? 'Success' : 'Failed'}
            </span>
          </div>
          <p className="text-text-secondary font-mono">
            {JSON.stringify(call.arguments || {}, null, 2).slice(0, 100)}
            {JSON.stringify(call.arguments || {}).length > 100 ? '...' : ''}
          </p>
          {call.result && (
            <p className="mt-1 text-green-600 dark:text-green-400 font-mono truncate">
              Result: {typeof call.result === 'object' ? JSON.stringify(call.result).slice(0, 80) : String(call.result)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
