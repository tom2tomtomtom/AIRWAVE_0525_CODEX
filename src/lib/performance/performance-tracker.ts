/**
 * Production Performance Tracker
 * Provides performance monitoring with Redis persistence for production use
 */

// Conditional Redis import for server-side only
let redisManager: any = null;
if (typeof window === 'undefined') {
  try {
    redisManager = require('@/lib/redis/redis-config').redisManager;
  } catch (error: any) {
    // Redis not available, will fallback to in-memory
    console.warn('Redis not available, using in-memory performance tracking');
  }
}

interface PerformanceMetric {
  operationName: string;
  duration: number;
  timestamp: number;
  userId?: string;
  metadata?: Record<string, any>;
}

export class ProductionPerformanceTracker {
  private static instance: ProductionPerformanceTracker;
  private timers: Map<string, number> = new Map();
  private useRedis = false;

  private constructor() {
    this.initializeRedis();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ProductionPerformanceTracker {
    if (!ProductionPerformanceTracker.instance) {
      ProductionPerformanceTracker.instance = new ProductionPerformanceTracker();
    }
    return ProductionPerformanceTracker.instance;
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      this.useRedis = await redisManager.isAvailable();
      if (this.useRedis) {
        // eslint-disable-next-line no-console
        console.log('✅ Performance tracker using Redis for persistence');
      } else {
        // eslint-disable-next-line no-console
        console.log('⚠️ Performance tracker using in-memory storage (Redis unavailable)');
      }
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.warn('Performance tracker Redis initialization failed:', error);
      this.useRedis = false;
    }
  }

  /**
   * Start timing an operation
   */
  public start(operationName: string, userId?: string, metadata?: Record<string, any>): void {
    const key = this.getTimerKey(operationName, userId);
    const startTime = Date.now();

    this.timers.set(key, startTime);

    // Store additional context for later use
    if (userId || metadata) {
      this.timers.set(`${key}:context`, Date.now()); // Store timestamp as placeholder
    }
  }

  /**
   * End timing an operation and persist the result
   */
  public async end(operationName: string, userId?: string): Promise<number> {
    const key = this.getTimerKey(operationName, userId);
    const startTime = this.timers.get(key);

    if (startTime === undefined) {
      // eslint-disable-next-line no-console
      console.warn(`[Performance] No start time found for: ${operationName}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    const timestamp = Date.now();

    // Get context if available
    const contextKey = `${key}:context`;
    const contextData = this.timers.get(contextKey);
    let context: { userId?: string; metadata?: Record<string, any> } = {};

    if (contextData) {
      // For now, just use the provided userId and metadata
      context = { userId, metadata: {} };
    }

    // Create metric object
    const metric: PerformanceMetric = {
      operationName,
      duration,
      timestamp,
      userId: userId || context.userId,
      metadata: context.metadata };

    // Log the result
    // eslint-disable-next-line no-console
    console.log(`[Performance] ${operationName}: ${duration}ms`);

    // Persist to Redis if available
    if (this.useRedis) {
      await this.persistMetric(metric);
    }

    // Clean up timers
    this.timers.delete(key);
    this.timers.delete(contextKey);

    return duration;
  }

  /**
   * Generate timer key
   */
  private getTimerKey(operationName: string, userId?: string): string {
    return userId ? `${operationName}:${userId}` : operationName;
  }

  /**
   * Persist metric to Redis
   */
  private async persistMetric(metric: PerformanceMetric): Promise<void> {
    try {
      const key = `performance:metrics:${metric.operationName}`;
      const dailyKey = `performance:daily:${new Date().toISOString().split('T')[0]}`;

      // Store individual metric
      await redisManager.lpush(key, metric);

      // Store daily aggregation
      await redisManager.hset(dailyKey, metric.operationName, {
        count: (await redisManager.hget(dailyKey, `${metric.operationName}:count`)) || 0 + 1,
        totalDuration:
          (await redisManager.hget(dailyKey, `${metric.operationName}:total`)) ||
          0 + metric.duration,
        avgDuration: metric.duration, // Will be calculated properly in aggregation
        lastUpdate: metric.timestamp });

      // Set TTL for metrics (30 days)
      await redisManager.expire(key, 30 * 24 * 60 * 60);
      await redisManager.expire(dailyKey, 30 * 24 * 60 * 60);
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error('Failed to persist performance metric:', error);
    }
  }

  /**
   * Measure a function execution time
   */
  public async measure<T>(
    operationName: string,
    fn: () => Promise<T>,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.start(operationName, userId, metadata);
    try {
      const result = await fn();
      await this.end(operationName, userId);
      return result;
    } catch (error: any) {
      await this.end(operationName, userId);
      throw error;
    }
  }

  /**
   * Measure a synchronous function execution time
   */
  public async measureSync<T>(
    operationName: string,
    fn: () => T,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.start(operationName, userId, metadata);
    try {
      const result = fn();
      await this.end(operationName, userId);
      return result;
    } catch (error: any) {
      await this.end(operationName, userId);
      throw error;
    }
  }

  /**
   * Get performance metrics for an operation
   */
  public async getMetrics(
    operationName: string,
    limit: number = 100
  ): Promise<PerformanceMetric[]> {
    if (!this.useRedis) {
      return [];
    }

    try {
      const key = `performance:metrics:${operationName}`;
      const client = await redisManager.getClient();
      const metrics = await client.lrange(key, 0, limit - 1);

      return metrics.map((metric: any) => JSON.parse(metric));
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error('Failed to get performance metrics:', error);
      return [];
    }
  }

  /**
   * Get daily performance summary
   */
  public async getDailySummary(date?: string): Promise<Record<string, any>> {
    if (!this.useRedis) {
      return {};
    }

    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const key = `performance:daily:${targetDate}`;
      const client = await redisManager.getClient();

      return await client.hgetall(key);
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error('Failed to get daily performance summary:', error);
      return {};
    }
  }

  /**
   * Clear all active timers
   */
  public clear(): void {
    this.timers.clear();
  }

  /**
   * Get all active timer names
   */
  public getActiveTimers(): string[] {
    return Array.from(this.timers.keys()).filter((key: any) => !key.includes(':context'));
  }

  /**
   * Record a custom metric
   */
  public async recordMetric(
    operationName: string,
    value: number,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const metric: PerformanceMetric = {
      operationName,
      duration: value,
      timestamp: Date.now(),
      userId,
      metadata};

    // eslint-disable-next-line no-console
    console.log(`[Performance] ${operationName}: ${value}ms`);

    if (this.useRedis) {
      await this.persistMetric(metric);
    }
  }
}

// Export singleton instance for convenience
export const performanceTracker = ProductionPerformanceTracker.getInstance();

// Export types
export type { PerformanceMetric };
