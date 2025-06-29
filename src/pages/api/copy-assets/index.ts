import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';

const CopyAssetCreateSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  type: z.enum([
    'headline',
    'body',
    'cta',
    'subject_line',
    'description',
    'caption',
    'script',
    'other',
  ]),
  title: z.string().optional(),
  platform: z
    .enum([
      'facebook',
      'instagram',
      'youtube',
      'tiktok',
      'linkedin',
      'twitter',
      'email',
      'universal',
    ])
    .optional(),
  tone: z.string().optional(),
  style: z.string().optional(),
  language: z.string().default('en'),
  character_count: z.number().optional(),
  word_count: z.number().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.any().default({}),
  client_id: z.string().uuid('Invalid client ID'),
  brief_id: z.string().uuid().optional(),
  motivation_ids: z.array(z.string().uuid()).default([]),
  generation_prompt: z.string().optional(),
  ai_generated: z.boolean().default(false),
  performance_score: z.number().min(0).max(100).optional(),
  brand_compliance_score: z.number().min(0).max(100).optional(),
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
    console.error('Copy Assets API error:', message, error);
    return res.status(500).json({
      error: 'Internal server error',
      details:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : undefined,
    });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const {
    client_id,
    type,
    platform,
    tone,
    brief_id,
    ai_generated,
    limit = 50,
    offset = 0,
    search,
    sort_by = 'created_at',
    sort_order = 'desc',
  } = req.query;

  let query = supabase
    .from('copy_assets')
    .select(
      `
      *,
      clients(name, slug),
      profiles!copy_assets_created_by_fkey(full_name),
      briefs(name)
    `
    )
    .order(sort_by as string, { ascending: sort_order === 'asc' });

  // Filter by client access for the user
  if (client_id) {
    query = query.eq('client_id', client_id);
  } else {
    // Get copy assets for all clients user has access to
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
  if (type) {
    query = query.eq('type', type);
  }

  if (platform) {
    query = query.eq('platform', platform);
  }

  if (tone) {
    query = query.eq('tone', tone);
  }

  if (brief_id) {
    query = query.eq('brief_id', brief_id);
  }

  if (ai_generated !== undefined) {
    query = query.eq('ai_generated', ai_generated === 'true');
  }

  if (search) {
    query = query.or(`content.ilike.%${search}%,title.ilike.%${search}%,tags.cs.{${search}}`);
  }

  // Pagination
  query = query.range(
    parseInt(offset as string),
    parseInt(offset as string) + parseInt(limit as string) - 1
  );

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching copy assets:', error);
    return res.status(500).json({ error: 'Failed to fetch copy assets' });
  }

  // Calculate analytics for each copy asset
  const enrichedData =
    data?.map((asset: any) => ({
      ...asset,
      analytics: {
        character_count: asset.content.length,
        word_count: asset.content.split(/\s+/).length,
        readability_score: calculateReadabilityScore(asset.content),
        sentiment: analyzeSentiment(asset.content),
      },
    })) || [];

  return res.json({
    data: enrichedData,
    count,
    pagination: {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      total: count || 0,
    },
  });
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const validationResult = CopyAssetCreateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  const assetData = validationResult.data;

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', assetData.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this client' });
  }

  // Calculate content metrics
  const content = assetData.content;
  const characterCount = content.length;
  const wordCount = content.split(/\s+/).length;

  // Generate title if not provided
  const title = assetData.title || generateTitleFromContent(content, assetData.type);

  // Create the copy asset
  const { data: copyAsset, error } = await supabase
    .from('copy_assets')
    .insert({
      ...assetData,
      title,
      character_count: characterCount,
      word_count: wordCount,
      metadata: {
        ...assetData.metadata,
        readability_score: calculateReadabilityScore(content),
        sentiment: analyzeSentiment(content),
        created_timestamp: new Date().toISOString(),
      },
      created_by: user.id,
    })
    .select(
      `
      *,
      clients(name, slug),
      profiles!copy_assets_created_by_fkey(full_name),
      briefs(name)
    `
    )
    .single();

  if (error) {
    console.error('Error creating copy asset:', error);
    return res.status(500).json({ error: 'Failed to create copy asset' });
  }

  return res.status(201).json({ data: copyAsset });
}

// Helper functions
function calculateReadabilityScore(text: string): number {
  // Simple readability score based on sentence and word length
  const sentences = text.split(/[.!?]+/).filter((s: any) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w: any) => w.length > 0);

  if (sentences.length === 0 || words.length === 0) return 50;

  const avgWordsPerSentence = words.length / sentences.length;
  const avgCharsPerWord = text.replace(/\s+/g, '').length / words.length;

  // Simple scoring formula (lower is more readable)
  const score = Math.max(0, 100 - (avgWordsPerSentence * 2 + avgCharsPerWord * 5));
  return Math.min(100, Math.round(score));
}

function analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  // Simple sentiment analysis based on keywords
  const positiveWords = [
    'great',
    'excellent',
    'amazing',
    'wonderful',
    'fantastic',
    'love',
    'best',
    'awesome',
    'perfect',
    'outstanding',
  ];
  const negativeWords = [
    'bad',
    'terrible',
    'awful',
    'hate',
    'worst',
    'horrible',
    'disappointing',
    'failed',
    'broken',
    'useless',
  ];

  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter((word: any) => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter((word: any) => lowerText.includes(word)).length;

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

function generateTitleFromContent(content: string, type: string): string {
  // Generate a title based on content and type
  const firstLine = content.split('\n')[0]?.trim() || '';
  const preview = firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;

  const typeLabels: Record<string, string> = {
    headline: 'Headline',
    body: 'Body Copy',
    cta: 'Call to Action',
    subject_line: 'Subject Line',
    description: 'Description',
    caption: 'Caption',
    script: 'Script',
    other: 'Copy',
  };

  return `${typeLabels[type] || 'Copy'}: ${preview}`;
}

export default withAuth(withSecurityHeaders(handler));
