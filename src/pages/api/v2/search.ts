/**
 * Global Search API Endpoint
 * Provides unified search across all AIRWAVE content types
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/withAuth';
import { withRateLimit } from '@/middleware/withRateLimit';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

const SearchRequestSchema = z.object({
  query: z.string().min(1).max(100),
  limit: z.number().min(1).max(50).optional().default(20),
  types: z.array(z.enum(['brief', 'template', 'asset', 'campaign', 'client', 'page'])).optional(),
  clientId: z.string().uuid().optional(),
});

interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: 'brief' | 'template' | 'asset' | 'campaign' | 'client' | 'page';
  url?: string;
  metadata?: {
    date?: string;
    status?: string;
    tags?: string[];
    clientName?: string;
  };
}

/**
 * Search across clients
 */
async function searchClients(
  query: string,
  userId: string,
  limit: number
): Promise<SearchResult[]> {
  // Sanitize the search query to prevent SQL injection
  const { sanitizeInput } = await import('@/utils/sanitization');
  const sanitizedQuery = sanitizeInput(query);

  // Use parameterized search for security
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, description, created_at, brand_colors')
    .eq('user_id', userId)
    .or(`name.ilike.%${sanitizedQuery}%,description.ilike.%${sanitizedQuery}%`)
    .limit(limit);

  if (error) {
    console.error('Client search error:', error);
    return [];
  }

  return data.map(client => ({
    id: client.id,
    title: client.name,
    description: client.description || 'Client account',
    type: 'client' as const,
    url: `/clients/${client.id}`,
    metadata: {
      date: new Date(client.created_at).toLocaleDateString(),
      status: 'active',
    },
  }));
}

/**
 * Search across campaigns
 */
async function searchCampaigns(
  query: string,
  userId: string,
  limit: number
): Promise<SearchResult[]> {
  // Sanitize the search query to prevent SQL injection
  const { sanitizeInput } = await import('@/utils/sanitization');
  const sanitizedQuery = sanitizeInput(query);

  const { data, error } = await supabase
    .from('campaigns')
    .select(
      `
      id, name, description, created_at, status,
      clients!inner(name, user_id)
    `
    )
    .eq('clients.user_id', userId)
    .or(`name.ilike.%${sanitizedQuery}%,description.ilike.%${sanitizedQuery}%`)
    .limit(limit);

  if (error) {
    console.error('Campaign search error:', error);
    return [];
  }

  return data.map(campaign => ({
    id: campaign.id,
    title: campaign.name,
    description: campaign.description || 'Marketing campaign',
    type: 'campaign' as const,
    url: `/campaigns/${campaign.id}`,
    metadata: {
      date: new Date(campaign.created_at).toLocaleDateString(),
      status: campaign.status,
      clientName: campaign.clients?.name,
    },
  }));
}

/**
 * Search across assets
 */
async function searchAssets(query: string, userId: string, limit: number): Promise<SearchResult[]> {
  // Sanitize the search query to prevent SQL injection
  const { sanitizeInput } = await import('@/utils/sanitization');
  const sanitizedQuery = sanitizeInput(query);

  const { data, error } = await supabase
    .from('assets')
    .select('id, name, description, type, created_at, url')
    .eq('user_id', userId)
    .or(`name.ilike.%${sanitizedQuery}%,description.ilike.%${sanitizedQuery}%`)
    .limit(limit);

  if (error) {
    console.error('Asset search error:', error);
    return [];
  }

  return data.map(asset => ({
    id: asset.id,
    title: asset.name,
    description: asset.description || `${asset.type} asset`,
    type: 'asset' as const,
    url: `/assets/${asset.id}`,
    metadata: {
      date: new Date(asset.created_at).toLocaleDateString(),
      status: 'available',
    },
  }));
}

/**
 * Search across static pages and actions
 */
