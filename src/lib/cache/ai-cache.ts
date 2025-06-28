import { cacheManager, CACHE_TTL } from '../cache-manager';
import { loggers } from '../logger';
import crypto from 'crypto';

// AI Cache namespaces
const AI_NAMESPACES = {
  BRIEF_ANALYSIS: 'ai:brief',
  COPY_GENERATION: 'ai:copy',
  IMAGE_GENERATION: 'ai:image',
  VIDEO_GENERATION: 'ai:video',
  MOTIVATIONS: 'ai:motivations',
  CONTENT_OPTIMIZATION: 'ai:optimization',
} as const;

// Generate cache key from content hash
function generateContentHash(content: string | object): string {
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
}

// Brief Analysis Caching
export class BriefAnalysisCache {
  static async get(briefContent: string, userId: string): Promise<any> {
    const key = `${userId}:${generateContentHash(briefContent)}`;
    return await cacheManager.get(key, AI_NAMESPACES.BRIEF_ANALYSIS);
  }

  static async set(briefContent: string, userId: string, analysis: any): Promise<boolean> {
    const key = `${userId}:${generateContentHash(briefContent)}`;
    const tags = [`user:${userId}`, 'brief-analysis'];

    const success = await cacheManager.set(
      key,
      analysis,
      {
        ttl: CACHE_TTL.BRIEF_ANALYSIS,
        tags,
      },
      AI_NAMESPACES.BRIEF_ANALYSIS
    );

    if (success) {
      loggers.ai.debug('Brief analysis cached', { userId, keyHash: key });
    }

    return success;
  }

  static async invalidateUser(userId: string): Promise<number> {
    return await cacheManager.invalidateByTag(`user:${userId}`);
  }
}

// Copy Generation Caching
export class CopyGenerationCache {
  static async get(prompt: string, motivations: string[], userId: string): Promise<any> {
    const content = { prompt, motivations: motivations.sort() };
    const key = `${userId}:${generateContentHash(content)}`;
    return await cacheManager.get(key, AI_NAMESPACES.COPY_GENERATION);
  }

  static async set(
    prompt: string,
    motivations: string[],
    userId: string,
    generatedCopy: any
  ): Promise<boolean> {
    const content = { prompt, motivations: motivations.sort() };
    const key = `${userId}:${generateContentHash(content)}`;
    const tags = [`user:${userId}`, 'copy-generation'];

    const success = await cacheManager.set(
      key,
      generatedCopy,
      {
        ttl: CACHE_TTL.COPY_GENERATION,
        tags,
      },
      AI_NAMESPACES.COPY_GENERATION
    );

    if (success) {
      loggers.ai.debug('Copy generation cached', { userId, keyHash: key });
    }

    return success;
  }

  static async invalidateUser(userId: string): Promise<number> {
    return await cacheManager.invalidateByTag(`user:${userId}`);
  }
}

// Image Generation Caching
export class ImageGenerationCache {
  static async get(
    prompt: string,
    style: string,
    aspectRatio: string,
    userId: string
  ): Promise<any> {
    const content = { prompt, style, aspectRatio };
    const key = `${userId}:${generateContentHash(content)}`;
    return await cacheManager.get(key, AI_NAMESPACES.IMAGE_GENERATION);
  }

  static async set(
    prompt: string,
    style: string,
    aspectRatio: string,
    userId: string,
    generatedImages: any
  ): Promise<boolean> {
    const content = { prompt, style, aspectRatio };
    const key = `${userId}:${generateContentHash(content)}`;
    const tags = [`user:${userId}`, 'image-generation'];

    const success = await cacheManager.set(
      key,
      generatedImages,
      {
        ttl: CACHE_TTL.IMAGE_GENERATION,
        tags,
      },
      AI_NAMESPACES.IMAGE_GENERATION
    );

    if (success) {
      loggers.ai.debug('Image generation cached', { userId, keyHash: key });
    }

    return success;
  }

  static async invalidateUser(userId: string): Promise<number> {
    return await cacheManager.invalidateByTag(`user:${userId}`);
  }
}

// Video Generation Caching
export class VideoGenerationCache {
  static async get(prompt: string, style: string, duration: number, userId: string): Promise<any> {
    const content = { prompt, style, duration };
    const key = `${userId}:${generateContentHash(content)}`;
    return await cacheManager.get(key, AI_NAMESPACES.VIDEO_GENERATION);
  }

