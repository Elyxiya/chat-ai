import { Module } from '@nestjs/common';
import { AgentOrchestrator } from './orchestrator/agent-orchestrator.service';
import { PlanningEngine } from './planner/planning-engine.service';
import { MemoryService } from './memory/memory.service';
import { ToolRegistry } from './tools/tool-registry.service';
import { RagEngine } from './rag/rag-engine.service';
import { AgentController } from './agent.controller';
import { LLMModule } from '../llm/llm.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ChatModule } from '../chat/chat.module';
import { DeepSeekProvider } from '../llm/providers/deepseek.provider';

@Module({
  imports: [LLMModule, KnowledgeModule, ChatModule],
  controllers: [AgentController],
  providers: [
    AgentOrchestrator,
    PlanningEngine,
    MemoryService,
    ToolRegistry,
    RagEngine,
    DeepSeekProvider,
  ],
  exports: [AgentOrchestrator, ToolRegistry, MemoryService],
})
export class AgentModule {}
