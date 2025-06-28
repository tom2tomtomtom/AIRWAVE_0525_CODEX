import Redis from 'ioredis';
import { env } from './env';
import { loggers } from './logger';

// Cache configuration
// const CACHE_PREFIX = 'cache:';
const DEFAULT_TTL = 60 * 60; // 1 hour in seconds

// Cache TTL configurations for different data types
export const CACHE_TTL = {
  // AI-generated content - cache for 24 hours
  AI_CONTENT: 24 * 60 * 60,

  // User sessions - cache for 7 days (handled by session manager)
  USER_SESSION: 7 * 24 * 60 * 60,

  // Frequently accessed assets - cache for 1 hour
  ASSETS: 60 * 60,

  // Client data - cache for 30 minutes
  CLIENT_DATA: 30 * 60,

  // Campaign data - cache for 15 minutes
  CAMPAIGN_DATA: 15 * 60,

  // Video generation results - cache for 6 hours
  VIDEO_GENERATION: 6 * 60 * 60,

  // Image generation results - cache for 6 hours
  IMAGE_GENERATION: 6 * 60 * 60,

  // Brief analysis results - cache for 2 hours
  BRIEF_ANALYSIS: 2 * 60 * 60,

  // Copy generation results - cache for 4 hours
  COPY_GENERATION: 4 * 60 * 60,

  // Database query results - cache for 5 minutes
  DB_QUERY: 5 * 60,

  // API responses - cache for 10 minutes
  API_RESPONSE: 10 * 60,
} as const;

// Initialize Redis client for caching
const redis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      keyPrefix: 'airwave:cache:',
      retryStrategy: times => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })
  : null;

export interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  tags?: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

class CacheManager {
  private useMemoryFallback: boolean;
  private memoryCache: Map<string, { data: any; expires: number; tags?: string[] }>;
  private stats: CacheStats;

  constructor() {
    this.useMemoryFallback = !redis;
    this.memoryCache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };

