import { NextRequest, NextResponse } from 'next/server';
import { getCache, CacheProfiles, cacheKey } from './redis-cache';
import { getLogger } from '@/lib/logger';

const logger = getLogger('cache-middleware');

export interface CacheMiddlewareOptions {
  ttl?: number;
  keyGenerator?: (req: NextRequest) => string;
  condition?: (req: NextRequest) => boolean;
  invalidateOn?: string[]; // HTTP methods that invalidate cache
  varyBy?: string[]; // Headers to include in cache key
  private?: boolean; // Whether to add Cache-Control: private
  staleWhileRevalidate?: number; // Seconds to serve stale content while revalidating
}

export interface CacheHeaders {
  'Cache-Control': string;
  'ETag'?: string;
  'Last-Modified'?: string;
  'Vary'?: string;
}

export class CacheMiddleware {
  private cache = getCache();
  
  // Create cache middleware for API routes
  createAPIMiddleware(options: CacheMiddlewareOptions = {}) {
    const {
      ttl = 300, // 5 minutes default
      keyGenerator = this.defaultKeyGenerator,
      condition = this.defaultCondition,
      invalidateOn = ['POST', 'PUT', 'PATCH', 'DELETE'],
      varyBy = ['Authorization', 'Accept-Language'],
      private: isPrivate = false,
      staleWhileRevalidate = 60
    } = options;
    
    return async (
      req: NextRequest,
      handler: (req: NextRequest) => Promise<NextResponse>
    ): Promise<NextResponse> => {
      const method = req.method;
      const cacheKeyStr = keyGenerator(req);
      
      // Handle cache invalidation
      if (invalidateOn.includes(method)) {
        await this.invalidatePattern(`api:${req.nextUrl.pathname}*`);
        logger.debug(`Cache invalidated for ${req.nextUrl.pathname} due to ${method} request`);
      }
      
      // Skip caching if condition is not met
      if (!condition(req)) {
        logger.debug(`Cache skipped for ${cacheKeyStr} due to condition`);
        return handler(req);
      }
      
      // Try to get cached response for GET requests
      if (method === 'GET') {
        const cached = await this.getCachedResponse(cacheKeyStr);
        if (cached) {
          logger.debug(`Cache HIT for API: ${cacheKeyStr}`);
          return this.createCachedResponse(cached, {
            isPrivate,
            maxAge: ttl,
            staleWhileRevalidate,
            varyBy
          });
        }
      }
      
      // Execute handler
      const response = await handler(req);
      
      // Cache successful GET responses
      if (method === 'GET' && response.status === 200) {
        await this.cacheResponse(cacheKeyStr, response, ttl);
        logger.debug(`Cache SET for API: ${cacheKeyStr}`);
      }
      
      // Add cache headers
      this.addCacheHeaders(response, {
        isPrivate,
        maxAge: ttl,
        staleWhileRevalidate,
        varyBy
      });
      
      return response;
    };
  }
  
  // Create cache middleware for pages
  createPageMiddleware(options: CacheMiddlewareOptions = {}) {
    const {
      ttl = 3600, // 1 hour default for pages
      keyGenerator = this.defaultPageKeyGenerator,
      condition = this.defaultPageCondition,
      varyBy = ['Accept-Language', 'Accept-Encoding'],
      private: isPrivate = false,
      staleWhileRevalidate = 300
    } = options;
    
    return async (
      req: NextRequest,
      handler: (req: NextRequest) => Promise<NextResponse>
    ): Promise<NextResponse> => {
      const cacheKeyStr = keyGenerator(req);
      
      // Skip caching if condition is not met
      if (!condition(req)) {
        return handler(req);
      }
      
      // Try to get cached page
      const cached = await this.getCachedResponse(cacheKeyStr);
      if (cached) {
        logger.debug(`Cache HIT for page: ${cacheKeyStr}`);
        return this.createCachedResponse(cached, {
          isPrivate,
          maxAge: ttl,
          staleWhileRevalidate,
          varyBy
        });
      }
      
      // Execute handler
      const response = await handler(req);
      
      // Cache successful responses
      if (response.status === 200) {
        await this.cacheResponse(cacheKeyStr, response, ttl);
        logger.debug(`Cache SET for page: ${cacheKeyStr}`);
      }
      
      // Add cache headers
      this.addCacheHeaders(response, {
        isPrivate,
        maxAge: ttl,
        staleWhileRevalidate,
        varyBy
      });
      
      return response;
    };
  }
  
