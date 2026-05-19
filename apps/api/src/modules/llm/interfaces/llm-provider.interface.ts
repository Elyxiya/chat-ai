export interface LLMOptions {
  model?: 'v3' | 'r1';
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatPrompt {
  messages: ChatMessage[];
}

export type ChatPromptInput = { role: string; content: string }[];

export interface LLMProvider {
  chat(prompt: ChatPromptInput, options?: LLMOptions): Promise<string>;
  chatStream(prompt: ChatPromptInput, options?: LLMOptions): AsyncGenerator<string>;
  embed(text: string): Promise<number[]>;
  isAvailable(): Promise<boolean>;
}
