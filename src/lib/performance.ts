import { NextApiRequest, NextApiResponse } from 'next';
import compression from 'compression';
import { loggers } from './logger';
import { env } from './env';
import crypto from 'crypto';

// Cache control headers for different resource types
const CACHE_CONTROL = {
  // Static assets - cache for 1 year
  static: 'public, max-age=31536000, immutable',

  // API responses - cache for 5 minutes with revalidation
  api: 'public, max-age=300, s-maxage=300, stale-while-revalidate=60',

  // Private data - no caching
  private: 'private, no-cache, no-store, must-revalidate',

  // Dynamic content - short cache with revalidation
  dynamic: 'public, max-age=60, s-maxage=60, stale-while-revalidate=30',
};

// Response compression middleware
export const compressionMiddleware = compression({
  // Enable compression for responses > 1KB
  threshold: 1024,

  // Compression level (1-9, higher = better compression but slower)
  level: 6,

  // Filter function to determine if response should be compressed
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Use compression's default filter
    return compression.filter(req, res);
  },
});

// Performance headers middleware
export function performanceHeaders(type: keyof typeof CACHE_CONTROL = 'api') {
  return (_req: NextApiRequest, res: NextApiResponse, next: () => void) => {
    // Add cache control headers
    res.setHeader('Cache-Control', CACHE_CONTROL[type]);

    // Add timing headers
    res.setHeader('X-Response-Time', Date.now().toString());

    // Add server timing header
    const startTime = process.hrtime.bigint();

    // Override res.end to calculate response time
    const originalEnd = res.end.bind(res);
    res.end = function (...args: any[]) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      res.setHeader('Server-Timing', `total;dur=${duration.toFixed(2)}`);
      res.setHeader('X-Response-Time-Ms', duration.toFixed(2));

      return originalEnd(...args);
    };

    // Continue to next middleware
    next();
  };
}

// Database query optimization hints
export const dbOptimizations = {
  // Connection pooling configuration
  poolConfig: {
    min: 2,
    max: env.DB_POOL_SIZE || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    statement_timeout: env.DB_TIMEOUT || 30000,
  },
  // Query optimization hints
  queryHints: {
    // Use prepared statements
    usePreparedStatements: true,

    // Enable query caching
    enableQueryCache: true,

    // Batch size for bulk operations
    batchSize: 1000,

    // Default limit for list queries
    defaultLimit: 50,
    maxLimit: 200,
  },
  // Index hints for common queries
  indexHints: {
    // Assets queries
    assets: {
      byClientId: 'idx_assets_client_id',
      byType: 'idx_assets_type',
      byTags: 'idx_assets_tags',
      byCreatedAt: 'idx_assets_created_at',
    },
    // Campaigns queries
    campaigns: {
      byClientId: 'idx_campaigns_client_id',
      byStatus: 'idx_campaigns_status',
      byDateRange: 'idx_campaigns_start_date_end_date',
    },
    // Templates queries
    templates: {
      byPlatform: 'idx_templates_platform',
      byContentType: 'idx_templates_content_type',
      byPerformance: 'idx_templates_performance_score',
    },
  },
};

// Pagination helper with optimization
export interface PaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
}

export function optimizePagination(options: PaginationOptions): { offset: number; limit: number } {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(
    Math.max(1, options.limit || dbOptimizations.queryHints.defaultLimit),
    dbOptimizations.queryHints.maxLimit
  );

  const offset = (page - 1) * limit;

  return { offset, limit };
}

// Query performance tracking
export async function trackQueryPerformance<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = process.hrtime.bigint();

  try {
    const result = await queryFn();

    const duration = Number(process.hrtime.bigint() - startTime) / 1000000; // ms

    // Log slow queries
    if (duration > 1000) {
      loggers.db.warn('Slow query detected', {
        queryName,
        duration: `${duration.toFixed(2)}ms`,
      });
    } else {
      loggers.db.debug('Query executed', {
        queryName,
        duration: `${duration.toFixed(2)}ms`,
      });
    }

    return result;
  } catch (error: any) {
    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;

    loggers.db.error('Query failed', error, {
      queryName,
      duration: `${duration.toFixed(2)}ms`,
    });

    throw error;
  }
}

// Response size optimization
export function optimizeResponse<T extends Record<string, any>>(
  data: T,
  fields?: string[]
): Partial<T> {
  if (!fields || fields.length === 0) {
    return data;
  }

  // If data is an array, map over each item
  if (Array.isArray(data)) {
    return data.map((item: any) => pickFields(item, fields)) as any;
  }

  // Otherwise, pick fields from single object
  return pickFields(data, fields);
}

function pickFields<T extends Record<string, any>>(obj: T, fields: string[]): Partial<T> {
  const result: any = {};

  for (const field of fields) {
    if (field.includes('.')) {
      // Handle nested fields
      const parts = field.split('.');
      let value: any = obj;

      for (const part of parts) {
        value = value?.[part];
      }

      setNestedField(result, parts, value);
    } else if (field in obj) {
      result[field] = obj[field as keyof T];
    }
  }

  return result;
}

function setNestedField(obj: any, path: string[], value: any): void {
  let current = obj;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (key && !(key in current)) {
      current[key] = {};
    }
    if (key) {
      current = current[key];
    }
  }

  const lastKey = path[path.length - 1];
  if (lastKey && current) {
    current[lastKey] = value;
  }
}

// ETags for caching
export function generateETag(data: any): string {
  const hash = crypto.createHash('md5');
  hash.update(JSON.stringify(data));
  return `"${hash.digest('hex')}"`;
}

export function handleETag(req: NextApiRequest, res: NextApiResponse, data: any): boolean {
  const etag = generateETag(data);
  res.setHeader('ETag', etag);

  const clientETag = req.headers['if-none-match'];

  if (clientETag === etag) {
    res.status(304).end();
    return true;
  }

  return false;
}

// Export all optimizations
export default {
  compressionMiddleware,
  performanceHeaders,
  dbOptimizations,
  optimizePagination,
  trackQueryPerformance,
  optimizeResponse,
  generateETag,
  handleETag,
};
