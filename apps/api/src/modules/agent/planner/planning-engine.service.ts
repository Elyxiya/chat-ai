import { Injectable, Logger } from '@nestjs/common';
import { ToolRegistry } from '../tools/tool-registry.service';
import { MemoryService } from '../memory/memory.service';
import { RagEngine } from '../rag/rag-engine.service';
import { DeepSeekProvider } from '../../llm/providers/deepseek.provider';
import {
  IntentClassification,
  AgentResponse,
  AgentContext,
  PlanStep,
  ExecutionPlan,
  ToolCall,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PlanningEngine {
  private readonly logger = new Logger(PlanningEngine.name);
  private readonly MAX_REACT_STEPS = 10;
  private readonly MAX_PLAN_STEPS = 20;

  constructor(
    private readonly llmProvider: DeepSeekProvider,
    private readonly toolRegistry: ToolRegistry,
    private readonly memory: MemoryService,
    private readonly ragEngine: RagEngine,
  ) {}

  async classifyIntent(input: string): Promise<IntentClassification> {
    const prompt = `分析以下用户输入，判断其类型：

用户输入：${input}

类型说明：
- simple: 简单问答或闲聊，不需要工具调用
- complex: 复杂任务，需要多个步骤或工具调用
- reasoning: 需要深度推理和思考的问题
- creative: 创意生成任务（写作、代码等）

请只输出JSON格式：{"type":"类型","confidence":0.0-1.0,"reason":"原因"}`;

    try {
      const response = await this.llmProvider.chat([
        { role: 'user', content: prompt },
      ], { model: 'v3', temperature: 0.1, maxTokens: 200 });

      const parsed = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
      return parsed as IntentClassification;
    } catch (error) {
      this.logger.warn(`Intent classification failed, defaulting to simple: ${error.message}`);
      return { type: 'simple', confidence: 0.5, reason: 'classification_failed' };
    }
  }

  async executeReAct(
    userId: string,
    input: string,
    intent: IntentClassification,
    sessionId?: string,
  ): Promise<AgentResponse> {
    const memory = await this.memory.getShortTermMemory(userId, 20);
    const tools = this.toolRegistry.getToolDescriptions();
    const context = await this.buildContext(userId, input);

    let observation = '';
    let stepCount = 0;
    let reasoning = '';

    while (stepCount < this.MAX_REACT_STEPS) {
      stepCount++;

      const thoughtPrompt = this.buildReActPrompt(input, observation, memory, context, tools, stepCount);

      const thought = await this.llmProvider.chat(thoughtPrompt, {
        model: intent.type === 'reasoning' ? 'r1' : 'v3',
        temperature: 0.7,
        maxTokens: 1000,
      });

      const parsed = this.parseThought(thought);
      reasoning += `\n[Step ${stepCount}] ${parsed.reasoning}`;

      if (parsed.action?.type === 'final') {
        await this.memory.addShortTermMemory(userId, {
          role: 'assistant',
          content: parsed.action.result ?? '',
          timestamp: Date.now(),
          metadata: { reasoning },
        });

        return {
          type: 'final',
          content: parsed.action.result ?? '',
          reasoning,
          metadata: { steps: stepCount, intent },
        };
      }

      if (parsed.action?.type === 'tool') {
        const toolCall: ToolCall = {
          id: uuidv4(),
          name: parsed.action.toolName ?? '',
          arguments: parsed.action.args ?? {},
        };

        const toolResult = await this.executeToolCall(toolCall, userId);
        observation = `工具 "${toolCall.name}" 执行${toolResult.success ? '成功' : '失败'}。结果：${JSON.stringify(toolResult.result || toolResult.error)}`;

        memory.push({
          role: 'assistant',
          content: `Action: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`,
          timestamp: Date.now(),
        });
      }
    }

    return {
      type: 'max_steps',
      content: '任务较为复杂，已达到最大推理步骤限制。请尝试将问题拆分为更小的部分。',
      reasoning,
      metadata: { steps: stepCount },
    };
  }

  async *streamReAct(
    userId: string,
    input: string,
    intent: IntentClassification,
    sessionId?: string,
  ): AsyncGenerator<string> {
    const memory = await this.memory.getShortTermMemory(userId, 20);
    const tools = this.toolRegistry.getToolDescriptions();
    const context = await this.buildContext(userId, input);

    let observation = '';
    let stepCount = 0;
    let reasoning = '';

    while (stepCount < this.MAX_REACT_STEPS) {
      stepCount++;

      const thoughtPrompt = this.buildReActPrompt(input, observation, memory, context, tools, stepCount);

      let fullResponse = '';
      for await (const chunk of this.llmProvider.chatStream(thoughtPrompt, {
        model: intent.type === 'reasoning' ? 'r1' : 'v3',
        temperature: 0.7,
        maxTokens: 1000,
      })) {
        fullResponse += chunk;
      }

      const parsed = this.parseThought(fullResponse);
      reasoning += `\n[Step ${stepCount}] ${parsed.reasoning}`;

      if (parsed.action?.type === 'final') {
        await this.memory.addShortTermMemory(userId, {
          role: 'assistant',
          content: parsed.action.result ?? '',
          timestamp: Date.now(),
          metadata: { reasoning },
        });

        yield parsed.action.result ?? '';
        return;
      }

      if (parsed.action?.type === 'tool') {
        const toolCall: ToolCall = {
          id: uuidv4(),
          name: parsed.action.toolName ?? '',
          arguments: parsed.action.args ?? {},
        };

        const toolResult = await this.executeToolCall(toolCall, userId);
        observation = `工具 "${toolCall.name}" 执行${toolResult.success ? '成功' : '失败'}。结果：${JSON.stringify(toolResult.result || toolResult.error)}`;

        memory.push({
          role: 'assistant',
          content: `Action: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`,
          timestamp: Date.now(),
        });
      }
    }
  }

  async planAndExecute(
    userId: string,
    input: string,
    intent: IntentClassification,
    sessionId?: string,
  ): Promise<AgentResponse> {
    const context = await this.buildContext(userId, input);
    const tools = this.toolRegistry.getToolDescriptions();

    const plan = await this.createPlan(input, context, tools);
    this.logger.log(`[${userId}] Plan created with ${plan.steps.length} steps`);

    for (const step of plan.steps) {
      if (step.status === 'pending' && step.tool) {
        const result = await this.executeToolCall(
          { id: uuidv4(), name: step.tool, arguments: step.args || {} },
          userId,
        );
        step.result = result;
        step.status = result.success ? 'completed' : 'failed';

        if (!result.success) {
          this.logger.warn(`[${userId}] Step "${step.description}" failed: ${result.error}`);
        }
      }
    }

    const reflection = await this.reflect(input, plan);
    plan.reflection = reflection;

    if (reflection.needsRetry && plan.steps.some((s) => s.status === 'failed')) {
      return this.retry(input, plan, reflection, userId, context, tools);
    }

    const finalResponse = reflection.summary;

    return {
      type: 'final',
      content: finalResponse,
      reasoning: plan.steps.map((s) => `[${s.status}] ${s.description}`).join('\n'),
      metadata: { plan, reflection },
    };
  }

  async *streamPlanAndExecute(
    userId: string,
    input: string,
    intent: IntentClassification,
    sessionId?: string,
  ): AsyncGenerator<string> {
    const context = await this.buildContext(userId, input);
    const tools = this.toolRegistry.getToolDescriptions();

    const plan = await this.createPlan(input, context, tools);

    for await (const chunk of this.llmProvider.chatStream([
      { role: 'system', content: 'You are a helpful assistant. Summarize the plan execution results concisely.' },
      { role: 'user', content: `Original task: ${input}\n\nPlan execution:\n${plan.steps.map((s) => `[${s.status}] ${s.description}: ${s.result?.result || s.result?.error || 'N/A'}`).join('\n')}` },
    ], { model: 'v3', temperature: 0.7 })) {
      yield chunk;
    }
  }

  async createPlan(
    input: string,
    context: string,
    tools: string,
  ): Promise<ExecutionPlan> {
    const prompt = `你是一个任务规划专家。用户需要完成以下任务：

任务：${input}

可用工具：
${tools}

背景信息：
${context}

请将任务拆解为清晰的步骤序列。每个步骤格式：
STEP-[序号]: 描述 | 工具名称 | 参数JSON

只输出步骤序列，不要其他内容。`;

    const response = await this.llmProvider.chat([
      { role: 'user', content: prompt },
    ], { model: 'v3', temperature: 0.3, maxTokens: 2000 });

    const steps: PlanStep[] = [];
    const stepRegex = /STEP-(\d+):\s*(.+?)\s*\|\s*(\w+)\s*(?:\|)?\s*(\{.*?\})?/gi;
    let match;

    while ((match = stepRegex.exec(response)) !== null) {
      steps.push({
        id: parseInt(match[1]),
        description: match[2].trim(),
        tool: match[3].trim() || undefined,
        args: match[4] ? JSON.parse(match[4]) : {},
        status: 'pending',
      });
    }

    return { goal: input, steps };
  }

  async reflect(input: string, plan: ExecutionPlan): Promise<{ needsRetry: boolean; summary: string; feedback?: string }> {
    const prompt = `任务：${input}

执行结果：
${plan.steps.map((s) => `- ${s.description}: ${s.status === 'completed' ? '成功 ✓' : '失败 ✗'}`).join('\n')}

请反思：
1. 任务是否成功完成？
2. 有哪些失败的步骤？原因是什么？
3. 如何改进？

输出JSON：{"needsRetry":true/false,"summary":"最终总结","feedback":"改进建议（如需要重试）"}`;

    const response = await this.llmProvider.chat([
      { role: 'user', content: prompt },
    ], { model: 'v3', temperature: 0.5, maxTokens: 1000 });

    return JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  }

  private async retry(
    input: string,
    failedPlan: ExecutionPlan,
    reflection: { feedback?: string },
    userId: string,
    context: string,
    tools: string,
  ): Promise<AgentResponse> {
    this.logger.log(`[${userId}] Retrying with improved plan`);

    const retryPrompt = `原任务：${input}
失败原因：${reflection.feedback}
原计划失败的步骤：
${failedPlan.steps.filter((s) => s.status === 'failed').map((s) => `- ${s.description}`).join('\n')}

请创建一个改进的执行计划。`;

    const improvedPlan = await this.createPlan(retryPrompt, context, tools);

    for (const step of improvedPlan.steps) {
      if (step.tool) {
        const result = await this.executeToolCall(
          { id: uuidv4(), name: step.tool, arguments: step.args || {} },
          userId,
        );
        step.result = result;
        step.status = result.success ? 'completed' : 'failed';
      }
    }

    const summary = await this.llmProvider.chat([
      { role: 'user', content: `任务：${input}\n\n执行：${improvedPlan.steps.map((s) => `${s.description}: ${s.result?.result || s.result?.error}`).join('\n')}\n\n请简洁总结结果。` },
    ], { model: 'v3', temperature: 0.5 });

    return {
      type: 'final',
      content: summary,
      reasoning: improvedPlan.steps.map((s) => `[${s.status}] ${s.description}`).join('\n'),
      metadata: { plan: improvedPlan, retry: true },
    };
  }

  private async buildContext(userId: string, input: string): Promise<string> {
    const memories = await this.memory.getRelevantMemories(userId, input, 5);
    const knowledge = await this.ragEngine.retrieve(input, userId, 3);

    let context = '';
    if (memories.length) {
      context += `相关记忆：\n${memories.map((m) => `- ${m.content}`).join('\n')}\n\n`;
    }
    if (knowledge) {
      context += `相关知识：\n${knowledge}\n\n`;
    }
    return context;
  }

  private buildReActPrompt(
    input: string,
    observation: string,
    memory: any[],
    context: string,
    tools: string,
    step: number,
  ) {
    const history = memory.map((m) => `${m.role}: ${m.content}`).join('\n');

    return [
      {
        role: 'system',
        content: `你是一个智能助手，通过推理和工具调用来完成任务。

可用工具：
${tools}

上下文：
${context}

推理格式：
思考：<你的推理过程>
行动：<工具名称>(<参数JSON>)
或者：
思考：<你的推理过程>
最终答案：<直接回答用户>

注意：
- 只使用列表中的工具
- 参数必须严格匹配工具描述
- 如果问题可以直接回答，使用"最终答案"
- 最多执行${this.MAX_REACT_STEPS}步`,
      },
      {
        role: 'user',
        content: `任务：${input}

历史：${history}
当前观察：${observation || '无'}
步骤 ${step}/${this.MAX_REACT_STEPS}`,
      },
    ];
  }

  private parseThought(response: string): { reasoning: string; action?: { type: 'tool' | 'final'; toolName?: string; args?: any; result?: string } } {
    const thoughtMatch = response.match(/思考[：:]\s*(.+?)(?=\n行动[：:]|最终答案[：:])/s);
    const toolMatch = response.match(/行动[：:]\s*(\w+)\s*\(\s*(\{[^}]*\})?\s*\)/s);
    const finalMatch = response.match(/最终答案[：:]\s*(.+)/s);

    return {
      reasoning: thoughtMatch?.[1]?.trim() || '',
      action: toolMatch
        ? { type: 'tool', toolName: toolMatch[1], args: toolMatch[2] ? JSON.parse(toolMatch[2]) : {} }
        : finalMatch
          ? { type: 'final', result: finalMatch[1].trim() }
          : undefined,
    };
  }

  private async executeToolCall(
    toolCall: ToolCall,
    userId: string,
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    const startTime = Date.now();
    let toolSuccess = false;

    try {
      const result = await this.toolRegistry.execute(toolCall.name, toolCall.arguments, { userId, messages: [] });
      toolSuccess = true;
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      await this.memory.logToolCall({
        conversationId: '',
        userId,
        toolName: toolCall.name,
        toolInput: toolCall.arguments,
        success: toolSuccess,
        errorMessage: undefined,
        executionTimeMs: Date.now() - startTime,
      });
    }
  }
}
