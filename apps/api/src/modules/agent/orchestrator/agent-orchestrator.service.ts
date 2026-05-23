import { Injectable, Logger } from '@nestjs/common';
import { AgentResponse } from '../types';
import { PlanningEngine } from '../planner/planning-engine.service';
import { MemoryService } from '../memory/memory.service';
import { ToolRegistry } from '../tools/tool-registry.service';
import { RagEngine } from '../rag/rag-engine.service';
import { DeepSeekProvider } from '../../llm/providers/deepseek.provider';

@Injectable()
export class AgentOrchestrator {
  private readonly logger = new Logger(AgentOrchestrator.name);

  constructor(
    private readonly planner: PlanningEngine,
    private readonly memory: MemoryService,
    private readonly toolRegistry: ToolRegistry,
    private readonly ragEngine: RagEngine,
    private readonly llmProvider: DeepSeekProvider,
  ) {}

  async process(userId: string, input: string, sessionId?: string): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      await this.memory.addShortTermMemory(userId, {
        role: 'user',
        content: input,
        timestamp: Date.now(),
      });

      const intent = await this.planner.classifyIntent(input);

      this.logger.log(`[${userId}] Intent: ${intent.type}, confidence: ${intent.confidence}`);

      if (intent.type === 'complex') {
        const planResult = await this.planner.planAndExecute(userId, input, intent, sessionId);
        await this.finalize(userId, sessionId, planResult, startTime);
        return planResult;
      }

      const reactResult = await this.planner.executeReAct(userId, input, intent, sessionId);
      await this.finalize(userId, sessionId, reactResult, startTime);
      return reactResult;

    } catch (error) {
      this.logger.error(`[${userId}] Agent error: ${error.message}`, error.stack);
      return {
        type: 'error',
        content: '抱歉，处理您的请求时遇到了问题，请稍后再试。',
        metadata: { error: error.message },
      };
    }
  }

  async *streamProcess(userId: string, input: string, sessionId?: string): AsyncGenerator<string> {
    await this.memory.addShortTermMemory(userId, {
      role: 'user',
      content: input,
      timestamp: Date.now(),
    });

    const intent = await this.planner.classifyIntent(input);

    if (intent.type === 'complex') {
      for await (const chunk of this.planner.streamPlanAndExecute(userId, input, intent, sessionId)) {
        yield chunk;
      }
    } else {
      for await (const chunk of this.planner.streamReAct(userId, input, intent, sessionId)) {
        yield chunk;
      }
    }

    await this.memory.addShortTermMemory(userId, {
      role: 'assistant',
      content: 'finalized',
      timestamp: Date.now(),
    });
  }

  async *streamProcessWithEvents(userId: string, input: string, sessionId?: string, mode?: string): AsyncGenerator<{ type: string; data: any }> {
    await this.memory.addShortTermMemory(userId, {
      role: 'user',
      content: input,
      timestamp: Date.now(),
    });

    yield { type: 'start', data: { sessionId } };

    const intent = await this.planner.classifyIntent(input);

    const usePlanner = mode === 'planner' || intent.type === 'complex';
    const useReasoner = mode === 'reasoner' || intent.type === 'reasoning';

    if (usePlanner) {
      for await (const event of this.planner.streamPlanAndExecuteWithEvents(userId, input, { ...intent, type: 'complex' }, sessionId)) {
        yield event;
      }
    } else {
      for await (const event of this.planner.streamReActWithEvents(userId, input, { ...intent, type: useReasoner ? 'reasoning' : intent.type }, sessionId)) {
        yield event;
      }
    }

    // Note: 'done' event is sent by the controller, not here.
    // This ensures a single, consistent done event regardless of which planner path was used.
  }

  async getConversationHistory(
    userId: string,
    limit = 50,
  ): Promise<any[]> {
    const result = await this.memory.getShortTermMemory(userId, limit);
    return result;
  }

  async clearMemory(userId: string) {
    await this.memory.clearShortTermMemory(userId);
  }

  private async finalize(
    userId: string,
    sessionId: string | undefined,
    result: AgentResponse,
    _startTime: number,
  ) {
    await this.memory.addShortTermMemory(userId, {
      role: 'assistant',
      content: result.content,
      timestamp: Date.now(),
    });

    if (result.metadata?.important) {
      await this.memory.storeLongTermMemory(userId, {
        type: 'episodic',
        content: {
          userInput: result.metadata.userInput,
          response: result.content,
          intent: result.metadata.intent,
        },
        importance: result.metadata.importance || 0.7,
      });
    }
  }
}
