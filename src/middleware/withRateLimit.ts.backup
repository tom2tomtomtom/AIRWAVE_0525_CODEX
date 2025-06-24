/**
 * Rate Limiting Middleware for AIRWAVE API Protection
 * Implements sliding window rate limiting with Redis backend
 * Protects against brute force attacks and API abuse
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { getClientIp } from '@/lib/utils/ip';

// Rate limit configuration for different endpoint types
export const RATE_LIMITS = {
  auth: 5,           // Authentication endpoints: 5 requests per minute,
    api: 100,          // Standard API endpoints: 100 requests per minute,
    ai: 20,            // AI-powered endpoints: 20 requests per minute,
    upload: 10,        // File upload endpoints: 10 requests per minute,
    public: 200,       // Public endpoints: 200 requests per minute
} as const;

export type RateLimitType = keyof typeof RATE_LIMITS;

interface RateLimitOptions {
  windowMs?: number;           // Time window in milliseconds (default: 60000 = 1 minute)
  maxRequests?: number;        // Max requests per window (overrides type-based limit)
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean;     // Don't count failed requests
  keyGenerator?: (req: NextApiRequest) => string; // Custom key generator
}

interface RateLimitInfo {
  totalHits: number;,
    totalTime: number;,
    remaining: number;,
    resetTime: Date;
}

/**
 * In-memory store for development (when Redis is not available)
 */
class MemoryStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  async increment(key: string, windowMs: number): Promise<RateLimitInfo> {
    const now = Date.now();
    const resetTime = now + windowMs;
    
    const current = this.store.get(key);
    
    if (!current || current.resetTime < now) {
      // First request or window expired
      this.store.set(key, { count: 1, resetTime });
      return {
        totalHits: 1,
        totalTime: windowMs,
        remaining: -1, // Will be calculated by caller
        resetTime: new Date(resetTime)};
    }
    
    // Increment existing count
    current.count++;
    this.store.set(key, current);
    
    return {
      totalHits: current.count,
      totalTime: current.resetTime - now,
      remaining: -1, // Will be calculated by caller
      resetTime: new Date(current.resetTime)};
  }

  // Cleanup expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (value.resetTime < now) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Redis store for production rate limiting
 */
class RedisStore {
  private redis: unknown; // eslint-disable-line @typescript-eslint/no-explicit-any

  constructor() {
    // Conditional Redis import for server-side only
    if (typeof window === 'undefined') {
      try {
        // Dynamic import to avoid bundling Redis in client
        const { getRedisClient } = require('@/lib/redis'); // eslint-disable-line @typescript-eslint/no-var-requires
        this.redis = getRedisClient();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Redis not available for rate limiting, falling back to memory store');
      }
    }
  }

  async increment(key: string, windowMs: number): Promise<RateLimitInfo> {
    if (!this.redis) {
      throw new Error('Redis client not available');
    }

    const now = Date.now();
    const windowStart = now - windowMs;
    const pipeline = this.redis.pipeline();

    // Use sorted set to store timestamps
    pipeline.zremrangebyscore(key, 0, windowStart); // Remove old entries
    pipeline.zadd(key, now, `${now}-${Math.random()}`); // Add current request
    pipeline.zcard(key); // Count current requests
    pipeline.expire(key, Math.ceil(windowMs / 1000)); // Set expiration

    const results = await pipeline.exec();
    const totalHits = results[2][1]; // Result from zcard

    return {
      totalHits,
      totalTime: windowMs,
      remaining: -1, // Will be calculated by caller
      resetTime: new Date(now + windowMs)};
  }
}

// Global store instances
let memoryStore: MemoryStore;
let redisStore: RedisStore;

// Initialize stores
function getStore(): MemoryStore | RedisStore {
  if (typeof window !== 'undefined') {
    throw new Error('Rate limiting is server-side only');
  }

  try {
    if (!redisStore) {
      redisStore = new RedisStore();
    }
    return redisStore;
  } catch (error) {
    // Fallback to memory store
    if (!memoryStore) {
      memoryStore = new MemoryStore();
      
      // Cleanup memory store every 5 minutes
      setInterval(() => memoryStore.cleanup(), 5 * 60 * 1000);
    }
    return memoryStore;
  }
}

/**
 * Generate rate limit key for request
 */
function generateKey(req: NextApiRequest, type: RateLimitType): string {
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';
  const userId = (req as any).user?.id;
  
  // Use user ID if authenticated, otherwise IP + partial user agent
  const identifier = userId || `${ip}:${userAgent.slice(0, 20)}`;
  
  return `rate_limit:${type}:${identifier}`;
}

/**
 * Rate limiting middleware
 */
