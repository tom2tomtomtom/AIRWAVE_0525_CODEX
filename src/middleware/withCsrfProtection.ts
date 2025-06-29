/**
 * CSRF Protection Middleware for AIRWAVE
 * Implements Double Submit Cookie pattern and SameSite cookie protection
 * Protects against Cross-Site Request Forgery attacks
 */

import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { loggers } from '@/lib/logger';


export interface CsrfOptions {
  tokenLength?: number;
  cookieName?: string;
  headerName?: string;
  sameSite?: 'strict' | 'lax' | 'none';
  secure?: boolean;
  httpOnly?: boolean;
  maxAge?: number;
  ignoreMethods?: string[];
  skipPaths?: (string | RegExp)[];
  generateToken?: () => string;
  validateToken?: (token: string, cookieToken: string) => boolean;
}

const DEFAULT_OPTIONS: Required<CsrfOptions> = {
  tokenLength: 32,
  cookieName: '_csrf',
  headerName: 'x-csrf-token',
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  httpOnly: false, // Must be false to allow client-side access
  maxAge: 86400, // 24 hours
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  skipPaths: ['/api/auth/callback', '/api/webhooks'],
  generateToken: () => crypto.randomBytes(32).toString('hex'),
  validateToken: (token: string, cookieToken: string) => {
    try {
      const tokenBuffer = Buffer.from(token, 'hex');
      const cookieBuffer = Buffer.from(cookieToken, 'hex');

      // Ensure buffers are the same length for timing-safe comparison
      if (tokenBuffer.length !== cookieBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(tokenBuffer, cookieBuffer);
    } catch (error) {
      // If there's any error with hex decoding or comparison, tokens are invalid
      return false;
    }
  },
};

/**
 * Generate a cryptographically secure CSRF token
 */
// function _generateCsrfToken(length: number = 32): string {
//   return crypto.randomBytes(length).toString('hex');
// }

/**
 * Validate CSRF token using timing-safe comparison
 */
// function _validateCsrfToken(token: string, cookieToken: string): boolean {
//   if (!token || !cookieToken) {
//     return false;
//   }
//
//   try {
//     // Ensure both tokens are the same length to prevent timing attacks
//     if (token.length !== cookieToken.length) {
//       return false;
//     }
//
//     return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(cookieToken, 'hex'));
//   } catch (error) {
//     console.error('CSRF token validation error:', error);
//     return false;
//   }
// }

/**
 * Extract CSRF token from request headers or body
 */
function extractTokenFromRequest(req: NextApiRequest, headerName: string): string | null {
  // Try header first
  const headerToken = req.headers[headerName] as string;

  if (process.env.NODE_ENV !== 'production') {
    console.log('ExtractToken Debug:', {
      headerName,
      headerToken,
      allHeaders: req.headers,
    });
  }
  if (headerToken) {
    return headerToken;
  }

  // Try body for form submissions
  if (req.body && typeof req.body === 'object') {
    const bodyToken = req.body._csrf || req.body.csrfToken;
    if (bodyToken) {
      return bodyToken;
    }
  }

  // Try query parameters as fallback (less secure)
  const queryToken = req.query._csrf || req.query.csrfToken;
  if (queryToken && typeof queryToken === 'string') {
    return queryToken;
  }

  return null;
}

/**
 * Parse cookies from request header
 */
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce((cookies: Record<string, string>, cookie) => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
    return cookies;
  }, {});
}

/**
 * Check if request path should skip CSRF protection
 */
function shouldSkipPath(path: string, skipPaths: (string | RegExp)[]): boolean {
  return skipPaths.some(skipPath => {
    if (typeof skipPath === 'string') {
      return path === skipPath || path.startsWith(skipPath);
    }
    return skipPath.test(path);
  });
}

/**
 * Set CSRF cookie with secure options
 */
function setCsrfCookie(res: NextApiResponse, token: string, options: Required<CsrfOptions>): void {
  const cookieOptions = [
    `${options.cookieName}=${token}`,
    `Max-Age=${options.maxAge}`,
    `SameSite=${options.sameSite}`,
    'Path=/',
  ];

  if (options.secure) {
    cookieOptions.push('Secure');
  }

  if (options.httpOnly) {
    cookieOptions.push('HttpOnly');
  }

  res.setHeader('Set-Cookie', cookieOptions.join('; '));
}

/**
 * CSRF Protection Middleware
 */
