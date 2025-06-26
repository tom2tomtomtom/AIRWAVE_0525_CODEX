import { loggers } from '@/lib/logger';

/**
 * AI Response Caching System
 * Caches expensive AI operations to reduce costs and improve performance
 */

// Conditional imports for server-side only
let crypto: any = null;
let redisManager: any = null;

if (typeof window === 'undefined') {
  try {
    crypto = require('crypto');
    redisManager = require('@/lib/redis/redis-config').redisManager;
  } catch (error: any) {
    // Server dependencies not available, will fallback to in-memory
    console.warn('Server dependencies not available, using fallbacks');
  }
} else {
  // Client-side fallback for crypto
  crypto = {
    createHash: () => ({
      update: () => ({ digest: () => Math.random().toString(36) }) }),
  };
}

interface CacheConfig {
  ttl: number; // Time to live in seconds
  keyPrefix: string;
  enableCompression?: boolean;
}

interface CachedResponse<T = any> {
  data: T;
  timestamp: number;
  version: string;
  metadata?: Record<string, any>;
}

export class AIResponseCache {
  private static instance: AIResponseCache;
  private useRedis = false;
  private memoryCache = new Map<string, CachedResponse>();
  private maxMemoryCacheSize = 1000; // Maximum items in memory cache

  // Cache configurations for different AI operations
  private cacheConfigs: Record<string, CacheConfig> = {
    'generate-motivations': {
      ttl: 24 * 60 * 60, // 24 hours
      keyPrefix: 'ai_cache:motivations',
      enableCompression: true },
    'generate-copy': {
      ttl: 12 * 60 * 60, // 12 hours
      keyPrefix: 'ai_cache:copy',
      enableCompression: true },
    'generate-image': {
      ttl: 7 * 24 * 60 * 60, // 7 days
      keyPrefix: 'ai_cache:image',
      enableCompression: false, // Images are already compressed
    },
    'parse-brief': {
      ttl: 30 * 24 * 60 * 60, // 30 days
      keyPrefix: 'ai_cache:brief',
      enableCompression: true },
  };