    if (this.useMemoryFallback) {
      loggers.general.warn('Using in-memory cache storage - not recommended for production');

      // Clean up expired cache entries every 10 minutes
      setInterval(() => this.cleanupMemoryCache(), 10 * 60 * 1000);
    } else {
      loggers.general.info('Redis cache manager initialized');
    }
  }

  private cleanupMemoryCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expires < now) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      loggers.general.debug(`Cleaned up ${cleaned} expired cache entries`);
    }
  }

  private generateKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }

  async get<T = any>(key: string, namespace?: string): Promise<T | null> {
    const cacheKey = this.generateKey(key, namespace);

    try {
      if (this.useMemoryFallback) {
        const entry = this.memoryCache.get(cacheKey);
        if (entry && entry.expires > Date.now()) {
          this.stats.hits++;
          return entry.data as T;
        }
        this.stats.misses++;
        return null;
      }

      const data = await redis!.get(cacheKey);
      if (data) {
        this.stats.hits++;
        return JSON.parse(data) as T;
      }

      this.stats.misses++;
      return null;
    } catch (error: any) {
      this.stats.errors++;
      loggers.general.error('Cache get error', error, { key: cacheKey });
      return null;
    }
  }

  async set<T = any>(
    key: string,
    value: T,
    options: CacheOptions = {},
    namespace?: string
  ): Promise<boolean> {
    const cacheKey = this.generateKey(key, namespace);
    const ttl = options.ttl || DEFAULT_TTL;

    try {
      if (this.useMemoryFallback) {
        const cacheItem: any = {
          data: value,
          expires: Date.now() + ttl * 1000,
        };
        if (options.tags) {
          cacheItem.tags = options.tags;
        }
        this.memoryCache.set(cacheKey, cacheItem);
        this.stats.sets++;
        return true;
      }

      const serialized = JSON.stringify(value);
      await redis!.setex(cacheKey, ttl, serialized);

      // Store tags for cache invalidation
      if (options.tags && options.tags.length > 0) {
        const pipeline = redis!.pipeline();
        for (const tag of options.tags) {
          pipeline.sadd(`tag:${tag}`, cacheKey);
          pipeline.expire(`tag:${tag}`, ttl);
        }
        await pipeline.exec();
      }

      this.stats.sets++;
      return true;
    } catch (error: any) {
      this.stats.errors++;
      loggers.general.error('Cache set error', error, { key: cacheKey });
      return false;
    }
  }

  async delete(key: string, namespace?: string): Promise<boolean> {
    const cacheKey = this.generateKey(key, namespace);

    try {
      if (this.useMemoryFallback) {
        const deleted = this.memoryCache.delete(cacheKey);
        if (deleted) this.stats.deletes++;
        return deleted;
      }

      const result = await redis!.del(cacheKey);
      if (result > 0) this.stats.deletes++;
      return result > 0;
    } catch (error: any) {
      this.stats.errors++;
      loggers.general.error('Cache delete error', error, { key: cacheKey });
      return false;
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    if (this.useMemoryFallback) {
      let deleted = 0;
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.tags && entry.tags.includes(tag)) {
          this.memoryCache.delete(key);
          deleted++;
        }
      }
      this.stats.deletes += deleted;
      return deleted;
    }

    try {
      const keys = await redis!.smembers(`tag:${tag}`);
      if (keys.length === 0) return 0;

      const pipeline = redis!.pipeline();
      keys.forEach((key: any) => pipeline.del(key));
      pipeline.del(`tag:${tag}`);

      const results = await pipeline.exec();
      const deleted = results?.filter(([err, result]) => !err && result === 1).length || 0;

      this.stats.deletes += deleted;
      return deleted;
    } catch (error: any) {
      this.stats.errors++;
      loggers.general.error('Cache invalidate by tag error', error, { tag });
      return 0;
    }
  }

  async clear(namespace?: string): Promise<boolean> {
    try {
      if (this.useMemoryFallback) {
        if (namespace) {
          const prefix = `${namespace}:`;
          const keysToDelete = Array.from(this.memoryCache.keys()).filter((key: any) =>
            key.startsWith(prefix)
          );
          keysToDelete.forEach((key: any) => this.memoryCache.delete(key));
          this.stats.deletes += keysToDelete.length;
        } else {
          const size = this.memoryCache.size;
          this.memoryCache.clear();
          this.stats.deletes += size;
        }
        return true;
      }

      const pattern = namespace ? `${namespace}:*` : '*';
      const keys = await redis!.keys(pattern);

      if (keys.length === 0) return true;

      const deleted = await redis!.del(...keys);
      this.stats.deletes += deleted;
      return true;
    } catch (error: any) {
      this.stats.errors++;
      loggers.general.error('Cache clear error', error, { namespace });
      return false;
    }
  }

  async exists(key: string, namespace?: string): Promise<boolean> {
    const cacheKey = this.generateKey(key, namespace);

    try {
      if (this.useMemoryFallback) {
        const entry = this.memoryCache.get(cacheKey);
        return entry ? entry.expires > Date.now() : false;
      }

      const result = await redis!.exists(cacheKey);
      return result === 1;
    } catch (error: any) {
      this.stats.errors++;
      loggers.general.error('Cache exists error', error, { key: cacheKey });
      return false;
    }
  }

  async getStats(): Promise<CacheStats & { memoryUsage?: number }> {
    const stats = { ...this.stats };

    if (this.useMemoryFallback) {
      // Estimate memory usage
      const memoryUsage = Array.from(this.memoryCache.values()).reduce((total, entry) => {
        return total + JSON.stringify(entry.data).length;
      }, 0);

      return { ...stats, memoryUsage };
    }

    return stats;
  }

  // Helper method for caching function results
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    options: CacheOptions = {},
    namespace?: string
  ): Promise<T> {
    const cached = await this.get<T>(key, namespace);
    if (cached !== null) {
      return cached;
    }

    const result = await fn();
    await this.set(key, result, options, namespace);
    return result;
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

export default cacheManager;
