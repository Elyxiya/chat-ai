import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  public readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor() {
    const rawPass = process.env.REDIS_PASSWORD;
    const pass = rawPass === '' || rawPass === undefined || rawPass === null ? undefined : rawPass;
    // #region debug log
    fetch('http://127.0.0.1:7327/ingest/804a4ea0-edf2-4cdf-8542-0c7db0a68a39',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7dd50'},body:JSON.stringify({sessionId:'d7dd50',location:'redis.service.ts:10',message:'Redis config',data:{rawPass,pass,REDIS_PASSWORD:process.env.REDIS_PASSWORD},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: pass,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    if (ttlMs) {
      await this.client.set(key, value, 'PX', ttlMs);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
  }

  async subscribe(
    channel: string,
    callback: (message: string) => void,
  ): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.subscribe(channel);
    subscriber.on('message', (_, msg) => callback(msg));
  }

  async lpush(key: string, ...values: string[]): Promise<void> {
    await this.client.lpush(key, ...values);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    // #region debug log
    fetch('http://127.0.0.1:7327/ingest/804a4ea0-edf2-4cdf-8542-0c7db0a68a39',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'288cad'},body:JSON.stringify({sessionId:'288cad',runId:'initial',hypothesisId:'D',location:'redis.service.ts:83',message:'Redis lrange called',data:{key,start,stop},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    try {
      const result = await this.client.lrange(key, start, stop);
      // #region debug log
      fetch('http://127.0.0.1:7327/ingest/804a4ea0-edf2-4cdf-8542-0c7db0a68a39',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'288cad'},body:JSON.stringify({sessionId:'288cad',runId:'initial',hypothesisId:'D',location:'redis.service.ts:84',message:'Redis lrange result',data:{key,resultLength:result.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return result;
    } catch (err: any) {
      // #region debug log
      fetch('http://127.0.0.1:7327/ingest/804a4ea0-edf2-4cdf-8542-0c7db0a68a39',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'288cad'},body:JSON.stringify({sessionId:'288cad',runId:'initial',hypothesisId:'D',location:'redis.service.ts:84',message:'Redis lrange ERROR',data:{key,error:err.message,errorType:err.name},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      throw err;
    }
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    await this.client.ltrim(key, start, stop);
  }

  async scan(cursor: string, pattern: string, count?: number): Promise<[string, string[]]> {
    return this.client.scan(cursor, 'MATCH', pattern, 'COUNT', count ?? 100) as Promise<[string, string[]]>;
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.client.zadd(key, score, member);
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.zrange(key, start, stop);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
