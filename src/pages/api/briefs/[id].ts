import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';

const BriefUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  objectives: z.any().optional(),
  target_audience: z.string().optional(),
  key_messaging: z.any().optional(),
  brand_guidelines: z.any().optional(),
  platforms: z.array(z.string()).optional(),
  budget: z.number().optional(),
  timeline: z.any().optional(),
  parsing_status: z.enum(['pending', 'processing', 'completed', 'error']).optional(),
});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const { id } = req.query;
  const user = (req as any).user;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Brief ID is required' });
  }

  try {
    switch (method) {
      case 'GET':
        return handleGet(req, res, user, id);
      case 'PUT':
        return handlePut(req, res, user, id);
      case 'DELETE':
        return handleDelete(req, res, user, id);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Brief API error:', message, error);
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

async function handleGet(
  _req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  briefId: string
): Promise<void> {
  // First verify user has access to this brief
  const { data: brief, error } = await supabase
    .from('briefs')
    .select(
      `
      *,
      clients(name, slug, primary_color, secondary_color),
      profiles!briefs_created_by_fkey(full_name, avatar_url),
      motivations(
        id,
        title,
        description,
        category,
        relevance_score,
        is_ai_generated,
        created_at
      )
    `
    )
    .eq('id', briefId)
    .single();

  if (error || !brief) {
    return res.status(404).json({ error: 'Brief not found' });
  }

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', brief.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this brief' });
  }

  // Get related content variations
  const { data: contentVariations } = await supabase
    .from('content_variations')
    .select('*')
    .eq('brief_id', briefId)
    .order('created_at', { ascending: false });

  // Get related strategies
  const { data: strategies } = await supabase
    .from('strategies')
    .select(
      `
      id,
      title,
      description,
      goals,
      key_messages,
      target_audience,
      created_at
    `
    )
    .eq('client_id', brief.client_id)
    .order('created_at', { ascending: false });

  return res.json({
    data: {
      ...brief,
      content_variations: contentVariations || [],
      related_strategies: strategies || [],
    },
  });
}

async function handlePut(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  briefId: string
): Promise<void> {
  const validationResult = BriefUpdateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  // First verify user has access to this brief
  const { data: existingBrief } = await supabase
    .from('briefs')
    .select('client_id, created_by')
    .eq('id', briefId)
    .single();

  if (!existingBrief) {
    return res.status(404).json({ error: 'Brief not found' });
  }

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', existingBrief.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this brief' });
  }

  const updateData = {
    ...validationResult.data,
    updated_at: new Date().toISOString(),
  };

  const { data: brief, error } = await supabase
    .from('briefs')
    .update(updateData)
    .eq('id', briefId)
    .select(
      `
      *,
      clients(name, slug),
      profiles!briefs_created_by_fkey(full_name)
    `
    )
    .single();

  if (error) {
    console.error('Error updating brief:', error);
    return res.status(500).json({ error: 'Failed to update brief' });
  }

  return res.json({ data: brief });
}

async function handleDelete(
  _req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  briefId: string
): Promise<void> {
  // First verify user has access to this brief
  const { data: existingBrief } = await supabase
    .from('briefs')
    .select('client_id, created_by')
    .eq('id', briefId)
    .single();

  if (!existingBrief) {
    return res.status(404).json({ error: 'Brief not found' });
  }

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', existingBrief.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this brief' });
  }

  // Check if brief is being used by other resources
  const { data: motivations } = await supabase
    .from('motivations')
    .select('id')
    .eq('brief_id', briefId)
    .limit(1);

  const { data: contentVariations } = await supabase
    .from('content_variations')
    .select('id')
    .eq('brief_id', briefId)
    .limit(1);

  if (
    (motivations && motivations.length > 0) ||
    (contentVariations && contentVariations.length > 0)
  ) {
    return res.status(409).json({
      error: 'Cannot delete brief with associated motivations or content variations',
      details: 'Please remove related content first',
    });
  }

  const { error } = await supabase.from('briefs').delete().eq('id', briefId);

  if (error) {
    console.error('Error deleting brief:', error);
    return res.status(500).json({ error: 'Failed to delete brief' });
  }

  return res.status(200).json({ message: 'Brief deleted successfully' });
}

export default withAuth(withSecurityHeaders(handler));
