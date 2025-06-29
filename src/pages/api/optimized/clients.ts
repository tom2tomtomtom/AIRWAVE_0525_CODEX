/**
 * Optimized Clients API Endpoint
 * Demonstrates performance optimizations: caching, compression, query optimization
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { withAPIOptimization, QueryOptimizer } from '@/middleware/performance/apiOptimization';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Request validation schema
const ClientQuerySchema = z.object({
  search: z.string().optional(),
  industry: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  sort_by: z.enum(['name', 'industry', 'created_at', 'updated_at']).default('name'),
  sort_order: z.enum(['asc', 'desc']).default('asc'),
});

interface Client {
  id: string;
  name: string;
  industry?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  campaign_count?: number;
}

interface ClientsResponse {
  success: true;
  data: Client[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
    query_time: number;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
}

/**
 * Optimized client fetching with performance enhancements
 */
async function getOptimizedClients(
  req: NextApiRequest,
  params: z.infer<typeof ClientQuerySchema>
): Promise<ClientsResponse> {
  const startTime = Date.now();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Build optimized query
  let query = supabase.from('clients').select(
    `
      id,
      name,
      industry,
      description,
      created_at,
      updated_at,
      campaigns!inner(count)
    `,
    { count: 'exact' }
  );

  // Add filters
  if (params.search) {
    query = query.or(
      `name.ilike.%${params.search}%,description.ilike.%${params.search}%,industry.ilike.%${params.search}%`
    );
  }

  if (params.industry) {
    query = query.eq('industry', params.industry);
  }

  // Add sorting
  query = query.order(params.sort_by, { ascending: params.sort_order === 'asc' });

  // Add pagination
  query = query.range(params.offset, params.offset + params.limit - 1);

  // Execute query with performance tracking
  const queryString = query.toString();
  const cached = QueryOptimizer.getCachedQuery(req.url || '', queryString);

  let result: { data: any[] | null; count: number | null };
  if (cached) {
    result = cached as { data: any[] | null; count: number | null };
  } else {
    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    result = { data, count };
    QueryOptimizer.trackQuery(req.url || '', queryString, result);
  }

  // Transform data for response
  const clients: Client[] = (result.data || []).map((client: any) => ({
    id: client.id,
    name: client.name,
    industry: client.industry,
    description: client.description,
    created_at: client.created_at,
    updated_at: client.updated_at,
    campaign_count: client.campaigns?.length || 0,
  }));

  const total = result.count || 0;
  const queryTime = Date.now() - startTime;

  return {
    success: true,
    data: clients,
    meta: {
      total,
      limit: params.limit,
      offset: params.offset,
      has_more: params.offset + params.limit < total,
      query_time: queryTime,
    },
  };
}

/**
 * Main handler with optimizations
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ClientsResponse | ErrorResponse>
): Promise<void> {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
    return;
  }

  try {
    // Validate query parameters
    const params = ClientQuerySchema.parse(req.query);

    // Get optimized clients data
    const response = await getOptimizedClients(req, params);

    // Set additional performance headers
    res.setHeader('X-Total-Count', response.meta.total.toString());
    res.setHeader('X-Query-Time', `${response.meta.query_time}ms`);
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count,X-Query-Time');

    res.status(200).json(response);
  } catch (error) {
    console.error('Clients API error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors,
      });
    } else {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
}

// Apply performance optimizations
export default withAPIOptimization(handler, {
  enableCaching: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  enableCompression: true,
  enableMetrics: true,
  enableQueryOptimization: true,
});
