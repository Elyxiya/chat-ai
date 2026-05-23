import { Test, TestingModule } from '@nestjs/testing';
import { ToolRegistry } from './tool-registry.service';
import { PrismaService } from '../../../config/prisma.service';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1', username: 'testuser' }),
        findMany: jest.fn(),
      },
      chatSessionMember: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolRegistry,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    registry = module.get<ToolRegistry>(ToolRegistry);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTools', () => {
    it('TOOL-05: should return list of registered tools', async () => {
      const tools = registry.getTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should include built-in tools', async () => {
      const toolNames = registry.getTools().map((t) => t.name);

      expect(toolNames).toContain('get_time');
      expect(toolNames).toContain('calculate');
      expect(toolNames).toContain('get_user_info');
    });
  });

  describe('register', () => {
    it('TOOL-01: should register new tool and getTools should return it', async () => {
      const newTool = {
        name: 'custom_tool',
        description: 'A custom tool for testing',
        parameters: { query: { type: 'string', description: 'Query string', required: true } },
        handler: async (args: any) => ({ result: `You searched for: ${args.query}` }),
      };

      registry.register(newTool);
      const tools = registry.getTools();

      expect(tools.find((t) => t.name === 'custom_tool')).toBeDefined();
    });
  });

  describe('execute', () => {
    it('TOOL-02: should execute get_time tool and return formatted time string', async () => {
      const ctx = { userId: 'user-1', messages: [] };
      const result = await registry.execute('get_time', {}, ctx);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should execute calculate tool and return result object', async () => {
      const ctx = { userId: 'user-1', messages: [] };
      const result = await registry.execute('calculate', { expression: '2 + 2' }, ctx);

      expect(result).toHaveProperty('expression', '2 + 2');
      expect(result).toHaveProperty('result', 4);
    });

    it('should return error on invalid expression', async () => {
      const ctx = { userId: 'user-1', messages: [] };
      const result = await registry.execute('calculate', { expression: 'invalid' }, ctx);

      expect(result).toHaveProperty('expression', 'invalid');
      expect(result).toHaveProperty('error');
    });

    it('TOOL-03: should throw error for non-existent tool', async () => {
      const ctx = { userId: 'user-1', messages: [] };

      await expect(registry.execute('nonexistent_tool', {}, ctx)).rejects.toThrow(/not found/);
    });

    it('TOOL-04: should throw error for missing required parameter', async () => {
      const ctx = { userId: 'user-1', messages: [] };
      const tool = registry.getTools().find((t) => t.name === 'get_user_info');
      const requiredEntry = Object.entries(tool!.parameters).find(([, spec]) => spec.required);

      if (requiredEntry) {
        await expect(registry.execute('get_user_info', {}, ctx)).rejects.toThrow(/Missing required argument/);
      }
    });

    it('should execute get_user_info with userId parameter and return user data', async () => {
      const ctx = { userId: 'user-1', messages: [] };

      const result = await registry.execute('get_user_info', { userId: 'user-1' }, ctx);

      expect(result).not.toBeNull();
      expect((result as any).id).toBe('user-1');
    });
  });

  describe('getToolDescriptions', () => {
    it('should return all tool descriptions as string', async () => {
      const descriptions = registry.getToolDescriptions();

      expect(typeof descriptions).toBe('string');
      expect(descriptions).toContain('get_time:');
      expect(descriptions).toContain('calculate:');
    });
  });
});
