/**
 * Advanced Caching Strategy for Performance Optimization
 * Implements multi-layer caching for API responses, static data, and user content
 */

interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
  staleWhileRevalidate?: boolean; // Return stale data while fetching fresh
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  stale?: boolean;
}

/**
 * In-memory cache implementation with LRU eviction
 */
class MemoryCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  set(key: string, data: T, config: CacheConfig): void {
    // Remove oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: config.ttl,
      stale: false};

    this.cache.set(key, entry);
    this.accessOrder.set(key, ++this.accessCounter);
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Update access order
    this.accessOrder.set(key, ++this.accessCounter);

    // Check if expired
    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      entry.stale = true;
      // Don't delete yet - might be useful for stale-while-revalidate
    }

    return entry.data;
  }

  isStale(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;
    
    return entry.stale || (Date.now() - entry.timestamp > entry.ttl);
  }

  delete(key: string): boolean {
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestAccess = Infinity;

    for (const [key, accessTime] of this.accessOrder) {
      if (accessTime < oldestAccess) {
        oldestAccess = accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  // Get cache statistics
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries: Array.from(this.cache.keys())};
  }
}

/**
 * Cache configurations for different data types
 */
export const CACHE_CONFIGS = {
  // API responses
  API_SHORT: { ttl: 5 * 60 * 1000, maxSize: 50 }, // 5 minutes
  API_MEDIUM: { ttl: 30 * 60 * 1000, maxSize: 100 }, // 30 minutes
  API_LONG: { ttl: 60 * 60 * 1000, maxSize: 50 }, // 1 hour
  
  // Static data
  STATIC_DATA: { ttl: 24 * 60 * 60 * 1000, maxSize: 20 }, // 24 hours
  
  // User content
  USER_PROFILE: { ttl: 15 * 60 * 1000, maxSize: 100 }, // 15 minutes
  USER_PREFERENCES: { ttl: 60 * 60 * 1000, maxSize: 200 }, // 1 hour
  
  // AI responses (expensive to generate)
  AI_RESPONSES: { ttl: 60 * 60 * 1000, maxSize: 30, staleWhileRevalidate: true }, // 1 hour
  
  // Video processing results
  VIDEO_METADATA: { ttl: 2 * 60 * 60 * 1000, maxSize: 50 }, // 2 hours
} as const;

/**
 * Multi-layer cache manager
 */
class CacheManager {
  private memoryCaches = new Map<string, MemoryCache>();
  private browserCache: Cache | null = null;

  constructor() {
    this.initializeBrowserCache();
  }

