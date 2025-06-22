import { createClient, RedisClientType } from 'redis';
import { getRedisConfig } from '@/lib/config';
import { getLogger } from '@/lib/logger';

const logger = getLogger('cache');

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
  serialize?: boolean; // Auto serialize/deserialize objects
  compress?: boolean; // Compress large values
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  totalKeys: number;
  memoryUsage: number;
}

export interface CacheEntry<T = any> {
  value: T;
  ttl: number;
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
}

export class RedisCache {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private fallbackCache = new Map<string, CacheEntry>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    totalKeys: 0,
    memoryUsage: 0
  };
  
  private defaultOptions: CacheOptions = {
    ttl: 3600, // 1 hour
    prefix: 'airwave:',
    serialize: true,
    compress: false
  };
  
  constructor() {
    this.initializeRedis();
    this.startCleanupInterval();
  }
  
  private async initializeRedis(): Promise<void> {
    try {
      const config = getRedisConfig();
      
      this.client = createClient({
        url: config.url,
        password: config.password,
        database: config.db,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 500),
          connectTimeout: 5000,
          commandTimeout: 5000
        }
      }) as RedisClientType;
      
      this.client.on('error', (error) => {
        logger.error('Redis cache error', error);
        this.isConnected = false;
        this.stats.errors++;
      });
      
      this.client.on('connect', () => {
        logger.info('Redis cache connected');
        this.isConnected = true;
      });
      
      this.client.on('disconnect', () => {
        logger.warn('Redis cache disconnected, falling back to in-memory cache');
        this.isConnected = false;
      });
      
      this.client.on('reconnecting', () => {
        logger.info('Redis cache reconnecting...');
      });
      
      await this.client.connect();
      
    } catch (error) {
      logger.error('Failed to initialize Redis cache', error);
      this.isConnected = false;
    }
  }
  
  private generateKey(key: string, prefix?: string): string {
    const keyPrefix = prefix || this.defaultOptions.prefix;
    return `${keyPrefix}${key}`;
  }
  
  private async serializeValue(value: any, options: CacheOptions): Promise<string> {
    if (!options.serialize) {
      return typeof value === 'string' ? value : JSON.stringify(value);
    }
    
    const serialized = JSON.stringify({
      value,
      type: typeof value,
      timestamp: Date.now()
    });
    
    if (options.compress && serialized.length > 1024) {
      // Implement compression if needed
      // For now, just return serialized value
      return serialized;
    }
    
    return serialized;
  }
  
  private async deserializeValue(data: string, options: CacheOptions): Promise<any> {
    if (!options.serialize) {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
    
    try {
      const parsed = JSON.parse(data);
      return parsed.value;
    } catch (error) {
      logger.warn('Failed to deserialize cache value', error);
      return data;
    }
  }
  
  // Core cache operations
  async get<T = any>(key: string, options: Partial<CacheOptions> = {}): Promise<T | null> {
    const opts = { ...this.defaultOptions, ...options };
    const cacheKey = this.generateKey(key, opts.prefix);
    
    try {
      // Try Redis first
      if (this.isConnected && this.client) {
        const data = await this.client.get(cacheKey);
        
        if (data !== null) {
          this.stats.hits++;
          const value = await this.deserializeValue(data, opts);
          logger.debug(`Cache HIT: ${key}`);
          return value;
        }
      }
      
      // Fallback to in-memory cache
      const entry = this.fallbackCache.get(cacheKey);
      if (entry) {
        // Check TTL
        if (Date.now() < entry.createdAt + (entry.ttl * 1000)) {
          entry.accessCount++;
          entry.lastAccessed = Date.now();
          this.stats.hits++;
          logger.debug(`Fallback cache HIT: ${key}`);
          return entry.value;
        } else {
          // Expired
          this.fallbackCache.delete(cacheKey);
        }
      }
      
      this.stats.misses++;
      logger.debug(`Cache MISS: ${key}`);
      return null;
      
    } catch (error) {
      logger.error(`Cache get error for key ${key}`, error);
      this.stats.errors++;
      return null;
    }
  }
  
  async set<T = any>(
    key: string, 
    value: T, 
    options: Partial<CacheOptions> = {}
  ): Promise<boolean> {
    const opts = { ...this.defaultOptions, ...options };
    const cacheKey = this.generateKey(key, opts.prefix);
    const ttl = opts.ttl || this.defaultOptions.ttl!;
    
    try {
      const serializedValue = await this.serializeValue(value, opts);
      
      // Try Redis first
      if (this.isConnected && this.client) {
        await this.client.setEx(cacheKey, ttl, serializedValue);
        this.stats.sets++;
        logger.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);
        return true;
      }
      
      // Fallback to in-memory cache
      this.fallbackCache.set(cacheKey, {
        value,
        ttl,
        createdAt: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now()
      });
      
      this.stats.sets++;
      logger.debug(`Fallback cache SET: ${key} (TTL: ${ttl}s)`);
      return true;
      
    } catch (error) {
      logger.error(`Cache set error for key ${key}`, error);
      this.stats.errors++;
      return false;
    }
  }
  
  async del(key: string, options: Partial<CacheOptions> = {}): Promise<boolean> {
    const opts = { ...this.defaultOptions, ...options };
    const cacheKey = this.generateKey(key, opts.prefix);
    
    try {
      let deleted = false;
      
      // Delete from Redis
      if (this.isConnected && this.client) {
        const result = await this.client.del(cacheKey);
        deleted = result > 0;
      }
      
      // Delete from fallback cache
      if (this.fallbackCache.has(cacheKey)) {
        this.fallbackCache.delete(cacheKey);
        deleted = true;
      }
      
      if (deleted) {
        this.stats.deletes++;
        logger.debug(`Cache DEL: ${key}`);
      }
      
      return deleted;
      
    } catch (error) {
      logger.error(`Cache delete error for key ${key}`, error);
      this.stats.errors++;
      return false;
    }
  }
  
  async exists(key: string, options: Partial<CacheOptions> = {}): Promise<boolean> {
    const opts = { ...this.defaultOptions, ...options };
    const cacheKey = this.generateKey(key, opts.prefix);
    
    try {
      // Check Redis
      if (this.isConnected && this.client) {
        const exists = await this.client.exists(cacheKey);
        if (exists) return true;
      }
      
      // Check fallback cache
      const entry = this.fallbackCache.get(cacheKey);
      if (entry) {
        // Check TTL
        return Date.now() < entry.createdAt + (entry.ttl * 1000);
      }
      
      return false;
      
    } catch (error) {
      logger.error(`Cache exists error for key ${key}`, error);
      this.stats.errors++;
      return false;
    }
  }
  
  async expire(key: string, ttl: number, options: Partial<CacheOptions> = {}): Promise<boolean> {
    const opts = { ...this.defaultOptions, ...options };
    const cacheKey = this.generateKey(key, opts.prefix);
    
    try {
      // Update TTL in Redis
      if (this.isConnected && this.client) {
        const result = await this.client.expire(cacheKey, ttl);
        if (result) return true;
      }
      
      // Update TTL in fallback cache
      const entry = this.fallbackCache.get(cacheKey);
      if (entry) {
        entry.ttl = ttl;
        entry.createdAt = Date.now(); // Reset creation time
        return true;
      }
      
      return false;
      
    } catch (error) {
      logger.error(`Cache expire error for key ${key}`, error);
      this.stats.errors++;
      return false;
    }
  }
  
  // Advanced operations
  async mget<T = any>(keys: string[], options: Partial<CacheOptions> = {}): Promise<(T | null)[]> {
    const opts = { ...this.defaultOptions, ...options };
    const cacheKeys = keys.map(key => this.generateKey(key, opts.prefix));
    
    try {
      if (this.isConnected && this.client) {
        const values = await this.client.mGet(cacheKeys);
        return Promise.all(
          values.map(async (value, index) => {
            if (value !== null) {
              this.stats.hits++;
              return await this.deserializeValue(value, opts);
            } else {
              this.stats.misses++;
              return null;
            }
          })
        );
      }
      
      // Fallback to individual gets
      return Promise.all(keys.map(key => this.get<T>(key, options)));
      
    } catch (error) {
      logger.error('Cache mget error', error);
      this.stats.errors++;
      return keys.map(() => null);
    }
  }
  
  async mset(entries: Record<string, any>, options: Partial<CacheOptions> = {}): Promise<boolean> {
    const opts = { ...this.defaultOptions, ...options };
    const ttl = opts.ttl || this.defaultOptions.ttl!;
    
    try {
      if (this.isConnected && this.client) {
        const serializedEntries: Record<string, string> = {};
        
        for (const [key, value] of Object.entries(entries)) {
          const cacheKey = this.generateKey(key, opts.prefix);
          serializedEntries[cacheKey] = await this.serializeValue(value, opts);
        }
        
        // Use pipeline for better performance
        const pipeline = this.client.multi();
        
        for (const [cacheKey, serializedValue] of Object.entries(serializedEntries)) {
          pipeline.setEx(cacheKey, ttl, serializedValue);
        }
        
        await pipeline.exec();
        this.stats.sets += Object.keys(entries).length;
        return true;
      }
      
      // Fallback to individual sets
      const results = await Promise.all(
        Object.entries(entries).map(([key, value]) => this.set(key, value, options))
      );
      
      return results.every(result => result);
      
    } catch (error) {
      logger.error('Cache mset error', error);
      this.stats.errors++;
      return false;
    }
  }
  
  async clear(pattern?: string): Promise<number> {
    let cleared = 0;
    
    try {
      if (this.isConnected && this.client) {
        if (pattern) {
          const keys = await this.client.keys(pattern);
          if (keys.length > 0) {
            cleared = await this.client.del(keys);
          }
        } else {
          await this.client.flushDb();
          cleared = -1; // Unknown count
        }
      }
      
      // Clear fallback cache
      if (pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        for (const key of this.fallbackCache.keys()) {
          if (regex.test(key)) {
            this.fallbackCache.delete(key);
            cleared++;
          }
        }
      } else {
        cleared += this.fallbackCache.size;
        this.fallbackCache.clear();
      }
      
      logger.info(`Cache cleared${pattern ? ` (pattern: ${pattern})` : ''}: ${cleared} keys`);
      return cleared;
      
    } catch (error) {
      logger.error('Cache clear error', error);
      this.stats.errors++;
      return 0;
    }
  }
  
  // Cache management
  async getStats(): Promise<CacheStats> {
    try {
      if (this.isConnected && this.client) {
        const info = await this.client.info('memory');
        const memoryMatch = info.match(/used_memory:(\d+)/);
        this.stats.memoryUsage = memoryMatch ? parseInt(memoryMatch[1]) : 0;
        
        const dbSize = await this.client.dbSize();
        this.stats.totalKeys = dbSize;
      } else {
        this.stats.totalKeys = this.fallbackCache.size;
        this.stats.memoryUsage = JSON.stringify([...this.fallbackCache.entries()]).length;
      }
      
      return { ...this.stats };
      
    } catch (error) {
      logger.error('Failed to get cache stats', error);
      return { ...this.stats };
    }
  }
  
  async healthCheck(): Promise<{
    healthy: boolean;
    redis: boolean;
    fallback: boolean;
    latency: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      let redisHealthy = false;
      
      if (this.isConnected && this.client) {
        await this.client.ping();
        redisHealthy = true;
      }
      
      const latency = Date.now() - startTime;
      
      return {
        healthy: redisHealthy || this.fallbackCache.size >= 0,
        redis: redisHealthy,
        fallback: true,
        latency
      };
      
    } catch (error) {
      return {
        healthy: this.fallbackCache.size >= 0,
        redis: false,
        fallback: true,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  // Cleanup expired entries from fallback cache
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      for (const [key, entry] of this.fallbackCache.entries()) {
        if (now > entry.createdAt + (entry.ttl * 1000)) {
          this.fallbackCache.delete(key);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        logger.debug(`Cleaned up ${cleaned} expired cache entries`);
      }
    }, 60000); // Run every minute
  }
  
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
      logger.info('Redis cache disconnected');
    }
  }
}

