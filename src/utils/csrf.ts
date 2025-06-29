/**
 * CSRF Protection Utilities
 * Provides Cross-Site Request Forgery protection for API endpoints
 */

import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production';
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Create CSRF token with HMAC signature
 */
export function createCSRFToken(sessionId?: string): string {
  const token = generateCSRFToken();
  const timestamp = Date.now().toString();
  const payload = `${token}:${timestamp}:${sessionId || ''}`;

  const hmac = crypto.createHmac('sha256', CSRF_SECRET);
  hmac.update(payload);
  const signature = hmac.digest('hex');

  return `${token}:${timestamp}:${signature}`;
}

/**
 * Verify CSRF token
 */
export function verifyCSRFToken(token: string, sessionId?: string): boolean {
  try {
    const parts = token.split(':');
    if (parts.length !== 3) {
      return false;
    }

    const [tokenPart, timestamp, signature] = parts;

    // Check if token is not too old (1 hour max)
    const tokenAge = Date.now() - parseInt(timestamp || '0');
    if (tokenAge > 3600000) {
      // 1 hour in milliseconds
      return false;
    }

    // Verify signature
    const payload = `${tokenPart}:${timestamp}:${sessionId || ''}`;
    const hmac = crypto.createHmac('sha256', CSRF_SECRET);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature || '', 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error: any) {
    console.error('CSRF token verification error:', error);
    return false;
  }
}

/**
 * Middleware to validate CSRF tokens
 */
export function withCSRFProtection(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Skip CSRF for safe methods (they should be idempotent)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
      return handler(req, res);
    }

    // Skip CSRF for webhook endpoints
    if (req.url?.includes('/webhook')) {
      return handler(req, res);
    }

    // Check origin/referer for additional protection
    const origin = req.headers.origin as string;
    const referer = req.headers.referer as string;

    if (origin || referer) {
      const validOrigin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const isValidOrigin = origin === validOrigin || (referer && referer.startsWith(validOrigin));

      if (!isValidOrigin) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Invalid origin',
          },
        });
      }
    }

    const csrfToken = req.headers['x-csrf-token'] as string;
    const sessionId = req.headers['x-session-id'] as string;

    if (!csrfToken) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'CSRF token missing',
        },
      });
    }

    if (!verifyCSRFToken(csrfToken, sessionId)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Invalid CSRF token',
        },
      });
    }

    return handler(req, res);
  };
}

/**
 * Get CSRF token for client-side use
 */
export async function getCSRFToken(sessionId?: string): Promise<string> {
  return createCSRFToken(sessionId);
}

/**
 * CSRF token API endpoint handler
 */
export async function handleCSRFTokenRequest(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = req.headers['x-session-id'] as string;
  const token = await getCSRFToken(sessionId);

  res.status(200).json({ csrfToken: token });
}

/**
 * Client-side CSRF token management
 */
export const csrfClient = {
  token: null as string | null,

  async getToken(): Promise<string> {
    if (!this.token) {
      await this.refreshToken();
    }
    return this.token!;
  },

  async refreshToken(): Promise<void> {
    try {
      const response = await fetch('/api/auth/csrf-token');
      const data = await response.json();
      this.token = data.csrfToken;
    } catch (error: any) {
      console.error('Failed to get CSRF token:', error);
      throw new Error('CSRF token unavailable');
    }
  },

  async makeSecureRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getToken();

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'X-CSRF-Token': token,
        'Content-Type': 'application/json',
      },
    });
  },
};

/**
 * React hook for CSRF protection
 */
export function useCSRF() {
  const makeSecureRequest = async (url: string, options: RequestInit = {}) => {
    return csrfClient.makeSecureRequest(url, options);
  };

  const refreshToken = async () => {
    await csrfClient.refreshToken();
  };

  return {
    makeSecureRequest,
    refreshToken,
  };
}
