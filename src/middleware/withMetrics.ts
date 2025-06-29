/**
 * Metrics Collection Middleware for AIRWAVE
 * Automatically tracks API performance metrics
 * Integrates with the metrics collection system
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { performance } from 'perf_hooks';
import { metrics } from '../lib/monitoring/metrics-collector';
import { getClientIp } from '../lib/utils/ip';

// Middleware configuration
interface MetricsConfig {
  trackResponseTime?: boolean;
  trackRequestCount?: boolean;
  trackErrorRate?: boolean;
  trackUserActions?: boolean;
  customTags?: Record<string, string>;
  samplingRate?: number; // 0.0 to 1.0
}

// Request context for metrics
interface RequestContext {
  startTime: number;
  endpoint: string;
  method: string;
  userAgent?: string;
  clientIp?: string;
  userId?: string;
  clientId?: string;
}

// Default configuration
const DEFAULT_CONFIG: Required<MetricsConfig> = {
  trackResponseTime: true,
  trackRequestCount: true,
  trackErrorRate: true,
  trackUserActions: true,
  customTags: {},
  samplingRate: 1.0,
};

/**
 * Middleware to track API metrics automatically
 */
export function withMetrics(config: MetricsConfig = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return function metricsMiddleware(
    handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void
  ) {
    return async function (req: NextApiRequest, res: NextApiResponse) {
      // Check if we should sample this request
      if (Math.random() > finalConfig.samplingRate) {
        return handler(req, res);
      }

      const startTime = performance.now();
      const context: RequestContext = {
        startTime,
        endpoint: sanitizeEndpoint(req.url || ''),
        method: req.method || 'GET',
        ...(req.headers['user-agent'] && { userAgent: req.headers['user-agent'] }),
        clientIp: getClientIp(req),
        userId: (req as any).user?.id,
        clientId: (req as any).user?.selectedClient?.id,
      };

      // Track request start
      if (finalConfig.trackRequestCount) {
        trackRequestStart(context, finalConfig.customTags);
      }

      // Intercept response to track completion metrics
      const originalSend = res.send;
      const originalJson = res.json;
      const originalEnd = res.end;

      let responseIntercepted = false;

      const interceptResponse = (statusCode: number, responseSize?: number) => {
        if (responseIntercepted) return;
        responseIntercepted = true;

        const endTime = performance.now();
        const duration = endTime - startTime;

        // Track all configured metrics
        trackRequestCompletion(context, statusCode, duration, responseSize, finalConfig);
      };

      // Override response methods
      res.send = function (data: unknown) {
        const size = data ? Buffer.byteLength(data.toString(), 'utf8') : 0;
        interceptResponse(res.statusCode, size);
        return originalSend.call(this, data);
      };

      res.json = function (data: unknown) {
        const size = data ? Buffer.byteLength(JSON.stringify(data), 'utf8') : 0;
        interceptResponse(res.statusCode, size);
        return originalJson.call(this, data);
      };

      res.end = function (chunk?: unknown, encoding?: unknown) {
        const size = chunk ? Buffer.byteLength(chunk.toString(), 'utf8') : 0;
        interceptResponse(res.statusCode, size);
        return originalEnd.call(this, chunk, encoding as BufferEncoding);
      };

      try {
        // Execute the handler
        await handler(req, res);

        // Ensure metrics are tracked even if response wasn't sent through intercepted methods
        if (!responseIntercepted) {
          interceptResponse(res.statusCode);
        }
      } catch (error) {
        // Track error metrics
        if (!responseIntercepted) {
          interceptResponse(500);
        }

        trackError(context, error, finalConfig.customTags);
        throw error;
      }
    };
  };
}

/**
 * Track request initiation
 */
function trackRequestStart(context: RequestContext, customTags: Record<string, string>): void {
  const tags = {
    method: context.method,
    endpoint: context.endpoint,
    user_agent: getUserAgentCategory(context.userAgent),
    ...customTags,
  };

  metrics.counter('api.requests.started', 1, tags);

  // Track concurrent requests
  metrics.gauge('api.requests.concurrent', 1, tags);
}

/**
 * Track request completion with all metrics
 */
