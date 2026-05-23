export interface LLMOptions {
  model?: 'v3' | 'r1';
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  timeout?: number;
  /** Enable DeepSeek thinking mode (reasoning chain before final answer) */
  thinking?: boolean;
  /** Thinking effort: 'low'/'medium' -> 'high', 'xhigh' -> 'max' */
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  reasoning_content?: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface ChatPrompt {
  messages: ChatMessage[];
}

export type ChatPromptInput = Array<{
  role: string;
  content: string;
  reasoning_content?: string;
  tool_calls?: any[];
  tool_call_id?: string;
  [key: string]: any;
}>;

export interface LLMProvider {
  chat(prompt: ChatPromptInput, options?: LLMOptions): Promise<string>;
  chatStream(prompt: ChatPromptInput, options?: LLMOptions): AsyncGenerator<string>;
  chatStreamWithReasoning(prompt: ChatPromptInput, options?: LLMOptions): AsyncGenerator<{ type: 'reasoning' | 'content'; data: string }>;
  embed(text: string): Promise<number[]>;
  isAvailable(): Promise<boolean>;
}
