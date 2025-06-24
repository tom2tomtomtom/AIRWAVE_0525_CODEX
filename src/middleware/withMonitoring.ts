/**
 * Comprehensive Monitoring Middleware for AIRWAVE
 * Combines metrics collection, alerting, and performance tracking
 * Auto-instruments API endpoints with monitoring capabilities
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { withMetrics } from './withMetrics';
import { metrics } from '@/lib/monitoring/metrics-collector';
import { alerting } from '@/lib/monitoring/alerting-system';
import { performanceDashboard } from '@/lib/monitoring/performance-dashboard';

// Monitoring configuration
interface MonitoringConfig {
  collectMetrics?: boolean;
  trackPerformance?: boolean;
  enableAlerting?: boolean;
  customTags?: Record<string, string>;
  samplingRate?: number;
  performanceThresholds?: {
    responseTime?: number;
    errorRate?: number;
    memoryUsage?: number;
  };
}

// Default configuration
const DEFAULT_CONFIG: Required<MonitoringConfig> = {
    collectMetrics: true,
  trackPerformance: true,
  enableAlerting: true,
  customTags: {},
  samplingRate: 1.0,
  performanceThresholds: {},
  responseTime: 2000, // 2 seconds
    errorRate: 0.05, // 5%
    memoryUsage: 0.8, // 80% };

/**
 * Comprehensive monitoring middleware that provides:
 * - Automatic metrics collection
 * - Performance tracking
 * - Error monitoring
 * - Alert triggering
 * - Dashboard integration
 */
export function withMonitoring(config: MonitoringConfig = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return function monitoringMiddleware(
    handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void
  ) {
    // First apply metrics collection if enabled
    let wrappedHandler = handler;
    
    if (finalConfig.collectMetrics) {
      wrappedHandler = withMetrics({
        customTags: finalConfig.customTags,
        samplingRate: finalConfig.samplingRate})(wrappedHandler);
    }

    return async function (req: NextApiRequest, res: NextApiResponse) {
      const startTime = Date.now();
      const endpoint = req.url || '';
      const method = req.method || 'GET';

      // Track request start for performance monitoring
      if (finalConfig.trackPerformance) {
        trackRequestStart(endpoint, method, finalConfig.customTags);
      }

      // Monitor system resources
      if (finalConfig.enableAlerting) {
        await monitorSystemHealth(finalConfig.performanceThresholds);
      }

      try {
        // Execute the wrapped handler
        await wrappedHandler(req, res);

        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;

        // Track completion metrics
        if (finalConfig.trackPerformance) {
          trackRequestCompletion(endpoint, method, statusCode, duration, finalConfig);
        }

        // Check performance thresholds and trigger alerts if needed
        if (finalConfig.enableAlerting) {
          await checkPerformanceThresholds(endpoint, duration, statusCode, finalConfig.performanceThresholds);
        }

      } catch (error) {
        const duration = Date.now() - startTime;

        // Track error metrics
        if (finalConfig.collectMetrics) {
          trackError(endpoint, method, error, finalConfig.customTags);
        }

        // Trigger error alerts
        if (finalConfig.enableAlerting) {
          await triggerErrorAlert(endpoint, error);
        }

        throw error;
      }
    };
  };
}

/**
 * Track request initiation for performance monitoring
 */
function trackRequestStart(endpoint: string, method: string, customTags: Record<string, string>): void {
  const tags = {
    endpoint: sanitizeEndpoint(endpoint),
    method,
    ...customTags};

  // Update dashboard with real-time data
  performanceDashboard.updateMetric('api.requests.active', 1);
  performanceDashboard.updateMetric('api.requests.rate', 1);
}

/**
 * Track request completion with comprehensive metrics
 */
function trackRequestCompletion(
  endpoint: string,
  method: string,
  statusCode: number,
  duration: number,
  config: Required<MonitoringConfig>
): void {
  const sanitizedEndpoint = sanitizeEndpoint(endpoint);
  const isError = statusCode >= 400;
  const isSuccess = statusCode >= 200 && statusCode < 400;

  const tags = {
    endpoint: sanitizedEndpoint,
    method,
    status_code: statusCode.toString(),
    ...config.customTags};

  // Update performance dashboard
  performanceDashboard.updateMetric('api.requests.duration', duration);
  performanceDashboard.updateMetric('api.requests.total', 1);

  if (isError) {
    performanceDashboard.updateMetric('api.requests.errors', 1);
  }

  if (isSuccess) {
    performanceDashboard.updateMetric('api.requests.success', 1);
  }

  // Track endpoint-specific performance
  const endpointMetricName = `api.endpoints.${sanitizedEndpoint}.duration`;
  performanceDashboard.updateMetric(endpointMetricName, duration);

  // Update alerting system for threshold monitoring
  alerting.updateMetric('api.requests.duration', duration);
  alerting.updateMetric('api.requests.error_rate', isError ? 1 : 0);

  // Calculate and update error rate
  updateErrorRate(sanitizedEndpoint, isError);

  // Track slow requests
  if (duration > config.performanceThresholds.responseTime) {
    metrics.counter('api.requests.slow', 1, { ...tags, threshold: config.performanceThresholds.responseTime.toString() });
  }

  // Track by endpoint category
  trackEndpointCategory(sanitizedEndpoint, duration, statusCode, tags);
}