  static getInstance(): AIResponseCache {
    if (!AIResponseCache.instance) {
      AIResponseCache.instance = new AIResponseCache();
    }
    return AIResponseCache.instance;
  }

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.useRedis = await redisManager.isAvailable();
      if (this.useRedis) {
        loggers.general.error('✅ AI Response Cache using Redis for persistence');
      } else {
        loggers.general.error('⚠️ AI Response Cache using in-memory storage (Redis unavailable)');
      }
    } catch (error: any) {
      console.warn('AI Response Cache Redis initialization failed:', error);
      this.useRedis = false;
    }
  }

  /**
   * Generate cache key from input parameters
   */
  private generateCacheKey(operation: string, input: any): string {
    const config = this.cacheConfigs[operation];
    if (!config) {
      throw new Error(`No cache configuration found for operation: ${operation}`);
    }

    // Create a deterministic hash of the input
    const inputString = JSON.stringify(input, Object.keys(input).sort());
    const hash = crypto.createHash('sha256').update(inputString).digest('hex');

    return `${config.keyPrefix}:${hash}`;
  }

  /**
   * Get cached response
   */
  async get<T>(operation: string, input: any): Promise<T | null> {
    try {
      const key = this.generateCacheKey(operation, input);
      const config = this.cacheConfigs[operation];

      let cachedResponse: CachedResponse<T> | null = null;

      if (this.useRedis) {
        cachedResponse = await redisManager.get<CachedResponse<T>>(key);
      } else {
        cachedResponse = (this.memoryCache.get(key) as CachedResponse<T>) || null;
      }

      if (!cachedResponse) {
        return null;
      }

      // Check if cache has expired
      const now = Date.now();
      const ageInSeconds = (now - cachedResponse.timestamp) / 1000;

      if (ageInSeconds > config.ttl) {
        // Cache expired, remove it
        await this.delete(operation, input);
        return null;
      }

      loggers.general.error(`🎯 Cache hit for ${operation} (age: ${Math.round(ageInSeconds)}s)`);
      return cachedResponse.data;
    } catch (error: any) {
      console.error('Error getting cached response:', error);
      return null;
    }
  }

  /**
   * Set cached response
   */
  async set<T>(
    operation: string,
    input: any,
    data: T,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      const key = this.generateCacheKey(operation, input);
      const config = this.cacheConfigs[operation];

      const cachedResponse: CachedResponse<T> = {
        data,
        timestamp: Date.now(),
        version: '1.0',
        metadata,
      };

      if (this.useRedis) {
        const success = await redisManager.set(key, cachedResponse, config.ttl);
        if (success) {
          loggers.general.error(`💾 Cached ${operation} response for ${config.ttl}s`);
        }
        return success;
      } else {
        // Memory cache with size limit
        if (this.memoryCache.size >= this.maxMemoryCacheSize) {
          // Remove oldest entries
          const entries = Array.from(this.memoryCache.entries());
          entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
          const toRemove = entries.slice(0, Math.floor(this.maxMemoryCacheSize * 0.1));
          toRemove.forEach(([key]) => this.memoryCache.delete(key));
        }

        this.memoryCache.set(key, cachedResponse);
        loggers.general.error(`💾 Cached ${operation} response in memory`);
        return true;
      }
    } catch (error: any) {
      console.error('Error setting cached response:', error);
      return false;
    }
  }

  /**
   * Delete cached response
   */
  async delete(operation: string, input: any): Promise<boolean> {
    try {
      const key = this.generateCacheKey(operation, input);

      if (this.useRedis) {
        return await redisManager.del(key);
      } else {
        return this.memoryCache.delete(key);
      }
    } catch (error: any) {
      console.error('Error deleting cached response:', error);
      return false;
    }
  }

  /**
   * Check if response is cached
   */
  async exists(operation: string, input: any): Promise<boolean> {
    try {
      const key = this.generateCacheKey(operation, input);

      if (this.useRedis) {
        return await redisManager.exists(key);
      } else {
        return this.memoryCache.has(key);
      }
    } catch (error: any) {
      console.error('Error checking cache existence:', error);
      return false;
    }
  }

  /**
   * Clear all cached responses for an operation
   */
  async clearOperation(operation: string): Promise<number> {
    const config = this.cacheConfigs[operation];
    if (!config) {
      return 0;
    }

    let cleared = 0;

    if (this.useRedis) {
      try {
        const client = await redisManager.getClient();
        const pattern = `${config.keyPrefix}:*`;
        const keys = await client.keys(pattern);

        if (keys.length > 0) {
          cleared = await client.del(...keys);
        }
      } catch (error: any) {
        console.error('Error clearing Redis cache:', error);
      }
    } else {
      // Clear memory cache
      const keysToDelete: string[] = [];
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(config.keyPrefix)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach((key: any) => this.memoryCache.delete(key));
      cleared = keysToDelete.length;
    }

    loggers.general.error(`🗑️ Cleared ${cleared} cached responses for ${operation}`);
    return cleared;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    memoryUsage: number;
    hitRate?: number;
    operations: Record<string, { keys: number; totalSize: number }>;
  }> {
    const stats = {
      totalKeys: 0,
      memoryUsage: 0,
      operations: {} as Record<string, { keys: number; totalSize: number }> };

    if (this.useRedis) {
      try {
        const client = await redisManager.getClient();

        for (const [operation, config] of Object.entries(this.cacheConfigs)) {
          const pattern = `${config.keyPrefix}:*`;
          const keys = await client.keys(pattern);

          stats.operations[operation] = {
            keys: keys.length,
            totalSize: 0, // Would need to calculate actual size
          };

          stats.totalKeys += keys.length;
        }
      } catch (error: any) {
        console.error('Error getting Redis cache stats:', error);
      }
    } else {
      // Memory cache stats
      stats.totalKeys = this.memoryCache.size;
      stats.memoryUsage = JSON.stringify(Array.from(this.memoryCache.values())).length;

      for (const [operation, config] of Object.entries(this.cacheConfigs)) {
        let operationKeys = 0;
        for (const key of this.memoryCache.keys()) {
          if (key.startsWith(config.keyPrefix)) {
            operationKeys++;
          }
        }

        stats.operations[operation] = {
          keys: operationKeys,
          totalSize: 0 };
      }
    }

    return stats;
  }

  /**
   * Update cache configuration for an operation
   */
  updateConfig(operation: string, config: Partial<CacheConfig>): void {
    this.cacheConfigs[operation] = {
      ...this.cacheConfigs[operation],
      ...config,
    };
  }

  /**
   * Get all cache configurations
   */
  getConfigs(): Record<string, CacheConfig> {
    return { ...this.cacheConfigs };
  }

  /**
   * Warm up cache with common requests
   */
  async warmUp(
    commonRequests: Array<{ operation: string; input: any; data: any }>
  ): Promise<number> {
    let warmedUp = 0;

    for (const request of commonRequests) {
      try {
        const success = await this.set(request.operation, request.input, request.data);
        if (success) {
          warmedUp++;
        }
      } catch (error: any) {
        console.error('Error warming up cache:', error);
      }
    }

    loggers.general.error(`🔥 Warmed up ${warmedUp} cache entries`);
    return warmedUp;
  }
}

// Export singleton instance
export const aiResponseCache = AIResponseCache.getInstance();

// Export types
export type { CacheConfig, CachedResponse };
