import { Module } from '@nestjs/common';
import { DeepSeekProvider } from './providers/deepseek.provider';

@Module({
  providers: [DeepSeekProvider],
  exports: [DeepSeekProvider],
})
export class LLMModule {}
