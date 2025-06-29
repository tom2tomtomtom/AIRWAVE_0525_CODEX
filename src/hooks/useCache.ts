import { useState, useEffect, useCallback, useRef } from 'react';
import { apiCache, assetCache, userPreferencesCache, sessionCache } from '@/lib/cache/CacheManager';

// Cache types for different data categories
export type CacheType = 'api' | 'asset' | 'userPreferences' | 'session';

// Get the appropriate cache manager
const getCacheManager = (type: CacheType) => {
  switch (type) {
    case 'api': return apiCache;
    case 'asset': return assetCache;
    case 'userPreferences': return userPreferencesCache;
    case 'session': return sessionCache;
  }
};

interface UseCacheOptions {
  cacheType?: CacheType;
  ttl?: number;
  version?: string;
  refreshInterval?: number; // Auto-refresh data every X ms
  refreshOnFocus?: boolean; // Refresh when window gains focus
  refreshOnReconnect?: boolean; // Refresh when network reconnects
}

/**
 * Hook for caching data with automatic cache management
 */
export const useCache = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseCacheOptions = {}
) => {
  const {
    cacheType = 'api',
    ttl,
    version,
    refreshInterval,
    refreshOnFocus = false,
    refreshOnReconnect = false,
  } = options;

  const cache = getCacheManager(cacheType);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetcherRef = useRef(fetcher);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update fetcher ref when it changes
  fetcherRef.current = fetcher;

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Check cache first unless forcing refresh
    if (!forceRefresh) {
      const cacheOptions: any = {};
      if (version) cacheOptions.version = version;
      if (ttl) cacheOptions.ttl = ttl;
      
      const cached = cache.get<T>(key, cacheOptions);
      if (cached) {
        setData(cached);
        setError(null);
        return cached;
      }
    }

    setLoading(true);
    setError(null);

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      const result = await fetcherRef.current();
      
      // Check if request was aborted
      if (abortControllerRef.current.signal.aborted) {
        return;
      }

      // Cache the result
      const cacheSetOptions: any = {};
      if (version) cacheSetOptions.version = version;
      if (ttl) cacheSetOptions.ttl = ttl;
      
      cache.set(key, result, cacheSetOptions);
      setData(result);
      setLoading(false);
      return result;
    } catch (err: any) {
      if (!abortControllerRef.current.signal.aborted) {
        setError(err);
        setLoading(false);
      }
      throw err;
    }
  }, [key, cache, version, ttl]);

  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  const mutate = useCallback((newData: T | ((prev: T | null) => T)) => {
    const updatedData = typeof newData === 'function' 
      ? (newData as (prev: T | null) => T)(data)
      : newData;
    
    const cacheSetOptions: any = {};
    if (version) cacheSetOptions.version = version;
    if (ttl) cacheSetOptions.ttl = ttl;
    
    cache.set(key, updatedData, cacheSetOptions);
    setData(updatedData);
  }, [key, cache, version, ttl, data]);

  const invalidate = useCallback(() => {
    cache.delete(key);
    setData(null);
  }, [key, cache]);

  // Initial fetch
  useEffect(() => {
    fetchData();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  // Auto-refresh interval
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(() => {
      fetchData(true);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  // Refresh on window focus
  useEffect(() => {
    if (!refreshOnFocus) return;

    const handleFocus = () => {
      fetchData(true);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchData, refreshOnFocus]);

  // Refresh on network reconnect
  useEffect(() => {
    if (!refreshOnReconnect) return;

    const handleOnline = () => {
      fetchData(true);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchData, refreshOnReconnect]);

  return {
    data,
    loading,
    error,
    refresh,
    mutate,
    invalidate,
  };
};

/**
 * Hook for caching API responses specifically
 */
export const useApiCache = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options: Omit<UseCacheOptions, 'cacheType'> = {}
) => {
  return useCache(key, fetcher, { ...options, cacheType: 'api' });
};

/**
 * Hook for caching asset data
 */
export const useAssetCache = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options: Omit<UseCacheOptions, 'cacheType'> = {}
) => {
  return useCache(key, fetcher, { ...options, cacheType: 'asset' });
};

/**
 * Hook for caching user preferences
 */
export const useUserPreferencesCache = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options: Omit<UseCacheOptions, 'cacheType'> = {}
) => {
  return useCache(key, fetcher, { ...options, cacheType: 'userPreferences' });
};

/**
 * Hook for managing cache state globally
 */
export const useCacheManager = (cacheType: CacheType = 'api') => {
  const cache = getCacheManager(cacheType);

  const clearCache = useCallback(() => {
    cache.clear();
  }, [cache]);

  const deleteKey = useCallback((key: string) => {
    cache.delete(key);
  }, [cache]);

  const getCacheStats = useCallback(() => {
    return cache.getStats();
  }, [cache]);

  const setCacheData = useCallback(<T>(key: string, data: T, options?: { ttl?: number; version?: string }) => {
    cache.set(key, data, options);
  }, [cache]);

  const getCacheData = useCallback(<T>(key: string, options?: { version?: string }) => {
    return cache.get<T>(key, options);
  }, [cache]);

  return {
    clearCache,
    deleteKey,
    getCacheStats,
    setCacheData,
    getCacheData,
  };
};

/**
 * Hook for batch operations on cached data
 */
export const useBatchCache = <T>(
  keys: string[],
  fetcher: (key: string) => Promise<T>,
  options: UseCacheOptions = {}
) => {
  const [data, setData] = useState<Record<string, T>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, Error>>({});

  const cache = getCacheManager(options.cacheType || 'api');

  const fetchBatch = useCallback(async (keysToFetch: string[]) => {
    const promises = keysToFetch.map(async (key) => {
      setLoading(prev => ({ ...prev, [key]: true }));
      
      try {
        // Check cache first
        const cacheGetOptions: any = {};
        if (options.version) cacheGetOptions.version = options.version;
        if (options.ttl) cacheGetOptions.ttl = options.ttl;
        
        const cached = cache.get<T>(key, cacheGetOptions);
        if (cached) {
          setData(prev => ({ ...prev, [key]: cached }));
          setLoading(prev => ({ ...prev, [key]: false }));
          return;
        }

        // Fetch data
        const result = await fetcher(key);
        
        const cacheSetOptions: any = {};
        if (options.version) cacheSetOptions.version = options.version;
        if (options.ttl) cacheSetOptions.ttl = options.ttl;
        
        cache.set(key, result, cacheSetOptions);
        setData(prev => ({ ...prev, [key]: result }));
      } catch (error: any) {
        setErrors(prev => ({ ...prev, [key]: error }));
      } finally {
        setLoading(prev => ({ ...prev, [key]: false }));
      }
    });

    await Promise.allSettled(promises);
  }, [cache, fetcher, options.version, options.ttl]);

  useEffect(() => {
    if (keys.length > 0) {
      fetchBatch(keys);
    }
  }, [keys, fetchBatch]);

  const refresh = useCallback((specificKeys?: string[]) => {
    const keysToRefresh = specificKeys || keys;
    // Clear cache for these keys first
    keysToRefresh.forEach(key => cache.delete(key));
    return fetchBatch(keysToRefresh);
  }, [keys, cache, fetchBatch]);

  return {
    data,
    loading,
    errors,
    refresh,
  };
};