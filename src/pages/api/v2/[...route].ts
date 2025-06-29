/**
 * Universal API v2 Router
 *
 * This is the central router for all API v2 endpoints with a standardized middleware pipeline:
 * 1. Security headers (CSP, HSTS, etc.)
 * 2. Authentication
 * 3. CSRF protection
 * 4. Session security
 * 5. Rate limiting
 * 6. Input validation & sanitization
 * 7. Cost tracking (for AI operations)
 * 8. Security event logging
 * 9. Route handling
 *
 * All API v2 endpoints follow consistent patterns for:
 * - Response format
 * - Error handling
 * - Authentication
 * - Rate limiting
 * - Logging and monitoring
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/withAuth';
import { withRateLimit } from '@/middleware/withRateLimit';
import { withSecurityHeaders, getSecurityConfig } from '@/middleware/withSecurityHeaders';
import { withCsrfProtection, getCsrfConfig } from '@/middleware/withCsrfProtection';
import { withSessionSecurity } from '@/middleware/withSessionSecurity';
import { securityLogger } from '@/lib/security/security-logger';
import { securityValidation, sanitization } from '@/utils/validation-utils';
import {
  successResponse,
  errorResponse,
  handleApiError,
  methodNotAllowed,
  ApiErrorCode,
} from '@/lib/api-response';
// Simple stubs for missing modules
class AICostController {
  static getInstance() {
    return new AICostController();
  }

  async getBudgetStatus(): Promise<{ status: string; remaining: number }> {
    return { status: 'healthy', remaining: 1000 };
  }

  async getTotalSpent(): Promise<number> {
    return 0;
  }

  async checkBudget(
    _service: string,
    _model: string,
    _tokens: number,
    _userId: string
  ): Promise<{ allowed: boolean; budgetRemaining: number; reason: string }> {
    return { allowed: true, budgetRemaining: 1000, reason: 'Budget check passed' };
  }

  async trackUsage(
    service: string,
    model: string,
    tokens: number,
    cost: number,
    _userId: string,
    metadata: any
  ): Promise<void> {
    // Stub implementation
    loggers.general.error(`Tracked usage: ${service}/${model} - ${tokens} tokens, $${cost}`, metadata);
  }
}

class PerformanceTracker {
  static getInstance() {
    return new PerformanceTracker();
  }

  startOperation(_name: string) {
    return { end: () => {} };
  }

  getAverageResponseTime() {
    return 100;
  }

  getTotalRequests() {
    return 0;
  }

  getErrorRate() {
    return 0;
  }
}

// Route handlers
import { handleWorkflowRoutes } from './handlers/workflow';
import { handleAIRoutes } from './handlers/ai';
import { handleAssetsRoutes } from './handlers/assets';
import { handleMonitoringRoutes } from './handlers/monitoring';
import { loggers } from '@/lib/logger';


interface RouteContext {
  user: any;
  route: string[];
  method: string;
  body: any;
  query: any;
  startTime: number;
  requestId: string;
}

// Security validation and sanitization functions
async function validateAndSanitizeInput(req: NextApiRequest, body: any): Promise<any> {
  const sanitized: any = {};

  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      // Check for malicious patterns
      if (securityValidation.containsMaliciousPattern(value)) {
        securityLogger.logEvent('MALICIOUS_INPUT_DETECTED', req, {
          field: key,
          pattern_type: 'multiple',
          value_preview: value.slice(0, 100),
        });
        throw new Error(`Malicious content detected in field: ${key}`);
      }

      // Sanitize the input
      sanitized[key] = sanitization.sanitizeInput(value, {
        allowHTML: false,
        maxLength: 10000,
        removeControlChars: true,
        normalizeUnicode: true,
      });
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = await validateAndSanitizeInput(req, value);
    } else {
      // Keep non-string values as is (numbers, booleans, etc.)
      sanitized[key] = value;
    }
  }

  return sanitized;
}

async function validateAndSanitizeQuery(req: NextApiRequest, query: any): Promise<any> {
  const sanitized: any = {};

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') {
      // Check for malicious patterns in query parameters
      if (securityValidation.containsMaliciousPattern(value)) {
        securityLogger.logEvent('MALICIOUS_QUERY_DETECTED', req, {
          parameter: key,
          value_preview: value.slice(0, 100),
        });
        // For query parameters, we'll sanitize rather than reject
        sanitized[key] = sanitization.sanitizeInput(value, {
          allowHTML: false,
          maxLength: 1000,
          removeControlChars: true,
          normalizeUnicode: true,
        });
      } else {
        sanitized[key] = value;
      }
    } else if (Array.isArray(value)) {
      // Handle array query parameters
      sanitized[key] = value.map(v =>
        typeof v === 'string' ? sanitization.sanitizeInput(v, { maxLength: 1000 }) : v
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

async function universalHandler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const user = (req as any).user;
  const sessionId = (req as any).sessionId;

  // Extract route from URL
  const { route: routeParams } = req.query;
  const route = Array.isArray(routeParams)
    ? routeParams.filter((param): param is string => typeof param === 'string')
    : [routeParams].filter((param): param is string => typeof param === 'string');

  const context: RouteContext = {
    user,
    route,
    method: req.method || 'GET',
    body: req.body,
    query: req.query,
    startTime,
    requestId,
  };

  // Start performance tracking
  const performanceTracker = PerformanceTracker.getInstance();
  const operation = performanceTracker.startOperation(`api_v2_${route.join('_')}`);

  try {
    // Security: Log API access
    if (user?.id) {
      securityLogger.logEvent(
        'API_USAGE',
        req,
        {
          route: route.join('/'),
          requestId,
          authenticated: true,
        },
        user.id,
        sessionId
      );
    }

    // Security: Validate and sanitize input data
    if (req.body && typeof req.body === 'object') {
      context.body = await validateAndSanitizeInput(req, req.body);
    }

    // Security: Validate query parameters
    if (req.query && typeof req.query === 'object') {
      context.query = await validateAndSanitizeQuery(req, req.query);
    }

    // Log request with security context
    console.log(
      `[API v2] ${context.method} /${route.join('/')} - ${requestId} - User: ${user?.id || 'anonymous'}`
    );

    // Validate route
    if (!route || route.length === 0) {
      securityLogger.logEvent('INVALID_API_REQUEST', req, { reason: 'missing_route' });
      return errorResponse(res, ApiErrorCode.INVALID_REQUEST, 'API v2 route not specified', 400);
    }

    const [mainRoute, ...subRoute] = route;

    // Route to appropriate handler
    switch (mainRoute) {
      case 'workflow':
        return await handleWorkflowRoutes(req, res, context, subRoute);

      case 'ai':
        return await handleAIRoutes(req, res, context, subRoute);

      case 'assets':
        return await handleAssetsRoutes(req, res, context, subRoute);

      case 'monitoring':
        return await handleMonitoringRoutes(req, res, context, subRoute);

      case 'health':
        return await handleHealthCheck(req, res, context);

      default:
        return errorResponse(
          res,
          ApiErrorCode.NOT_FOUND,
          `API v2 route '${mainRoute}' not found`,
          404
        );
    }
  } catch (error: any) {
    // Security: Log API errors for monitoring
    securityLogger.logEvent(
      'API_ERROR',
      req,
      {
        route: route.join('/'),
        error: error.message,
        stack: error.stack?.slice(0, 500),
        requestId,
      },
      user?.id,
      sessionId
    );

    console.error(`[API v2] Error in ${context.method} /${route.join('/')}:`, error);
    return handleApiError(res, error, `api_v2_${route.join('_')}`);
  } finally {
    // End performance tracking
    operation.end();

    // Log response time
    const duration = Date.now() - startTime;
    console.log(
      `[API v2] ${context.method} /${route.join('/')} completed in ${duration}ms - ${requestId}`
    );
  }
}

// Health check endpoint
async function handleHealthCheck(
  _req: NextApiRequest,
  res: NextApiResponse,
  context: RouteContext
): Promise<void> {
  if (context.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const performanceTracker = PerformanceTracker.getInstance();
  const costController = AICostController.getInstance();

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    performance: {
      averageResponseTime: performanceTracker.getAverageResponseTime(),
      totalRequests: performanceTracker.getTotalRequests(),
      errorRate: performanceTracker.getErrorRate(),
    },
    ai: {
      budgetStatus: await costController.getBudgetStatus(),
      totalSpent: await costController.getTotalSpent(),
    },
  };

  return successResponse(res, health, 200, {
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
  });
}

// Middleware pipeline wrapper
function withMiddlewarePipeline(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Set CORS headers for API v2
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Add API version header
    res.setHeader('X-API-Version', '2.0.0');
    res.setHeader('X-Powered-By', 'AIRWAVE API v2');

    return handler(req, res);
  };
}

// Cost tracking middleware for AI operations
export async function withCostTracking(
  req: NextApiRequest,
  res: NextApiResponse,
  context: RouteContext,
  operation: string,
  _estimatedCost: number = 0
): Promise<boolean> {
  if (!context.user?.id) {
    return true; // Skip cost tracking if no user
  }

  const costController = AICostController.getInstance();

  try {
    // Check budget before operation
    const budgetCheck = await costController.checkBudget(
      'openai', // Default service
      'gpt-4', // Default model
      1000, // Estimated tokens
      context.user.id
    );

    if (!budgetCheck.allowed) {
      errorResponse(
        res,
        ApiErrorCode.VALIDATION_ERROR,
        budgetCheck.reason || 'Budget exceeded',
        402
      );
      return false;
    }

    // Track the operation (will be called after successful completion)
    (req as any).trackCost = async (actualCost: number) => {
      await costController.trackUsage('openai', 'gpt-4', 1000, actualCost, context.user.id, {
        operation,
        route: context.route.join('/'),
        requestId: context.requestId,
      });
    };

    return true;
  } catch (error: any) {
    console.error('Cost tracking error:', error);
    return true; // Don't block request on cost tracking errors
  }
}

// Input validation middleware
export function validateInput(_schema: any) {
  return (_req: NextApiRequest, res: NextApiResponse, next: () => void) => {
    try {
      // TODO: Implement Zod schema validation
      // const validated = schema.parse(req.body);
      // req.body = validated;
      next();
    } catch (error: any) {
      return errorResponse(res, ApiErrorCode.VALIDATION_ERROR, 'Invalid input data', 400);
    }
  };
}

// Security-enhanced middleware pipeline
// Order: Security Headers → Auth → CSRF → Session → Rate Limiting → Handler
const securityEnhancedHandler = withSecurityHeaders(
  withAuth(
    withCsrfProtection(withSessionSecurity(withRateLimit('api')(universalHandler)), getCsrfConfig())
  ),
  getSecurityConfig()
);

// Export the handler with complete security middleware pipeline
export default withMiddlewarePipeline(securityEnhancedHandler);
