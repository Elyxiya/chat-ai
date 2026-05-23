import { DeepSeekProvider } from '../../modules/llm/providers/deepseek.provider';

export function createMockDeepSeekProvider(overrides?: Partial<DeepSeekProvider>): DeepSeekProvider {
  const mock = {
    chat: jest.fn().mockResolvedValue('Mocked LLM response'),
    chatStream: jest.fn().mockImplementation(function* () {
      yield 'Mocked ';
      yield 'streaming ';
      yield 'response';
    }),
    chatStreamWithReasoning: jest.fn().mockImplementation(function* () {
      yield { type: 'content' as const, data: 'Mocked ' };
      yield { type: 'content' as const, data: 'streaming ' };
      yield { type: 'content' as const, data: 'response' };
    }),
    embed: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    isAvailable: jest.fn().mockResolvedValue(true),
  } as unknown as DeepSeekProvider;
  return Object.assign(mock, overrides);
}

export function createMockDeepSeekProviderWithStream(chunks: string[]): DeepSeekProvider {
  const mock = {
    chat: jest.fn().mockResolvedValue('Mocked LLM response'),
    chatStream: jest.fn().mockImplementation(function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    }),
    chatStreamWithReasoning: jest.fn().mockImplementation(function* () {
      for (const chunk of chunks) {
        yield { type: 'content' as const, data: chunk };
      }
    }),
    embed: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    isAvailable: jest.fn().mockResolvedValue(true),
  } as unknown as DeepSeekProvider;
  return mock;
}