  // Database query caching
  async cacheQuery<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    ttl: number = CacheProfiles.DATABASE_QUERY.ttl
  ): Promise<T> {
    const key = cacheKey(['db', queryKey]);
    
    // Try to get from cache
    const cached = await this.cache.get<T>(key, CacheProfiles.DATABASE_QUERY);
    if (cached !== null) {
      logger.debug(`Database cache HIT: ${queryKey}`);
      return cached;
    }
    
    // Execute query
    const result = await queryFn();
    
    // Cache result
    await this.cache.set(key, result, {
      ...CacheProfiles.DATABASE_QUERY,
      ttl
    });
    
    logger.debug(`Database cache SET: ${queryKey}`);
    return result;
  }
  
  // AI generation caching
  async cacheAIGeneration<T>(
    prompt: string,
    model: string,
    generationFn: () => Promise<T>,
    ttl: number = CacheProfiles.AI_GENERATION.ttl
  ): Promise<T> {
    const promptHash = this.hashString(prompt);
    const key = cacheKey(['ai', model, promptHash]);
    
    // Try to get from cache
    const cached = await this.cache.get<T>(key, CacheProfiles.AI_GENERATION);
    if (cached !== null) {
      logger.debug(`AI generation cache HIT: ${model}:${promptHash.substring(0, 8)}`);
      return cached;
    }
    
    // Execute generation
    const result = await generationFn();
    
    // Cache result
    await this.cache.set(key, result, {
      ...CacheProfiles.AI_GENERATION,
      ttl
    });
    
    logger.debug(`AI generation cache SET: ${model}:${promptHash.substring(0, 8)}`);
    return result;
  }
  
  // Session caching
  async cacheUserSession(
    userId: string,
    sessionData: any,
    ttl: number = CacheProfiles.USER_SESSION.ttl
  ): Promise<void> {
    const key = cacheKey(['session', userId]);
    await this.cache.set(key, sessionData, {
      ...CacheProfiles.USER_SESSION,
      ttl
    });
  }
  
  async getUserSession(userId: string): Promise<any | null> {
    const key = cacheKey(['session', userId]);
    return this.cache.get(key, CacheProfiles.USER_SESSION);
  }
  
  async invalidateUserSession(userId: string): Promise<void> {
    const key = cacheKey(['session', userId]);
    await this.cache.del(key, CacheProfiles.USER_SESSION);
  }
  
  // Cache invalidation
  async invalidatePattern(pattern: string): Promise<number> {
    return this.cache.clear(pattern);
  }
  
  async invalidateUserCache(userId: string): Promise<void> {
    await this.invalidatePattern(`*:user:${userId}:*`);
    await this.invalidatePattern(`session:${userId}*`);
  }
  
  async invalidateClientCache(clientId: string): Promise<void> {
    await this.invalidatePattern(`*:client:${clientId}:*`);
  }
  
  // Helper methods
  private async getCachedResponse(key: string): Promise<any | null> {
    return this.cache.get(key, CacheProfiles.API_RESPONSE);
  }
  
  private async cacheResponse(
    key: string, 
    response: NextResponse, 
    ttl: number
  ): Promise<void> {
    try {
      const body = await response.text();
      const cachedData = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body,
        timestamp: Date.now()
      };
      
      await this.cache.set(key, cachedData, {
        ...CacheProfiles.API_RESPONSE,
        ttl
      });
    } catch (error) {
      logger.error('Failed to cache response', error);
    }
  }
  
  private createCachedResponse(
    cached: any,
    options: {
      isPrivate: boolean;
      maxAge: number;
      staleWhileRevalidate: number;
      varyBy: string[];
    }
  ): NextResponse {
    const response = new NextResponse(cached.body, {
      status: cached.status,
      statusText: cached.statusText
    });
    
    // Restore original headers
    Object.entries(cached.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        response.headers.set(key, value);
      }
    });
    
    // Add cache hit indicator
    response.headers.set('X-Cache', 'HIT');
    response.headers.set('X-Cache-Time', new Date(cached.timestamp).toISOString());
    
    // Add cache control headers
    this.addCacheHeaders(response, options);
    
    return response;
  }
  
  private addCacheHeaders(
    response: NextResponse,
    options: {
      isPrivate: boolean;
      maxAge: number;
      staleWhileRevalidate: number;
      varyBy: string[];
    }
  ): void {
    const cacheControl = [];
    
    if (options.isPrivate) {
      cacheControl.push('private');
    } else {
      cacheControl.push('public');
    }
    
    cacheControl.push(`max-age=${options.maxAge}`);
    
    if (options.staleWhileRevalidate > 0) {
      cacheControl.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
    }
    
    response.headers.set('Cache-Control', cacheControl.join(', '));
    
    if (options.varyBy.length > 0) {
      response.headers.set('Vary', options.varyBy.join(', '));
    }
    
    // Add ETag for better caching
    if (!response.headers.has('ETag')) {
      const etag = this.generateETag(response);
      response.headers.set('ETag', etag);
    }
  }
  
  private defaultKeyGenerator(req: NextRequest): string {
    const url = req.nextUrl;
    const searchParams = url.searchParams.toString();
    return cacheKey([
      'api',
      url.pathname,
      searchParams || 'no-params',
      req.headers.get('Authorization')?.substring(0, 10) || 'no-auth'
    ]);
  }
  
  private defaultPageKeyGenerator(req: NextRequest): string {
    const url = req.nextUrl;
    const searchParams = url.searchParams.toString();
    return cacheKey([
      'page',
      url.pathname,
      searchParams || 'no-params',
      req.headers.get('Accept-Language') || 'no-lang'
    ]);
  }
  
  private defaultCondition(req: NextRequest): boolean {
    // Don't cache requests with authentication by default
    return !req.headers.has('Authorization');
  }
  
  private defaultPageCondition(req: NextRequest): boolean {
    // Cache pages for anonymous users
    return !req.headers.has('Authorization') && req.method === 'GET';
  }
  
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  private generateETag(response: NextResponse): string {
    const content = response.body?.toString() || '';
    const hash = this.hashString(content);
    return `"${hash}"`;
  }
}

// Singleton instance
let middlewareInstance: CacheMiddleware | null = null;

export const getCacheMiddleware = (): CacheMiddleware => {
  if (!middlewareInstance) {
    middlewareInstance = new CacheMiddleware();
  }
  return middlewareInstance;
};

// Convenience functions
export const cacheAPI = (options?: CacheMiddlewareOptions) => {
  return getCacheMiddleware().createAPIMiddleware(options);
};

export const cachePage = (options?: CacheMiddlewareOptions) => {
  return getCacheMiddleware().createPageMiddleware(options);
};

export const cacheQuery = <T>(
  queryKey: string,
  queryFn: () => Promise<T>,
  ttl?: number
): Promise<T> => {
  return getCacheMiddleware().cacheQuery(queryKey, queryFn, ttl);
};

export const cacheAI = <T>(
  prompt: string,
  model: string,
  generationFn: () => Promise<T>,
  ttl?: number
): Promise<T> => {
  return getCacheMiddleware().cacheAIGeneration(prompt, model, generationFn, ttl);
};