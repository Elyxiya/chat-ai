export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: number;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  metadata?: Record<string, any>;
}

export interface AgentContext {
  userId: string;
  sessionId?: string;
  messages: AgentMessage[];
  knowledge?: string;
  tools?: ToolDefinition[];
}

export interface AgentResponse {
  type: 'final' | 'reasoning' | 'error' | 'tool_call' | 'max_steps';
  content: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
  metadata?: Record<string, any>;
}

export interface IntentClassification {
  type: 'simple' | 'complex' | 'reasoning' | 'creative';
  confidence: number;
  reason?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
  success?: boolean;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  /** Sensitive tools require additional permission checks (e.g. membership verification). */
  requiresSessionMembership?: boolean;
  handler: (args: Record<string, any>, ctx: AgentContext) => Promise<any>;
}

export interface PlanStep {
  id: number;
  description: string;
  tool?: string;
  args?: Record<string, any>;
  status: 'pending' | 'completed' | 'failed';
  result?: any;
}

export interface ExecutionPlan {
  goal: string;
  steps: PlanStep[];
  reflection?: { needsRetry: boolean; summary: string; feedback?: string };
}

export interface MemoryItem {
  id: string;
  type: 'short_term' | 'long_term' | 'episodic' | 'semantic' | 'working';
  content: any;
  embedding?: number[];
  importance: number;
  createdAt: Date;
  expiresAt?: Date;
}

export interface RagChunk {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, any>;
}
