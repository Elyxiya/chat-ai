import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import axios from 'axios';
import { LLMProvider, ChatPromptInput, LLMOptions } from '../interfaces/llm-provider.interface';

// Node.js 18+ can convert a Readable to a Web ReadableStream
type WebReadableStream = ReadableStream<Uint8Array>;

@Injectable()
export class DeepSeekProvider implements LLMProvider {
  private readonly logger = new Logger(DeepSeekProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelV3: string;
  private readonly modelR1: string;

  constructor(private readonly config?: ConfigService) {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    this.baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    this.modelV3 = process.env.DEEPSEEK_MODEL_V3 || 'deepseek-chat';
    this.modelR1 = process.env.DEEPSEEK_MODEL_R1 || 'deepseek-reasoner';
  }

  private getModel(options?: LLMOptions): string {
    if (options?.model === 'r1') return this.modelR1;
    return this.modelV3;
  }

  async chat(prompt: ChatPromptInput, options?: LLMOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not configured');
    }

    const model = this.getModel(options);

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model,
          messages: prompt,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? (model === this.modelR1 ? 8192 : 4096),
          top_p: options?.topP,
          stop: options?.stop,
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 120000,
        },
      );

      return response.data.choices?.[0]?.message?.content || '';
    } catch (error: any) {
      this.logger.error(`DeepSeek API error: ${error.message}`);
      if (error.response?.data?.error) {
        throw new Error(`DeepSeek API: ${error.response.data.error.message}`);
      }
      throw new Error(`DeepSeek API request failed: ${error.message}`);
    }
  }

  async *chatStream(prompt: ChatPromptInput, options?: LLMOptions): AsyncGenerator<string> {
    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not configured');
    }

    const model = this.getModel(options);
    const timeoutMs = options?.timeout ?? 120000;

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model,
          messages: prompt,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? (model === this.modelR1 ? 8192 : 4096),
          top_p: options?.topP,
          stop: options?.stop,
          stream: true,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          responseType: 'stream',
          signal: AbortSignal.timeout(timeoutMs),
        },
      );

      const nodeStream = response.data as unknown as NodeJS.ReadableStream;
      const webStream = Readable.toWeb(nodeStream as unknown as Readable) as WebReadableStream;
      const reader = webStream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6).trim();
            if (data === '[DONE]') return;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) yield content;
            } catch {
              // skip malformed chunks
            }
          }
        }

        // flush remaining buffer
        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(trimmed.slice(6).trim());
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) yield content;
            } catch {
              // skip malformed
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error: any) {
      if (error.name === 'TimeoutError' || error.code === 'ERR_CANCELED') {
        this.logger.warn(`DeepSeek stream timeout after ${timeoutMs}ms`);
        throw new Error('AI request timed out');
      }
      this.logger.error(`DeepSeek stream error: ${error.message}`);
      throw new Error(`DeepSeek stream failed: ${error.message}`);
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not configured for embedding');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/embeddings`,
        {
          model: 'deepseek-embedding',
          input: text,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 30000,
        },
      );

      return response.data.data?.[0]?.embedding || [];
    } catch (error: any) {
      this.logger.error(`DeepSeek embedding error: ${error.message}`);
      return [];
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeout: 5000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