function trackRequestCompletion(
  context: RequestContext,
  statusCode: number,
  duration: number,
  responseSize: number = 0,
  config: Required<MetricsConfig>
): void {
  const statusClass = `${Math.floor(statusCode / 100)}xx`;
  const isError = statusCode >= 400;
  const isSuccess = statusCode >= 200 && statusCode < 400;

  const baseTags = {
    method: context.method,
    endpoint: context.endpoint,
    status_code: statusCode.toString(),
    status_class: statusClass,
    user_agent: getUserAgentCategory(context.userAgent),
    ...config.customTags,
  };

  // Track request completion
  if (config.trackRequestCount) {
    metrics.counter('api.requests.total', 1, baseTags);
    metrics.counter('api.requests.completed', 1, baseTags);

    if (isSuccess) {
      metrics.counter('api.requests.success', 1, baseTags);
    }
  }

  // Track response time
  if (config.trackResponseTime) {
    metrics.timer('api.requests.duration', duration, baseTags);
    metrics.histogram('api.response_time', duration, baseTags);

    // Track slow requests
    if (duration > 1000) {
      metrics.counter('api.requests.slow', 1, { ...baseTags, threshold: '1s' });
    }
    if (duration > 5000) {
      metrics.counter('api.requests.very_slow', 1, { ...baseTags, threshold: '5s' });
    }
  }

  // Track error rates
  if (config.trackErrorRate && isError) {
    metrics.counter('api.requests.errors', 1, baseTags);

    // Specific error tracking
    if (statusCode === 404) {
      metrics.counter('api.requests.not_found', 1, baseTags);
    } else if (statusCode === 401) {
      metrics.counter('api.requests.unauthorized', 1, baseTags);
    } else if (statusCode === 403) {
      metrics.counter('api.requests.forbidden', 1, baseTags);
    } else if (statusCode === 429) {
      metrics.counter('api.requests.rate_limited', 1, baseTags);
    } else if (statusCode >= 500) {
      metrics.counter('api.requests.server_errors', 1, baseTags);
    }
  }

  // Track response size
  if (responseSize > 0) {
    metrics.histogram('api.response.size', responseSize, baseTags);

    // Track large responses
    if (responseSize > 1024 * 1024) {
      // 1MB
      metrics.counter('api.responses.large', 1, { ...baseTags, threshold: '1mb' });
    }
  }

  // Track user actions if enabled
  if (config.trackUserActions) {
    trackUserAction(context, statusCode, baseTags);
  }

  // Track endpoint-specific metrics
  trackEndpointSpecificMetrics(context, statusCode, duration, baseTags);

  // Decrement concurrent requests
  metrics.gauge('api.requests.concurrent', -1, baseTags);
}

/**
 * Track errors with detailed context
 */
function trackError(
  context: RequestContext,
  error: unknown,
  customTags: Record<string, string>
): void {
  const tags = {
    method: context.method,
    endpoint: context.endpoint,
    error_type: error instanceof Error ? error.constructor.name : 'unknown',
    error_message:
      error instanceof Error ? error.message?.substring(0, 100) || 'unknown' : 'unknown',
    ...customTags,
  };

  metrics.counter('api.errors.total', 1, tags);

  // Track specific error types
  const errorName = error instanceof Error ? error.name : 'unknown';
  if (errorName === 'ValidationError') {
    metrics.counter('api.errors.validation', 1, tags);
  } else if (errorName === 'AuthenticationError') {
    metrics.counter('api.errors.authentication', 1, tags);
  } else if (errorName === 'DatabaseError') {
    metrics.counter('api.errors.database', 1, tags);
  } else if (errorName === 'ExternalServiceError') {
    metrics.counter('api.errors.external_service', 1, tags);
  } else {
    metrics.counter('api.errors.unknown', 1, tags);
  }
}

/**
 * Track user actions for business intelligence
 */
