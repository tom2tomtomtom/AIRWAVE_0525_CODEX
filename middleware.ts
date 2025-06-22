import { NextRequest, NextResponse } from 'next/server';
import { 
  securityMiddleware,
  checkMaintenanceMode,
  validateHost,
  validateCSRFToken
} from '@/src/middleware/security';
import { loggers } from '@/src/lib/logger';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  try {
    // 1. Check maintenance mode first
    const maintenanceResponse = checkMaintenanceMode(request);
    if (maintenanceResponse) {
      return maintenanceResponse;
    }
    
    // 2. Validate host header
    if (!validateHost(request)) {
      loggers.general.warn('Invalid host header', {
        host: request.headers.get('host'),
        pathname,
        ip: request.ip
      });
      
      return new NextResponse('Invalid Host', { status: 400 });
    }
    
    // 3. Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
    
    // 4. Apply security middleware (rate limiting, headers, CORS)
    const securityResponse = securityMiddleware(request);
    if (securityResponse.status !== 200 && securityResponse.status !== 308 && securityResponse.status !== 307) {
      return securityResponse;
    }
    
    // 5. CSRF validation for state-changing requests
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && 
        pathname.startsWith('/api/') && 
        !pathname.startsWith('/api/health/') &&
        !pathname.startsWith('/api/auth/') &&
        !pathname.startsWith('/api/csrf-token')) {
      
      if (!validateCSRFToken(request)) {
        return new NextResponse('CSRF token validation failed', { 
          status: 403,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }
    
    // 6. Special handling for authentication routes
    if (pathname.startsWith('/api/auth/')) {
      // Auth routes get basic security headers but skip CSRF
      const response = NextResponse.next();
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('X-Content-Type-Options', 'nosniff');
      return response;
    }
    
    // 7. Return the response from security middleware with all headers applied
    return securityResponse;
    
  } catch (error) {
    loggers.general.error('Middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      pathname,
      method: request.method,
      ip: request.ip
    });
    
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};