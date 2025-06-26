/**
 * Comprehensive Metrics Collection System for AIRWAVE
 * Collects application metrics, performance data, and business metrics
 * Supports multiple backends: StatsD, Prometheus, CloudWatch
 */

import { performance } from 'perf_hooks';
import { loggers } from '@/lib/logger';


// Metric types
export interface Metric {
  name: string;
  value: number;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  tags?: Record<string, string>;
  timestamp?: number;
}

export interface TimerMetric {
  name: string;
  startTime: number;
  tags?: Record<string, string>;
}

// Metric backends
export interface MetricsBackend {
  name: string;
  send(metric: Metric): Promise<void>;
  sendBatch(metrics: Metric[]): Promise<void>;
  isHealthy(): Promise<boolean>;
}

// StatsD backend implementation
class StatsDBackend implements MetricsBackend {
  name = 'statsd';
  private client: any = null;

  constructor() {
    // Conditional import for server-side only
    if (typeof window === 'undefined') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const StatsD = require('hot-shots');
        this.client = new StatsD({
          host: process.env.STATSD_HOST || 'localhost',
          port: parseInt(process.env.STATSD_PORT || '8125'),
          prefix: 'airwave.',
          globalTags: {
            env: process.env.NODE_ENV || 'development',
            service: 'airwave-web',
          },
        });
      } catch (error) {
        console.warn('StatsD client not available:', error.message);
      }
    }
  }

  async send(metric: Metric): Promise<void> {
    if (!this.client) return;

    try {
      const tags = this.formatTags(metric.tags);

      switch (metric.type) {
        case 'counter':
          this.client.increment(metric.name, metric.value, tags);
          break;
        case 'gauge':
          this.client.gauge(metric.name, metric.value, tags);
          break;
        case 'histogram':
          this.client.histogram(metric.name, metric.value, tags);
          break;
        case 'timer':
          this.client.timing(metric.name, metric.value, tags);
          break;
      }
    } catch (error) {
      console.error('Failed to send metric to StatsD:', error);
    }
  }

  async sendBatch(metrics: Metric[]): Promise<void> {
    for (const metric of metrics) {
      await this.send(metric);
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.client !== null;
  }

  private formatTags(tags?: Record<string, string>): string[] {
    if (!tags) return [];
    return Object.entries(tags).map(([key, value]) => `${key}:${value}`);
  }
}

// Console backend for development
class ConsoleBackend implements MetricsBackend {
  name = 'console';