// Singleton instance
let cacheInstance: RedisCache | null = null;

export const getCache = (): RedisCache => {
  if (!cacheInstance) {
    cacheInstance = new RedisCache();
  }
  return cacheInstance;
};

// Helper functions for common caching patterns
export const cached = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string,
  options: Partial<CacheOptions> = {}
): T => {
  const cache = getCache();
  
  return (async (...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    
    // Try to get from cache
    const cached = await cache.get(key, options);
    if (cached !== null) {
      return cached;
    }
    
    // Execute function and cache result
    const result = await fn(...args);
    await cache.set(key, result, options);
    
    return result;
  }) as T;
};

export const cacheKey = (parts: (string | number)[]): string => {
  return parts.map(part => String(part)).join(':');
};

// Predefined cache configurations
export const CacheProfiles = {
  SHORT: { ttl: 300 }, // 5 minutes
  MEDIUM: { ttl: 3600 }, // 1 hour
  LONG: { ttl: 86400 }, // 24 hours
  USER_SESSION: { ttl: 1800, prefix: 'session:' }, // 30 minutes
  API_RESPONSE: { ttl: 600, prefix: 'api:' }, // 10 minutes
  DATABASE_QUERY: { ttl: 1800, prefix: 'db:' }, // 30 minutes
  AI_GENERATION: { ttl: 7200, prefix: 'ai:' }, // 2 hours
} as const;