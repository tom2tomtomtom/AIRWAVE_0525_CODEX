// Comprehensive caching system for API responses and client-side data
interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  version?: string;
}

interface CacheOptions {
  ttl?: number | undefined; // Default: 5 minutes
  maxSize?: number | undefined; // Maximum number of entries
  version?: string | undefined; // For cache invalidation
  storageType?: 'memory' | 'localStorage' | 'sessionStorage' | undefined;
}

class CacheManager {
  private memoryCache = new Map<string, CacheEntry>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes
  private maxSize = 1000;

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.ttl || this.defaultTTL;
    this.maxSize = options.maxSize || this.maxSize;
  }

  /**
   * Set data in cache with TTL
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl || this.defaultTTL,
      ...(options.version && { version: options.version }),
    };

    // Memory cache
    if (!options.storageType || options.storageType === 'memory') {
      this.setMemoryCache(key, entry);
    }

    // Browser storage
    if (typeof window !== 'undefined') {
      if (options.storageType === 'localStorage') {
        this.setStorageCache(key, entry, localStorage);
      } else if (options.storageType === 'sessionStorage') {
        this.setStorageCache(key, entry, sessionStorage);
      }
    }
  }

  /**
   * Get data from cache
   */
  get<T>(key: string, options: CacheOptions = {}): T | null {
    // Try storage first if specified
    if (typeof window !== 'undefined' && options.storageType !== 'memory') {
      const storage = options.storageType === 'localStorage' ? localStorage : sessionStorage;
      const stored = this.getStorageCache<T>(key, storage, options.version);
      if (stored) return stored;
    }

    // Fall back to memory cache
    return this.getMemoryCache<T>(key, options.version);
  }

  /**
   * Check if data exists in cache and is valid
   */
  has(key: string, options: CacheOptions = {}): boolean {
    return this.get(key, options) !== null;
  }

  /**
   * Remove specific entry from cache
   */
  delete(key: string): void {
    this.memoryCache.delete(key);
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.getStorageKey(key));
      sessionStorage.removeItem(this.getStorageKey(key));
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.memoryCache.clear();
    
    if (typeof window !== 'undefined') {
      // Clear all our cache entries from storage
      this.clearStorageByPrefix(localStorage);
      this.clearStorageByPrefix(sessionStorage);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const memorySize = this.memoryCache.size;
    const memoryKeys = Array.from(this.memoryCache.keys());
    
    return {
      memorySize,
      memoryKeys,
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL,
    };
  }

  private setMemoryCache(key: string, entry: CacheEntry): void {
    // Implement LRU eviction if cache is full
    if (this.memoryCache.size >= this.maxSize) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
    
    this.memoryCache.set(key, entry);
  }

  private getMemoryCache<T>(key: string, version?: string): T | null {
    const entry = this.memoryCache.get(key);
    
    if (!entry) return null;
    
    // Check version mismatch
    if (version && entry.version && entry.version !== version) {
      this.memoryCache.delete(key);
      return null;
    }
    
    // Check expiration
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private setStorageCache(key: string, entry: CacheEntry, storage: Storage): void {
    try {
      const storageKey = this.getStorageKey(key);
      storage.setItem(storageKey, JSON.stringify(entry));
    } catch (error) {
      console.warn('Failed to save to storage:', error);
    }
  }

  private getStorageCache<T>(key: string, storage: Storage, version?: string): T | null {
    try {
      const storageKey = this.getStorageKey(key);
      const stored = storage.getItem(storageKey);
      
      if (!stored) return null;
      
      const entry: CacheEntry<T> = JSON.parse(stored);
      
      // Check version mismatch
      if (version && entry.version && entry.version !== version) {
        storage.removeItem(storageKey);
        return null;
      }
      
      // Check expiration
      if (Date.now() - entry.timestamp > entry.ttl) {
        storage.removeItem(storageKey);
        return null;
      }
      
      return entry.data;
    } catch (error) {
      console.warn('Failed to read from storage:', error);
      return null;
    }
  }

  private getStorageKey(key: string): string {
    return `airwave_cache_${key}`;
  }

  private clearStorageByPrefix(storage: Storage): void {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith('airwave_cache_')) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => storage.removeItem(key));
  }
}

// Global cache instance
export const cacheManager = new CacheManager();

// Specialized cache instances for different data types
export const apiCache = new CacheManager({
  ttl: 2 * 60 * 1000, // 2 minutes for API responses
  maxSize: 500,
  storageType: 'memory',
});

export const assetCache = new CacheManager({
  ttl: 30 * 60 * 1000, // 30 minutes for assets
  maxSize: 200,
  storageType: 'localStorage',
});

export const userPreferencesCache = new CacheManager({
  ttl: 24 * 60 * 60 * 1000, // 24 hours for user preferences
  maxSize: 100,
  storageType: 'localStorage',
});

export const sessionCache = new CacheManager({
  ttl: 60 * 60 * 1000, // 1 hour for session data
  maxSize: 50,
  storageType: 'sessionStorage',
});

export { CacheManager };