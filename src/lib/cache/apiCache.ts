// API-specific caching utilities with request deduplication and background refresh
import { apiCache } from './CacheManager';

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  cache?: boolean;
  cacheTTL?: number;
  cacheVersion?: string;
  backgroundRefresh?: boolean; // Refresh in background after serving cached data
  dedupe?: boolean; // Deduplicate simultaneous requests
}

interface CachedResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  timestamp: number;
}

// Store for in-flight requests to prevent duplicates
const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Enhanced fetch with caching, deduplication, and background refresh
 */
export const cachedFetch = async <T = any>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<T> => {
  const {
    method = 'GET',
    headers = {},
    body,
    cache = method === 'GET',
    cacheTTL = 2 * 60 * 1000, // 2 minutes
    cacheVersion,
    backgroundRefresh = false,
    dedupe = true,
  } = options;

  // Only cache GET requests by default
  const shouldCache = cache && method === 'GET';
  
  // Create cache key from URL and relevant options
  const cacheKey = createCacheKey(url, method, body);

  // Check for cached response first
  if (shouldCache) {
    const cacheGetOptions: any = {};
    if (cacheVersion) cacheGetOptions.version = cacheVersion;
    if (cacheTTL) cacheGetOptions.ttl = cacheTTL;
    
    const cached = apiCache.get<CachedResponse<T>>(cacheKey, cacheGetOptions);
    
    if (cached) {
      // If background refresh is enabled, trigger refresh but return cached data
      if (backgroundRefresh) {
        // Don't await - let it refresh in background
        performRequest<T>(url, method, headers, body, cacheKey, cacheTTL, cacheVersion);
      }
      return cached.data;
    }
  }

  // Check for in-flight request to prevent duplicates
  if (dedupe && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  // Perform the actual request
  const requestPromise = performRequest<T>(url, method, headers, body, cacheKey, cacheTTL, cacheVersion, shouldCache);
  
  // Store in-flight request
  if (dedupe) {
    inFlightRequests.set(cacheKey, requestPromise);
    
    // Clean up after completion
    requestPromise.finally(() => {
      inFlightRequests.delete(cacheKey);
    });
  }

  return requestPromise;
};

/**
 * Perform the actual HTTP request
 */
const performRequest = async <T>(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: any,
  cacheKey: string,
  cacheTTL: number,
  cacheVersion?: string,
  shouldCache = false
): Promise<T> => {
  const requestOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && method !== 'GET') {
    requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  try {
    const response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Cache successful responses
    if (shouldCache) {
      const cachedResponse: CachedResponse<T> = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        timestamp: Date.now(),
      };
      
      const cacheSetOptions: any = { ttl: cacheTTL };
      if (cacheVersion) cacheSetOptions.version = cacheVersion;
      
      apiCache.set(cacheKey, cachedResponse, cacheSetOptions);
    }
    
    return data;
  } catch (error) {
    console.error(`API request failed for ${url}:`, error);
    throw error;
  }
};

/**
 * Create consistent cache key from request parameters
 */
const createCacheKey = (url: string, method: string, body?: any): string => {
  let key = `${method}:${url}`;
  
  if (body && method !== 'GET') {
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    key += `:${btoa(bodyString).slice(0, 20)}`; // Use base64 hash of body
  }
  
  return key;
};

/**
 * Invalidate cached responses by pattern
 */
export const invalidateApiCache = (pattern?: string): void => {
  if (!pattern) {
    apiCache.clear();
    return;
  }

  const stats = apiCache.getStats();
  const keysToDelete = stats.memoryKeys.filter(key => key.includes(pattern));
  keysToDelete.forEach(key => apiCache.delete(key));
};

/**
 * Pre-warm cache with expected API calls
 */
export const preWarmCache = async (urls: string[]): Promise<void> => {
  const promises = urls.map(url => 
    cachedFetch(url, { backgroundRefresh: false }).catch(err => {
      console.warn(`Failed to pre-warm cache for ${url}:`, err);
    })
  );
  
  await Promise.allSettled(promises);
};

/**
 * Batch API requests with caching
 */
export const batchApiRequest = async <T>(
  requests: Array<{ url: string; options?: ApiRequestOptions }>
): Promise<T[]> => {
  const promises = requests.map(({ url, options }) => 
    cachedFetch<T>(url, options)
  );
  
  const results = await Promise.allSettled(promises);
  
  return results.map(result => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error('Batch request failed:', result.reason);
      throw result.reason;
    }
  });
};

/**
 * Smart cache invalidation based on data mutations
 */
export const invalidateRelatedCache = (resourceType: string, resourceId?: string): void => {
  const patterns = [
    resourceType, // e.g., 'clients', 'assets', 'campaigns'
    resourceId ? `${resourceType}/${resourceId}` : null,
    resourceId ? `${resourceType}?` : null, // Query endpoints
  ].filter(Boolean) as string[];

  patterns.forEach(pattern => invalidateApiCache(pattern));
};

/**
 * Cache warming strategies for common data
 */
export const cacheWarmingStrategies = {
  // Warm essential user data
  essential: async (userId: string) => {
    await preWarmCache([
      '/api/auth/session',
      `/api/clients?user_id=${userId}`,
      '/api/notifications',
    ]);
  },

  // Warm dashboard data
  dashboard: async () => {
    await preWarmCache([
      '/api/dashboard/stats',
      '/api/analytics/overview',
      '/api/executions?limit=10',
    ]);
  },

  // Warm campaign builder data
  campaignBuilder: async (clientId: string) => {
    await preWarmCache([
      `/api/templates?client_id=${clientId}`,
      `/api/assets?client_id=${clientId}`,
      `/api/campaigns?client_id=${clientId}&limit=5`,
    ]);
  },

  // Warm asset library
  assetLibrary: async (clientId: string) => {
    await preWarmCache([
      `/api/assets?client_id=${clientId}`,
      `/api/assets?client_id=${clientId}&type=image`,
      `/api/assets?client_id=${clientId}&type=video`,
    ]);
  },
};

/**
 * Cache performance metrics
 */
export const getCacheMetrics = () => {
  const stats = apiCache.getStats();
  const inFlightCount = inFlightRequests.size;
  
  return {
    ...stats,
    inFlightRequests: inFlightCount,
    hitRate: calculateHitRate(),
  };
};

// Simple hit rate calculation (could be enhanced with more sophisticated tracking)
let cacheHits = 0;
let cacheMisses = 0;

const originalGet = apiCache.get.bind(apiCache);
apiCache.get = function<T>(key: string, options?: any): T | null {
  const result = originalGet<T>(key, options);
  if (result) {
    cacheHits++;
  } else {
    cacheMisses++;
  }
  return result;
};

const calculateHitRate = (): number => {
  const total = cacheHits + cacheMisses;
  return total > 0 ? (cacheHits / total) * 100 : 0;
};