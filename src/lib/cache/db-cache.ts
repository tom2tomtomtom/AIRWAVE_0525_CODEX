import { cacheManager, CACHE_TTL } from '../cache-manager';
import { loggers } from '../logger';
import crypto from 'crypto';

// Database Cache namespaces
const DB_NAMESPACES = {
  CLIENTS: 'db:clients',
  ASSETS: 'db:assets',
  CAMPAIGNS: 'db:campaigns',
  TEMPLATES: 'db:templates',
  USER_PROFILES: 'db:profiles',
  MATRICES: 'db:matrices',
} as const;

// Generate cache key from query parameters
function generateQueryHash(query: string, params?: any[]): string {
  const content = { query, params: params || [] };
  return crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex').substring(0, 16);
}

// Client Data Caching
export class ClientCache {
  static async getClient(clientId: string, userId: string): Promise<any> {
    const key = `${userId}:client:${clientId}`;
    return await cacheManager.get(key, DB_NAMESPACES.CLIENTS);
  }

  static async setClient(clientId: string, userId: string, clientData: any): Promise<boolean> {
    const key = `${userId}:client:${clientId}`;
    const tags = [`user:${userId}`, `client:${clientId}`, 'clients'];

    const success = await cacheManager.set(
      key,
      clientData,
      {
        ttl: CACHE_TTL.CLIENT_DATA,
        tags,
      },
      DB_NAMESPACES.CLIENTS
    );

    if (success) {
      loggers.db.debug('Client data cached', { userId, clientId });
    }

    return success;
  }

  static async getUserClients(userId: string): Promise<any> {
    const key = `${userId}:clients:all`;
    return await cacheManager.get(key, DB_NAMESPACES.CLIENTS);
  }

  static async setUserClients(userId: string, clients: any[]): Promise<boolean> {
    const key = `${userId}:clients:all`;
    const tags = [`user:${userId}`, 'clients'];

    const success = await cacheManager.set(
      key,
      clients,
      {
        ttl: CACHE_TTL.CLIENT_DATA,
        tags,
      },
      DB_NAMESPACES.CLIENTS
    );

    if (success) {
      loggers.db.debug('User clients cached', { userId, count: clients.length });
    }

    return success;
  }

  static async invalidateClient(clientId: string): Promise<number> {
    return await cacheManager.invalidateByTag(`client:${clientId}`);
  }

  static async invalidateUser(userId: string): Promise<number> {
    return await cacheManager.invalidateByTag(`user:${userId}`);
  }
}

// Asset Data Caching
export class AssetCache {
  static async getAsset(assetId: string, userId: string): Promise<any> {
    const key = `${userId}:asset:${assetId}`;
    return await cacheManager.get(key, DB_NAMESPACES.ASSETS);
  }

  static async setAsset(assetId: string, userId: string, assetData: any): Promise<boolean> {
    const key = `${userId}:asset:${assetId}`;
    const tags = [`user:${userId}`, `asset:${assetId}`, 'assets'];

    const success = await cacheManager.set(
      key,
      assetData,
      {
        ttl: CACHE_TTL.ASSETS,
        tags,
      },
      DB_NAMESPACES.ASSETS
    );

    if (success) {
      loggers.db.debug('Asset data cached', { userId, assetId });
    }

    return success;
  }

  static async getClientAssets(clientId: string, userId: string): Promise<any> {
    const key = `${userId}:client:${clientId}:assets`;
    return await cacheManager.get(key, DB_NAMESPACES.ASSETS);
  }

  static async setClientAssets(clientId: string, userId: string, assets: any[]): Promise<boolean> {
    const key = `${userId}:client:${clientId}:assets`;
    const tags = [`user:${userId}`, `client:${clientId}`, 'assets'];

    const success = await cacheManager.set(
      key,
      assets,
      {
        ttl: CACHE_TTL.ASSETS,
        tags,
      },
      DB_NAMESPACES.ASSETS
    );

    if (success) {
      loggers.db.debug('Client assets cached', { userId, clientId, count: assets.length });
    }

    return success;
  }

  static async invalidateAsset(assetId: string): Promise<number> {
    return await cacheManager.invalidateByTag(`asset:${assetId}`);
  }

  static async invalidateClient(clientId: string): Promise<number> {
    return await cacheManager.invalidateByTag(`client:${clientId}`);
  }
}

// Campaign Data Caching
export class CampaignCache {
  static async getCampaign(campaignId: string, userId: string): Promise<any> {
    const key = `${userId}:campaign:${campaignId}`;
    return await cacheManager.get(key, DB_NAMESPACES.CAMPAIGNS);
  }

