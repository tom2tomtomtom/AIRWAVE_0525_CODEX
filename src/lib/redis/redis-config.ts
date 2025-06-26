/**
 * Redis Configuration for Production
 * Handles connection, caching, and distributed operations
 */

import Redis from 'ioredis';
import { loggers } from '@/lib/logger';


interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
  keepAlive: number;
  family: number;
  keyPrefix?: string;
}

class RedisManager {
  private static instance: RedisManager;
  private redis: Redis | null = null;
  private isConnected = false;

  static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<Redis> {
    if (this.redis && this.isConnected) {
      return this.redis;
    }

    try {
      const config = this.getRedisConfig();

      this.redis = new Redis(config);

      // Set up event listeners
      this.redis.on('connect', () => {
        loggers.general.error('✅ Redis connected successfully');
        this.isConnected = true;
      });

      this.redis.on('error', error => {
        console.error('❌ Redis connection error:', error);
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        loggers.general.error('🔌 Redis connection closed');
        this.isConnected = false;
      });

      this.redis.on('reconnecting', () => {
        loggers.general.error('🔄 Redis reconnecting...');
      });

      // Test the connection
      await this.redis.ping();

      return this.redis;
    } catch (error: any) {
      console.error('Failed to connect to Redis:', error);
      throw new Error(
        `Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get Redis configuration from environment
   */
  private getRedisConfig(): any {
    // Check for Upstash Redis configuration first
    const upstashUrl = process.env.UPSTASH_REDIS_URL;
    const upstashToken = process.env.UPSTASH_REDIS_TOKEN;

    if (upstashUrl && upstashToken) {
      return {
        url: upstashUrl,
        token: upstashToken,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        family: 4,
        keyPrefix: 'airwave:' };
    }

    // Check for standard Redis URL
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      // Parse Redis URL (e.g., redis://user:pass@host:port/db)
      const url = new URL(redisUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
        db: parseInt(url.pathname.slice(1)) || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        family: 4,
        keyPrefix: 'airwave:' };
    }

    // Fallback to individual environment variables
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      family: 4,
      keyPrefix: 'airwave:' };
  }

  /**
   * Get Redis client instance
   */
  async getClient(): Promise<Redis> {
    if (!this.redis || !this.isConnected) {
      return await this.connect();
    }
    return this.redis;
  }

  /**
   * Check if Redis is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const client = await this.getClient();
      await client.ping();
      return true;
    } catch (error: any) {
      console.warn('Redis not available:', error);
      return false;
    }
  }

  /**
   * Gracefully disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
    }
  }

  /**
   * Cache operations
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const client = await this.getClient();
      const serializedValue = JSON.stringify(value);

      if (ttlSeconds) {
        await client.setex(key, ttlSeconds, serializedValue);
      } else {
        await client.set(key, serializedValue);
      }

      return true;
    } catch (error: any) {
      console.error('Redis SET error:', error);
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await this.getClient();
      const value = await client.get(key);

      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error: any) {
      console.error('Redis GET error:', error);
      return null;
    }
  }

  async del(...keys: string[]): Promise<boolean> {
    try {
      const client = await this.getClient();
      const result = await client.del(...keys);
      return result > 0;
    } catch (error: any) {
      console.error('Redis DEL error:', error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error: any) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  }

  /**
   * List operations
   */
  async lpush(key: string, ...values: any[]): Promise<number> {
    try {
      const client = await this.getClient();
      const serializedValues = values.map((v: any) => JSON.stringify(v));
      return await client.lpush(key, ...serializedValues);
    } catch (error: any) {
      console.error('Redis LPUSH error:', error);
      return 0;
    }
  }

  async rpop<T>(key: string): Promise<T | null> {
    try {
      const client = await this.getClient();
      const value = await client.rpop(key);

      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error: any) {
      console.error('Redis RPOP error:', error);
      return null;
    }
  }

  /**
   * Hash operations
   */
  async hset(key: string, field: string, value: any): Promise<boolean> {
    try {
      const client = await this.getClient();
      // For hash operations, store as string directly (not JSON) for simple values
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      const result = await client.hset(key, field, stringValue);
      return result >= 0;
    } catch (error: any) {
      console.error('Redis HSET error:', error);
      return false;
    }
  }

  async hget<T>(key: string, field: string): Promise<T | null> {
    try {
      const client = await this.getClient();
      const value = await client.hget(key, field);

      if (value === null) {
        return null;
      }

      // Try to parse as JSON, but return as string if it fails
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error: any) {
      console.error('Redis HGET error:', error);
      return null;
    }
  }

  /**
   * Increment operations
   */
  async incr(key: string): Promise<number> {
    try {
      const client = await this.getClient();
      return await client.incr(key);
    } catch (error: any) {
      console.error('Redis INCR error:', error);
      return 0;
    }
  }

  async incrby(key: string, increment: number): Promise<number> {
    try {
      const client = await this.getClient();
      return await client.incrby(key, increment);
    } catch (error: any) {
      console.error('Redis INCRBY error:', error);
      return 0;
    }
  }

  /**
   * Set TTL on existing key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const client = await this.getClient();
      const result = await client.expire(key, seconds);
      return result === 1;
    } catch (error: any) {
      console.error('Redis EXPIRE error:', error);
      return false;
    }
  }

  /**
   * Set operations
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      const client = await this.getClient();
      return await client.sadd(key, ...members);
    } catch (error: any) {
      console.error('Redis SADD error:', error);
      return 0;
    }
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    try {
      const client = await this.getClient();
      return await client.srem(key, ...members);
    } catch (error: any) {
      console.error('Redis SREM error:', error);
      return 0;
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      const client = await this.getClient();
      return await client.smembers(key);
    } catch (error: any) {
      console.error('Redis SMEMBERS error:', error);
      return [];
    }
  }

  async sismember(key: string, member: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      const result = await client.sismember(key, member);
      return result === 1;
    } catch (error: any) {
      console.error('Redis SISMEMBER error:', error);
      return false;
    }
  }

  /**
   * Sorted set operations
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    try {
      const client = await this.getClient();
      return await client.zadd(key, score, member);
    } catch (error: any) {
      console.error('Redis ZADD error:', error);
      return 0;
    }
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    try {
      const client = await this.getClient();
      return await client.zrem(key, ...members);
    } catch (error: any) {
      console.error('Redis ZREM error:', error);
      return 0;
    }
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      const client = await this.getClient();
      return await client.zrange(key, start, stop);
    } catch (error: any) {
      console.error('Redis ZRANGE error:', error);
      return [];
    }
  }

  async zrangebyscore(key: string, min: number, max: number): Promise<string[]> {
    try {
      const client = await this.getClient();
      return await client.zrangebyscore(key, min, max);
    } catch (error: any) {
      console.error('Redis ZRANGEBYSCORE error:', error);
      return [];
    }
  }

  async zcard(key: string): Promise<number> {
    try {
      const client = await this.getClient();
      return await client.zcard(key);
    } catch (error: any) {
      console.error('Redis ZCARD error:', error);
      return 0;
    }
  }

  /**
   * Utility operations
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      const client = await this.getClient();
      return await client.keys(pattern);
    } catch (error: any) {
      console.error('Redis KEYS error:', error);
      return [];
    }
  }

  async ping(): Promise<string> {
    try {
      const client = await this.getClient();
      return await client.ping();
    } catch (error: any) {
      console.error('Redis PING error:', error);
      throw error;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      const client = await this.getClient();
      return await client.ttl(key);
    } catch (error: any) {
      console.error('Redis TTL error:', error);
      return -1;
    }
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    try {
      const client = await this.getClient();
      return await client.hdel(key, ...fields);
    } catch (error: any) {
      console.error('Redis HDEL error:', error);
      return 0;
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      const client = await this.getClient();
      return await client.hgetall(key);
    } catch (error: any) {
      console.error('Redis HGETALL error:', error);
      return {};
    }
  }

  async decr(key: string): Promise<number> {
    try {
      const client = await this.getClient();
      return await client.decr(key);
    } catch (error: any) {
      console.error('Redis DECR error:', error);
      return 0;
    }
  }

  async flushall(): Promise<string> {
    try {
      const client = await this.getClient();
      return await client.flushall();
    } catch (error: any) {
      console.error('Redis FLUSHALL error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const redisManager = RedisManager.getInstance();

// Export Redis client getter for direct access when needed
export const getRedisClient = () => redisManager.getClient();

// Export the class for testing
export { RedisManager };

// Export types
export type { RedisConfig };
