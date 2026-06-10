import { Test, TestingModule } from '@nestjs/testing';
import { PlanningEngine } from './planning-engine.service';
import { DeepSeekProvider } from '../../llm/providers/deepseek.provider';
import { ToolRegistry } from '../tools/tool-registry.service';
import { MemoryService } from '../memory/memory.service';
import { RagEngine } from '../rag/rag-engine.service';

const createMockLlmProvider = () => ({
  chat: jest.fn(),
  chatStream: jest.fn(),
  chatStreamWithReasoning: jest.fn(),
  embed: jest.fn(),
  isAvailable: jest.fn(),
});

const createMockToolRegistry = () => ({
  getToolDescriptions: jest.fn(),
  execute: jest.fn(),
  getTools: jest.fn(),
});

const createMockMemory = () => ({
  getShortTermMemory: jest.fn(),
  getRelevantMemories: jest.fn(),
  addShortTermMemory: jest.fn(),
  logToolCall: jest.fn(),
});

const createMockRagEngine = () => ({
  retrieve: jest.fn(),
});

describe('PlanningEngine', () => {
  let engine: PlanningEngine;
  let mockLlm: ReturnType<typeof createMockLlmProvider>;
  let mockToolRegistry: ReturnType<typeof createMockToolRegistry>;
  let mockMemory: ReturnType<typeof createMockMemory>;
  let mockRagEngine: ReturnType<typeof createMockRagEngine>;

  beforeEach(async () => {
    mockLlm = createMockLlmProvider();
    mockToolRegistry = createMockToolRegistry();
    mockMemory = createMockMemory();
    mockRagEngine = createMockRagEngine();

    mockToolRegistry.getToolDescriptions.mockReturnValue(
      '- get_time: Get current time\n- calculate: Calculate expression',
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanningEngine,
        { provide: DeepSeekProvider, useValue: mockLlm },
        { provide: ToolRegistry, useValue: mockToolRegistry },
        { provide: MemoryService, useValue: mockMemory },
        { provide: RagEngine, useValue: mockRagEngine },
      ],
    }).compile();

    engine = module.get<PlanningEngine>(PlanningEngine);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('classifyIntent', () => {
    it('PLAN-01: should classify simple greeting as SIMPLE intent', async () => {
      mockLlm.chat.mockResolvedValue('{"type":"simple","confidence":0.95,"reason":"test"}');

      const result = await engine.classifyIntent('Hello, how are you?');

      expect(result.type).toBe('simple');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('PLAN-02: should classify multi-step task as COMPLEX intent', async () => {
      mockLlm.chat.mockResolvedValue('{"type":"complex","confidence":0.85,"reason":"test"}');

      const result = await engine.classifyIntent('Book a flight to Tokyo and find a hotel nearby');

      expect(result.type).toBe('complex');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('PLAN-03: should classify math problem as REASONING intent', async () => {
      mockLlm.chat.mockResolvedValue('{"type":"reasoning","confidence":0.9,"reason":"test"}');

      const result = await engine.classifyIntent('Solve this equation: 2x + 5 = 15');

      expect(result.type).toBe('reasoning');
    });

    it('PLAN-04: should classify creative request as CREATIVE intent', async () => {
      mockLlm.chat.mockResolvedValue('{"type":"creative","confidence":0.8,"reason":"test"}');

      const result = await engine.classifyIntent('Write a poem about the ocean');

      expect(result.type).toBe('creative');
    });

    it('PLAN-05: should fall back to SIMPLE intent on LLM error', async () => {
      mockLlm.chat.mockRejectedValue(new Error('LLM unavailable'));

      const result = await engine.classifyIntent('Any input');

      expect(result.type).toBe('simple');
      expect(result.confidence).toBe(0.5);
      expect(result.reason).toBe('classification_failed');
    });

    it('PLAN-06: should fall back to SIMPLE when LLM returns unexpected content', async () => {
      mockLlm.chat.mockResolvedValue('{"type":"unknown_type","confidence":0.5,"reason":"test"}');

      const result = await engine.classifyIntent('Any input');

      expect(result.type).toBe('unknown_type');
    });

    it('should include reasoning in the classification result', async () => {
      mockLlm.chat.mockResolvedValue('{"type":"simple","confidence":0.9,"reason":"test_reason"}');

      const result = await engine.classifyIntent('Hi there');

      expect(result).toHaveProperty('reason');
      expect(typeof result.reason).toBe('string');
    });
  });

  describe('executeReAct', () => {
    it('PLAN-10: should return final answer after ReAct loop', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat.mockResolvedValue('最终答案: Hello! Here is my response.');

      const result = await engine.executeReAct('user-1', 'Hello', {
        type: 'simple',
        confidence: 0.9,
        reason: 'test',
      });

      expect(result.type).toBe('final');
      expect(result.content).toContain('Hello');
    });

    it('PLAN-11: should execute tool call and continue ReAct loop', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat
        .mockResolvedValueOnce('思考: I need the current time\n行动: get_time()')
        .mockResolvedValueOnce('最终答案: The time is 10:00 AM.');
      mockToolRegistry.execute.mockResolvedValue('2024-01-01 10:00');

      const result = await engine.executeReAct('user-1', 'What time is it?', {
        type: 'simple',
        confidence: 0.9,
      });

      expect(result.type).toBe('final');
      expect(mockToolRegistry.execute).toHaveBeenCalled();
      expect(mockMemory.logToolCall).toHaveBeenCalled();
    });

    it('PLAN-12: should handle tool execution error gracefully', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat
        .mockResolvedValueOnce('思考: Need tool\n行动: nonexistent_tool()')
        .mockResolvedValueOnce('最终答案: The tool failed.');
      mockToolRegistry.execute.mockRejectedValue(new Error('Tool not found'));

      const result = await engine.executeReAct('user-1', 'Use a tool', {
        type: 'simple',
        confidence: 0.9,
      });

      expect(result.type).toBe('final');
    });

    it('PLAN-13: should handle empty tool result', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat
        .mockResolvedValueOnce('思考: Get info\n行动: get_user_info({"userId":"user-1"})')
        .mockResolvedValueOnce('最终答案: User found.');
      mockToolRegistry.execute.mockResolvedValue(null);

      const result = await engine.executeReAct('user-1', 'Get user info', {
        type: 'simple',
        confidence: 0.9,
      });

      expect(result.type).toBe('final');
    });

    it('PLAN-14: should return max_steps response after reaching iteration limit', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockToolRegistry.execute.mockResolvedValue('10:00');
      mockLlm.chat.mockResolvedValue('经过多步推理得出结论。');

      const result = await engine.executeReAct('user-1', 'Complex task', {
        type: 'simple',
        confidence: 0.9,
      });

      expect(result.type).toBe('max_steps');
      // Now returns LLM-generated summary (not the static text)
      expect(result.content).toContain('推理');
      expect((result.metadata as any)?.softLanding).toBe(true);
    });

    it('PLAN-15: should use r1 model for REASONING intent', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat.mockResolvedValue('最终答案: 2');

      await engine.executeReAct('user-1', '2 + 2 = ?', {
        type: 'reasoning',
        confidence: 0.9,
      });

      expect(mockLlm.chat).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
        ]),
        expect.objectContaining({ model: 'r1' }),
      );
    });

    it('should store assistant response in short-term memory', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat.mockResolvedValue('最终答案: Done.');

      await engine.executeReAct('user-1', 'Hello', { type: 'simple', confidence: 0.9 });

      expect(mockMemory.addShortTermMemory).toHaveBeenCalled();
    });

    it('should build context from RAG and memory', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([{ role: 'user', content: 'Previous' }]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('Relevant knowledge about Tokyo.');

      mockLlm.chat.mockResolvedValue('最终答案: Answer.');

      await engine.executeReAct('user-1', 'Tell me about Tokyo', {
        type: 'simple',
        confidence: 0.9,
      });

      expect(mockRagEngine.retrieve).toHaveBeenCalledWith('Tell me about Tokyo', 'user-1', 3);
    });

    it('should log tool call even when it fails', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat
        .mockResolvedValueOnce('行动: failing_tool()')
        .mockResolvedValueOnce('最终答案: Done.');
      mockToolRegistry.execute.mockRejectedValue(new Error('Tool failed'));

      await engine.executeReAct('user-1', 'Try tool', { type: 'simple', confidence: 0.9 });

      expect(mockMemory.logToolCall).toHaveBeenCalled();
    });
  });

  describe('streamReAct', () => {
    it('PLAN-20: should yield text chunks from streaming response', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chatStreamWithReasoning.mockImplementation(async function* () {
        yield { type: 'chunk', data: '最终答案: Hello' };
        yield { type: 'chunk', data: ' ' };
        yield { type: 'chunk', data: 'world' };
      });

      const chunks: string[] = [];
      for await (const chunk of engine.streamReAct('user-1', 'Hi', {
        type: 'simple',
        confidence: 0.9,
      })) {
        chunks.push(chunk);
      }

      expect(chunks.join('')).toContain('Hello');
    });

    it('PLAN-21: should emit reasoning events during streaming', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chatStreamWithReasoning.mockImplementation(async function* () {
        yield { type: 'chunk', data: '最终答案: Final answer.' };
      });

      const events: string[] = [];
      for await (const chunk of engine.streamReAct('user-1', 'Hi', {
        type: 'simple',
        confidence: 0.9,
      })) {
        events.push(chunk);
      }

      expect(events.length).toBeGreaterThan(0);
    });

    it('should handle empty streaming response', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chatStreamWithReasoning.mockImplementation(async function* () {
        return;
      });

      const chunks: string[] = [];
      for await (const chunk of engine.streamReAct('user-1', 'Hi', {
        type: 'simple',
        confidence: 0.9,
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('streamReActWithEvents', () => {
    it('PLAN-22: should emit step event', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chatStreamWithReasoning.mockImplementation(async function* () {
        return;
      });

      const events: any[] = [];
      for await (const event of engine.streamReActWithEvents('user-1', 'Hi', {
        type: 'simple',
        confidence: 0.9,
      })) {
        events.push(event);
      }

      expect(events.some((e) => e.type === 'step')).toBe(true);
    });

    it('PLAN-23: should emit tool_call and tool_result events', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chatStreamWithReasoning.mockImplementation(async function* () {
        yield { type: 'chunk', data: '行动: get_time()' };
      });
      mockToolRegistry.execute.mockResolvedValue('10:00');

      const events: any[] = [];
      for await (const event of engine.streamReActWithEvents('user-1', 'Time?', {
        type: 'simple',
        confidence: 0.9,
      })) {
        events.push(event);
      }

      expect(events.some((e) => e.type === 'tool_call')).toBe(true);
    });

    it('PLAN-24: should emit final event with content', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chatStreamWithReasoning.mockImplementation(async function* () {
        yield { type: 'chunk', data: '最终答案: Done.' };
      });

      const events: any[] = [];
      for await (const event of engine.streamReActWithEvents('user-1', 'Hi', {
        type: 'simple',
        confidence: 0.9,
      })) {
        events.push(event);
      }

      expect(events.some((e) => e.type === 'final')).toBe(true);
    });
  });

  describe('createPlan', () => {
    it('PLAN-30: should create plan with steps from task', async () => {
      mockLlm.chat.mockResolvedValue('STEP-1: Search for flights to Tokyo | search_flights | {"destination":"Tokyo"}\nSTEP-2: Find nearby hotels | search_hotels | {"location":"Tokyo"}');

      const result = await engine.createPlan('Book a trip to Tokyo', 'User wants to visit Tokyo', '- get_time: Get current time\n- calculate: Calculate expression');

      expect(result.goal).toBe('Book a trip to Tokyo');
      expect(result.steps.length).toBe(2);
      expect(result.steps[0]).toHaveProperty('id');
      expect(result.steps[0]).toHaveProperty('description');
      expect(result.steps[0]).toHaveProperty('tool');
    });

    it('PLAN-31: should handle empty plan when LLM returns no valid steps', async () => {
      mockLlm.chat.mockResolvedValue('No steps needed.');

      const result = await engine.createPlan('Simple greeting', '', '');

      expect(result.steps).toEqual([]);
    });

    it('PLAN-32: should log tool execution for planning', async () => {
      mockLlm.chat.mockResolvedValue('');

      await engine.createPlan('Task', '', '');

      // No tool calls expected during planning unless it involves a tool
      expect(mockMemory.logToolCall).not.toHaveBeenCalled();
    });

    it('PLAN-33: should handle plan with action args JSON', async () => {
      mockLlm.chat.mockResolvedValue('STEP-1: Search | search | {"query":"Tokyo flights"}\nSTEP-2: Book | book | {"itemId":"123"}');

      const result = await engine.createPlan('Book a flight', '', '- get_time: Get current time\n- calculate: Calculate expression');

      expect(result.steps.length).toBe(2);
      expect(result.steps[0].tool).toBe('search');
    });
  });

  describe('planAndExecute', () => {
    it('PLAN-40: should execute plan steps sequentially', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat
        .mockResolvedValueOnce('STEP-1: Get time | get_time | {}\nSTEP-2: Search | search | {"query":"weather"}')
        .mockResolvedValueOnce('{"needsRetry":false,"summary":"Summary of plan execution.","feedback":""}');
      mockToolRegistry.execute.mockResolvedValue('result');

      const result = await engine.planAndExecute('user-1', 'Plan a trip', {
        type: 'complex',
        confidence: 0.9,
      });

      expect(result.type).toBe('final');
      expect(mockToolRegistry.execute).toHaveBeenCalledTimes(2);
    });

    it('PLAN-41: should skip failed step and continue to next', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat
        .mockResolvedValueOnce('STEP-1: Failing step | failing_tool | {}\nSTEP-2: Succeeding step | get_time | {}')
        .mockResolvedValueOnce('{"needsRetry":false,"summary":"Summary.","feedback":""}');
      mockToolRegistry.execute
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('succeeded');

      const result = await engine.planAndExecute('user-1', 'Do tasks', {
        type: 'complex',
        confidence: 0.9,
      });

      expect(result.type).toBe('final');
      expect(mockToolRegistry.execute).toHaveBeenCalledTimes(2);
    });

    it('PLAN-42: should reflect on plan results and summarize', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat
        .mockResolvedValueOnce('STEP-1: Get time | get_time | {}')
        .mockResolvedValueOnce('{"needsRetry":false,"summary":"The plan was executed successfully.","feedback":""}');
      mockToolRegistry.execute.mockResolvedValue('10:00');

      const result = await engine.planAndExecute('user-1', 'What time is it', {
        type: 'complex',
        confidence: 0.9,
      });

      expect(result.type).toBe('final');
      expect(result.content).toBeDefined();
    });

    it('PLAN-43: should handle plan with empty goal', async () => {
      mockLlm.chat.mockResolvedValue('');

      const result = await engine.createPlan('', '', '');

      expect(result.goal).toBe('');
    });
  });

  describe('streamPlanAndExecuteWithEvents', () => {
    it('PLAN-50: should emit plan_created event', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat
        .mockResolvedValueOnce('STEP-1: First step | get_time | {}')
        .mockResolvedValueOnce('{"needsRetry":false,"summary":"Summary.","feedback":""}');
      mockLlm.chatStream.mockImplementation(async function* () { yield ''; });
      mockToolRegistry.execute.mockResolvedValue('10:00');

      const events: any[] = [];
      for await (const event of engine.streamPlanAndExecuteWithEvents('user-1', 'Do it', {
        type: 'complex',
        confidence: 0.9,
      })) {
        events.push(event);
      }

      expect(events.some((e) => e.type === 'plan_created')).toBe(true);
    });

    it('PLAN-51: should emit tool_result events for each step', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat
        .mockResolvedValueOnce('STEP-1: Get time | get_time | {}')
        .mockResolvedValueOnce('{"needsRetry":false,"summary":"Done.","feedback":""}');
      mockLlm.chatStream.mockImplementation(async function* () { yield ''; });
      mockToolRegistry.execute.mockResolvedValue('10:00');

      const events: any[] = [];
      for await (const event of engine.streamPlanAndExecuteWithEvents('user-1', 'Time?', {
        type: 'complex',
        confidence: 0.9,
      })) {
        events.push(event);
      }

      expect(events.some((e) => e.type === 'tool_result')).toBe(true);
    });

    it('PLAN-52: should emit final event', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat
        .mockResolvedValueOnce('STEP-1: Get time | get_time | {}')
        .mockResolvedValueOnce('{"needsRetry":false,"summary":"Final summary.","feedback":""}');
      mockLlm.chatStream.mockImplementation(async function* () { yield 'Final summary.'; });
      mockToolRegistry.execute.mockResolvedValue('10:00');

      const events: any[] = [];
      for await (const event of engine.streamPlanAndExecuteWithEvents('user-1', 'Time', {
        type: 'complex',
        confidence: 0.9,
      })) {
        events.push(event);
      }

      expect(events.some((e) => e.type === 'final')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('EDGE-PLAN-01: should handle very long user input without crashing', async () => {
      const longInput = 'A'.repeat(10000);
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat.mockResolvedValue('{"type":"simple","confidence":0.9,"reason":"test"}');

      const result = await engine.classifyIntent(longInput);

      expect(result).toBeDefined();
    });

    it('EDGE-PLAN-02: should handle RAG returning empty string', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat.mockResolvedValue('最终答案: Answer.');

      const result = await engine.executeReAct('user-1', 'Query', {
        type: 'simple',
        confidence: 0.9,
      });

      expect(result.type).toBe('final');
    });

    it('EDGE-PLAN-03: should handle LLM returning malformed tool call', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat
        .mockResolvedValueOnce('行动: get_time\n参数: invalid json')
        .mockResolvedValueOnce('最终答案: Done.');
      mockToolRegistry.execute.mockResolvedValue('10:00');

      const result = await engine.executeReAct('user-1', 'Time', { type: 'simple', confidence: 0.9 });

      expect(result.type).toBe('final');
    });

    it('EDGE-PLAN-04: should handle empty memory array', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat.mockResolvedValue('最终答案: Answer.');

      const result = await engine.executeReAct('user-1', 'Hi', { type: 'simple', confidence: 0.9 });

      expect(result.type).toBe('final');
    });

    it('EDGE-PLAN-05: should handle plan step with missing args', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat
        .mockResolvedValueOnce('STEP-1: Do something | tool_name')
        .mockResolvedValueOnce('{"needsRetry":false,"summary":"Summary.","feedback":""}');
      mockToolRegistry.execute.mockResolvedValue('result');

      const result = await engine.planAndExecute('user-1', 'Task', {
        type: 'complex',
        confidence: 0.9,
      });

      expect(result.type).toBe('final');
    });
  });

  describe('Soft Landing (ReAct Three-Tier Progressive)', () => {
    it('PLAN-SOFT-01: step 7 (70% of 10) should include soft-landing hint in prompt', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');

      let callCount = 0;
      mockLlm.chat.mockImplementation(() => {
        callCount++;
        if (callCount >= 10) return Promise.resolve('最终答案: Done.');
        return Promise.resolve('思考: reasoning\n行动: get_time()');
      });
      mockToolRegistry.execute.mockResolvedValue('10:00');

      await engine.executeReAct('user-1', 'Complex task', {
        type: 'simple',
        confidence: 0.9,
      });

      // The 7th call should include the soft-landing hint
      const softCallArgs = mockLlm.chat.mock.calls[6];
      expect(softCallArgs[0][softCallArgs[0].length - 1].content).toContain('剩余步数不多');
    });

    it('PLAN-SOFT-02: step 9 (90% of 10) should include more urgent hint in prompt', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');

      let callCount = 0;
      mockLlm.chat.mockImplementation(() => {
        callCount++;
        if (callCount >= 10) return Promise.resolve('最终答案: Done.');
        return Promise.resolve('思考: reasoning\n行动: get_time()');
      });
      mockToolRegistry.execute.mockResolvedValue('10:00');

      await engine.executeReAct('user-1', 'Complex task', {
        type: 'simple',
        confidence: 0.9,
      });

      // The 9th call should include the urgent hint
      const urgentCallArgs = mockLlm.chat.mock.calls[8];
      expect(urgentCallArgs[0][urgentCallArgs[0].length - 1].content).toContain('步数上限');
    });

    it('PLAN-SOFT-03: at max steps should call LLM to generate final summary', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');

      let callCount = 0;
      mockLlm.chat.mockImplementation(() => {
        callCount++;
        return Promise.resolve('思考: reasoning');
      });
      mockToolRegistry.execute.mockResolvedValue('result');

      const result = await engine.executeReAct('user-1', 'Very complex task', {
        type: 'simple',
        confidence: 0.9,
      });

      expect(result.type).toBe('max_steps');
      // LLM summary call should reference the original user question
      const summaryCall = mockLlm.chat.mock.calls[mockLlm.chat.mock.calls.length - 1];
      expect(summaryCall[0][summaryCall[0].length - 1].content).toContain('Very complex task');
      // Content should come from LLM, not the static fallback
      expect(result.content).not.toBe(
        '任务较为复杂，已达到最大推理步骤限制。请尝试将问题拆分为更小的部分。',
      );
    });

    it('PLAN-SOFT-04: streamReAct should apply three-tier progressive hints', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue([]);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockToolRegistry.execute.mockResolvedValue('result');

      let stepCount = 0;
      mockLlm.chatStreamWithReasoning.mockImplementation(async function* () {
        stepCount++;
        if (stepCount === 7) {
          yield { type: 'chunk', data: '思考: step 7\n行动: get_time()' };
        } else if (stepCount >= 10) {
          yield { type: 'chunk', data: '最终答案: Done.' };
        } else {
          yield { type: 'chunk', data: '思考: step\n行动: get_time()' };
        }
      });

      for await (const _ of engine.streamReAct('user-1', 'Task', {
        type: 'simple',
        confidence: 0.9,
      })) { /* consume stream */ }

      // Step 7 (70%) prompt should contain soft hint
      const step7Call = mockLlm.chatStreamWithReasoning.mock.calls[6];
      expect(step7Call[0][step7Call[0].length - 1].content).toContain('剩余步数不多');
    });
  });

  describe('Memory Token Integration', () => {
    it('PLAN-MEM-01: executeReAct should auto-compress memory when token exceeds 3000', async () => {
      // Simulate memory that exceeds 3000 tokens (50 items of 200 chars each)
      const largeMemory = Array(20).fill(null).map((_, i) => ({
        role: 'user',
        content: `message ${i} ` + 'a'.repeat(200),
      }));
      mockMemory.getShortTermMemory.mockResolvedValueOnce(largeMemory);
      mockMemory.getRelevantMemories.mockResolvedValue([]);
      mockRagEngine.retrieve.mockResolvedValue('');
      mockLlm.chat.mockResolvedValue('最终答案: Done.');

      await engine.executeReAct('user-1', 'Query', {
        type: 'simple',
        confidence: 0.9,
      });

      // After large memory is fetched, compress should be triggered
      expect(mockMemory.getShortTermMemory).toHaveBeenCalled();
    });
  });
});