/**
 * Track errors with detailed context
 */
function trackError(
  endpoint: string,
  method: string,
  error: unknown,
  customTags: Record<string, string>
): void {
  const tags = {
    endpoint: sanitizeEndpoint(endpoint),
    method,
    error_type: error.constructor.name,
    error_code: error.code || 'unknown',
    ...customTags};

  // Update dashboard and alerting
  performanceDashboard.updateMetric('api.errors.total', 1);
  alerting.updateMetric('api.errors.total', 1);

  // Track specific error types
  metrics.counter('api.errors.by_type', 1, { ...tags, type: error.constructor.name });

  // Track error patterns
  if (error.message) {
    const errorPattern = categorizeError(error.message);
    metrics.counter('api.errors.by_pattern', 1, { ...tags, pattern: errorPattern });
  }
}

/**
 * Monitor system health proactively
 */
async function monitorSystemHealth(thresholds: Required<MonitoringConfig>['performanceThresholds']): Promise<void> {
  try {
    // Check memory usage (simplified - in production use actual system metrics)
    const memoryUsage = process.memoryUsage();
    const heapUsedPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;

    // Update system metrics
    performanceDashboard.updateMetric('system.memory.heap_used', memoryUsage.heapUsed);
    performanceDashboard.updateMetric('system.memory.heap_total', memoryUsage.heapTotal);
    performanceDashboard.updateMetric('system.memory.usage_percent', heapUsedPercent);

    // Update alerting system
    alerting.updateMetric('system.memory.usage_percent', heapUsedPercent);

    // Check if memory threshold is exceeded
    if (heapUsedPercent > thresholds.memoryUsage) {
      metrics.counter('system.memory.threshold_exceeded', 1, {
        threshold: thresholds.memoryUsage.toString(),
        current: heapUsedPercent.toString()});
    }

    // Monitor event loop lag (simplified)
    const eventLoopStart = process.hrtime();
    setImmediate(() => {
      const eventLoopLag = process.hrtime(eventLoopStart);
      const lagMs = eventLoopLag[0] * 1000 + eventLoopLag[1] / 1e6;
      
      performanceDashboard.updateMetric('system.event_loop.lag', lagMs);
      alerting.updateMetric('system.event_loop.lag', lagMs);
    });

  } catch (error) {
    console.error('System health monitoring error:', error);
  }
}

/**
 * Check performance thresholds and trigger alerts
 */
async function checkPerformanceThresholds(
  endpoint: string,
  duration: number,
  statusCode: number,
  thresholds: Required<MonitoringConfig>['performanceThresholds']
): Promise<void> {
  const sanitizedEndpoint = sanitizeEndpoint(endpoint);

  // Check response time threshold
  if (duration > thresholds.responseTime) {
    metrics.counter('alerts.performance.slow_response', 1, {
      endpoint: sanitizedEndpoint,
      duration: duration.toString(),
      threshold: thresholds.responseTime.toString()});
  }

  // Update endpoint-specific error rates for alerting
  const errorRateMetric = `api.endpoints.${sanitizedEndpoint}.error_rate`;
  const isError = statusCode >= 400;
  alerting.updateMetric(errorRateMetric, isError ? 1 : 0);
}

/**
 * Trigger error-specific alerts
 */
async function triggerErrorAlert(endpoint: string, error: unknown): Promise<void> {
  const severity = determineErrorSeverity(error);
  const sanitizedEndpoint = sanitizeEndpoint(endpoint);

  metrics.counter('alerts.errors.triggered', 1, {
    endpoint: sanitizedEndpoint,
    error_type: error.constructor.name,
    severity});

  // For critical errors, immediately update alerting system
  if (severity === 'critical') {
    alerting.updateMetric('system.critical_errors', 1);
  }
}

/**
 * Update rolling error rate for an endpoint
 */
function updateErrorRate(endpoint: string, isError: boolean): void {
  const errorRateKey = `error_rate:${endpoint}`;
  
  // In a real implementation, this would use a sliding window
  // For now, we'll update the metrics for alerting
  const value = isError ? 1 : 0;
  alerting.updateMetric(`api.endpoints.${endpoint}.errors`, value);
  performanceDashboard.updateMetric(`api.endpoints.${endpoint}.error_rate`, value);
}

/**
 * Track metrics by endpoint category
 */
