import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

type EmbeddingProviderType = 'deepseek' | 'openai';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly provider: EmbeddingProviderType;
  private readonly apiKey: string;

  // DeepSeek
  private readonly deepseekUrl: string;
  private readonly deepseekModel: string;

  // OpenAI
  private readonly openaiApiKey: string;
  private readonly openaiUrl: string;
  private readonly openaiModel: string;

  constructor() {
    this.provider = (process.env.EMBEDDING_PROVIDER || 'openai') as EmbeddingProviderType;
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';

    // DeepSeek config
    this.deepseekUrl = process.env.DEEPSEEK_EMBEDDING_URL || 'https://api.deepseek.com/v1/embeddings';
    this.deepseekModel = process.env.DEEPSEEK_EMBEDDING_MODEL || 'deepseek-embedding';

    // OpenAI config
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
    this.openaiUrl = process.env.OPENAI_EMBEDDING_URL || 'https://api.openai.com/v1/embeddings';
    this.openaiModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  }

  async embed(text: string): Promise<number[]> {
    switch (this.provider) {
      case 'openai':
        return this.embedOpenAI(text);
      case 'deepseek':
      default:
        return this.embedDeepSeek(text);
    }
  }

  private async embedDeepSeek(text: string): Promise<number[]> {
    if (!this.apiKey) {
      this.logger.warn('DEEPSEEK_API_KEY not set, embedding unavailable');
      return [];
    }

    try {
      const response = await axios.post(
        this.deepseekUrl,
        {
          model: this.deepseekModel,
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
      if (error.response?.status === 404) {
        this.logger.warn(`DeepSeek embedding endpoint not found (404) at ${this.deepseekUrl}. Set EMBEDDING_PROVIDER=openai or configure a working provider.`);
      } else {
        this.logger.warn(`DeepSeek embedding error: ${error.message}`);
      }
      return [];
    }
  }

  private async embedOpenAI(text: string): Promise<number[]> {
    if (!this.openaiApiKey) {
      this.logger.warn('OPENAI_API_KEY not set, OpenAI embedding unavailable');
      return [];
    }

    try {
      const response = await axios.post(
        this.openaiUrl,
        {
          model: this.openaiModel,
          input: text,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.openaiApiKey}`,
          },
          timeout: 30000,
        },
      );

      return response.data.data?.[0]?.embedding || [];
    } catch (error: any) {
      this.logger.warn(`OpenAI embedding error: ${error.message}`);
      return [];
    }
  }
}
