import { NextApiRequest, NextApiResponse } from 'next';
import { withSecurityHeaders } from './withSecurityHeaders';
import { withInputValidation, ValidationConfig } from './withInputValidation';
import { withRateLimit } from './withRateLimit';
import { SecurityEvents } from '@/lib/security/security-logger';
import { loggers } from '@/lib/logger';

/**
 * Enhanced API Security Middleware
 * Combines multiple security layers for comprehensive protection
 */

export interface EnhancedSecurityConfig {
  // Rate limiting configuration
  rateLimit?: {
    windowMs?: number;
    max?: number;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
  };
  
  // Input validation configuration
  validation?: ValidationConfig;
  
  // Security headers configuration
  headers?: {
    enableCSP?: boolean;
    enableHSTS?: boolean;
    cspReportUri?: string;
    customHeaders?: Record<string, string>;
  };
  
  // Request analysis configuration
  analysis?: {
    checkUserAgent?: boolean;
    checkOrigin?: boolean;
    allowedOrigins?: string[];
    checkReferer?: boolean;
    detectBots?: boolean;
    logSuspiciousActivity?: boolean;
  };
  
  // CORS configuration
  cors?: {
    origin?: string | string[] | boolean;
    methods?: string[];
    allowedHeaders?: string[];
    credentials?: boolean;
  };
}

/**
 * Apply enhanced security middleware with configurable options
 */
export function withEnhancedSecurity(
  config: EnhancedSecurityConfig = {},
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // 1. Apply CORS if configured
      if (config.cors) {
        applyCORS(req, res, config.cors);
      }

      // 2. Analyze request for suspicious patterns
      if (config.analysis) {
        const suspiciousActivity = analyzeRequest(req, config.analysis);
        if (suspiciousActivity.detected) {
          SecurityEvents.authFailure(req, 'unknown', `Suspicious activity: ${suspiciousActivity.reasons.join(', ')}`);
          
          if (suspiciousActivity.block) {
            return res.status(403).json({
              success: false,
              message: 'Request blocked due to security policy'
            });
          }
        }
      }

      // 3. Apply security headers
      if (config.headers !== false) {
        await applySecurityHeaders(req, res, config.headers || {});
      }

      // 4. Apply rate limiting
      if (config.rateLimit) {
        const rateLimitHandler = withRateLimit(config.rateLimit, handler);
        await rateLimitHandler(req, res);
        return;
      }

      // 5. Apply input validation
      if (config.validation) {
        const validationHandler = withInputValidation(config.validation, handler);
        await validationHandler(req, res);
        return;
      }

      // 6. Execute the main handler
      await handler(req, res);

    } catch (error) {
      loggers.general.error('Enhanced security middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: req.url,
        method: req.method
      });

      SecurityEvents.authFailure(req, 'unknown', `Security middleware error: ${error instanceof Error ? error.message : 'Unknown'}`);

      return res.status(500).json({
        success: false,
        message: 'Internal security error'
      });
    }
  };
}

/**
 * Apply CORS headers
 */
