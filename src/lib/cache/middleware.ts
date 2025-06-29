// API route caching middleware for Next.js

/**
 * Specialized caching middlewares for different route types
 */
export const cacheMiddlewares = {
  // Short-term caching for frequently changing data
  shortTerm: { ttl: 2 * 60 * 1000, tags: ['short-term'] },
  
  // Medium-term caching for moderately changing data
  mediumTerm: { ttl: 10 * 60 * 1000, tags: ['medium-term'] },
  
  // Long-term caching for rarely changing data
  longTerm: { ttl: 60 * 60 * 1000, tags: ['long-term'] },
  
  // Asset caching (longer TTL for static content)
  assets: { ttl: 30 * 60 * 1000, tags: ['assets'] },
  
  // Analytics caching (shorter TTL for reporting data)
  analytics: { ttl: 5 * 60 * 1000, tags: ['analytics'] },
  
  // Template caching (longer TTL for relatively static data)
  templates: { ttl: 20 * 60 * 1000, tags: ['templates'] },
};

/**
 * Cache invalidation patterns
 */
export const invalidationPatterns = {
  user: (userId: string) => [`user:${userId}`, 'user-data'],
  client: (clientId: string) => [`client:${clientId}`, 'client-data'],
  assets: (clientId: string) => ['assets', `client:${clientId}`],
  campaigns: (clientId: string) => ['campaigns', `client:${clientId}`, 'analytics'],
  analytics: () => ['analytics'],
  templates: (clientId: string) => ['templates', `client:${clientId}`],
};