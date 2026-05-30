import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { FileParserService } from './file-parser.service';
import { RagEngine } from '../agent/rag/rag-engine.service';
import { LLMModule } from '../llm/llm.module';

@Module({
  imports: [LLMModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, FileParserService, RagEngine],
  exports: [KnowledgeService, RagEngine],
})
export class KnowledgeModule {}
