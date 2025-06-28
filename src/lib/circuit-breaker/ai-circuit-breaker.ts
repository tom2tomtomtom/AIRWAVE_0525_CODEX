/**
 * Circuit Breaker Pattern for AI Services
 * Prevents cascading failures and provides graceful degradation
 */

import { redisManager } from '@/lib/redis/redis-config';
import { loggers } from '@/lib/logger';

interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
}

enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Circuit is open, calls are rejected
  HALF_OPEN = 'HALF_OPEN', // Testing if service has recovered
}

interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  totalCalls: number;
  rejectedCalls: number;
}

export class AICircuitBreaker {
  private static instance: AICircuitBreaker;
  private useRedis = false;
  private localStats = new Map<string, CircuitBreakerStats>();

  // Default configurations for different AI services
  private configs: Record<string, CircuitBreakerConfig> = {
    openai: {
      failureThreshold: 5, // Open after 5 failures
      recoveryTimeout: 60000, // 1 minute recovery timeout
      monitoringPeriod: 300000, // 5 minute monitoring window
      halfOpenMaxCalls: 3, // Allow 3 test calls in half-open state
    },
    anthropic: {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      monitoringPeriod: 300000,
      halfOpenMaxCalls: 3,
    },
    elevenlabs: {
      failureThreshold: 3, // More sensitive for voice services
      recoveryTimeout: 30000, // Shorter recovery timeout
      monitoringPeriod: 180000, // 3 minute monitoring window
      halfOpenMaxCalls: 2,
    },
    default: {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      monitoringPeriod: 300000,
      halfOpenMaxCalls: 3,
    },
  };