function applyCORS(
  req: NextApiRequest, 
  res: NextApiResponse, 
  corsConfig: NonNullable<EnhancedSecurityConfig['cors']>
) {
  const origin = req.headers.origin;
  
  // Handle origin
  if (corsConfig.origin === true) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else if (corsConfig.origin === false) {
    // No CORS
  } else if (typeof corsConfig.origin === 'string') {
    res.setHeader('Access-Control-Allow-Origin', corsConfig.origin);
  } else if (Array.isArray(corsConfig.origin) && origin) {
    if (corsConfig.origin.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }

  // Handle methods
  if (corsConfig.methods) {
    res.setHeader('Access-Control-Allow-Methods', corsConfig.methods.join(', '));
  }

  // Handle headers
  if (corsConfig.allowedHeaders) {
    res.setHeader('Access-Control-Allow-Headers', corsConfig.allowedHeaders.join(', '));
  }

  // Handle credentials
  if (corsConfig.credentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
}

/**
 * Analyze request for suspicious patterns
 */
function analyzeRequest(
  req: NextApiRequest,
  analysisConfig: NonNullable<EnhancedSecurityConfig['analysis']>
): { detected: boolean; block: boolean; reasons: string[] } {
  const suspiciousReasons: string[] = [];
  let shouldBlock = false;

  // Check User-Agent
  if (analysisConfig.checkUserAgent) {
    const userAgent = req.headers['user-agent'] || '';
    
    // Common attack tools and scanners
    const suspiciousUserAgents = [
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /burp/i,
      /zap/i,
      /gobuster/i,
      /dirb/i,
      /masscan/i,
      /nessus/i,
      /openvas/i
    ];

    if (suspiciousUserAgents.some(pattern => pattern.test(userAgent))) {
      suspiciousReasons.push('Suspicious user agent detected');
      shouldBlock = true;
    }

    // Very short or missing user agent
    if (userAgent.length < 10) {
      suspiciousReasons.push('Suspicious user agent length');
    }
  }

  // Check Origin header
  if (analysisConfig.checkOrigin && analysisConfig.allowedOrigins) {
    const origin = req.headers.origin;
    if (origin && !analysisConfig.allowedOrigins.includes(origin)) {
      suspiciousReasons.push(`Unauthorized origin: ${origin}`);
      // Don't automatically block, might be legitimate cross-origin request
    }
  }

  // Check Referer header for potential CSRF
  if (analysisConfig.checkReferer) {
    const referer = req.headers.referer;
    const host = req.headers.host;
    
    // For state-changing operations, referer should match host
    if (req.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      if (!referer) {
        suspiciousReasons.push('Missing referer header for state-changing request');
      } else {
        try {
          const refererUrl = new URL(referer);
          if (refererUrl.host !== host) {
            suspiciousReasons.push('Referer host mismatch');
          }
        } catch (error) {
          suspiciousReasons.push('Invalid referer URL');
        }
      }
    }
  }

  // Bot detection
  if (analysisConfig.detectBots) {
    const userAgent = req.headers['user-agent'] || '';
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /php/i,
      /go-http-client/i
    ];

    if (botPatterns.some(pattern => pattern.test(userAgent))) {
      suspiciousReasons.push('Bot activity detected');
      // Don't block legitimate search engine bots, just log
    }
  }

  // Check for suspicious headers
  const suspiciousHeaders = [
    'x-forwarded-host',
    'x-real-ip',
    'x-forwarded-proto',
    'x-cluster-client-ip'
  ];

  suspiciousHeaders.forEach(header => {
    if (req.headers[header]) {
      suspiciousReasons.push(`Potentially spoofed header: ${header}`);
    }
  });

  // Check request size
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 50 * 1024 * 1024) { // 50MB
    suspiciousReasons.push('Unusually large request body');
    shouldBlock = true; // Block very large requests to prevent DoS
  }

  // Log suspicious activity if configured
  if (analysisConfig.logSuspiciousActivity && suspiciousReasons.length > 0) {
    loggers.general.warn('Suspicious request detected', {
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      endpoint: req.url,
      method: req.method,
      reasons: suspiciousReasons,
      willBlock: shouldBlock
    });
  }

  return {
    detected: suspiciousReasons.length > 0,
    block: shouldBlock,
    reasons: suspiciousReasons
  };
}

/**
 * Apply security headers using existing middleware
 */
async function applySecurityHeaders(
  req: NextApiRequest,
  res: NextApiResponse,
  headersConfig: NonNullable<EnhancedSecurityConfig['headers']>
) {
  const securityHeadersHandler = withSecurityHeaders(
    async (req, res) => {
      // No-op handler, we just want the headers applied
    },
    {
      enableCSP: headersConfig.enableCSP,
      enableHSTS: headersConfig.enableHSTS,
      cspReportUri: headersConfig.cspReportUri,
      customHeaders: headersConfig.customHeaders
    }
  );

  await securityHeadersHandler(req, res);
}

/**
 * Predefined security configurations for different API types
 */
export const SecurityConfigs = {
  /**
   * High security for admin endpoints
   */
  admin: {
    rateLimit: { windowMs: 15 * 60 * 1000, max: 100 }, // 100 requests per 15 minutes
    headers: { enableCSP: true, enableHSTS: true },
    analysis: {
      checkUserAgent: true,
      checkOrigin: true,
      checkReferer: true,
      detectBots: true,
      logSuspiciousActivity: true
    },
    cors: {
      origin: false, // No CORS for admin endpoints
      credentials: true
    }
  } as EnhancedSecurityConfig,

  /**
   * Medium security for API endpoints
   */
  api: {
    rateLimit: { windowMs: 15 * 60 * 1000, max: 1000 }, // 1000 requests per 15 minutes
    headers: { enableCSP: true },
    analysis: {
      checkUserAgent: true,
      detectBots: true,
      logSuspiciousActivity: true
    },
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    }
  } as EnhancedSecurityConfig,

  /**
   * Lower security for public endpoints
   */
  public: {
    rateLimit: { windowMs: 15 * 60 * 1000, max: 2000 }, // 2000 requests per 15 minutes
    headers: { enableCSP: false },
    analysis: {
      detectBots: true,
      logSuspiciousActivity: false
    },
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type']
    }
  } as EnhancedSecurityConfig,

  /**
   * Strict security for authentication endpoints
   */
  auth: {
    rateLimit: { windowMs: 15 * 60 * 1000, max: 50 }, // 50 requests per 15 minutes
    headers: { enableCSP: true, enableHSTS: true },
    analysis: {
      checkUserAgent: true,
      checkOrigin: true,
      checkReferer: true,
      detectBots: true,
      logSuspiciousActivity: true
    },
    validation: {
      body: [
        { field: 'email', type: 'email' as const, required: true },
        { field: 'password', type: 'string' as const, required: true, minLength: 8, maxLength: 128 }
      ]
    },
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }
  } as EnhancedSecurityConfig
};

export default withEnhancedSecurity;