  private async initializeBrowserCache() {
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        this.browserCache = await caches.open('airwave-v1');
      } catch (error) {
        console.warn('Browser cache not available:', error);
      }
    }
  }

  private getMemoryCache(namespace: string): MemoryCache {
    if (!this.memoryCaches.has(namespace)) {
      this.memoryCaches.set(namespace, new MemoryCache());
    }
    return this.memoryCaches.get(namespace)!;
  }

  /**
   * Set data in appropriate cache layer
   */
  async set<T>(
    namespace: string,
    key: string,
    data: T,
    config: CacheConfig
  ): Promise<void> {
    // Always set in memory cache
    const memoryCache = this.getMemoryCache(namespace);
    memoryCache.set(key, data, config);

    // For longer TTL, also set in browser cache
    if (config.ttl > 30 * 60 * 1000 && this.browserCache) {
      try {
        const response = new Response(JSON.stringify(data), {
          headers: {
        'Content-Type': 'application/json',
            'Cache-Control': `max-age=${Math.floor(config.ttl / 1000)
      }`}});
        await this.browserCache.put(`${namespace}:${key}`, response);
      } catch (error) {
        console.warn('Failed to set browser cache:', error);
      }
    }
  }

  /**
   * Get data from cache with fallback strategy
   */
  async get<T>(namespace: string, key: string): Promise<T | null> {
    // Try memory cache first (fastest)
    const memoryCache = this.getMemoryCache(namespace);
    const memoryData = memoryCache.get(key);
    
    if (memoryData && !memoryCache.isStale(key)) {
      return memoryData;
    }

    // Try browser cache if memory cache is stale/empty
    if (this.browserCache) {
      try {
        const response = await this.browserCache.match(`${namespace}:${key}`);
        if (response) {
          const data = await response.json();
          
          // Restore to memory cache
          const cacheControl = response.headers.get('Cache-Control');
          const maxAge = cacheControl?.match(/max-age=(\d+)/)?.[1];
          const ttl = maxAge ? parseInt(maxAge) * 1000 : 60 * 60 * 1000;
          
          memoryCache.set(key, data, { ttl });
          return data;
        }
      } catch (error) {
        console.warn('Failed to get from browser cache:', error);
      }
    }

    return null;
  }

  /**
   * Check if data is stale (for stale-while-revalidate strategy)
   */
  isStale(namespace: string, key: string): boolean {
    const memoryCache = this.getMemoryCache(namespace);
    return memoryCache.isStale(key);
  }

  /**
   * Delete from all cache layers
   */
  async delete(namespace: string, key: string): Promise<void> {
    // Delete from memory
    const memoryCache = this.getMemoryCache(namespace);
    memoryCache.delete(key);

    // Delete from browser cache
    if (this.browserCache) {
      try {
        await this.browserCache.delete(`${namespace}:${key}`);
      } catch (error) {
        console.warn('Failed to delete from browser cache:', error);
      }
    }
  }

  /**
   * Clear namespace or entire cache
   */
  async clear(namespace?: string): Promise<void> {
    if (namespace) {
      const memoryCache = this.getMemoryCache(namespace);
      memoryCache.clear();

      // Clear namespace from browser cache
      if (this.browserCache) {
        try {
          const keys = await this.browserCache.keys();
          const namespaceKeys = keys.filter(request => 
            request.url.includes(`${namespace}:`)
          );
          await Promise.all(
            namespaceKeys.map(request => this.browserCache!.delete(request))
          );
        } catch (error) {
          console.warn('Failed to clear browser cache namespace:', error);
        }
      }
    } else {
      // Clear all caches
      this.memoryCaches.clear();
      if (this.browserCache) {
        try {
          await this.browserCache.keys().then(keys =>
            Promise.all(keys.map(key => this.browserCache!.delete(key)))
          );
        } catch (error) {
          console.warn('Failed to clear browser cache:', error);
        }
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const memoryStats = new Map();
    for (const [namespace, cache] of this.memoryCaches) {
      memoryStats.set(namespace, cache.getStats());
    }

    return {
      memoryStats: Object.fromEntries(memoryStats),
      hasBrowserCache: !!this.browserCache};
  }
}

// Global cache manager instance
export const cacheManager = new CacheManager();

/**
 * Cache decorator for API functions
 */
export function cached<T extends (...args: any[]) => Promise<any>>(
  namespace: string,
  keyGenerator: (...args: Parameters<T>) => string,
  config: CacheConfig
) {
  return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: Parameters<T>) {
      const key = keyGenerator(...args);
      
      // Try to get from cache
      const cachedData = await cacheManager.get(namespace, key);
      
      if (cachedData && !cacheManager.isStale(namespace, key)) {
        return cachedData;
      }

      // If stale-while-revalidate is enabled, return stale data and update in background
      if (config.staleWhileRevalidate && cachedData) {
        // Return stale data immediately
        setTimeout(async () => {
          try {
            const freshData = await method.apply(this, args);
            await cacheManager.set(namespace, key, freshData, config);
          } catch (error) {
            console.warn('Background refresh failed:', error);
          }
        }, 0);
        
        return cachedData;
      }

      // Fetch fresh data
      const result = await method.apply(this, args);
      await cacheManager.set(namespace, key, result, config);
      
      return result;
    };
  };
}

/**
 * React hook for cached data
 */
export function useCachedData<T>(
  namespace: string,
  key: string,
  fetchFn: () => Promise<T>,
  config: CacheConfig
) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Try cache first
        const cachedData = await cacheManager.get<T>(namespace, key);
        
        if (cachedData && !cacheManager.isStale(namespace, key)) {
          if (mounted) {
            setData(cachedData);
            setLoading(false);
          }
          return;
        }

        // If stale-while-revalidate, show stale data while loading fresh
        if (config.staleWhileRevalidate && cachedData) {
          if (mounted) {
            setData(cachedData);
            setLoading(true); // Still loading fresh data
          }
        }

        // Fetch fresh data
        const freshData = await fetchFn();
        await cacheManager.set(namespace, key, freshData, config);
        
        if (mounted) {
          setData(freshData);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [namespace, key]);

  const refresh = React.useCallback(async () => {
    await cacheManager.delete(namespace, key);
    setLoading(true);
    
    try {
      const freshData = await fetchFn();
      await cacheManager.set(namespace, key, freshData, config);
      setData(freshData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [namespace, key, fetchFn, config]);

  return { data, loading, error, refresh };
}

/**
 * Preload data into cache
 */
export async function preloadData<T>(
  namespace: string,
  key: string,
  fetchFn: () => Promise<T>,
  config: CacheConfig
): Promise<void> {
  const existing = await cacheManager.get(namespace, key);
  if (existing && !cacheManager.isStale(namespace, key)) {
    return; // Already cached
  }

  try {
    const data = await fetchFn();
    await cacheManager.set(namespace, key, data, config);
  } catch (error) {
    console.warn('Failed to preload data:', error);
  }
}

// React import for the hook
const React = typeof window !== 'undefined' ? require('react') : { useState: () => [null, () => {}], useEffect: () => {}, useCallback: (fn: any) => fn };