  async send(metric: Metric): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[METRIC] ${metric.type.toUpperCase()}: ${metric.name} = ${metric.value}`,
        metric.tags
      );
    }
  }

  async sendBatch(metrics: Metric[]): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      loggers.general.error(`[METRICS BATCH] ${metrics.length} metrics:`, metrics);
    }
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }
}

// Custom webhook backend for external services
class WebhookBackend implements MetricsBackend {
  name = 'webhook';
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async send(metric: Metric): Promise<void> {
    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics: [metric],
          timestamp: new Date().toISOString(),
          service: 'airwave-web',
        }),
      });
    } catch (error) {
      console.error('Failed to send metric to webhook:', error);
    }
  }

  async sendBatch(metrics: Metric[]): Promise<void> {
    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics,
          timestamp: new Date().toISOString(),
          service: 'airwave-web',
        }),
      });
    } catch (error) {
      console.error('Failed to send metrics batch to webhook:', error);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(this.webhookUrl, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Main metrics collector class
export class MetricsCollector {
  private static instance: MetricsCollector;
  private backends: MetricsBackend[] = [];
  private metricBuffer: Metric[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly bufferSize = 100;
  private readonly flushIntervalMs = 5000; // 5 seconds

  private constructor() {
    this.initializeBackends();
    this.startBufferFlush();
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  private initializeBackends(): void {
    // Always add console backend for development
    this.backends.push(new ConsoleBackend());

    // Add StatsD backend if configured
    if (process.env.STATSD_HOST) {
      this.backends.push(new StatsDBackend());
    }

    // Add webhook backend if configured
    if (process.env.METRICS_WEBHOOK_URL) {
      this.backends.push(new WebhookBackend(process.env.METRICS_WEBHOOK_URL));
    }
  }

  private startBufferFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, this.flushIntervalMs);
  }

  private async flushBuffer(): Promise<void> {
    if (this.metricBuffer.length === 0) return;

    const metricsToFlush = [...this.metricBuffer];
    this.metricBuffer = [];

    for (const backend of this.backends) {
      try {
        await backend.sendBatch(metricsToFlush);
      } catch (error) {
        console.error(`Failed to flush metrics to ${backend.name}:`, error);
      }
    }
  }

  // Core metric methods
  public counter(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.addMetric({
      name,
      value,
      type: 'counter',
      tags,
      timestamp: Date.now(),
    });
  }

  public gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.addMetric({
      name,
      value,
      type: 'gauge',
      tags,
      timestamp: Date.now(),
    });
  }

  public histogram(name: string, value: number, tags?: Record<string, string>): void {
    this.addMetric({
      name,
      value,
      type: 'histogram',
      tags,
      timestamp: Date.now(),
    });
  }

  public timer(name: string, value: number, tags?: Record<string, string>): void {
    this.addMetric({
      name,
      value,
      type: 'timer',
      tags,
      timestamp: Date.now(),
    });
  }

  // Timer helpers
  public startTimer(name: string, tags?: Record<string, string>): TimerMetric {
    return {
      name,
      startTime: performance.now(),
      tags,
    };
  }

  public endTimer(timerMetric: TimerMetric): void {
    const duration = performance.now() - timerMetric.startTime;
    this.timer(timerMetric.name, duration, timerMetric.tags);
  }

  // Business metrics helpers
  public trackAPIRequest(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number
  ): void {
    const tags = {
      method,
      endpoint: this.sanitizeEndpoint(endpoint),
      status_code: statusCode.toString(),
      status_class: `${Math.floor(statusCode / 100)}xx`,
    };

    this.counter('api.requests.total', 1, tags);
    this.timer('api.requests.duration', duration, tags);

    if (statusCode >= 400) {
      this.counter('api.requests.errors', 1, tags);
    }
  }

  public trackAIUsage(
    provider: string,
    model: string,
    tokens: number,
    cost: number,
    operation: string
  ): void {
    const tags = { provider, model, operation };

    this.counter('ai.requests.total', 1, tags);
    this.counter('ai.tokens.used', tokens, tags);
    this.gauge('ai.cost.total', cost, tags);
    this.histogram('ai.tokens.per_request', tokens, tags);
  }

  public trackDatabaseQuery(
    table: string,
    operation: string,
    duration: number,
    rows?: number
  ): void {
    const tags = { table, operation };

    this.counter('database.queries.total', 1, tags);
    this.timer('database.queries.duration', duration, tags);

    if (rows !== undefined) {
      this.histogram('database.queries.rows', rows, tags);
    }
  }

  public trackCacheOperation(
    key: string,
    operation: 'hit' | 'miss' | 'set' | 'delete',
    duration?: number
  ): void {
    const tags = { operation, key_type: this.getCacheKeyType(key) };

    this.counter(`cache.operations.${operation}`, 1, tags);

    if (duration !== undefined) {
      this.timer('cache.operations.duration', duration, tags);
    }
  }

  public trackVideoGeneration(
    status: 'started' | 'completed' | 'failed',
    duration?: number,
    templateId?: string
  ): void {
    const tags: Record<string, string> = { status };
    if (templateId) tags.template_id = templateId;

    this.counter('video.generation.total', 1, tags);

    if (duration !== undefined) {
      this.timer('video.generation.duration', duration, tags);
    }
  }

  public trackUserAction(action: string, userId?: string, clientId?: string): void {
    const tags: Record<string, string> = { action };
    if (userId) tags.user_id = userId;
    if (clientId) tags.client_id = clientId;

    this.counter('user.actions.total', 1, tags);
  }

  public trackFileUpload(fileType: string, fileSize: number, status: 'success' | 'failed'): void {
    const tags = { file_type: fileType, status };

    this.counter('uploads.total', 1, tags);
    this.histogram('uploads.file_size', fileSize, tags);
  }

  public trackSystemHealth(
    component: string,
    status: 'healthy' | 'unhealthy',
    responseTime?: number
  ): void {
    const tags = { component, status };

    this.gauge(`system.health.${component}`, status === 'healthy' ? 1 : 0, tags);

    if (responseTime !== undefined) {
      this.timer(`system.health.${component}.response_time`, responseTime, tags);
    }
  }

  // Utility methods
  private addMetric(metric: Metric): void {
    this.metricBuffer.push(metric);

    // Force flush if buffer is full
    if (this.metricBuffer.length >= this.bufferSize) {
      this.flushBuffer();
    }
  }

  private sanitizeEndpoint(endpoint: string): string {
    // Replace dynamic segments with placeholders
    return endpoint
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
      .replace(/\/[a-zA-Z0-9_-]{20}/g, '/:token');
  }

  private getCacheKeyType(key: string): string {
    if (key.startsWith('user:')) return 'user';
    if (key.startsWith('client:')) return 'client';
    if (key.startsWith('session:')) return 'session';
    if (key.startsWith('ai:')) return 'ai';
    return 'other';
  }

  // Health check for all backends
  public async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const backend of this.backends) {
      health[backend.name] = await backend.isHealthy();
    }

    return health;
  }

  // Force flush all metrics
  public async flush(): Promise<void> {
    await this.flushBuffer();
  }

  // Cleanup
  public destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flushBuffer();
  }
}

// Global metrics instance
export const metrics = MetricsCollector.getInstance();

// Helper decorators for automatic metrics
export function trackExecutionTime(metricName: string, tags?: Record<string, string>) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const timer = metrics.startTimer(metricName, tags);
      try {
        const result = await method.apply(this, args);
        metrics.endTimer(timer);
        return result;
      } catch (error) {
        metrics.endTimer(timer);
        metrics.counter(`${metricName}.errors`, 1, tags);
        throw error;
      }
    };

    return descriptor;
  };
}

export default MetricsCollector;
