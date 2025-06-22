import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { loggers } from '@/lib/logger';

// Security headers configuration
export const getSecurityHeaders = () => {
  const config = getConfig();
  
  const headers = new Headers();
  
  // Basic security headers
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-XSS-Protection', '1; mode=block');
  
  // Strict Transport Security (HSTS)
  if (config.ENABLE_SECURITY_HEADERS && config.isProduction) {
    headers.set('Strict-Transport-Security', `max-age=${config.HSTS_MAX_AGE}; includeSubDomains; preload`);
  }
  
  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' https: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ];
  
  if (config.CSP_REPORT_URI) {
    cspDirectives.push(`report-uri ${config.CSP_REPORT_URI}`);
  }
  
  headers.set('Content-Security-Policy', cspDirectives.join('; '));
  
  // Permissions Policy (formerly Feature Policy)
  const permissionsPolicyDirectives = [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()'
  ];
  
  headers.set('Permissions-Policy', permissionsPolicyDirectives.join(', '));
  
  return headers;
};

// CORS configuration
export const configureCORS = (request: NextRequest, response: NextResponse) => {
  const config = getConfig();
  const origin = request.headers.get('origin');
  
  // Check if origin is allowed
  if (origin && config.ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (config.NODE_ENV === 'development') {
    // Allow localhost in development
    if (origin?.includes('localhost') || origin?.includes('127.0.0.1')) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }
  }
  
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token');
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  
  return response;
};

// Rate limiting store (in-memory for simplicity, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

// Rate limiting function
export const checkRateLimit = (
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetTime: number; total: number } => {
  const now = Date.now();
  const key = identifier;
  const existing = rateLimitStore.get(key);
  
  if (!existing || now > existing.resetTime) {
    // First request or window expired
    const resetTime = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime,
      total: maxRequests
    };
  }
  
  // Increment count
  existing.count++;
  rateLimitStore.set(key, existing);
  
  const allowed = existing.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - existing.count);
  
  return {
    allowed,
    remaining,
    resetTime: existing.resetTime,
    total: maxRequests
  };
};

// Security middleware function
export const securityMiddleware = (request: NextRequest) => {
  const config = getConfig();
  const url = request.nextUrl.clone();
  
  // Skip security checks for health endpoints
  if (url.pathname.startsWith('/api/health/')) {
    return NextResponse.next();
  }
  
  // Get client identifier for rate limiting
  const clientIP = request.ip || 
                  request.headers.get('x-forwarded-for')?.split(',')[0] ||
                  request.headers.get('x-real-ip') ||
                  'unknown';
  
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const identifier = `${clientIP}:${userAgent}`;
  
  // Apply rate limiting
  const rateLimitConfig = config.NODE_ENV === 'production' 
    ? { max: config.RATE_LIMIT_MAX, window: config.RATE_LIMIT_WINDOW }
    : { max: 1000, window: 60000 }; // More lenient in development
  
  const rateLimit = checkRateLimit(identifier, rateLimitConfig.max, rateLimitConfig.window);
  
  if (!rateLimit.allowed) {
    loggers.general.warn('Rate limit exceeded', {
      clientIP,
      userAgent,
      path: url.pathname,
      method: request.method
    });
    
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
        'X-RateLimit-Limit': rateLimit.total.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString()
      }
    });
  }
  
  // Create response with security headers
  const response = NextResponse.next();
  
  // Add security headers if enabled
  if (config.ENABLE_SECURITY_HEADERS) {
    const securityHeaders = getSecurityHeaders();
    securityHeaders.forEach((value, key) => {
      response.headers.set(key, value);
    });
  }
  
  // Add rate limiting headers
  response.headers.set('X-RateLimit-Limit', rateLimit.total.toString());
  response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
  response.headers.set('X-RateLimit-Reset', new Date(rateLimit.resetTime).toISOString());
  
  // Configure CORS
  return configureCORS(request, response);
};

// CSRF token validation middleware
export const validateCSRFToken = (request: NextRequest): boolean => {
  const config = getConfig();
  
  // Skip CSRF for GET requests and health checks
  if (request.method === 'GET' || request.nextUrl.pathname.startsWith('/api/health/')) {
    return true;
  }
  
  const token = request.headers.get('X-CSRF-Token') || 
                request.headers.get('x-csrf-token');
  
  const cookieToken = request.cookies.get(config.CSRF_COOKIE_NAME)?.value;
  
  if (!token || !cookieToken || token !== cookieToken) {
    loggers.general.warn('CSRF token validation failed', {
      path: request.nextUrl.pathname,
      method: request.method,
      hasToken: !!token,
      hasCookieToken: !!cookieToken
    });
    return false;
  }
  
  return true;
};

// Maintenance mode check
export const checkMaintenanceMode = (request: NextRequest): NextResponse | null => {
  const config = getConfig();
  
  if (config.MAINTENANCE_MODE) {
    // Allow health checks and admin routes during maintenance
    if (request.nextUrl.pathname.startsWith('/api/health/') ||
        request.nextUrl.pathname.startsWith('/api/admin/')) {
      return null;
    }
    
    return new NextResponse('Service Temporarily Unavailable', {
      status: 503,
      headers: {
        'Retry-After': '3600', // 1 hour
        'Content-Type': 'text/plain'
      }
    });
  }
  
  return null;
};

// Host validation
export const validateHost = (request: NextRequest): boolean => {
  const config = getConfig();
  const host = request.headers.get('host');
  
  if (!host) return false;
  
  // Allow configured hosts
  if (config.ALLOWED_HOSTS.includes(host)) {
    return true;
  }
  
  // Allow localhost in development
  if (config.NODE_ENV === 'development' && 
      (host.includes('localhost') || host.includes('127.0.0.1'))) {
    return true;
  }
  
  return false;
};