  static async setCampaign(
    campaignId: string,
    userId: string,
    campaignData: any
  ): Promise<boolean> {
    const key = `${userId}:campaign:${campaignId}`;
    const tags = [`user:${userId}`, `campaign:${campaignId}`, 'campaigns'];

    const success = await cacheManager.set(
      key,
      campaignData,
      {
        ttl: CACHE_TTL.CAMPAIGN_DATA,
        tags,
      },
      DB_NAMESPACES.CAMPAIGNS
    );

    if (success) {
      loggers.db.debug('Campaign data cached', { userId, campaignId });
    }

    return success;
  }

  static async getClientCampaigns(clientId: string, userId: string): Promise<any> {
    const key = `${userId}:client:${clientId}:campaigns`;
    return await cacheManager.get(key, DB_NAMESPACES.CAMPAIGNS);
  }

  static async setClientCampaigns(
    clientId: string,
    userId: string,
    campaigns: any[]
  ): Promise<boolean> {
    const key = `${userId}:client:${clientId}:campaigns`;
    const tags = [`user:${userId}`, `client:${clientId}`, 'campaigns'];

    const success = await cacheManager.set(
      key,
      campaigns,
      {
        ttl: CACHE_TTL.CAMPAIGN_DATA,
        tags,
      },
      DB_NAMESPACES.CAMPAIGNS
    );

    if (success) {
      loggers.db.debug('Client campaigns cached', { userId, clientId, count: campaigns.length });
    }

    return success;
  }

  static async invalidateCampaign(campaignId: string): Promise<number> {
    return await cacheManager.invalidateByTag(`campaign:${campaignId}`);
  }

  static async invalidateClient(clientId: string): Promise<number> {
    return await cacheManager.invalidateByTag(`client:${clientId}`);
  }
}

// User Profile Caching
export class UserProfileCache {
  static async getProfile(userId: string): Promise<any> {
    const key = `profile:${userId}`;
    return await cacheManager.get(key, DB_NAMESPACES.USER_PROFILES);
  }

  static async setProfile(userId: string, profileData: any): Promise<boolean> {
    const key = `profile:${userId}`;
    const tags = [`user:${userId}`, 'profiles'];

    const success = await cacheManager.set(
      key,
      profileData,
      {
        ttl: CACHE_TTL.CLIENT_DATA, // Use client data TTL for profiles
        tags,
      },
      DB_NAMESPACES.USER_PROFILES
    );

    if (success) {
      loggers.db.debug('User profile cached', { userId });
    }

    return success;
  }

  static async invalidateProfile(userId: string): Promise<number> {
    return await cacheManager.invalidateByTag(`user:${userId}`);
  }
}

// Generic Query Caching
export class QueryCache {
  static async get(query: string, params?: any[], namespace?: string): Promise<any> {
    const key = generateQueryHash(query, params);
    return await cacheManager.get(key, namespace || 'db:query');
  }

  static async set(
    query: string,
    params: any[] | undefined,
    result: any,
    ttl: number = CACHE_TTL.DB_QUERY,
    tags?: string[],
    namespace?: string
  ) {
    const key = generateQueryHash(query, params);

    const success = await cacheManager.set(
      key,
      result,
      {
        ttl,
        tags: tags || ['db-query'],
      },
      namespace || 'db:query'
    );

    if (success) {
      loggers.db.debug('Query result cached', { queryHash: key, ttl });
    }

    return success;
  }

  static async invalidateByTag(tag: string): Promise<number> {
    return await cacheManager.invalidateByTag(tag);
  }
}

// Database Cache Utilities
export class DBCacheUtils {
  // Clear all database cache for a user
  static async clearUserCache(userId: string): Promise<number> {
    const deleted = await cacheManager.invalidateByTag(`user:${userId}`);
    loggers.db.info('User database cache cleared', { userId, deletedEntries: deleted });
    return deleted;
  }

  // Clear specific database cache type
  static async clearCacheType(type: keyof typeof DB_NAMESPACES): Promise<boolean> {
    const namespace = DB_NAMESPACES[type];
    const success = await cacheManager.clear(namespace);
    loggers.db.info('Database cache type cleared', { type, namespace, success });
    return success;
  }

  // Get database cache statistics
  static async getCacheStats(): Promise<any> {
    const stats = await cacheManager.getStats();
    loggers.db.debug('Database cache stats retrieved', stats as any);
    return stats;
  }

  // Cache wrapper for database queries
  static async wrapQuery<T>(
    query: string,
    queryFn: () => Promise<T>,
    params?: any[],
    options: {
      ttl?: number;
      tags?: string[];
      namespace?: string;
    } = {}
  ): Promise<T> {
    const key = generateQueryHash(query, params);
    const namespace = options.namespace || 'db:query';

    return await cacheManager.wrap(
      key,
      queryFn,
      {
        ttl: options.ttl || CACHE_TTL.DB_QUERY,
        tags: options.tags || ['db-query'],
      },
      namespace
    );
  }
}

export default {
  ClientCache,
  AssetCache,
  CampaignCache,
  UserProfileCache,
  QueryCache,
  DBCacheUtils,
};
