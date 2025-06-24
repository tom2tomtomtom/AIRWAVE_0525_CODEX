import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';
import { loggers } from '@/lib/logger';
import { 
  handleSupabaseError, 
  isRetryableError, 
  DEFAULT_RETRY_CONFIG, 
  RetryConfig 
} from './errors';
// Conditional import of Redis cache (server-side only)
let cached: any = null;
let CacheProfiles: any = {};

// Only import Redis cache on server-side
if (typeof window === 'undefined') {
  try {
    const cacheModule = require('@/lib/cache/redis-cache');
    cached = cacheModule.cached;
    CacheProfiles = cacheModule.CacheProfiles;
  } catch (error) {
    // Fallback if Redis is not available
    console.warn('Redis cache not available, queries will not be cached');
  }
}

// Helper type for table names
type TableName = keyof Database['public']['Tables'];

// Retry helper for transient failures
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: any;
  let delay = config.initialDelay || 1000;
  
  for (let attempt = 1; attempt <= (config.maxAttempts || 3); attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      if (!isRetryableError(error, config) || attempt === config.maxAttempts) {
        throw error;
      }
      
      loggers.supabase.warn(`Retrying operation (attempt ${attempt}/${config.maxAttempts})`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        delay});
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Exponential backoff
      delay = Math.min(
        delay * (config.backoffFactor || 2),
        config.maxDelay || 10000
      );
    }
  }
  
  throw lastError;
}

// Transaction helper
export async function withTransaction<T>(
  supabase: SupabaseClient<Database>,
  fn: (tx: SupabaseClient<Database>) => Promise<T>
): Promise<T> {
  // Note: Supabase doesn't have native transaction support in the JS client
  // This is a placeholder for future implementation when it becomes available
  // For now, we'll execute the function directly
  loggers.supabase.warn('Transaction support not yet available in Supabase JS client');
  return fn(supabase);
}

// RLS helper to ensure queries respect row-level security
export async function withRLS<T>(
  supabase: SupabaseClient<Database>,
  tableName: TableName,
  operation: 'select' | 'insert' | 'update' | 'delete',
  fn: () => Promise<T>
): Promise<T> {
  try {
    // Ensure we're using a client with proper auth context
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user && operation !== 'select') {
      throw new Error('Authentication required for this operation');
    }
    
    const result = await fn();
    
    loggers.supabase.debug('RLS operation completed', {
      table: tableName,
      operation,
      userId: user?.id});
    
    return result;
  } catch (error: any) {
    await handleSupabaseError(error, {
      operation: `${operation} with RLS`,
      table: tableName});
  }
}

// Cache wrapper for queries
export async function queryWithCache<T>(
  key: string,
  queryFn: () => Promise<T>,
  options?: {
    ttl?: number;
    profile?: keyof typeof CacheProfiles;
  }
): Promise<T> {
  const cacheKey = `supabase:${key}`;
  
  // Only use cache if available (server-side)
  if (cached) {
    // Try to get from cache first
    const cachedResult = await cached.get<T>(cacheKey);
    if (cachedResult !== null) {
      loggers.supabase.debug('Cache hit', { key: cacheKey });
      return cachedResult;
    }
  }
  
  // Execute query
  const result = await queryFn();
  
  // Cache the result if cache is available
  if (cached) {
    const profile = options?.profile ? CacheProfiles[options.profile] : undefined;
    const ttl = options?.ttl || profile?.ttl || 300; // Default 5 minutes
    
    await cached.set(cacheKey, result, ttl);
    loggers.supabase.debug('Cache set', { key: cacheKey, ttl });
  }
  
  return result;
}

// Batch query helper
export async function batchQuery<T>(
  supabase: SupabaseClient<Database>,
  tableName: TableName,
  ids: string[],
  options?: {
    chunkSize?: number;
    idColumn?: string;
  }
): Promise<T[]> {
  const chunkSize = options?.chunkSize || 100;
  const idColumn = options?.idColumn || 'id';
  const results: T[] = [];
  
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .in(idColumn, chunk);
    
    if (error) {
      await handleSupabaseError(error, {
        operation: 'batchQuery',
        table: tableName,
        metadata: { chunkIndex: i / chunkSize, chunkSize: chunk.length }});
    }
    
    results.push(...(data as T[]));
  }
  
  return results;
}

// Upsert with conflict handling
export async function upsertWithConflict<T extends Record<string, any>>(
  supabase: SupabaseClient<Database>,
  tableName: TableName,
  data: T | T[],
  options?: {
    onConflict?: string;
    ignoreDuplicates?: boolean;
  }
): Promise<T[]> {
  try {
    const { data: result, error } = await supabase
      .from(tableName)
      .upsert(data, {
        onConflict: options?.onConflict,
        ignoreDuplicates: options?.ignoreDuplicates})
      .select();
    
    if (error) {
      throw error;
    }
    
    return result as T[];
  } catch (error: any) {
    await handleSupabaseError(error, {
      operation: 'upsert',
      table: tableName,
      metadata: {},
        recordCount: Array.isArray(data) ? data.length : 1,
        onConflict: options?.onConflict }});
  }
}

// Paginated query helper
export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  ascending?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export async function paginatedQuery<T>(
  supabase: SupabaseClient<Database>,
  tableName: TableName,
  options: PaginationOptions = {}
): Promise<PaginatedResult<T>> {
  const page = options.page || 1;
  const pageSize = options.pageSize || 20;
  const offset = (page - 1) * pageSize;
  const orderBy = options.orderBy || 'created_at';
  const ascending = options.ascending ?? false;
  
  try {
    // Get total count
    const { count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    // Get paginated data
    const query = supabase
      .from(tableName)
      .select('*')
      .order(orderBy, { ascending })
      .range(offset, offset + pageSize - 1);
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);
    
    return {
      data: data as T[],
      total,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages};
  } catch (error: any) {
    await handleSupabaseError(error, {
      operation: 'paginatedQuery',
      table: tableName,
      metadata: { page, pageSize, orderBy, ascending }});
  }
}

// Soft delete helper (assumes deleted_at column)
export async function softDelete(
  supabase: SupabaseClient<Database>,
  tableName: TableName,
  id: string,
  options?: {
    idColumn?: string;
    deletedAtColumn?: string;
  }
): Promise<void> {
  const idColumn = options?.idColumn || 'id';
  const deletedAtColumn = options?.deletedAtColumn || 'deleted_at';
  
  try {
    const { error } = await supabase
      .from(tableName)
      .update({ [deletedAtColumn]: new Date().toISOString() })
      .eq(idColumn, id);
    
    if (error) {
      throw error;
    }
    
    loggers.supabase.info('Soft delete completed', {
      table: tableName,
      id});
  } catch (error: any) {
    await handleSupabaseError(error, {
      operation: 'softDelete',
      table: tableName,
      metadata: { id }});
  }
}