export function withCsrfProtection(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  options: CsrfOptions = {}
) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const method = req.method?.toUpperCase();
      const path = req.url || '';

      // Skip CSRF protection entirely for specified paths
      if (shouldSkipPath(path, config.skipPaths)) {
        return handler(req, res);
      }

      // Parse existing cookies
      const cookies = parseCookies(req.headers.cookie);
      const existingToken = cookies[config.cookieName];

      // Generate new token if none exists and set cookie
      let csrfToken = existingToken;
      if (!csrfToken) {
        csrfToken = config.generateToken();
        setCsrfCookie(res, csrfToken, config);
      }

      // Skip token validation for safe methods
      if (config.ignoreMethods.includes(method || '')) {
        // Add CSRF token to response headers for client access
        res.setHeader('X-CSRF-Token', csrfToken);
        (req as any).csrfToken = csrfToken;
        return handler(req, res);
      }

      // For state-changing methods, validate the token
      const submittedToken = extractTokenFromRequest(req, config.headerName);

      if (process.env.NODE_ENV !== 'production') {
        console.log('CSRF Debug:', {
          method,
          submittedToken: submittedToken ? submittedToken.slice(0, 8) + '...' : 'null',
          expectedToken: csrfToken.slice(0, 8) + '...',
          headers: Object.keys(req.headers || {}),
          headerName: config.headerName,
        });
      }

      if (!submittedToken) {
        console.warn(`CSRF protection: Missing token for ${method} ${path}`, {
          userAgent: req.headers?.['user-agent'] || 'unknown',
          ip:
            req.headers?.['x-forwarded-for'] || (req as any).connection?.remoteAddress || 'unknown',
          referer: req.headers?.referer || 'unknown',
        });

        return res.status(403).json({
          success: false,
          error: 'CSRF token missing',
          code: 'FORBIDDEN',
        });
      }

      if (!config.validateToken(submittedToken, csrfToken)) {
        console.warn(`CSRF protection: Invalid token for ${method} ${path}`, {
          submittedToken: submittedToken.slice(0, 8) + '...',
          expectedToken: csrfToken.slice(0, 8) + '...',
          userAgent: req.headers?.['user-agent'] || 'unknown',
          ip:
            req.headers?.['x-forwarded-for'] || (req as any).connection?.remoteAddress || 'unknown',
          referer: req.headers?.referer || 'unknown',
        });

        return res.status(403).json({
          success: false,
          error: 'Invalid CSRF token',
          code: 'FORBIDDEN',
        });
      }

      // Add CSRF token to response headers for client access
      res.setHeader('X-CSRF-Token', csrfToken);

      // Store token in request object for handler access
      (req as any).csrfToken = csrfToken;

      // Log successful CSRF validation in development
      if (process.env.NODE_ENV === 'development') {
        loggers.general.error(`[CSRF] Token validated for ${method} ${path}`);
      }
    } catch (error) {
      console.error('CSRF middleware error:', error);

      return res.status(500).json({
        success: false,
        error: {
          code: 'CSRF_VALIDATION_ERROR',
          message: 'Error validating CSRF token',
        },
      });
    }

    // Execute the original handler
    return handler(req, res);
  };
}

/**
 * Generate CSRF token for client-side use
 */
export async function generateCsrfTokenAPI(
  _req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  const options = { ...DEFAULT_OPTIONS };
  const token = options.generateToken();

  setCsrfCookie(res, token, options);

  res.status(200).json({
    success: true,
    data: { token },
    meta: { timestamp: new Date().toISOString() },
  });
}

/**
 * Utility function to get CSRF token from cookies (client-side)
 */
export function getCsrfTokenFromCookie(cookieName: string = '_csrf'): string | null {
  if (typeof document === 'undefined') {
    return null; // Server-side
  }

  const cookies = document.cookie.split(';').reduce((acc: Record<string, string>, cookie) => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      acc[name] = decodeURIComponent(value);
    }
    return acc;
  }, {});

  return cookies[cookieName] || null;
}

/**
 * Predefined CSRF configurations for different security levels
 */
export const CsrfConfigs = {
  strict: {
    sameSite: 'strict' as const,
    secure: true,
    httpOnly: false,
    maxAge: 3600, // 1 hour
    skipPaths: [], // No paths skipped in strict mode
  },

  moderate: {
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
    maxAge: 86400, // 24 hours
    skipPaths: ['/api/auth/callback', '/api/webhooks'],
  },

  relaxed: {
    sameSite: 'lax' as const,
    secure: false,
    httpOnly: false,
    maxAge: 86400, // 24 hours
    skipPaths: ['/api/auth', '/api/webhooks', '/api/public'],
  },
};

/**
 * Get CSRF configuration based on environment
 */
export function getCsrfConfig(): CsrfOptions {
  const securityLevel = process.env.CSRF_SECURITY_LEVEL || 'moderate';
  const env = process.env.NODE_ENV || 'development';

  if (env === 'production') {
    return CsrfConfigs[securityLevel as keyof typeof CsrfConfigs] || CsrfConfigs.moderate;
  }

  return CsrfConfigs.relaxed;
}

export default withCsrfProtection;
