import { Test, TestingModule } from '@nestjs/testing';
import { AgentController } from './agent.controller';
import { AgentOrchestrator } from './orchestrator/agent-orchestrator.service';
import { MemoryService } from './memory/memory.service';
import { ChatService } from '../chat/chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Response } from 'express';

describe('AgentController', () => {
  let controller: AgentController;
  let mockOrchestrator: any;
  let mockMemory: any;
  let mockChatService: any;
  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    mockOrchestrator = {
      process: jest.fn(),
      streamProcess: jest.fn(),
      streamProcessWithEvents: jest.fn(),
      getConversationHistory: jest.fn(),
      clearMemory: jest.fn(),
    };

    mockMemory = {
      summarizeAndCompress: jest.fn(),
    };

    mockChatService = {};

    mockResponse = {
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      flushHeaders: jest.fn(),
      status: jest.fn().mockReturnThis(),
      socket: { setNoDelay: jest.fn() } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [
        { provide: AgentOrchestrator, useValue: mockOrchestrator },
        { provide: MemoryService, useValue: mockMemory },
        { provide: ChatService, useValue: mockChatService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AgentController>(AgentController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('chat', () => {
    it('AGENT-CTRL-01: should send message and return agent response', async () => {
      mockOrchestrator.process.mockResolvedValue({
        type: 'final',
        content: 'Hello! How can I help you?',
      });

      const result = await controller.chat('user-1', { message: 'Hello' });

      expect((result as any).data.type).toBe('final');
      expect((result as any).data.content).toBe('Hello! How can I help you?');
    });

    it('AGENT-CTRL-02: should pass sessionId to orchestrator', async () => {
      mockOrchestrator.process.mockResolvedValue({ type: 'final', content: 'Response' });

      await controller.chat('user-1', { message: 'Hello', sessionId: 'session-1' });

      expect(mockOrchestrator.process).toHaveBeenCalledWith('user-1', 'Hello', 'session-1');
    });
  });

  describe('chatStream', () => {
    it('AGENT-CTRL-03: should set correct SSE headers', async () => {
      mockOrchestrator.streamProcess.mockImplementation(async function* () {
        yield 'Hello';
        yield ' world';
      });

      await controller.chatStream('user-1', { message: 'Hello' }, mockResponse as Response);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    });

    it('AGENT-CTRL-04: should send start event', async () => {
      mockOrchestrator.streamProcess.mockImplementation(async function* () {
        yield 'chunk';
      });

      await controller.chatStream('user-1', { message: 'Hi' }, mockResponse as Response);

      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"type":"start"'));
    });

    it('AGENT-CTRL-05: should stream chunks to response', async () => {
      mockOrchestrator.streamProcess.mockImplementation(async function* () {
        yield 'Hello';
        yield ' there';
      });

      await controller.chatStream('user-1', { message: 'Hello' }, mockResponse as Response);

      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('Hello'));
    });

    it('AGENT-CTRL-06: should send done event at end', async () => {
      mockOrchestrator.streamProcess.mockImplementation(async function* () {
        yield 'Done';
      });

      await controller.chatStream('user-1', { message: 'Done' }, mockResponse as Response);

      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"type":"done"'));
      expect(mockResponse.end).toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('AGENT-CTRL-07: should return conversation history', async () => {
      const history = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];
      mockOrchestrator.getConversationHistory.mockResolvedValue(history);

      const result = await controller.getHistory('user-1', 50);

      expect((result as any).data).toEqual(history);
    });
  });

  describe('clearMemory', () => {
    it('AGENT-CTRL-08: should clear agent memory', async () => {
      mockOrchestrator.clearMemory.mockResolvedValue(undefined);

      const result = await controller.clearMemory('user-1');

      expect((result as any).message).toBe('Memory cleared');
      expect(mockOrchestrator.clearMemory).toHaveBeenCalledWith('user-1');
    });
  });

  describe('summarizeMemory', () => {
    it('AGENT-CTRL-09: should summarize and compress memory', async () => {
      mockMemory.summarizeAndCompress.mockResolvedValue(undefined);

      const result = await controller.summarizeMemory('user-1');

      expect((result as any).message).toBe('Memory summarized');
    });
  });

  describe('getStatus', () => {
    it('AGENT-CTRL-10: should return AI service status', async () => {
      const result = await controller.getStatus();

      expect((result as any).data).toHaveProperty('online', true);
      expect((result as any).data).toHaveProperty('model_v3');
      expect((result as any).data).toHaveProperty('timestamp');
    });
  });
});
