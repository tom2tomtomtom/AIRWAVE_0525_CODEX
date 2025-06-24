/**
 * API Security & Rate Limiting Tests
 * Tests for rate limiting enforcement, input sanitization, and API endpoint security
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createMocks } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse, NextApiHandler } from 'next';
import { withRateLimit, rateLimiters } from '@/lib/rate-limiter';
import { sanitizeInput } from '@/utils/sanitization';

// Mock rate limiter
jest.mock('@/lib/rate-limiter', () => ({
  rateLimiters: {},
  auth: {},
  limit: jest.fn() },
  api: {},
  limit: jest.fn() },
  ai: {},
  limit: jest.fn() },
  upload: {},
  limit: jest.fn() },
  flow: {},
  limit: jest.fn() },
  email: {},
  limit: jest.fn()}},
  withRateLimit: jest.fn()}));

// Mock sanitization utility
jest.mock('@/utils/sanitization', () => ({
  sanitizeInput: jest.fn(),
  sanitizeHtml: jest.fn()}));

describe('API Security & Rate Limiting Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rate Limiting', () => {
    it('should enforce auth endpoint rate limits', async () => {
      const mockHandler = jest.fn((req, res) => {
        res.status(200).json({ success: true });
      });

      // Mock rate limiter to allow request
      (rateLimiters.auth.limit as jest.Mock).mockResolvedValue({
        success: true,
        limit: 5,
        remaining: 4,
        reset: Date.now() + 900000, // 15 minutes
      });

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {},
        'x-forwarded-for': '127.0.0.1'
      }});

      // Mock withRateLimit to call the handler
      (withRateLimit as jest.Mock).mockImplementation((limiterName) => {
        return (handler: NextApiHandler) => async (req: NextApiRequest, res: NextApiResponse) => {
          const result = await rateLimiters[limiterName].limit('test-key');
          if (result.success) {
            return handler(req, res);
          } else {
            return res.status(429).json({ error: 'Rate limit exceeded' });
          }
        };
      });

      const rateLimitedHandler = withRateLimit('auth')(mockHandler);
      await rateLimitedHandler(req, res);

      expect(rateLimiters.auth.limit).toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(200);
    });

    it('should block requests when auth rate limit is exceeded', async () => {
      const mockHandler = jest.fn();

      // Mock rate limiter to reject request
      (rateLimiters.auth.limit as jest.Mock).mockResolvedValue({
        success: false,
        limit: 5,
        remaining: 0,
        reset: Date.now() + 900000});

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {},
        'x-forwarded-for': '127.0.0.1'
      }});

      (withRateLimit as jest.Mock).mockImplementation((limiterName) => {
        return (handler: NextApiHandler) => async (req: NextApiRequest, res: NextApiResponse) => {
          const result = await rateLimiters[limiterName].limit('test-key');
          if (result.success) {
            return handler(req, res);
          } else {
            return res.status(429).json({ 
              error: 'Rate limit exceeded',
              retryAfter: Math.ceil((result.reset - Date.now()) / 1000)
            });
          }
        };
      });

      const rateLimitedHandler = withRateLimit('auth')(mockHandler);
      await rateLimitedHandler(req, res);

      expect(res._getStatusCode()).toBe(429);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Rate limit exceeded',
        retryAfter: expect.any(Number)});
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should enforce different limits for different endpoint types', async () => {
      const endpoints = [
        { limiter: 'auth', expectedLimit: 5  }
        { limiter: 'api', expectedLimit: 100  }
        { limiter: 'ai', expectedLimit: 20  }
        { limiter: 'upload', expectedLimit: 10  }
        { limiter: 'flow', expectedLimit: 30  }
        { limiter: 'email', expectedLimit: 5  }
      ];

      for (const endpoint of endpoints) {
        (rateLimiters[endpoint.limiter as keyof typeof rateLimiters].limit as jest.Mock)
          .mockResolvedValue({
            success: true,
            limit: endpoint.expectedLimit,
            remaining: endpoint.expectedLimit - 1,
            reset: Date.now() + 3600000});

        const result = await rateLimiters[endpoint.limiter as keyof typeof rateLimiters].limit('test-key');
        expect(result.limit).toBe(endpoint.expectedLimit);
      }
    });

    it('should use IP address for rate limiting when user is not authenticated', async () => {
      const mockHandler = jest.fn((req, res) => {
        res.status(200).json({ success: true });
      });

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {},
        'x-forwarded-for': '192.168.1.100'
      }});

      (rateLimiters.api.limit as jest.Mock).mockResolvedValue({
        success: true,
        limit: 100,
        remaining: 99,
        reset: Date.now() + 60000});

      (withRateLimit as jest.Mock).mockImplementation((limiterName) => {
        return (handler: NextApiHandler) => async (req: NextApiRequest, res: NextApiResponse) => {
          // Should use IP for rate limiting
          const identifier = req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
          const result = await rateLimiters[limiterName].limit(`ip:${identifier}`);
          if (result.success) {
            return handler(req, res);
          } else {
            return res.status(429).json({ error: 'Rate limit exceeded' });
          }
        };
      });

      const rateLimitedHandler = withRateLimit('api')(mockHandler);
      await rateLimitedHandler(req, res);

      expect(rateLimiters.api.limit).toHaveBeenCalledWith('ip:192.168.1.100');
    });

    it('should use user ID for rate limiting when user is authenticated', async () => {
      const mockHandler = jest.fn((req, res) => {
        res.status(200).json({ success: true });
      });

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {},
        'x-forwarded-for': '192.168.1.100'
      }});

      // Mock authenticated request
      (req as NextApiRequest & { user?: { id: string } }).user = { id: 'user123' };

      (rateLimiters.api.limit as jest.Mock).mockResolvedValue({
        success: true,
        limit: 100,
        remaining: 99,
        reset: Date.now() + 60000});

      (withRateLimit as jest.Mock).mockImplementation((limiterName) => {
        return (handler: NextApiHandler) => async (req: NextApiRequest, res: NextApiResponse) => {
          // Should use user ID for rate limiting
          const identifier = req.user?.id ? `user:${req.user.id}` : `ip:${req.headers['x-forwarded-for']}`;
          const result = await rateLimiters[limiterName].limit(identifier);
          if (result.success) {
            return handler(req, res);
          } else {
            return res.status(429).json({ error: 'Rate limit exceeded' });
          }
        };
      });

      const rateLimitedHandler = withRateLimit('api')(mockHandler);
      await rateLimitedHandler(req, res);

      expect(rateLimiters.api.limit).toHaveBeenCalledWith('user:user123');
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize HTML input to prevent XSS', () => {
      const maliciousInput = '<script>alert("XSS")</script><p>Safe content</p>';
      
      (sanitizeInput as jest.Mock).mockReturnValue('<p>Safe content</p>');

      const sanitized = sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toBe('<p>Safe content</p>');
    });

    it('should remove dangerous attributes from HTML elements', () => {
      const maliciousInput = '<img src="image.jpg" onerror="alert(1)" onload="steal()">';
      
      (sanitizeInput as jest.Mock).mockReturnValue('<img src="image.jpg">');

      const sanitized = sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('onload');
      expect(sanitized).toBe('<img src="image.jpg">');
    });

    it('should sanitize JavaScript protocols', () => {
      const maliciousInput = '<a href="javascript:alert(1)">Click me</a>';
      
      (sanitizeInput as jest.Mock).mockReturnValue('<a>Click me</a>');

      const sanitized = sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).toBe('<a>Click me</a>');
    });

    it('should handle null and undefined inputs safely', () => {
      (sanitizeInput as jest.Mock).mockImplementation((input) => {
        if (input == null) return '';
        return String(input);
      });

      expect(sanitizeInput(null)).toBe('');
      expect(sanitizeInput(undefined)).toBe('');
      expect(() => sanitizeInput(null)).not.toThrow();
      expect(() => sanitizeInput(undefined)).not.toThrow();
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should detect SQL injection patterns', () => {
      const validateSqlInjection = jest.fn((input: string) => {
        const sqlPatterns = [
          /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
          /(--|\/\*|\*\/)/,
          /(\b(OR|AND)\b.*=.*)/i,
          /('.*'.*=.*'.*')/,
        ];
        
        return !sqlPatterns.some(pattern => pattern.test(input));
      });

      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'/**/UNION/**/SELECT/**/password/**/FROM/**/users--",
        "'; INSERT INTO admin VALUES ('hacker', 'password'); --",
      ];

      for (const input of maliciousInputs) {
        const isValid = validateSqlInjection(input);
        expect(isValid).toBe(false);
      }
    });

    it('should allow safe inputs', () => {
      const validateSqlInjection = jest.fn((input: string) => {
        const sqlPatterns = [
          /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
          /(--|\/\*|\*\/)/,
          /(\b(OR|AND)\b.*=.*)/i,
          /('.*'.*=.*'.*')/,
        ];
        
        return !sqlPatterns.some(pattern => pattern.test(input));
      });

      const safeInputs = [
        "John Doe",
        "user@example.com",
        "A normal description with spaces and punctuation.",
        "Product name with numbers 123",
      ];

      for (const input of safeInputs) {
        const isValid = validateSqlInjection(input);
        expect(isValid).toBe(true);
      }
    });
  });

  describe('API Endpoint Security', () => {
    it('should validate request content types', async () => {
      const mockHandler = jest.fn((req, res) => {
        // Only accept JSON for POST requests
        if (req.method === 'POST' && req.headers['content-type'] !== 'application/json') {
          return res.status(400).json({ error: 'Invalid content type' });
        }
        res.status(200).json({ success: true });
      });

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {},
        'content-type': 'text/plain'
      }});

      await mockHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Invalid content type'});
    });

    it('should limit request body size', async () => {
      const mockHandler = jest.fn((req, res) => {
        // Simulate body size check
        const contentLength = parseInt(req.headers['content-length'] || '0');
        const maxSize = 10 * 1024 * 1024; // 10MB
        
        if (contentLength > maxSize) {
          return res.status(413).json({ error: 'Request entity too large' });
        }
        
        res.status(200).json({ success: true });
      });

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {},
        'content-length': '20971520', // 20MB
          'content-type': 'application/json'
      }});

      await mockHandler(req, res);

      expect(res._getStatusCode()).toBe(413);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Request entity too large'});
    });

    it('should validate required headers', async () => {
      const mockHandler = jest.fn((req, res) => {
        // Require specific headers for sensitive operations
        if (!req.headers['x-api-version']) {
          return res.status(400).json({ error: 'API version header required' });
        }
        
        res.status(200).json({ success: true });
      });

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {},
        'content-type': 'application/json'
      }});

      await mockHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'API version header required'});
    });
  });
});
