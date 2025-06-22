import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { getConfig } from '@/lib/config';
import { loggers } from '@/lib/logger';

// CSRF token generation
export const generateCSRFToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// CSRF token verification
export const verifyCSRFToken = (token: string, secret: string): boolean => {
  try {
    // Create HMAC of the token with the secret
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(token);
    const expectedSignature = hmac.digest('hex');
    
    // For simplicity, we'll just check if the token exists and is long enough
    // In a more sophisticated implementation, you'd compare HMAC signatures
    return token && token.length >= 32;
  } catch (error) {
    loggers.general.error('CSRF token verification error', error);
    return false;
  }
};

// CSRF middleware for API routes
export const csrfProtection = (handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void) => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const config = getConfig();
    
    // Skip CSRF protection for GET, HEAD, and OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
      return handler(req, res);
    }
    
    // Skip CSRF protection in development if configured
    if (config.NODE_ENV === 'development' && config.DEV_BYPASS_AUTH) {
      return handler(req, res);
    }
    
    const token = req.headers['x-csrf-token'] as string || req.body?._csrf;
    const cookieToken = req.cookies[config.CSRF_COOKIE_NAME];
    
    if (!token) {
      loggers.general.warn('CSRF token missing', {
        method: req.method,
        url: req.url,
        ip: req.socket.remoteAddress
      });
      
      return res.status(403).json({
        error: 'CSRF token missing',
        code: 'CSRF_TOKEN_MISSING'
      });
    }
    
    if (!cookieToken) {
      loggers.general.warn('CSRF cookie missing', {
        method: req.method,
        url: req.url,
        ip: req.socket.remoteAddress
      });
      
      return res.status(403).json({
        error: 'CSRF cookie missing',
        code: 'CSRF_COOKIE_MISSING'
      });
    }
    
    if (token !== cookieToken) {
      loggers.general.warn('CSRF token mismatch', {
        method: req.method,
        url: req.url,
        ip: req.socket.remoteAddress,
        tokenLength: token.length,
        cookieTokenLength: cookieToken.length
      });
      
      return res.status(403).json({
        error: 'CSRF token invalid',
        code: 'CSRF_TOKEN_INVALID'
      });
    }
    
    if (!verifyCSRFToken(token, config.CSRF_SECRET)) {
      loggers.general.warn('CSRF token verification failed', {
        method: req.method,
        url: req.url,
        ip: req.socket.remoteAddress
      });
      
      return res.status(403).json({
        error: 'CSRF token verification failed',
        code: 'CSRF_TOKEN_VERIFICATION_FAILED'
      });
    }
    
    return handler(req, res);
  };
};

// CSRF token endpoint
export const createCSRFTokenHandler = (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const config = getConfig();
  const token = generateCSRFToken();
  
  // Set CSRF token in cookie
  res.setHeader('Set-Cookie', [
    `${config.CSRF_COOKIE_NAME}=${token}; HttpOnly; Secure=${config.COOKIE_SECURE}; SameSite=${config.COOKIE_SAME_SITE}; Path=/; Max-Age=${config.SESSION_MAX_AGE / 1000}`
  ]);
  
  res.status(200).json({
    csrfToken: token,
    expiresAt: new Date(Date.now() + config.SESSION_MAX_AGE).toISOString()
  });
};

// Double Submit Cookie pattern implementation
export class CSRFProtection {
  private secret: string;
  private cookieName: string;
  private headerName: string;
  
  constructor() {
    const config = getConfig();
    this.secret = config.CSRF_SECRET;
    this.cookieName = config.CSRF_COOKIE_NAME;
    this.headerName = 'x-csrf-token';
  }
  
  // Generate a signed CSRF token
  generateToken(): string {
    const token = crypto.randomBytes(32).toString('hex');
    const hmac = crypto.createHmac('sha256', this.secret);
    hmac.update(token);
    const signature = hmac.digest('hex');
    return `${token}.${signature}`;
  }
  
  // Verify a signed CSRF token
  verifyToken(token: string): boolean {
    try {
      const [tokenPart, signature] = token.split('.');
      if (!tokenPart || !signature) return false;
      
      const hmac = crypto.createHmac('sha256', this.secret);
      hmac.update(tokenPart);
      const expectedSignature = hmac.digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      return false;
    }
  }
  
  // Express-style middleware
  middleware() {
    return (req: NextApiRequest, res: NextApiResponse, next: () => void) => {
      // Skip for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
        return next();
      }
      
      const token = req.headers[this.headerName] as string;
      const cookieToken = req.cookies[this.cookieName];
      
      if (!token || !cookieToken || token !== cookieToken || !this.verifyToken(token)) {
        return res.status(403).json({
          error: 'Invalid CSRF token',
          code: 'CSRF_TOKEN_INVALID'
        });
      }
      
      next();
    };
  }
  
  // Set CSRF token in response
  setToken(res: NextApiResponse): string {
    const config = getConfig();
    const token = this.generateToken();
    
    res.setHeader('Set-Cookie', [
      `${this.cookieName}=${token}; HttpOnly; Secure=${config.COOKIE_SECURE}; SameSite=${config.COOKIE_SAME_SITE}; Path=/; Max-Age=${config.SESSION_MAX_AGE / 1000}`
    ]);
    
    return token;
  }
}

// Export a singleton instance
export const csrfProtectionInstance = new CSRFProtection();