  static getInstance(): AICircuitBreaker {
    if (!AICircuitBreaker.instance) {
      AICircuitBreaker.instance = new AICircuitBreaker();
    }
    return AICircuitBreaker.instance;
  }

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.useRedis = await redisManager.isAvailable();
      if (this.useRedis) {
        loggers.general.error('✅ AI Circuit Breaker using Redis for distributed state');
      } else {
        loggers.general.error('⚠️ AI Circuit Breaker using local state (Redis unavailable)');
      }
    } catch (error: any) {
      console.warn('AI Circuit Breaker Redis initialization failed:', error);
      this.useRedis = false;
    }
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    service: string,
    operation: string,
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const circuitKey = `${service}:${operation}`;
    const config = this.configs[service] || this.configs.default;

    // Check circuit state
    const stats = await this.getStats(circuitKey);
    const state = await this.determineState(stats, config!);

    // Update stats
    await this.incrementTotalCalls(circuitKey);

    switch (state) {
      case CircuitState.OPEN:
        await this.incrementRejectedCalls(circuitKey);
        console.warn(`🚫 Circuit breaker OPEN for ${circuitKey} - rejecting call`);

        if (fallback) {
          loggers.general.error(`🔄 Using fallback for ${circuitKey}`);
          return await fallback();
        }

        throw new Error(`Service ${circuitKey} is currently unavailable (circuit breaker open)`);

      case CircuitState.HALF_OPEN:
        // Allow limited calls to test service recovery
        const halfOpenCalls = await this.getHalfOpenCalls(circuitKey);
        if (config && halfOpenCalls >= config.halfOpenMaxCalls) {
          await this.incrementRejectedCalls(circuitKey);
          console.warn(`🚫 Circuit breaker HALF_OPEN for ${circuitKey} - max test calls reached`);

          if (fallback) {
            return await fallback();
          }

          throw new Error(
            `Service ${circuitKey} is being tested for recovery (circuit breaker half-open)`
          );
        }

        await this.incrementHalfOpenCalls(circuitKey);
        loggers.general.error(
          `🔍 Circuit breaker HALF_OPEN for ${circuitKey} - testing service recovery`
        );
        break;

      case CircuitState.CLOSED:
        // Normal operation
        break;
    }

    // Execute the function
    try {
      const result = await fn();
      await this.recordSuccess(circuitKey);
      return result;
    } catch (error: any) {
      await this.recordFailure(circuitKey);
      throw error;
    }
  }

  /**
   * Get circuit breaker statistics
   */
  private async getStats(circuitKey: string): Promise<CircuitBreakerStats> {
    if (this.useRedis) {
      try {
        const stats = await redisManager.hget<CircuitBreakerStats>(
          'circuit_breaker_stats',
          circuitKey
        );
        if (stats) {
          return stats;
        }
      } catch (error: any) {
        console.error('Error getting circuit breaker stats from Redis:', error);
      }
    }

    // Fallback to local stats
    return (
      this.localStats.get(circuitKey) || {
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastFailureTime: 0,
        lastSuccessTime: 0,
        totalCalls: 0,
        rejectedCalls: 0,
      }
    );
  }

  /**
   * Update circuit breaker statistics
   */
  private async updateStats(circuitKey: string, stats: CircuitBreakerStats): Promise<void> {
    if (this.useRedis) {
      try {
        await redisManager.hset('circuit_breaker_stats', circuitKey, stats);
        await redisManager.expire('circuit_breaker_stats', 24 * 60 * 60); // 24 hours TTL
      } catch (error: any) {
        console.error('Error updating circuit breaker stats in Redis:', error);
      }
    }

    // Always update local stats as fallback
    this.localStats.set(circuitKey, stats);
  }

  /**
   * Determine current circuit state
   */
  private async determineState(
    stats: CircuitBreakerStats,
    config: CircuitBreakerConfig
  ): Promise<CircuitState> {
    const now = Date.now();

    switch (stats.state) {
      case CircuitState.CLOSED:
        // Check if we should open the circuit
        if (stats.failureCount >= config.failureThreshold) {
          const timeSinceLastFailure = now - stats.lastFailureTime;
          if (timeSinceLastFailure <= config.monitoringPeriod) {
            return CircuitState.OPEN;
          }
        }
        return CircuitState.CLOSED;

      case CircuitState.OPEN:
        // Check if we should move to half-open
        const timeSinceLastFailure = now - stats.lastFailureTime;
        if (timeSinceLastFailure >= config.recoveryTimeout) {
          return CircuitState.HALF_OPEN;
        }
        return CircuitState.OPEN;

      case CircuitState.HALF_OPEN:
        // Stay in half-open until we get enough successful calls or failures
        return CircuitState.HALF_OPEN;

      default:
        return CircuitState.CLOSED;
    }
  }

  /**
   * Record a successful operation
   */
  private async recordSuccess(circuitKey: string): Promise<void> {
    const stats = await this.getStats(circuitKey);
    const now = Date.now();

    stats.successCount++;
    stats.lastSuccessTime = now;

    // If we're in half-open state and have enough successes, close the circuit
    if (stats.state === CircuitState.HALF_OPEN) {
      const config = this.getConfigForKey(circuitKey);
      if (stats.successCount >= config.halfOpenMaxCalls) {
        stats.state = CircuitState.CLOSED;
        stats.failureCount = 0; // Reset failure count
        loggers.general.error(`✅ Circuit breaker CLOSED for ${circuitKey} - service recovered`);
      }
    }

    await this.updateStats(circuitKey, stats);
  }

  /**
   * Record a failed operation
   */
  private async recordFailure(circuitKey: string): Promise<void> {
    const stats = await this.getStats(circuitKey);
    const now = Date.now();
    const config = this.getConfigForKey(circuitKey);

    stats.failureCount++;
    stats.lastFailureTime = now;

    // Check if we should open the circuit
    if (stats.state === CircuitState.CLOSED && stats.failureCount >= config.failureThreshold) {
      stats.state = CircuitState.OPEN;
      console.warn(`🚨 Circuit breaker OPENED for ${circuitKey} - failure threshold reached`);
    } else if (stats.state === CircuitState.HALF_OPEN) {
      // If we fail in half-open state, go back to open
      stats.state = CircuitState.OPEN;
      console.warn(`🚨 Circuit breaker back to OPEN for ${circuitKey} - recovery test failed`);
    }

    await this.updateStats(circuitKey, stats);
  }

  /**
   * Get configuration for a circuit key
   */
  private getConfigForKey(circuitKey: string): CircuitBreakerConfig {
    const service = circuitKey.split(':')[0];
    const config = this.configs[service!] || this.configs['default'];
    if (!config) {
      throw new Error(`No circuit breaker config found for service: ${service}`);
    }
    return config;
  }

  /**
   * Increment total calls counter
   */
  private async incrementTotalCalls(circuitKey: string): Promise<void> {
    const stats = await this.getStats(circuitKey);
    stats.totalCalls++;
    await this.updateStats(circuitKey, stats);
  }

  /**
   * Increment rejected calls counter
   */
  private async incrementRejectedCalls(circuitKey: string): Promise<void> {
    const stats = await this.getStats(circuitKey);
    stats.rejectedCalls++;
    await this.updateStats(circuitKey, stats);
  }

  /**
   * Get half-open calls count
   */
  private async getHalfOpenCalls(circuitKey: string): Promise<number> {
    if (this.useRedis) {
      try {
        const count = await redisManager.get<number>(`half_open_calls:${circuitKey}`);
        return count || 0;
      } catch (error: any) {
        console.error('Error getting half-open calls from Redis:', error);
      }
    }
    return 0; // Fallback for local implementation
  }

  /**
   * Increment half-open calls counter
   */
  private async incrementHalfOpenCalls(circuitKey: string): Promise<void> {
    if (this.useRedis) {
      try {
        await redisManager.incr(`half_open_calls:${circuitKey}`);
        await redisManager.expire(`half_open_calls:${circuitKey}`, 300); // 5 minutes TTL
      } catch (error: any) {
        console.error('Error incrementing half-open calls in Redis:', error);
      }
    }
  }

  /**
   * Get current circuit breaker status for all services
   */
  async getStatus(): Promise<
    Record<string, CircuitBreakerStats & { config: CircuitBreakerConfig }>
  > {
    const status: Record<string, CircuitBreakerStats & { config: CircuitBreakerConfig }> = {};

    if (this.useRedis) {
      try {
        const client = await redisManager.getClient();
        const allStats = await client.hgetall('circuit_breaker_stats');

        for (const [key, statsJson] of Object.entries(allStats)) {
          try {
            const stats = JSON.parse(statsJson);
            status[key] = {
              ...stats,
              config: this.getConfigForKey(key),
            };
          } catch (error: any) {
            console.error(`Error parsing stats for ${key}:`, error);
          }
        }
      } catch (error: any) {
        console.error('Error getting circuit breaker status from Redis:', error);
      }
    }

    // Include local stats
    for (const [key, stats] of this.localStats.entries()) {
      if (!status[key]) {
        status[key] = {
          ...stats,
          config: this.getConfigForKey(key),
        };
      }
    }

    return status;
  }

  /**
   * Reset circuit breaker for a specific service
   */
  async reset(circuitKey: string): Promise<void> {
    const resetStats: CircuitBreakerStats = {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      totalCalls: 0,
      rejectedCalls: 0,
    };

    await this.updateStats(circuitKey, resetStats);

    if (this.useRedis) {
      try {
        await redisManager.del(`half_open_calls:${circuitKey}`);
      } catch (error: any) {
        console.error('Error resetting half-open calls in Redis:', error);
      }
    }

    loggers.general.error(`🔄 Circuit breaker reset for ${circuitKey}`);
  }

  /**
   * Update configuration for a service
   */
  updateConfig(service: string, config: Partial<CircuitBreakerConfig>): void {
    this.configs[service] = {
      ...(this.configs[service] || this.configs.default),
      ...config,
    } as CircuitBreakerConfig;
  }
}

// Export singleton instance
export const aiCircuitBreaker = AICircuitBreaker.getInstance();

// Export types and enums
export { CircuitState };
export type { CircuitBreakerConfig, CircuitBreakerStats };