  static async set(
    prompt: string,
    style: string,
    duration: number,
    userId: string,
    generatedVideos: any
  ): Promise<boolean> {
    const content = { prompt, style, duration };
    const key = `${userId}:${generateContentHash(content)}`;
    const tags = [`user:${userId}`, 'video-generation'];

    const success = await cacheManager.set(
      key,
      generatedVideos,
      {
        ttl: CACHE_TTL.VIDEO_GENERATION,
        tags,
      },
      AI_NAMESPACES.VIDEO_GENERATION
    );

    if (success) {
      loggers.ai.debug('Video generation cached', { userId, keyHash: key });
    }

    return success;
  }

  static async invalidateUser(userId: string): Promise<number> {
    return await cacheManager.invalidateByTag(`user:${userId}`);
  }
}

// Motivations Caching
export class MotivationsCache {
  static async get(briefContent: string, userId: string): Promise<any> {
    const key = `${userId}:${generateContentHash(briefContent)}`;
    return await cacheManager.get(key, AI_NAMESPACES.MOTIVATIONS);
  }

  static async set(briefContent: string, userId: string, motivations: any): Promise<boolean> {
    const key = `${userId}:${generateContentHash(briefContent)}`;
    const tags = [`user:${userId}`, 'motivations'];

    const success = await cacheManager.set(
      key,
      motivations,
      {
        ttl: CACHE_TTL.BRIEF_ANALYSIS, // Same TTL as brief analysis
        tags,
      },
      AI_NAMESPACES.MOTIVATIONS
    );

    if (success) {
      loggers.ai.debug('Motivations cached', { userId, keyHash: key });
    }

    return success;
  }

  static async invalidateUser(userId: string): Promise<number> {
    return await cacheManager.invalidateByTag(`user:${userId}`);
  }
}

// Content Optimization Caching
export class ContentOptimizationCache {
  static async get(content: string, platform: string, userId: string): Promise<any> {
    const cacheContent = { content, platform };
    const key = `${userId}:${generateContentHash(cacheContent)}`;
    return await cacheManager.get(key, AI_NAMESPACES.CONTENT_OPTIMIZATION);
  }

  static async set(
    content: string,
    platform: string,
    userId: string,
    optimization: any
  ): Promise<boolean> {
    const cacheContent = { content, platform };
    const key = `${userId}:${generateContentHash(cacheContent)}`;
    const tags = [`user:${userId}`, 'content-optimization'];

    const success = await cacheManager.set(
      key,
      optimization,
      {
        ttl: CACHE_TTL.COPY_GENERATION, // Same TTL as copy generation
        tags,
      },
      AI_NAMESPACES.CONTENT_OPTIMIZATION
    );

    if (success) {
      loggers.ai.debug('Content optimization cached', { userId, keyHash: key });
    }

    return success;
  }

  static async invalidateUser(userId: string): Promise<number> {
    return await cacheManager.invalidateByTag(`user:${userId}`);
  }
}

// Utility functions for AI cache management
export class AICacheUtils {
  // Clear all AI cache for a user
  static async clearUserCache(userId: string): Promise<number> {
    const deleted = await cacheManager.invalidateByTag(`user:${userId}`);
    loggers.ai.info('User AI cache cleared', { userId, deletedEntries: deleted });
    return deleted;
  }

  // Clear specific AI cache type
  static async clearCacheType(type: keyof typeof AI_NAMESPACES): Promise<boolean> {
    const namespace = AI_NAMESPACES[type];
    const success = await cacheManager.clear(namespace);
    loggers.ai.info('AI cache type cleared', { type, namespace, success });
    return success;
  }

  // Get AI cache statistics
  static async getCacheStats(): Promise<any> {
    const stats = await cacheManager.getStats();
    loggers.ai.debug('AI cache stats retrieved', stats as any);
    return stats;
  }

  // Warm up cache with common requests
  static async warmUpCache(userId: string, commonRequests: any[]): Promise<number> {
    let warmedUp = 0;

    for (const request of commonRequests) {
      try {
        // This would be implemented based on specific warming strategies
        // For now, just log the warming attempt
        loggers.ai.debug('Cache warm-up attempt', { userId, request: request.type });
        warmedUp++;
      } catch (error: any) {
        loggers.ai.error('Cache warm-up failed', error, { userId, request });
      }
    }

    loggers.ai.info('Cache warm-up completed', { userId, warmedUp, total: commonRequests.length });
    return warmedUp;
  }
}

export default {
  BriefAnalysisCache,
  CopyGenerationCache,
  ImageGenerationCache,
  VideoGenerationCache,
  MotivationsCache,
  ContentOptimizationCache,
  AICacheUtils,
};
