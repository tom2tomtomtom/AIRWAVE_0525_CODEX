import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextApiRequest, NextApiResponse } from 'next';
import { env } from './env';
import { loggers } from '@/lib/logger';


// Initialize Redis client for production or fallback to memory
const redis =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN })
    : undefined;

// Log Redis status
if (process.env.NODE_ENV === 'development') {
  loggers.general.error('Rate limiter Redis status:', redis ? 'Connected' : 'Using memory fallback');
}

// Rate limiter configurations using Upstash
export const rateLimiters = {
  // Authentication endpoints - very strict
  auth: new Ratelimit({
    redis: redis || (new Map() as any), // Fallback to memory
    limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 attempts per 15 minutes
    analytics: true,
    prefix: 'auth' }),

  // General API endpoints - moderate
  api: new Ratelimit({
    redis: redis || (new Map() as any),
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
    analytics: true,
    prefix: 'api' }),

  // AI generation endpoints - expensive operations
  ai: new Ratelimit({
    redis: redis || (new Map() as any),
    limiter: Ratelimit.slidingWindow(20, '1 h'), // 20 AI requests per hour
    analytics: true,
    prefix: 'ai' }),

  // File upload endpoints - resource intensive
  upload: new Ratelimit({
    redis: redis || (new Map() as any),
    limiter: Ratelimit.slidingWindow(10, '5 m'), // 10 uploads per 5 minutes
    analytics: true,
    prefix: 'upload' }),

  // Flow workflow endpoints - critical business logic
  flow: new Ratelimit({
    redis: redis || (new Map() as any),
    limiter: Ratelimit.slidingWindow(30, '5 m'), // 30 flow operations per 5 minutes
    analytics: true,
    prefix: 'flow' }),

  // Email sending - prevent spam
  email: new Ratelimit({
    redis: redis || (new Map() as any),
    limiter: Ratelimit.slidingWindow(5, '1 h'), // 5 emails per hour
    analytics: true,
    prefix: 'email' }),
};

// Get identifier for rate limiting (user ID or IP)
function getIdentifier(req: NextApiRequest): string {
  // Try to get user ID from authenticated request
  const userId = (req as any).user?.id || (req as any).userId;
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (typeof forwarded === 'string' ? forwarded : forwarded[0])?.split(',')[0]
    : req.socket?.remoteAddress;

  return `ip:${ip || 'unknown'}`;
}

// Rate limit middleware for API routes
export function withRateLimit(
  limiterName: keyof typeof rateLimiters,
  options?: {
    skipForAdmin?: boolean;
    customIdentifier?: (req: NextApiRequest) => string;
  }
) {
  return function rateLimitMiddleware(
    handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
  ) {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      try {
        // Skip rate limiting for admin users if configured
        if (options?.skipForAdmin && (req as any).user?.role === 'admin') {
          return handler(req, res);
        }

        const identifier = options?.customIdentifier
          ? options.customIdentifier(req)
          : getIdentifier(req);

        const limiter = rateLimiters[limiterName];
        const result = await limiter.limit(identifier);

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', result.limit);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', new Date(result.reset).toISOString());

        if (!result.success) {
          res.setHeader('Retry-After', Math.ceil((result.reset - Date.now()) / 1000));

          return res.status(429).json({
            success: false,
            error: 'Too many requests',
            message: 'Please try again later',
            retryAfter: Math.ceil((result.reset - Date.now()) / 1000) });
        }

        return handler(req, res);
      } catch (error: any) {
        // If rate limiting fails, allow the request but log the error
        if (process.env.NODE_ENV === 'development') {
          console.error('Rate limiting error:', error);
        }
        return handler(req, res);
      }
    };
  };
}

// Helper function for manual rate limit checking
export const checkRateLimit = async (
  limiterName: keyof typeof rateLimiters,
  identifier: string
): Promise<{ allowed: boolean; remaining?: number; resetAt?: Date }> => {
  try {
    const limiter = rateLimiters[limiterName];
    const result = await limiter.limit(identifier, { rate: 0 }); // Check without consuming

    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: new Date(result.reset) };
  } catch (error: any) {
    // Fail open in case of errors
    if (process.env.NODE_ENV === 'development') {
      console.error('Rate limit check error:', error);
    }
    return { allowed: true };
  }
};

// Convenience exports for common rate limiting patterns
export const withAuthRateLimit = withRateLimit('auth');
export const withAPIRateLimit = withRateLimit('api');
export const withAIRateLimit = withRateLimit('ai');
export const withUploadRateLimit = withRateLimit('upload');
export const withFlowRateLimit = withRateLimit('flow');

export default rateLimiters;
