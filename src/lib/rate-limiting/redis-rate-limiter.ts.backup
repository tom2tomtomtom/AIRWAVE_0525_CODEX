import { createClient, RedisClientType } from 'redis';
import { getRedisConfig } from '@/lib/config';
import { loggers } from '@/lib/logger';

interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

interface RateLimitOptions {
  max: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export class RedisRateLimiter {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private fallbackStore = new Map<string, { count: number; resetTime: number }>();
  
  constructor() {
    this.initializeRedis();
  }
  
  private async initializeRedis() : Promise<void> {
    try {
      const config = getRedisConfig();
      
      this.client = createClient({
        url: config.url,
        password: config.password,
        database: config.db,
        socket: {},
  reconnectStrategy: (retries) => Math.min(retries * 50, 500)
        }
      }) as RedisClientType;
      
      this.client.on('error', (error) => {
        loggers.general.error('Redis connection error', error);
        this.isConnected = false;
      });
      
      this.client.on('connect', () => {
        loggers.general.info('Redis connected for rate limiting');
        this.isConnected = true;
      });
      
      this.client.on('disconnect', () => {
        loggers.general.warn('Redis disconnected, falling back to in-memory store');
        this.isConnected = false;
      });
      
      await this.client.connect();
      
    } catch (error: any) {
      loggers.general.error('Failed to initialize Redis for rate limiting', error);
      this.isConnected = false;
    }
  }
  
  private async redisRateLimit(
    key: string,
    options: RateLimitOptions
  ): Promise<RateLimitResult> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not available');
    }
    
    const now = Date.now();
    const window = Math.floor(now / options.windowMs);
    const redisKey = `rate_limit:${key}:${window}`;
    
    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.client.multi();
      
      // Increment the counter
      pipeline.incr(redisKey);
      // Set expiration if this is a new key
      pipeline.expire(redisKey, Math.ceil(options.windowMs / 1000));
      
      const results = await pipeline.exec();
      const count = results?.[0] as number || 0;
      
      const resetTime = (window + 1) * options.windowMs;
      const remaining = Math.max(0, options.max - count);
      const allowed = count <= options.max;
      
      return {
        allowed,
        count,
        remaining,
        resetTime,
        totalHits: count
      };
      
    } catch (error: any) {
      loggers.general.error('Redis rate limit operation failed', error);
      throw error;
    }
  }
  
  private fallbackRateLimit(
    key: string,
    options: RateLimitOptions
  ): RateLimitResult {
    const now = Date.now();
    const existing = this.fallbackStore.get(key);
    
    if (!existing || now > existing.resetTime) {
      // New window
      const resetTime = now + options.windowMs;
      this.fallbackStore.set(key, { count: 1, resetTime });
      
      return {
        allowed: true,
        count: 1,
        remaining: options.max - 1,
        resetTime,
        totalHits: 1
      };
    }
    
    // Increment existing count
    existing.count++;
    this.fallbackStore.set(key, existing);
    
    const remaining = Math.max(0, options.max - existing.count);
    const allowed = existing.count <= options.max;
    
    return {
      allowed,
      count: existing.count,
      remaining,
      resetTime: existing.resetTime,
      totalHits: existing.count
    };
  }
  
  async checkLimit(
    identifier: string,
    options: RateLimitOptions
  ): Promise<RateLimitResult> {
    try {
      // Try Redis first, fallback to in-memory
      if (this.isConnected) {
        return await this.redisRateLimit(identifier, options);
      } else {
        return this.fallbackRateLimit(identifier, options);
      }
    } catch (error: any) {
      loggers.general.warn('Rate limit check failed, using fallback', error);
      return this.fallbackRateLimit(identifier, options);
    }
  }
  
  // Clean up expired entries from fallback store
  private cleanupFallbackStore() {
    const now = Date.now();
    for (const [key, value] of this.fallbackStore.entries()) {
      if (now > value.resetTime) {
        this.fallbackStore.delete(key);
      }
    }
  }
  
  async disconnect() : Promise<void> {
    if (this.client) {
      await this.client.disconnect();
    }
  }
  
  // Get rate limit info without incrementing
  async getLimitInfo(
    identifier: string,
    options: RateLimitOptions
  ): Promise<Omit<RateLimitResult, 'allowed'>> {
    if (this.isConnected && this.client) {
      try {
        const now = Date.now();
        const window = Math.floor(now / options.windowMs);
        const redisKey = `rate_limit:${identifier}:${window}`;
        
        const count = await this.client.get(redisKey);
        const currentCount = count ? parseInt(count, 10) : 0;
        const resetTime = (window + 1) * options.windowMs;
        const remaining = Math.max(0, options.max - currentCount);
        
        return {
          count: currentCount,
          remaining,
          resetTime,
          totalHits: currentCount
        };
      } catch (error: any) {
        loggers.general.error('Failed to get rate limit info from Redis', error);
      }
    }
    
    // Fallback to in-memory store
    const existing = this.fallbackStore.get(identifier);
    if (existing) {
      const remaining = Math.max(0, options.max - existing.count);
      return {
        count: existing.count,
        remaining,
        resetTime: existing.resetTime,
        totalHits: existing.count
      };
    }
    
    return {
      count: 0,
      remaining: options.max,
      resetTime: Date.now() + options.windowMs,
      totalHits: 0
    };
  }
  
  // Reset rate limit for an identifier
  async resetLimit(identifier: string): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        const now = Date.now();
        const window = Math.floor(now / 60000); // Assume 1-minute windows for cleanup
        const pattern = `rate_limit:${identifier}:*`;
        
        // Get all keys matching the pattern
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      } catch (error: any) {
        loggers.general.error('Failed to reset rate limit in Redis', error);
      }
    }
    
    // Also remove from fallback store
    this.fallbackStore.delete(identifier);
  }
}

// Singleton instance
let rateLimiterInstance: RedisRateLimiter | null = null;

export const getRateLimiter = (): RedisRateLimiter => {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RedisRateLimiter();
  }
  return rateLimiterInstance;
};

// Rate limiting middleware factory
export const createRateLimitMiddleware = (options: RateLimitOptions) => {
  const limiter = getRateLimiter();
  
  return async (
    identifier: string,
    onSuccess?: () => void,
    onFailure?: () => void
  ): Promise<RateLimitResult> => {
    const result = await limiter.checkLimit(identifier, options);
    
    if (result.allowed) {
      onSuccess?.();
    } else {
      onFailure?.();
    }
    
    return result;
  };
};

// Predefined rate limiters for different use cases
export const createAPIRateLimiter = () => createRateLimitMiddleware({
  max: 1000,
  windowMs: 60 * 60 * 1000, // 1 hour
});

export const createAuthRateLimiter = () => createRateLimitMiddleware({
  max: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

export const createUploadRateLimiter = () => createRateLimitMiddleware({
  max: 10,
  windowMs: 60 * 1000, // 1 minute
});

export const createAIRateLimiter = () => createRateLimitMiddleware({
  max: 50,
  windowMs: 60 * 60 * 1000, // 1 hour
});

// Clean up function for graceful shutdown
export const cleanupRateLimiter = async () => {
  if (rateLimiterInstance) {
    await rateLimiterInstance.disconnect();
    rateLimiterInstance = null;
  }
};