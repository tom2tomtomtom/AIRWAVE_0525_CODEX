import { loggers } from '@/lib/logger';

/**
 * Distributed Rate Limiting for AI Operations
 * Uses Redis for distributed rate limiting across multiple server instances
 */

// Conditional Redis import for server-side only
let redisManager: any = null;
if (typeof window === 'undefined') {
  try {
    redisManager = require('@/lib/redis/redis-config').redisManager;
  } catch (error: any) {
    // Redis not available, will fallback to in-memory
    console.warn('Redis not available, using in-memory rate limiting');
  }
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (userId: string, operation: string) => string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalRequests: number;
}

export class AIRateLimiter {
  private static instance: AIRateLimiter;
  private useRedis = false;
  private fallbackStore = new Map<string, { count: number; resetTime: number }>();

  // Default rate limits for different AI operations
  private defaultLimits: Record<string, RateLimitConfig> = {
    'generate-motivations': {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 5, // 5 requests per minute
    },
    'generate-copy': {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 requests per minute
    },
    'generate-image': {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 3, // 3 requests per minute (more expensive)
    },
    'parse-brief': {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 20, // 20 requests per minute
    },
    default: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 requests per minute
    },
  };

  static getInstance(): AIRateLimiter {
    if (!AIRateLimiter.instance) {
      AIRateLimiter.instance = new AIRateLimiter();
    }
    return AIRateLimiter.instance;
  }

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.useRedis = await redisManager.isAvailable();
      if (this.useRedis) {
        loggers.general.error('✅ AI Rate Limiter using Redis for distributed limiting');
      } else {
        loggers.general.error('⚠️ AI Rate Limiter using in-memory fallback (Redis unavailable)');
      }
    } catch (error: any) {
      console.warn('AI Rate Limiter Redis initialization failed:', error);
      this.useRedis = false;
    }
  }

  /**
   * Check if an AI operation is allowed for a user
   */
  async checkLimit(
    userId: string,
    operation: string,
    customConfig?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    const config = {
      ...(this.defaultLimits[operation] || this.defaultLimits.default),
      ...customConfig,
    };

    const key = this.generateKey(userId, operation);

    if (this.useRedis) {
      return await this.checkRedisLimit(key, config);
    } else {
      return this.checkMemoryLimit(key, config);
    }
  }

  /**
   * Redis-based distributed rate limiting
   */
  private async checkRedisLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    try {
      const client = await redisManager.getClient();
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Use Redis sorted set for sliding window rate limiting
      const pipeline = client.pipeline();

      // Remove expired entries
      pipeline.zremrangebyscore(key, 0, windowStart);

      // Count current requests in window
      pipeline.zcard(key);

      // Add current request
      pipeline.zadd(key, now, `${now}-${Math.random()}`);

      // Set expiration
      pipeline.expire(key, Math.ceil(config.windowMs / 1000));

      const results = await pipeline.exec();

      if (!results) {
        throw new Error('Redis pipeline execution failed');
      }

      const currentCount = (results[1][1] as number) || 0;
      const allowed = currentCount < config.maxRequests;

      // If not allowed, remove the request we just added
      if (!allowed) {
        await client.zpopmax(key);
      }

      return {
        allowed,
        remaining: Math.max(0, config.maxRequests - currentCount - (allowed ? 1 : 0)),
        resetTime: now + config.windowMs,
        totalRequests: currentCount + (allowed ? 1 : 0) };
    } catch (error: any) {
      console.error('Redis rate limiting error:', error);
      // Fallback to memory-based limiting
      return this.checkMemoryLimit(key, config);
    }
  }

  /**
   * In-memory fallback rate limiting
   */
  private checkMemoryLimit(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const existing = this.fallbackStore.get(key);

    // Clean up expired entries periodically
    if (Math.random() < 0.1) {
      // 10% chance to clean up
      this.cleanupExpiredEntries();
    }

    if (!existing || now > existing.resetTime) {
      // New window
      this.fallbackStore.set(key, {
        count: 1,
        resetTime: now + config.windowMs });

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs,
        totalRequests: 1 };
    }

    // Existing window
    const allowed = existing.count < config.maxRequests;

    if (allowed) {
      existing.count++;
    }

    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - existing.count),
      resetTime: existing.resetTime,
      totalRequests: existing.count };
  }

  /**
   * Generate rate limiting key
   */
  private generateKey(userId: string, operation: string): string {
    return `rate_limit:ai:${operation}:${userId}`;
  }

  /**
   * Clean up expired entries from memory store
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    for (const [key, value] of this.fallbackStore.entries()) {
      if (now > value.resetTime) {
        this.fallbackStore.delete(key);
      }
    }
  }

  /**
   * Get current rate limit status for a user and operation
   */
  async getStatus(
    userId: string,
    operation: string
  ): Promise<{
    remaining: number;
    resetTime: number;
    totalRequests: number;
  }> {
    const config = this.defaultLimits[operation] || this.defaultLimits.default;
    const key = this.generateKey(userId, operation);

    if (this.useRedis) {
      try {
        const client = await redisManager.getClient();
        const now = Date.now();
        const windowStart = now - config.windowMs;

        // Clean up expired entries and count current
        await client.zremrangebyscore(key, 0, windowStart);
        const currentCount = await client.zcard(key);

        return {
          remaining: Math.max(0, config.maxRequests - currentCount),
          resetTime: now + config.windowMs,
          totalRequests: currentCount };
      } catch (error: any) {
        console.error('Error getting rate limit status from Redis:', error);
      }
    }

    // Fallback to memory
    const existing = this.fallbackStore.get(key);
    const now = Date.now();

    if (!existing || now > existing.resetTime) {
      return {
        remaining: config.maxRequests,
        resetTime: now + config.windowMs,
        totalRequests: 0 };
    }

    return {
      remaining: Math.max(0, config.maxRequests - existing.count),
      resetTime: existing.resetTime,
      totalRequests: existing.count };
  }

  /**
   * Reset rate limit for a user and operation (admin function)
   */
  async resetLimit(userId: string, operation: string): Promise<boolean> {
    const key = this.generateKey(userId, operation);

    if (this.useRedis) {
      try {
        const client = await redisManager.getClient();
        await client.del(key);
        return true;
      } catch (error: any) {
        console.error('Error resetting rate limit in Redis:', error);
      }
    }

    // Fallback to memory
    this.fallbackStore.delete(key);
    return true;
  }

  /**
   * Update rate limit configuration for an operation
   */
  updateConfig(operation: string, config: Partial<RateLimitConfig>): void {
    this.defaultLimits[operation] = {
      ...(this.defaultLimits[operation] || this.defaultLimits.default),
      ...config,
    };
  }

  /**
   * Get all configured rate limits
   */
  getConfigs(): Record<string, RateLimitConfig> {
    return { ...this.defaultLimits };
  }
}

// Export singleton instance
export const aiRateLimiter = AIRateLimiter.getInstance();

// Export types
export type { RateLimitConfig, RateLimitResult };