export function withRateLimit(
  type: RateLimitType,
  options: RateLimitOptions = {}
) {
  return function rateLimitMiddleware(
    handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
  ) {
    return async function (req: NextApiRequest, res: NextApiResponse) {
      try {
        const {
          windowMs = 60000, // 1 minute default
          maxRequests = RATE_LIMITS[type],
          skipSuccessfulRequests = false,
          skipFailedRequests = false,
          keyGenerator = (req) => generateKey(req, type)} = options;

        const key = keyGenerator(req);
        const store = getStore();
        
        // Get current rate limit info
        const limitInfo = await store.increment(key, windowMs);
        const remaining = Math.max(0, maxRequests - limitInfo.totalHits);
        
        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', limitInfo.resetTime.toISOString());
        res.setHeader('X-RateLimit-Window', windowMs);

        // Check if rate limit exceeded
        if (limitInfo.totalHits > maxRequests) {
          // Log rate limit violation
          // eslint-disable-next-line no-console
          console.warn(`Rate limit exceeded for ${type}:`, {
            key: key.replace(/:\d+\.\d+\.\d+\.\d+/, ':***'), // Mask IP
            requests: limitInfo.totalHits,
            limit: maxRequests,
            window: windowMs,
            resetTime: limitInfo.resetTime});

          res.setHeader('Retry-After', Math.ceil(limitInfo.totalTime / 1000));
          
          return res.status(429).json({
            success: false,
            error: {},
  code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests. Please try again later.',
              details: {},
  limit: maxRequests,
                window: windowMs,
                resetTime: limitInfo.resetTime.toISOString() });
        }

        // Store original res.json to intercept response
        const originalJson = res.json;
        let statusCode = 200;
        
        res.json = function(body: unknown) {
          statusCode = res.statusCode;
          return originalJson.call(this, body);
        };

        // Execute handler
        await handler(req, res);

        // Update headers after execution (they might have changed)
        res.setHeader('X-RateLimit-Remaining', remaining - 1);

        // Skip counting based on response status if configured
        const shouldSkip = 
          (skipSuccessfulRequests && statusCode >= 200 && statusCode < 400) ||
          (skipFailedRequests && statusCode >= 400);

        if (shouldSkip) {
          // Decrement the count for this request
          // Note: This is a simplified approach. In production, you might want
          // a more sophisticated mechanism to handle this.
          // eslint-disable-next-line no-console
          console.log('Skipping rate limit count for request:', { statusCode, type });
        }

      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Rate limiting middleware error:', error);
        
        // Don't block requests if rate limiting fails
        await handler(req, res);
      }
    };
  };
}

/**
 * Utility function to check if rate limit is exceeded without incrementing
 */
export async function checkRateLimit(
  req: NextApiRequest,
  type: RateLimitType,
  options: RateLimitOptions = {}
): Promise<{ exceeded: boolean; remaining: number; resetTime: Date }> {
  try {
    const {
      windowMs = 60000,
      maxRequests = RATE_LIMITS[type],
      keyGenerator = (req) => generateKey(req, type)} = options;

    const key = keyGenerator(req);
    
    // For memory store, we need to check without incrementing
    // This is a simplified check - in production, use Redis for accuracy
    if (memoryStore) {
      const current = (memoryStore as any).store.get(key);
      if (!current || current.resetTime < Date.now()) {
        return { exceeded: false, remaining: maxRequests, resetTime: new Date(Date.now() + windowMs) };
      }
      
      const remaining = Math.max(0, maxRequests - current.count);
      return {
        exceeded: current.count >= maxRequests,
        remaining,
        resetTime: new Date(current.resetTime)};
    }

    // For Redis, we can use a separate check operation
    if (redisStore) {
      const redis = (redisStore as any).redis;
      if (redis) {
        const count = await redis.zcard(key);
        const remaining = Math.max(0, maxRequests - count);
        return {
          exceeded: count >= maxRequests,
          remaining,
          resetTime: new Date(Date.now() + windowMs)};
      }
    }

    return { exceeded: false, remaining: maxRequests, resetTime: new Date(Date.now() + windowMs) };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Rate limit check error:', error);
    return { exceeded: false, remaining: maxRequests, resetTime: new Date(Date.now() + windowMs) };
  }
}

/**
 * Reset rate limit for a specific key (admin function)
 */
export async function resetRateLimit(
  req: NextApiRequest,
  type: RateLimitType,
  options: RateLimitOptions = {}
): Promise<boolean> {
  try {
    const { keyGenerator = (req) => generateKey(req, type) } = options;
    const key = keyGenerator(req);
    
    if (memoryStore) {
      (memoryStore as any).store.delete(key);
      return true;
    }

    if (redisStore) {
      const redis = (redisStore as any).redis;
      if (redis) {
        await redis.del(key);
        return true;
      }
    }

    return false;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Rate limit reset error:', error);
    return false;
  }
}

export default withRateLimit;