function trackEndpointCategory(
  endpoint: string,
  duration: number,
  statusCode: number,
  baseTags: Record<string, string>
): void {
  const category = categorizeEndpoint(endpoint);
  
  const categoryTags = {
    ...baseTags,
    category};

  metrics.timer(`api.categories.${category}.duration`, duration, categoryTags);
  metrics.counter(`api.categories.${category}.requests`, 1, categoryTags);

  if (statusCode >= 400) {
    metrics.counter(`api.categories.${category}.errors`, 1, categoryTags);
  }

  // Update dashboard with category metrics
  performanceDashboard.updateMetric(`api.categories.${category}.duration`, duration);
  performanceDashboard.updateMetric(`api.categories.${category}.requests`, 1);
}

/**
 * Categorize API endpoints for better organization
 */
function categorizeEndpoint(endpoint: string): string {
  const path = endpoint.toLowerCase();

  if (path.includes('/auth/')) return 'authentication';
  if (path.includes('/ai/') || path.includes('/flow/')) return 'ai_services';
  if (path.includes('/video/') || path.includes('/render/')) return 'video_generation';
  if (path.includes('/assets/') || path.includes('/upload/')) return 'asset_management';
  if (path.includes('/clients/')) return 'client_management';
  if (path.includes('/campaigns/')) return 'campaign_management';
  if (path.includes('/monitoring/') || path.includes('/health/')) return 'system_monitoring';
  if (path.includes('/v2/')) return 'api_v2';
  
  return 'other';
}

/**
 * Categorize errors for better tracking
 */
function categorizeError(errorMessage: string): string {
  const message = errorMessage.toLowerCase();

  if (message.includes('validation') || message.includes('invalid')) return 'validation';
  if (message.includes('auth') || message.includes('permission')) return 'authentication';
  if (message.includes('database') || message.includes('sql')) return 'database';
  if (message.includes('network') || message.includes('timeout')) return 'network';
  if (message.includes('ai') || message.includes('openai') || message.includes('anthropic')) return 'ai_service';
  if (message.includes('video') || message.includes('render')) return 'video_processing';
  if (message.includes('file') || message.includes('upload')) return 'file_processing';
  if (message.includes('rate limit')) return 'rate_limiting';
  
  return 'unknown';
}

/**
 * Determine error severity for alerting
 */
function determineErrorSeverity(error: unknown): string {
  // Critical errors that require immediate attention
  if (error.name === 'DatabaseConnectionError') return 'critical';
  if (error.name === 'SecurityError') return 'critical';
  if (error.message?.includes('out of memory')) return 'critical';

  // High priority errors
  if (error.name === 'AuthenticationError') return 'high';
  if (error.name === 'PaymentError') return 'high';
  if (error.status >= 500) return 'high';

  // Medium priority errors
  if (error.name === 'ValidationError') return 'medium';
  if (error.status >= 400 && error.status < 500) return 'medium';

  // Low priority errors
  return 'low';
}

/**
 * Sanitize endpoint for consistent metric naming
 */
function sanitizeEndpoint(url: string): string {
  return url
    .split('?')[0] // Remove query parameters
    .replace(/\/\d+/g, '/:id') // Replace numeric IDs
    .replace(/\/[a-f0-9-]{36}/g, '/:uuid') // Replace UUIDs
    .replace(/\/[a-zA-Z0-9_-]{20}/g, '/:token') // Replace long tokens
    .replace(/[^a-zA-Z0-9\/._-]/g, '_') // Replace special characters
    .toLowerCase();
}

/**
 * Enhanced monitoring for specific endpoint types
 */
export function withAIMonitoring(config: MonitoringConfig = {}) {
  return withMonitoring({
    ...config,
    customTags: { }
      ...config.customTags,
      service_type: 'ai' },
  performanceThresholds: {},
  responseTime: 30000, // AI operations can take longer
      errorRate: 0.1, // Higher error tolerance for AI
      memoryUsage: 0.9, // AI operations are memory intensive
      ...config.performanceThresholds });
}

export function withVideoMonitoring(config: MonitoringConfig = {}) {
  return withMonitoring({
    ...config,
    customTags: { }
      ...config.customTags,
      service_type: 'video' },
  performanceThresholds: {},
  responseTime: 60000, // Video operations take longer
      errorRate: 0.05,
      memoryUsage: 0.85,
      ...config.performanceThresholds });
}

export function withDatabaseMonitoring(config: MonitoringConfig = {}) {
  return withMonitoring({
    ...config,
    customTags: { }
      ...config.customTags,
      service_type: 'database' },
  performanceThresholds: {},
  responseTime: 1000, // Database operations should be fast
      errorRate: 0.01, // Very low error tolerance
      memoryUsage: 0.8,
      ...config.performanceThresholds });
}

export default withMonitoring;