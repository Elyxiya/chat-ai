import { Test, TestingModule } from '@nestjs/testing';
import { AgentOrchestrator } from './agent-orchestrator.service';
import { PlanningEngine } from '../planner/planning-engine.service';
import { MemoryService } from '../memory/memory.service';
import { ToolRegistry } from '../tools/tool-registry.service';
import { RagEngine } from '../rag/rag-engine.service';
import { DeepSeekProvider } from '../../llm/providers/deepseek.provider';

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;
  let mockPlanner: any;
  let mockMemory: any;
  let mockToolRegistry: any;
  let mockRagEngine: any;
  let mockLlmProvider: any;

  beforeEach(async () => {
    mockPlanner = {
      classifyIntent: jest.fn(),
      executeReAct: jest.fn(),
      planAndExecute: jest.fn(),
      streamReAct: jest.fn(),
      streamPlanAndExecute: jest.fn(),
      streamPlanAndExecuteWithEvents: jest.fn(),
      streamReActWithEvents: jest.fn(),
    };

    mockMemory = {
      addShortTermMemory: jest.fn(),
      getShortTermMemory: jest.fn(),
      clearShortTermMemory: jest.fn(),
      storeLongTermMemory: jest.fn(),
    };

    mockToolRegistry = {
      execute: jest.fn(),
      getTools: jest.fn(),
    };

    mockRagEngine = {
      retrieve: jest.fn(),
    };

    mockLlmProvider = {
      chat: jest.fn(),
      chatStream: jest.fn(),
      embed: jest.fn(),
      isAvailable: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentOrchestrator,
        { provide: PlanningEngine, useValue: mockPlanner },
        { provide: MemoryService, useValue: mockMemory },
        { provide: ToolRegistry, useValue: mockToolRegistry },
        { provide: RagEngine, useValue: mockRagEngine },
        { provide: DeepSeekProvider, useValue: mockLlmProvider },
      ],
    }).compile();

    orchestrator = module.get<AgentOrchestrator>(AgentOrchestrator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('process', () => {
    it('AGENT-ORCH-01: should process SIMPLE intent directly via ReAct', async () => {
      mockPlanner.classifyIntent.mockResolvedValue({ type: 'simple', confidence: 0.9 });
      mockPlanner.executeReAct.mockResolvedValue({
        type: 'final',
        content: 'Hello, how can I help you?',
        metadata: {},
      });

      const result = await orchestrator.process('user-1', 'Hello');

      expect(result.content).toBe('Hello, how can I help you?');
      expect(mockMemory.addShortTermMemory).toHaveBeenCalledWith('user-1', expect.any(Object));
    });

    it('AGENT-ORCH-02: should process COMPLEX intent via planner', async () => {
      mockPlanner.classifyIntent.mockResolvedValue({ type: 'complex', confidence: 0.8 });
      mockPlanner.planAndExecute.mockResolvedValue({
        type: 'final',
        content: 'Complex task completed',
        metadata: {},
      });

      const result = await orchestrator.process('user-1', 'Plan a trip to Tokyo');

      expect(result.content).toBe('Complex task completed');
      expect(mockPlanner.planAndExecute).toHaveBeenCalled();
    });

    it('AGENT-ORCH-03: should return error response on exception', async () => {
      mockPlanner.classifyIntent.mockRejectedValue(new Error('LLM error'));

      const result = await orchestrator.process('user-1', 'Some query');

      expect(result.type).toBe('error');
      expect(result.content).toContain('抱歉');
    });

    it('should store user message in short-term memory', async () => {
      mockPlanner.classifyIntent.mockResolvedValue({ type: 'simple', confidence: 0.9 });
      mockPlanner.executeReAct.mockResolvedValue({ type: 'final', content: 'Response', metadata: {} });

      await orchestrator.process('user-1', 'User message');

      expect(mockMemory.addShortTermMemory).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ role: 'user', content: 'User message' }),
      );
    });

    it('should store important memories in long-term memory', async () => {
      mockPlanner.classifyIntent.mockResolvedValue({ type: 'simple', confidence: 0.9 });
      mockPlanner.executeReAct.mockResolvedValue({
        type: 'final',
        content: 'Important response',
        metadata: { important: true, importance: 0.8 },
      });

      await orchestrator.process('user-1', 'Important query');

      expect(mockMemory.storeLongTermMemory).toHaveBeenCalled();
    });
  });

  describe('streamProcess', () => {
    it('AGENT-ORCH-04: should yield multiple chunks', async () => {
      mockPlanner.classifyIntent.mockResolvedValue({ type: 'simple', confidence: 0.9 });
      const chunks = ['Hello', ' there', '!'];
      mockPlanner.streamReAct.mockImplementation(async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      });

      const result: string[] = [];
      for await (const chunk of orchestrator.streamProcess('user-1', 'Hello')) {
        result.push(chunk);
      }

      expect(result).toEqual(['Hello', ' there', '!']);
    });

    it('should process COMPLEX intent in streaming mode', async () => {
      mockPlanner.classifyIntent.mockResolvedValue({ type: 'complex', confidence: 0.8 });
      mockPlanner.streamPlanAndExecute.mockImplementation(async function* () {
        yield 'Planning';
        yield ' step 1';
        yield ' done';
      });

      const result: string[] = [];
      for await (const chunk of orchestrator.streamProcess('user-1', 'Plan something')) {
        result.push(chunk);
      }

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('streamProcessWithEvents', () => {
    it('should yield start event', async () => {
      mockPlanner.classifyIntent.mockResolvedValue({ type: 'simple', confidence: 0.9 });
      mockPlanner.streamReActWithEvents.mockImplementation(async function* () {
        yield { type: 'chunk', data: { content: 'hi' } };
      });

      const events: any[] = [];
      for await (const event of orchestrator.streamProcessWithEvents('user-1', 'Hi', undefined, 'default')) {
        events.push(event);
      }

      expect(events[0]).toEqual({ type: 'start', data: { sessionId: undefined } });
    });
  });

  describe('getConversationHistory', () => {
    it('AGENT-ORCH-05: should return conversation history from memory', async () => {
      const history = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ];
      mockMemory.getShortTermMemory.mockResolvedValue(history);

      const result = await orchestrator.getConversationHistory('user-1', 50);

      expect(result).toEqual(history);
      expect(mockMemory.getShortTermMemory).toHaveBeenCalledWith('user-1', 50);
    });
  });

  describe('clearMemory', () => {
    it('should clear short-term memory', async () => {
      mockMemory.clearShortTermMemory.mockResolvedValue(undefined);

      await orchestrator.clearMemory('user-1');

      expect(mockMemory.clearShortTermMemory).toHaveBeenCalledWith('user-1');
    });
  });

  describe('Edge Cases', () => {
    it('EDGE-ORCH-01: should handle empty user message', async () => {
      mockPlanner.classifyIntent.mockResolvedValue({ type: 'simple', confidence: 0.9 });
      mockPlanner.executeReAct.mockResolvedValue({ type: 'final', content: '', metadata: {} });

      const result = await orchestrator.process('user-1', '');

      expect(result).toBeDefined();
    });

    it('EDGE-ORCH-02: should handle memory service being unavailable', async () => {
      mockPlanner.classifyIntent.mockRejectedValue(new Error('Memory error'));

      const result = await orchestrator.process('user-1', 'Hello');

      expect(result.type).toBe('error');
    });

    it('EDGE-ORCH-03: should handle streaming with no chunks', async () => {
      mockPlanner.classifyIntent.mockResolvedValue({ type: 'simple', confidence: 0.9 });
      mockPlanner.streamReAct.mockImplementation(async function* () {
        return;
      });

      const chunks: string[] = [];
      for await (const chunk of orchestrator.streamProcess('user-1', 'Hello')) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([]);
    });

    it('EDGE-ORCH-04: should handle streaming with COMPLEX intent', async () => {
      mockPlanner.classifyIntent.mockResolvedValue({ type: 'complex', confidence: 0.8 });
      mockPlanner.streamPlanAndExecute.mockImplementation(async function* () {
        yield 'Planning';
        yield ' done';
      });

      const chunks: string[] = [];
      for await (const chunk of orchestrator.streamProcess('user-1', 'Complex task')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('EDGE-ORCH-05: should handle events stream with empty events', async () => {
      mockPlanner.classifyIntent.mockResolvedValue({ type: 'simple', confidence: 0.9 });
      mockPlanner.streamReActWithEvents.mockImplementation(async function* () {
        return;
      });

      const events: any[] = [];
      for await (const event of orchestrator.streamProcessWithEvents('user-1', 'Hi', undefined, 'default')) {
        events.push(event);
      }

      expect(events.length).toBeGreaterThan(0);
    });
  });
});
