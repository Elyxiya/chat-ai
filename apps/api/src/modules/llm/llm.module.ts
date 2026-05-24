import { Module } from '@nestjs/common';
import { DeepSeekProvider } from './providers/deepseek.provider';
import { EmbeddingService } from './providers/embedding.service';

@Module({
  providers: [DeepSeekProvider, EmbeddingService],
  exports: [DeepSeekProvider, EmbeddingService],
})
export class LLMModule {}