function searchPages(query: string): SearchResult[] {
  const pages = [
    {
      id: 'page-flow',
      title: 'Content Flow',
      description: 'AI-powered content generation workflow',
      type: 'page' as const,
      url: '/flow',
      keywords: ['flow', 'content', 'generation', 'ai', 'workflow', 'brief'],
    },
    {
      id: 'page-strategy',
      title: 'Strategy',
      description: 'Strategic planning and content strategy tools',
      type: 'page' as const,
      url: '/strategy',
      keywords: ['strategy', 'planning', 'content strategy', 'strategic'],
    },
    {
      id: 'page-matrix',
      title: 'Campaign Matrix',
      description: 'Organize and manage your campaigns',
      type: 'page' as const,
      url: '/matrix',
      keywords: ['matrix', 'campaign', 'organize', 'manage'],
    },
    {
      id: 'page-clients',
      title: 'Clients',
      description: 'Manage your client accounts and projects',
      type: 'page' as const,
      url: '/clients',
      keywords: ['clients', 'accounts', 'projects', 'manage'],
    },
    {
      id: 'page-assets',
      title: 'Assets',
      description: 'Media library and asset management',
      type: 'page' as const,
      url: '/assets',
      keywords: ['assets', 'media', 'library', 'files', 'uploads'],
    },
    {
      id: 'page-video',
      title: 'Video Studio',
      description: 'Video creation and editing tools',
      type: 'page' as const,
      url: '/video-studio',
      keywords: ['video', 'studio', 'creation', 'editing', 'production'],
    },
  ];

  const lowerQuery = query.toLowerCase();

  return pages
    .filter(
      page =>
        page.title.toLowerCase().includes(lowerQuery) ||
        page.description.toLowerCase().includes(lowerQuery) ||
        page.keywords.some(keyword => keyword.toLowerCase().includes(lowerQuery))
    )
    .map(page => ({
      id: page.id,
      title: page.title,
      description: page.description,
      type: page.type,
      url: page.url,
      metadata: {
        status: 'available',
      },
    }));
}

/**
 * Main search handler
 */
async function searchHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST requests allowed' },
    });
  }

  try {
    // Validate request body
    const validatedData = SearchRequestSchema.parse(req.body);
    const { query, limit, types, clientId } = validatedData;

    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
    }

    // Perform searches across different content types
    const searchPromises: Promise<SearchResult[]>[] = [];
    const searchTypes = types || ['client', 'campaign', 'asset', 'page'];

    if (searchTypes.includes('client')) {
      searchPromises.push(searchClients(query, userId, Math.ceil(limit / 4)));
    }

    if (searchTypes.includes('campaign')) {
      searchPromises.push(searchCampaigns(query, userId, Math.ceil(limit / 4)));
    }

    if (searchTypes.includes('asset')) {
      searchPromises.push(searchAssets(query, userId, Math.ceil(limit / 4)));
    }

    if (searchTypes.includes('page')) {
      searchPromises.push(Promise.resolve(searchPages(query)));
    }

    // Execute all searches in parallel
    const searchResults = await Promise.all(searchPromises);

    // Combine and sort results
    const allResults = searchResults.flat();

    // Sort by relevance (exact matches first, then alphabetical)
    const sortedResults = allResults.sort((a, b) => {
      const aExact = a.title.toLowerCase().startsWith(query.toLowerCase());
      const bExact = b.title.toLowerCase().startsWith(query.toLowerCase());

      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Then by type priority
      const typePriority: Record<string, number> = {
        page: 0,
        client: 1,
        campaign: 2,
        asset: 3,
        template: 4,
        brief: 5,
      };
      const aPriority = typePriority[a.type] || 99;
      const bPriority = typePriority[b.type] || 99;

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // Finally alphabetical
      return a.title.localeCompare(b.title);
    });

    // Limit results
    const limitedResults = sortedResults.slice(0, limit);

    return res.status(200).json({
      success: true,
      data: limitedResults,
      meta: {
        query,
        total: limitedResults.length,
        limit,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Search API error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'SEARCH_ERROR',
        message: 'Internal search error',
      },
    });
  }
}

// Apply middleware and export
export default withSecurityHeaders(withAuth(withRateLimit('api')(searchHandler)));
