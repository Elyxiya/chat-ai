import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { RagEngine } from '../agent/rag/rag-engine.service';

@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService, RagEngine],
  exports: [KnowledgeService, RagEngine],
})
export class KnowledgeModule {}
