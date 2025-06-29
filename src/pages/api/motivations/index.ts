import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';

const MotivationCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.enum([
    'emotional',
    'rational',
    'social',
    'fear',
    'aspiration',
    'convenience',
    'status',
    'safety',
    'other',
  ]),
  brief_id: z.string().uuid().optional(),
  relevance_score: z.number().min(0).max(100).optional(),
  is_ai_generated: z.boolean().default(false),
  generation_context: z.any().optional(),
  client_id: z.string().uuid('Invalid client ID'),
  tags: z.array(z.string()).default([]),
  target_emotions: z.array(z.string()).default([]),
  use_cases: z.array(z.string()).default([]),
  effectiveness_rating: z.number().min(1).max(5).optional(),
});


async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const user = (req as any).user;

  try {
    switch (method) {
      case 'GET':
        return handleGet(req, res, user);
      case 'POST':
        return handlePost(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Motivations API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const {
    client_id,
    brief_id,
    category,
    is_ai_generated,
    min_relevance,
    max_relevance,
    limit = 50,
    offset = 0,
    search,
    sort_by = 'relevance_score',
    sort_order = 'desc',
    include_usage = false,
  } = req.query;

  let query = supabase
    .from('motivations')
    .select(
      `
      *,
      clients(name, slug),
      briefs(name, title),
      profiles!motivations_created_by_fkey(full_name)
    `
    )
    .order(sort_by as string, { ascending: sort_order === 'asc' });

  // Filter by client access for the user
  if (client_id) {
    query = query.eq('client_id', client_id);
  } else {
    // Get motivations for all clients user has access to
    const { data: userClients } = await supabase
      .from('user_clients')
      .select('client_id')
      .eq('user_id', user.id);

    if (userClients && userClients.length > 0) {
      const clientIds = userClients.map((uc: any) => uc.client_id);
      query = query.in('client_id', clientIds);
    } else {
      // User has no client access
      return res.json({ data: [], count: 0 });
    }
  }

  // Additional filters
  if (brief_id) {
    query = query.eq('brief_id', brief_id);
  }

  if (category) {
    query = query.eq('category', category);
  }

  if (is_ai_generated !== undefined) {
    query = query.eq('is_ai_generated', is_ai_generated === 'true');
  }

  if (min_relevance || max_relevance) {
    const min = min_relevance ? parseFloat(min_relevance as string) : 0;
    const max = max_relevance ? parseFloat(max_relevance as string) : 100;
    query = query.gte('relevance_score', min).lte('relevance_score', max);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,tags.cs.{${search}}`);
  }

  // Pagination
  query = query.range(
    parseInt(offset as string),
    parseInt(offset as string) + parseInt(limit as string) - 1
  );

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching motivations:', error);
    return res.status(500).json({ error: 'Failed to fetch motivations' });
  }

  // Include usage statistics if requested
  let enrichedData = data || [];
  if (include_usage === 'true') {
    enrichedData = await Promise.all(
      (data || []).map(async motivation => {
        const usageStats = await getMotivationUsageStats(motivation.id);
        return {
          ...motivation,
          usage_stats: usageStats,
        };
      })
    );
  }

  // Calculate category distribution
  const categoryStats = calculateCategoryDistribution(data || []);

  return res.json({
    data: enrichedData,
    count,
    statistics: {
      category_distribution: categoryStats,
      avg_relevance_score: data?.length
        ? data.reduce((sum, m) => sum + (m.relevance_score || 0), 0) / data.length
        : 0,
      ai_generated_percentage: data?.length
        ? (data.filter((m: any) => m.is_ai_generated).length / data.length) * 100
        : 0,
    },
    pagination: {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      total: count || 0,
    },
  });
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const validationResult = MotivationCreateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  const motivationData = validationResult.data;

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', motivationData.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this client' });
  }

  // If brief_id is provided, verify it belongs to the same client
  if (motivationData.brief_id) {
    const { data: brief } = await supabase
      .from('briefs')
      .select('client_id')
      .eq('id', motivationData.brief_id)
      .single();

    if (!brief || brief.client_id !== motivationData.client_id) {
      return res.status(400).json({ error: 'Brief does not belong to the specified client' });
    }
  }

  // Auto-calculate relevance score if not provided and we have context
  if (!motivationData.relevance_score && motivationData.brief_id) {
    motivationData.relevance_score = await calculateRelevanceScore(
      motivationData.title,
      motivationData.description,
      motivationData.brief_id
    );
  }

  // Create the motivation
  const { data: motivation, error } = await supabase
    .from('motivations')
    .insert({
      ...motivationData,
      created_by: user.id,
    })
    .select(
      `
      *,
      clients(name, slug),
      briefs(name, title),
      profiles!motivations_created_by_fkey(full_name)
    `
    )
    .single();

  if (error) {
    console.error('Error creating motivation:', error);
    return res.status(500).json({ error: 'Failed to create motivation' });
  }

  return res.status(201).json({ data: motivation });
}

// Helper functions
async function getMotivationUsageStats(motivationId: string): Promise<any> {
  try {
    // Get usage in strategies
    const { count: strategyUsage } = await supabase
      .from('strategy_motivations')
      .select('id', { count: 'exact' })
      .eq('motivation_id', motivationId);

    // Get usage in content variations
    const { count: contentUsage } = await supabase
      .from('content_variations')
      .select('id', { count: 'exact' })
      .contains('motivation_ids', [motivationId]);

    // Get usage in copy assets
    const { count: copyUsage } = await supabase
      .from('copy_assets')
      .select('id', { count: 'exact' })
      .contains('motivation_ids', [motivationId]);

    return {
      strategy_usage: strategyUsage || 0,
      content_usage: contentUsage || 0,
      copy_usage: copyUsage || 0,
      total_usage: (strategyUsage || 0) + (contentUsage || 0) + (copyUsage || 0),
    };
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error calculating usage stats:', message, error);
    return {
      strategy_usage: 0,
      content_usage: 0,
      copy_usage: 0,
      total_usage: 0,
    };
  }
}

function calculateCategoryDistribution(motivations: any[]): Record<string, number> {
  const distribution: Record<string, number> = {};

  motivations.forEach((motivation: any) => {
    const category = motivation.category || 'other';
    distribution[category] = (distribution[category] || 0) + 1;
  });

  return distribution;
}

async function calculateRelevanceScore(
  title: string,
  description: string,
  briefId: string
): Promise<number> {
  try {
    // Get brief details for context
    const { data: brief } = await supabase
      .from('briefs')
      .select('objectives, target_audience, key_messaging')
      .eq('id', briefId)
      .single();

    if (!brief) return 50; // Default score if no brief context

    // Simple relevance calculation based on keyword matching
    const motivationText = `${title} ${description}`.toLowerCase();
    const briefText =
      `${JSON.stringify(brief.objectives || {})} ${brief.target_audience || ''} ${JSON.stringify(brief.key_messaging || {})}`.toLowerCase();

    // Extract keywords
    const motivationKeywords = extractKeywords(motivationText);
    const briefKeywords = extractKeywords(briefText);

    // Calculate overlap
    const intersection = motivationKeywords.filter((keyword: any) =>
      briefKeywords.includes(keyword)
    );
    const relevanceScore =
      briefKeywords.length > 0
        ? Math.min(100, (intersection.length / briefKeywords.length) * 100 + Math.random() * 20)
        : 50;

    return Math.round(relevanceScore);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error calculating relevance score:', message, error);
    return 50; // Default score on error
  }
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction
  const stopWords = [
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
  ];

  return text
    .split(/\s+/)
    .map((word: any) => word.replace(/[^\w]/g, '').toLowerCase())
    .filter((word: any) => word.length > 3 && !stopWords.includes(word))
    .slice(0, 20); // Limit to 20 keywords
}

export default withAuth(withSecurityHeaders(handler));
