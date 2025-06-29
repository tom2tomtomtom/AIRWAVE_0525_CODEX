import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';

const BriefCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  document_url: z.string().optional(),
  document_type: z.enum(['pdf', 'docx', 'txt']).optional(),
  raw_content: z.string().optional(),
  objectives: z.any().optional(),
  target_audience: z.string().optional(),
  key_messaging: z.any().optional(),
  brand_guidelines: z.any().optional(),
  platforms: z.array(z.string()).optional(),
  budget: z.number().optional(),
  timeline: z.any().optional(),
  client_id: z.string().uuid('Invalid client ID'),
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
    console.error('Briefs API error:', message, error);
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
  const { client_id, status, limit = 50, offset = 0, search } = req.query;

  let query = supabase
    .from('briefs')
    .select(
      `
      *,
      clients(name, slug),
      profiles!briefs_created_by_fkey(full_name),
      motivations(count)
    `
    )
    .order('created_at', { ascending: false });

  // Filter by client access for the user
  if (client_id) {
    query = query.eq('client_id', client_id);
  } else {
    // Get briefs for all clients user has access to
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
  if (status) {
    query = query.eq('parsing_status', status);
  }

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,description.ilike.%${search}%,target_audience.ilike.%${search}%`
    );
  }

  // Pagination
  query = query.range(
    parseInt(offset as string),
    parseInt(offset as string) + parseInt(limit as string) - 1
  );

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching briefs:', error);
    return res.status(500).json({ error: 'Failed to fetch briefs' });
  }

  return res.json({
    data: data || [],
    count,
    pagination: {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      total: count || 0,
    },
  });
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const validationResult = BriefCreateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  const briefData = validationResult.data;

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', briefData.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this client' });
  }

  // Create the brief
  const { data: brief, error } = await supabase
    .from('briefs')
    .insert({
      ...briefData,
      created_by: user.id,
      parsing_status: briefData.raw_content ? 'pending' : 'completed',
    })
    .select(
      `
      *,
      clients(name, slug),
      profiles!briefs_created_by_fkey(full_name)
    `
    )
    .single();

  if (error) {
    console.error('Error creating brief:', error);
    return res.status(500).json({ error: 'Failed to create brief' });
  }

  // If raw content exists, trigger parsing
  if (briefData.raw_content) {
    try {
      await fetch(`${req.headers.origin}/api/brief-parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: req.headers.authorization || '',
        },
        body: JSON.stringify({
          brief_id: brief.id,
          content: briefData.raw_content,
        }),
      });
    } catch (parseError: any) {
      console.error('Error triggering brief parsing:', parseError);
      // Don't fail the request, just log the error
    }
  }

  return res.status(201).json({ data: brief });
}

export default withAuth(withSecurityHeaders(handler));
