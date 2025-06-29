/**
 * Rate Limiting Utilities
 * Provides rate limiting for API endpoints to prevent abuse
 */

import { NextApiRequest, NextApiResponse } from 'next';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore: RateLimitStore = {};

/**
 * Clean up expired entries from the rate limit store
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  Object.keys(rateLimitStore).forEach((key: string) => {
    const entry = rateLimitStore[key];
    if (entry && entry.resetTime < now) {
      delete rateLimitStore[key];
    }
  });
}

/**
 * Get client identifier for rate limiting
 */
function getClientId(req: NextApiRequest): string {
  // Try to get user ID from session/auth
  const userId = (req as any).user?.id;
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address
  const forwarded = req.headers['x-forwarded-for'] as string;
  const ip = forwarded ? forwarded.split(',')[0] : req.connection.remoteAddress;
  return `ip:${ip}`;
}

/**
 * Create rate limiter middleware
 */
export function createRateLimit(config: RateLimitConfig) {
  return async (req: NextApiRequest, res: NextApiResponse, next?: () => void) => {
    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
      // 1% chance
      cleanupExpiredEntries();
    }

    const clientId = getClientId(req);
    const key = `${req.url}:${clientId}`;
    const now = Date.now();

    // Get or create rate limit entry
    let entry = rateLimitStore[key];
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + config.windowMs,
      };
      rateLimitStore[key] = entry;
    }

    // Check if rate limit exceeded
    if (entry.count >= config.maxRequests) {
      const resetIn = Math.ceil((entry.resetTime - now) / 1000);

      res.status(429).json({
        error: config.message || 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: resetIn,
      });
      return;
    }

    // Increment counter
    entry.count++;

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    // Continue to next middleware or handler
    if (next) {
      next();
    }
  };
}

/**
 * Predefined rate limiters for common use cases
 */
export const rateLimiters = {
  // Strict rate limiting for authentication endpoints
  auth: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later',
  }),

  // Moderate rate limiting for API endpoints
  api: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    message: 'Too many API requests, please slow down',
  }),

  // Strict rate limiting for AI generation endpoints
  aiGeneration: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 generations per minute
    message: 'Too many AI generation requests, please wait before trying again',
  }),

  // Lenient rate limiting for general endpoints
  general: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    message: 'Too many requests, please slow down',
  }),

  // Very strict rate limiting for expensive operations
  expensive: createRateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 3, // 3 requests per 5 minutes
    message: 'This operation is rate limited, please try again later',
  }),
};

/**
 * Middleware wrapper for rate limiting
 */
export function withRateLimit(
  rateLimit: ReturnType<typeof createRateLimit>,
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    return new Promise<void>((resolve, reject) => {
      let nextCalled = false;
      rateLimit(req, res, () => {
        nextCalled = true;
        handler(req, res).then(resolve).catch(reject);
      });

      // If next wasn't called, the rate limit was hit
      if (!nextCalled) {
        resolve();
      }
    });
  };
}

/**
 * Check if request is rate limited without incrementing counter
 */
export function checkRateLimit(
  req: NextApiRequest,
  config: RateLimitConfig
): {
  limited: boolean;
  remaining: number;
  resetTime: number;
} {
  const clientId = getClientId(req);
  const key = `${req.url}:${clientId}`;
  const now = Date.now();

  const entry = rateLimitStore[key];
  if (!entry || entry.resetTime < now) {
    return {
      limited: false,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
    };
  }

  return {
    limited: entry.count >= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetTime: entry.resetTime,
  };
}

/**
 * Reset rate limit for a specific client and endpoint
 */
export function resetRateLimit(req: NextApiRequest): void {
  const clientId = getClientId(req);
  const key = `${req.url}:${clientId}`;
  delete rateLimitStore[key];
}

/**
 * Get rate limit status for monitoring
 */
export function getRateLimitStats(): {
  totalEntries: number;
  activeEntries: number;
  topEndpoints: Array<{ endpoint: string; requests: number }>;
} {
  const now = Date.now();
  const activeEntries = Object.entries(rateLimitStore).filter(([, entry]) => entry.resetTime > now);

  const endpointCounts: { [endpoint: string]: number } = {};
  activeEntries.forEach(([key, entry]) => {
    const endpoint = key.split(':')[0];
    if (endpoint) {
      endpointCounts[endpoint] = (endpointCounts[endpoint] || 0) + entry.count;
    }
  });

  const topEndpoints = Object.entries(endpointCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([endpoint, requests]) => ({ endpoint, requests }));

  return {
    totalEntries: Object.keys(rateLimitStore).length,
    activeEntries: activeEntries.length,
    topEndpoints,
  };
}

/**
 * Clear all rate limit entries (for testing)
 */
export function clearRateLimitStore(): void {
  Object.keys(rateLimitStore).forEach((key: string) => delete rateLimitStore[key]);
}
