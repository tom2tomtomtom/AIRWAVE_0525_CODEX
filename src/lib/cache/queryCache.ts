// Server-side database query caching with Redis-like interface
import { cacheManager } from './CacheManager';

interface QueryCacheOptions {
  ttl?: number;
  tags?: string[]; // For tag-based invalidation
  version?: string;
  skipCache?: boolean;
}

interface QueryResult<T> {
  data: T;
  cached: boolean;
  timestamp: number;
  query: string;
}

class QueryCache {
  private cache = cacheManager;
  private queryTags = new Map<string, Set<string>>(); // tag -> set of cache keys

  /**
   * Execute query with caching
   */
  async query<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    options: QueryCacheOptions = {}
  ): Promise<QueryResult<T>> {
    const { ttl = 5 * 60 * 1000, tags = [], version, skipCache = false } = options;

    // Skip cache if requested
    if (skipCache) {
      const data = await queryFn();
      return {
        data,
        cached: false,
        timestamp: Date.now(),
        query: queryKey,
      };
    }

    // Try to get from cache
    const cacheGetOptions: any = {};
    if (version) cacheGetOptions.version = version;
    if (ttl) cacheGetOptions.ttl = ttl;
    
    const cached = this.cache.get<T>(queryKey, cacheGetOptions);
    if (cached) {
      return {
        data: cached,
        cached: true,
        timestamp: Date.now(),
        query: queryKey,
      };
    }

    // Execute query
    const data = await queryFn();

    // Cache the result
    const cacheSetOptions: any = { ttl };
    if (version) cacheSetOptions.version = version;
    
    this.cache.set(queryKey, data, cacheSetOptions);

    // Associate with tags for invalidation
    if (tags.length > 0) {
      this.associateWithTags(queryKey, tags);
    }

    return {
      data,
      cached: false,
      timestamp: Date.now(),
      query: queryKey,
    };
  }

  /**
   * Invalidate cache by key pattern
   */
  invalidateByPattern(pattern: string): void {
    const stats = this.cache.getStats();
    const keysToDelete = stats.memoryKeys.filter(key => 
      key.includes(pattern) || new RegExp(pattern).test(key)
    );
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.removeFromAllTags(key);
    });
  }

  /**
   * Invalidate cache by tags
   */
  invalidateByTags(tags: string[]): void {
    const keysToDelete = new Set<string>();

    tags.forEach(tag => {
      const taggedKeys = this.queryTags.get(tag);
      if (taggedKeys) {
        taggedKeys.forEach(key => keysToDelete.add(key));
      }
    });

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.removeFromAllTags(key);
    });
  }

  /**
   * Clear all cached queries
   */
  clear(): void {
    this.cache.clear();
    this.queryTags.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.cache.getStats(),
      tagCount: this.queryTags.size,
      taggedKeys: Array.from(this.queryTags.entries()).map(([tag, keys]) => ({
        tag,
        keyCount: keys.size,
      })),
    };
  }

  private associateWithTags(key: string, tags: string[]): void {
    tags.forEach(tag => {
      if (!this.queryTags.has(tag)) {
        this.queryTags.set(tag, new Set());
      }
      this.queryTags.get(tag)!.add(key);
    });
  }

  private removeFromAllTags(key: string): void {
    this.queryTags.forEach(tagSet => {
      tagSet.delete(key);
    });
  }
}

// Global query cache instance
export const queryCache = new QueryCache();

/**
 * Common database query patterns with caching
 */