function trackUserAction(
  context: RequestContext,
  statusCode: number,
  baseTags: Record<string, string>
): void {
  if (!context.userId) return;

  const actionTags = {
    user_id: context.userId,
    client_id: context.clientId || 'none',
    success: statusCode < 400 ? 'true' : 'false',
    ...baseTags,
  };

  // Infer action type from endpoint
  const action = inferActionFromEndpoint(context.endpoint, context.method);
  if (action) {
    metrics.counter(`user.actions.${action}`, 1, actionTags);
  }

  metrics.counter('user.actions.total', 1, actionTags);
}

/**
 * Track endpoint-specific business metrics
 */
function trackEndpointSpecificMetrics(
  context: RequestContext,
  statusCode: number,
  duration: number,
  baseTags: Record<string, string>
): void {
  const endpoint = context.endpoint;

  // AI-related endpoints
  if (endpoint.includes('/ai/') || endpoint.includes('/flow/')) {
    metrics.counter('ai.api.requests', 1, baseTags);
    metrics.timer('ai.api.duration', duration, baseTags);

    if (statusCode < 400) {
      metrics.counter('ai.api.success', 1, baseTags);
    }
  }

  // Video generation endpoints
  if (endpoint.includes('/video/') || endpoint.includes('/render/')) {
    metrics.counter('video.api.requests', 1, baseTags);
    metrics.timer('video.api.duration', duration, baseTags);
  }

  // Asset management endpoints
  if (endpoint.includes('/assets/') || endpoint.includes('/upload/')) {
    metrics.counter('assets.api.requests', 1, baseTags);
    metrics.timer('assets.api.duration', duration, baseTags);
  }

  // Authentication endpoints
  if (endpoint.includes('/auth/')) {
    metrics.counter('auth.api.requests', 1, baseTags);

    if (statusCode === 200) {
      metrics.counter('auth.success', 1, baseTags);
    } else if (statusCode === 401) {
      metrics.counter('auth.failures', 1, baseTags);
    }
  }
}

/**
 * Sanitize endpoint for consistent metric naming
 */
function sanitizeEndpoint(url: string): string {
  return ((url || '').split('?')[0] || '')
    .replace(/\/\d+/g, '/:id') // Replace numeric IDs
    .replace(/\/[a-f0-9-]{36}/g, '/:uuid') // Replace UUIDs
    .replace(/\/[a-zA-Z0-9_-]{20}/g, '/:token') // Replace long tokens
    .toLowerCase();
}

/**
 * Categorize user agent for better grouping
 */
function getUserAgentCategory(userAgent?: string): string {
  if (!userAgent) return 'unknown';

  const ua = userAgent.toLowerCase();

  if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
    return 'bot';
  }
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  }
  if (ua.includes('chrome')) {
    return 'chrome';
  }
  if (ua.includes('firefox')) {
    return 'firefox';
  }
  if (ua.includes('safari')) {
    return 'safari';
  }
  if (ua.includes('edge')) {
    return 'edge';
  }

  return 'other';
}

/**
 * Infer user action from endpoint and method
 */
function inferActionFromEndpoint(endpoint: string, method: string): string | null {
  const path = endpoint.toLowerCase();

  if (method === 'POST') {
    if (path.includes('/clients')) return 'create_client';
    if (path.includes('/campaigns')) return 'create_campaign';
    if (path.includes('/assets')) return 'upload_asset';
    if (path.includes('/videos')) return 'generate_video';
    if (path.includes('/flow')) return 'start_workflow';
    if (path.includes('/auth/login')) return 'login';
    if (path.includes('/auth/register')) return 'register';
  }

  if (method === 'GET') {
    if (path.includes('/dashboard')) return 'view_dashboard';
    if (path.includes('/clients')) return 'view_clients';
    if (path.includes('/campaigns')) return 'view_campaigns';
    if (path.includes('/assets')) return 'view_assets';
  }

  if (method === 'PUT' || method === 'PATCH') {
    if (path.includes('/clients')) return 'update_client';
    if (path.includes('/campaigns')) return 'update_campaign';
    if (path.includes('/profile')) return 'update_profile';
  }

  if (method === 'DELETE') {
    if (path.includes('/clients')) return 'delete_client';
    if (path.includes('/campaigns')) return 'delete_campaign';
    if (path.includes('/assets')) return 'delete_asset';
  }

  return null;
}

export default withMetrics;
