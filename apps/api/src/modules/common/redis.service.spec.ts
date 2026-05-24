import { RedisService } from './redis.service';

const mockRedisInstance = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  hset: jest.fn(),
  hget: jest.fn(),
  hgetall: jest.fn(),
  publish: jest.fn(),
  subscribe: jest.fn(),
  lpush: jest.fn(),
  lrange: jest.fn(),
  ltrim: jest.fn(),
  scan: jest.fn(),
  zadd: jest.fn(),
  zrange: jest.fn(),
  quit: jest.fn(),
  duplicate: jest.fn(),
  on: jest.fn(),
};

jest.mock('ioredis', () => ({
  default: jest.fn().mockImplementation(() => mockRedisInstance),
  Redis: jest.fn().mockImplementation(() => mockRedisInstance),
}));

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RedisService();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('constructor', () => {
    it('REDIS-01: should create Redis client with default options', () => {
      expect(mockRedisInstance.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('getClient', () => {
    it('REDIS-02: should return the Redis client instance', () => {
      const client = service.getClient();
      expect(client).toBe(mockRedisInstance);
    });
  });

  describe('get', () => {
    it('REDIS-03: should return value for existing key', async () => {
      mockRedisInstance.get.mockResolvedValue('value');

      const result = await service.get('key');

      expect(mockRedisInstance.get).toHaveBeenCalledWith('key');
      expect(result).toBe('value');
    });

    it('REDIS-04: should return null for non-existent key', async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      const result = await service.get('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('REDIS-05: should set key without TTL when not provided', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');

      await service.set('key', 'value');

      expect(mockRedisInstance.set).toHaveBeenCalledWith('key', 'value');
    });

    it('REDIS-06: should set key with TTL in milliseconds when provided', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');

      await service.set('key', 'value', 5000);

      expect(mockRedisInstance.set).toHaveBeenCalledWith('key', 'value', 'PX', 5000);
    });

    it('should set key with TTL as number 0 (treated as no TTL)', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');

      await service.set('key', 'value', 0);

      expect(mockRedisInstance.set).toHaveBeenCalledWith('key', 'value');
    });
  });

  describe('del', () => {
    it('REDIS-07: should delete key', async () => {
      mockRedisInstance.del.mockResolvedValue(1);

      await service.del('key');

      expect(mockRedisInstance.del).toHaveBeenCalledWith('key');
    });

    it('should return 0 when deleting non-existent key', async () => {
      mockRedisInstance.del.mockResolvedValue(0);

      await service.del('nonexistent');

      expect(mockRedisInstance.del).toHaveBeenCalledWith('nonexistent');
    });
  });

  describe('incr', () => {
    it('REDIS-08: should increment key value', async () => {
      mockRedisInstance.incr.mockResolvedValue(5);

      const result = await service.incr('counter');

      expect(mockRedisInstance.incr).toHaveBeenCalledWith('counter');
      expect(result).toBe(5);
    });

    it('should increment from 0 when key does not exist', async () => {
      mockRedisInstance.incr.mockResolvedValue(1);

      const result = await service.incr('new-counter');

      expect(result).toBe(1);
    });
  });

  describe('expire', () => {
    it('REDIS-09: should set expiration on key', async () => {
      mockRedisInstance.expire.mockResolvedValue(1);

      await service.expire('key', 60);

      expect(mockRedisInstance.expire).toHaveBeenCalledWith('key', 60);
    });

    it('should return 0 when setting expire on non-existent key', async () => {
      mockRedisInstance.expire.mockResolvedValue(0);

      await service.expire('nonexistent', 60);

      expect(mockRedisInstance.expire).toHaveBeenCalledWith('nonexistent', 60);
    });
  });

  describe('hset', () => {
    it('REDIS-10: should set hash field', async () => {
      mockRedisInstance.hset.mockResolvedValue(1);

      await service.hset('hash', 'field', 'value');

      expect(mockRedisInstance.hset).toHaveBeenCalledWith('hash', 'field', 'value');
    });

    it('should return 0 when field already exists (overwrites)', async () => {
      mockRedisInstance.hset.mockResolvedValue(0);

      await service.hset('hash', 'field', 'new-value');

      expect(mockRedisInstance.hset).toHaveBeenCalledWith('hash', 'field', 'new-value');
    });
  });

  describe('hget', () => {
    it('REDIS-11: should return hash field value', async () => {
      mockRedisInstance.hget.mockResolvedValue('value');

      const result = await service.hget('hash', 'field');

      expect(mockRedisInstance.hget).toHaveBeenCalledWith('hash', 'field');
      expect(result).toBe('value');
    });

    it('REDIS-12: should return null when field does not exist', async () => {
      mockRedisInstance.hget.mockResolvedValue(null);

      const result = await service.hget('hash', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('hgetall', () => {
    it('REDIS-13: should return all hash fields', async () => {
      const hashData = { field1: 'value1', field2: 'value2' };
      mockRedisInstance.hgetall.mockResolvedValue(hashData);

      const result = await service.hgetall('hash');

      expect(mockRedisInstance.hgetall).toHaveBeenCalledWith('hash');
      expect(result).toEqual(hashData);
    });

    it('REDIS-14: should return empty object for non-existent hash', async () => {
      mockRedisInstance.hgetall.mockResolvedValue({});

      const result = await service.hgetall('nonexistent');

      expect(result).toEqual({});
    });
  });

  describe('publish', () => {
    it('REDIS-15: should publish message to channel', async () => {
      mockRedisInstance.publish.mockResolvedValue(1);

      await service.publish('channel', 'message');

      expect(mockRedisInstance.publish).toHaveBeenCalledWith('channel', 'message');
    });

    it('should publish to multiple subscribers', async () => {
      mockRedisInstance.publish.mockResolvedValue(2);

      await service.publish('channel', 'broadcast');

      expect(mockRedisInstance.publish).toHaveBeenCalledWith('channel', 'broadcast');
    });
  });

  describe('subscribe', () => {
    it('REDIS-16: should create duplicate client and subscribe to channel', async () => {
      const mockSubscriber = {
        subscribe: jest.fn().mockResolvedValue(1),
        on: jest.fn(),
      };
      mockRedisInstance.duplicate.mockReturnValue(mockSubscriber);

      const callback = jest.fn();
      await service.subscribe('channel', callback);

      expect(mockRedisInstance.duplicate).toHaveBeenCalled();
      expect(mockSubscriber.subscribe).toHaveBeenCalledWith('channel');
    });

    it('REDIS-17: should invoke callback when message received', async () => {
      const mockSubscriber = {
        subscribe: jest.fn().mockResolvedValue(1),
        on: jest.fn(),
      };
      mockRedisInstance.duplicate.mockReturnValue(mockSubscriber);

      const callback = jest.fn();
      await service.subscribe('channel', callback);

      const messageHandler = mockSubscriber.on.mock.calls.find(([event]) => event === 'message')[1];
      messageHandler('channel', 'test-message');

      expect(callback).toHaveBeenCalledWith('test-message');
    });
  });

  describe('lpush', () => {
    it('REDIS-18: should push values to list head', async () => {
      mockRedisInstance.lpush.mockResolvedValue(3);

      await service.lpush('list', 'value1', 'value2', 'value3');

      expect(mockRedisInstance.lpush).toHaveBeenCalledWith('list', 'value1', 'value2', 'value3');
    });

    it('should push single value', async () => {
      mockRedisInstance.lpush.mockResolvedValue(1);

      await service.lpush('list', 'value');

      expect(mockRedisInstance.lpush).toHaveBeenCalledWith('list', 'value');
    });
  });

  describe('lrange', () => {
    it('REDIS-19: should return list range', async () => {
      const listItems = ['item1', 'item2', 'item3'];
      mockRedisInstance.lrange.mockResolvedValue(listItems);

      const result = await service.lrange('list', 0, -1);

      expect(mockRedisInstance.lrange).toHaveBeenCalledWith('list', 0, -1);
      expect(result).toEqual(listItems);
    });

    it('REDIS-20: should return empty array for non-existent list', async () => {
      mockRedisInstance.lrange.mockResolvedValue([]);

      const result = await service.lrange('nonexistent', 0, -1);

      expect(result).toEqual([]);
    });

    it('should return empty array when Redis connection fails', async () => {
      mockRedisInstance.lrange.mockRejectedValue(new Error('Connection refused'));

      const result = await service.lrange('list', 0, -1);

      expect(result).toEqual([]);
    });
  });

  describe('ltrim', () => {
    it('REDIS-21: should trim list to range', async () => {
      mockRedisInstance.ltrim.mockResolvedValue('OK');

      await service.ltrim('list', 0, 99);

      expect(mockRedisInstance.ltrim).toHaveBeenCalledWith('list', 0, 99);
    });

    it('should handle negative indices', async () => {
      mockRedisInstance.ltrim.mockResolvedValue('OK');

      await service.ltrim('list', 0, -1);

      expect(mockRedisInstance.ltrim).toHaveBeenCalledWith('list', 0, -1);
    });
  });

  describe('scan', () => {
    it('REDIS-22: should scan keys matching pattern with default count', async () => {
      mockRedisInstance.scan.mockResolvedValue(['0', ['key1', 'key2']]);

      const result = await service.scan('0', 'user:*');

      expect(mockRedisInstance.scan).toHaveBeenCalledWith('0', 'MATCH', 'user:*', 'COUNT', 100);
      expect(result).toEqual(['0', ['key1', 'key2']]);
    });

    it('REDIS-23: should scan with custom count', async () => {
      mockRedisInstance.scan.mockResolvedValue(['5', ['key3']]);

      const result = await service.scan('0', 'session:*', 50);

      expect(mockRedisInstance.scan).toHaveBeenCalledWith('0', 'MATCH', 'session:*', 'COUNT', 50);
      expect(result).toEqual(['5', ['key3']]);
    });

    it('should return empty keys array when no matches', async () => {
      mockRedisInstance.scan.mockResolvedValue(['0', []]);

      const result = await service.scan('0', 'nonexistent:*');

      expect(result).toEqual(['0', []]);
    });

    it('should handle cursor-based pagination', async () => {
      mockRedisInstance.scan.mockResolvedValue(['10', ['key4']]);

      const result = await service.scan('5', 'user:*');

      expect(result[0]).toBe('10');
    });
  });

  describe('zadd', () => {
    it('REDIS-24: should add member with score to sorted set', async () => {
      mockRedisInstance.zadd.mockResolvedValue(1);

      await service.zadd('leaderboard', 100, 'user-1');

      expect(mockRedisInstance.zadd).toHaveBeenCalledWith('leaderboard', 100, 'user-1');
    });

    it('should update score if member already exists', async () => {
      mockRedisInstance.zadd.mockResolvedValue(0);

      await service.zadd('leaderboard', 200, 'user-1');

      expect(mockRedisInstance.zadd).toHaveBeenCalledWith('leaderboard', 200, 'user-1');
    });
  });

  describe('zrange', () => {
    it('REDIS-25: should return members in sorted set by score', async () => {
      const members = ['user-1', 'user-2', 'user-3'];
      mockRedisInstance.zrange.mockResolvedValue(members);

      const result = await service.zrange('leaderboard', 0, -1);

      expect(mockRedisInstance.zrange).toHaveBeenCalledWith('leaderboard', 0, -1);
      expect(result).toEqual(members);
    });

    it('REDIS-26: should return empty array for non-existent sorted set', async () => {
      mockRedisInstance.zrange.mockResolvedValue([]);

      const result = await service.zrange('nonexistent', 0, -1);

      expect(result).toEqual([]);
    });
  });

  describe('onModuleDestroy', () => {
    it('REDIS-27: should call quit on client', async () => {
      mockRedisInstance.quit.mockResolvedValue('OK');

      await service.onModuleDestroy();

      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('EDGE-REDIS-01: should handle empty string value in set', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');

      await service.set('key', '');

      expect(mockRedisInstance.set).toHaveBeenCalledWith('key', '');
    });

    it('EDGE-REDIS-02: should handle null value from hget', async () => {
      mockRedisInstance.hget.mockResolvedValue(null);

      const result = await service.hget('hash', 'field');

      expect(result).toBeNull();
    });

    it('EDGE-REDIS-03: should handle concurrent operations', async () => {
      mockRedisInstance.get.mockResolvedValue('value1');
      mockRedisInstance.set.mockResolvedValue('OK');
      mockRedisInstance.del.mockResolvedValue(1);

      const [getResult, , delResult] = await Promise.all([
        service.get('key1'),
        service.set('key2', 'value2'),
        service.del('key3'),
      ]);

      expect(getResult).toBe('value1');
      expect(delResult).toBeUndefined();
    });

    it('EDGE-REDIS-04: should handle scan with special characters in pattern', async () => {
      mockRedisInstance.scan.mockResolvedValue(['0', ['key:special']]);

      const result = await service.scan('0', 'key:*:special');

      expect(result).toEqual(['0', ['key:special']]);
    });

    it('EDGE-REDIS-05: should handle incr on string value (returns error)', async () => {
      mockRedisInstance.incr.mockRejectedValue(new Error('ERR value is not an integer'));

      await expect(service.incr('string-key')).rejects.toThrow('ERR value is not an integer');
    });
  });
});