export const cachedQueries = {
  // User-related queries
  getUserById: async (userId: string, queryFn: () => Promise<any>) => {
    return queryCache.query(
      `user:${userId}`,
      queryFn,
      { ttl: 10 * 60 * 1000, tags: ['users', `user:${userId}`] }
    );
  },

  getUserClients: async (userId: string, queryFn: () => Promise<any>) => {
    return queryCache.query(
      `user:${userId}:clients`,
      queryFn,
      { ttl: 5 * 60 * 1000, tags: ['users', 'clients', `user:${userId}`] }
    );
  },

  // Client-related queries
  getClientById: async (clientId: string, queryFn: () => Promise<any>) => {
    return queryCache.query(
      `client:${clientId}`,
      queryFn,
      { ttl: 15 * 60 * 1000, tags: ['clients', `client:${clientId}`] }
    );
  },

  getClientAssets: async (clientId: string, queryFn: () => Promise<any>) => {
    return queryCache.query(
      `client:${clientId}:assets`,
      queryFn,
      { ttl: 10 * 60 * 1000, tags: ['clients', 'assets', `client:${clientId}`] }
    );
  },

  getClientCampaigns: async (clientId: string, queryFn: () => Promise<any>) => {
    return queryCache.query(
      `client:${clientId}:campaigns`,
      queryFn,
      { ttl: 3 * 60 * 1000, tags: ['clients', 'campaigns', `client:${clientId}`] }
    );
  },

  // Asset-related queries
  getAssetById: async (assetId: string, queryFn: () => Promise<any>) => {
    return queryCache.query(
      `asset:${assetId}`,
      queryFn,
      { ttl: 30 * 60 * 1000, tags: ['assets', `asset:${assetId}`] }
    );
  },

  getAssetsByType: async (type: string, clientId: string, queryFn: () => Promise<any>) => {
    return queryCache.query(
      `assets:type:${type}:client:${clientId}`,
      queryFn,
      { ttl: 10 * 60 * 1000, tags: ['assets', `client:${clientId}`, `assetType:${type}`] }
    );
  },

  // Campaign-related queries
  getCampaignById: async (campaignId: string, queryFn: () => Promise<any>) => {
    return queryCache.query(
      `campaign:${campaignId}`,
      queryFn,
      { ttl: 5 * 60 * 1000, tags: ['campaigns', `campaign:${campaignId}`] }
    );
  },

  getCampaignExecutions: async (campaignId: string, queryFn: () => Promise<any>) => {
    return queryCache.query(
      `campaign:${campaignId}:executions`,
      queryFn,
      { ttl: 2 * 60 * 1000, tags: ['campaigns', 'executions', `campaign:${campaignId}`] }
    );
  },

  // Template-related queries
  getTemplates: async (clientId: string, queryFn: () => Promise<any>) => {
    return queryCache.query(
      `templates:client:${clientId}`,
      queryFn,
      { ttl: 20 * 60 * 1000, tags: ['templates', `client:${clientId}`] }
    );
  },

  getTemplateById: async (templateId: string, queryFn: () => Promise<any>) => {
    return queryCache.query(
      `template:${templateId}`,
      queryFn,
      { ttl: 30 * 60 * 1000, tags: ['templates', `template:${templateId}`] }
    );
  },

  // Analytics queries (shorter TTL due to changing data)
  getAnalyticsOverview: async (clientId: string, queryFn: () => Promise<any>) => {
    return queryCache.query(
      `analytics:overview:client:${clientId}`,
      queryFn,
      { ttl: 5 * 60 * 1000, tags: ['analytics', `client:${clientId}`] }
    );
  },

  getExecutionStats: async (period: string, queryFn: () => Promise<any>) => {
    return queryCache.query(
      `analytics:executions:${period}`,
      queryFn,
      { ttl: 10 * 60 * 1000, tags: ['analytics', 'executions'] }
    );
  },

  // System-wide queries
  getSystemStats: async (queryFn: () => Promise<any>) => {
    return queryCache.query(
      'system:stats',
      queryFn,
      { ttl: 5 * 60 * 1000, tags: ['system'] }
    );
  },

  getRecentActivity: async (userId: string, queryFn: () => Promise<any>) => {
    return queryCache.query(
      `activity:recent:user:${userId}`,
      queryFn,
      { ttl: 2 * 60 * 1000, tags: ['activity', `user:${userId}`] }
    );
  },
};

/**
 * Cache invalidation helpers for common mutations
 */
export const cacheInvalidation = {
  // User operations
  userUpdated: (userId: string) => {
    queryCache.invalidateByTags([`user:${userId}`, 'users']);
  },

  userDeleted: (userId: string) => {
    queryCache.invalidateByTags([`user:${userId}`, 'users']);
  },

  // Client operations
  clientCreated: (userId: string) => {
    queryCache.invalidateByTags([`user:${userId}`, 'clients']);
  },

  clientUpdated: (clientId: string, userId: string) => {
    queryCache.invalidateByTags([`client:${clientId}`, `user:${userId}`, 'clients']);
  },

  clientDeleted: (clientId: string, userId: string) => {
    queryCache.invalidateByTags([`client:${clientId}`, `user:${userId}`, 'clients']);
  },

  // Asset operations
  assetCreated: (clientId: string) => {
    queryCache.invalidateByTags([`client:${clientId}`, 'assets']);
  },

  assetUpdated: (assetId: string, clientId: string) => {
    queryCache.invalidateByTags([`asset:${assetId}`, `client:${clientId}`, 'assets']);
  },

  assetDeleted: (assetId: string, clientId: string) => {
    queryCache.invalidateByTags([`asset:${assetId}`, `client:${clientId}`, 'assets']);
  },

  // Campaign operations
  campaignCreated: (clientId: string) => {
    queryCache.invalidateByTags([`client:${clientId}`, 'campaigns']);
  },

  campaignUpdated: (campaignId: string, clientId: string) => {
    queryCache.invalidateByTags([`campaign:${campaignId}`, `client:${clientId}`, 'campaigns']);
  },

  campaignExecuted: (campaignId: string, clientId: string) => {
    queryCache.invalidateByTags([
      `campaign:${campaignId}`, 
      `client:${clientId}`, 
      'campaigns', 
      'executions', 
      'analytics'
    ]);
  },

  // Template operations
  templateCreated: (clientId: string) => {
    queryCache.invalidateByTags([`client:${clientId}`, 'templates']);
  },

  templateUpdated: (templateId: string, clientId: string) => {
    queryCache.invalidateByTags([`template:${templateId}`, `client:${clientId}`, 'templates']);
  },

  // System operations
  systemStatsUpdated: () => {
    queryCache.invalidateByTags(['system', 'analytics']);
  },
};