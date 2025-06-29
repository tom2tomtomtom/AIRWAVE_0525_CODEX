import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';

const GenerationsFilterSchema = z.object({
  client_id: z.string().uuid().optional(),
  brief_id: z.string().uuid().optional(),
  campaign_id: z.string().uuid().optional(),
  matrix_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  generation_id: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  sort_by: z.enum(['created_at', 'updated_at', 'status']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  include_jobs: z.boolean().default(false),
});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const user = (req as any).user;

  try {
    switch (method) {
      case 'GET':
        return handleGet(req, res, user);
      case 'DELETE':
        return handleDelete(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Video Generations API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const validationResult = GenerationsFilterSchema.safeParse(req.query);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Invalid query parameters',
      details: validationResult.error.issues,
    });
  }

  const filters = validationResult.data;

  // Get user's accessible clients
  const { data: userClients } = await supabase
    .from('user_clients')
    .select('client_id')
    .eq('user_id', user.id);

  if (!userClients || userClients.length === 0) {
    return res.json({
      data: [],
      count: 0,
      summary: getEmptySummary(),
    });
  }

  const clientIds = userClients.map((uc: any) => uc.client_id);

  let query = supabase
    .from('video_generations')
    .select(
      `
      *,
      briefs(id, name, clients(id, name, slug)),
      campaigns(id, name, clients(id, name, slug)),
      matrices(id, name, campaigns(id, name, clients(id, name, slug))),
      assets(id, name, file_url)
    `,
      { count: 'exact' }
    )
    .order(filters.sort_by, { ascending: filters.sort_order === 'asc' });

  // Filter by client access
  if (filters.client_id) {
    if (!clientIds.includes(filters.client_id)) {
      return res.status(403).json({ error: 'Access denied to this client' });
    }
    query = query.eq('client_id', filters.client_id);
  } else {
    query = query.in('client_id', clientIds);
  }

  // Apply filters
  if (filters.brief_id) {
    query = query.eq('brief_id', filters.brief_id);
  }

  if (filters.campaign_id) {
    query = query.eq('campaign_id', filters.campaign_id);
  }

  if (filters.matrix_id) {
    query = query.eq('matrix_id', filters.matrix_id);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.generation_id) {
    query = query.eq('generation_id', filters.generation_id);
  }

  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  // Pagination
  query = query.range(filters.offset, filters.offset + filters.limit - 1);

  const { data: generations, error, count } = await query;

  if (error) {
    console.error('Error fetching video generations:', error);
    return res.status(500).json({ error: 'Failed to fetch video generations' });
  }

  // Group by generation_id if include_jobs is true
  let processedData;
  if (filters.include_jobs) {
    processedData = groupByGeneration(generations || []);
  } else {
    // Return unique generations (one per generation_id)
    const uniqueGenerations = getUniqueGenerations(generations || []);
    processedData = uniqueGenerations.map((gen: any) => enhanceGenerationData(gen));
  }

  // Calculate summary statistics
  const summary = calculateSummary(generations || []);

  return res.json({
    data: processedData,
    count: processedData.length,
    total_jobs: count || 0,
    summary,
    pagination: {
      limit: filters.limit,
      offset: filters.offset,
      total: count || 0,
    },
  });
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const { generation_id, job_id } = req.query;

  if (!generation_id && !job_id) {
    return res.status(400).json({
      error: 'Either generation_id or job_id is required',
    });
  }

  if (generation_id) {
    return await deleteGeneration(req, res, user, generation_id as string);
  } else {
    return await deleteJob(req, res, user, job_id as string);
  }
}

async function deleteGeneration(
  _req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  generationId: string
): Promise<void> {
  // Get all jobs for this generation
  const { data: generations } = await supabase
    .from('video_generations')
    .select('id, client_id, status')
    .eq('generation_id', generationId);

  if (!generations || generations.length === 0) {
    return res.status(404).json({ error: 'Generation not found' });
  }

  // Verify user has access
  const clientId = generations[0]?.client_id;
  if (!clientId) {
    return res.status(500).json({ error: 'Invalid generation data' });
  }
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this generation' });
  }

  // Check if any jobs are still processing
  const processingJobs = generations.filter((gen: any) =>
    ['pending', 'processing'].includes(gen.status)
  );
  if (processingJobs.length > 0) {
    return res.status(409).json({
      error: 'Cannot delete generation with active jobs',
      details: `${processingJobs.length} jobs are still processing`,
    });
  }

  // Delete all jobs in this generation
  const { error } = await supabase
    .from('video_generations')
    .delete()
    .eq('generation_id', generationId);

  if (error) {
    console.error('Error deleting generation:', error);
    return res.status(500).json({ error: 'Failed to delete generation' });
  }

  return res.json({
    message: 'Generation deleted successfully',
    deleted_jobs: generations.length,
  });
}

async function deleteJob(
  _req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  jobId: string
): Promise<void> {
  // Get job info
  const { data: generation } = await supabase
    .from('video_generations')
    .select('id, client_id, status, asset_id')
    .eq('id', jobId)
    .single();

  if (!generation) {
    return res.status(404).json({ error: 'Video generation job not found' });
  }

  // Verify user has access
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', generation.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this generation job' });
  }

  // Check if job is still processing
  if (['pending', 'processing'].includes(generation.status)) {
    return res.status(409).json({
      error: 'Cannot delete active job',
      status: generation.status,
    });
  }

  // Delete associated asset if exists
  if (generation.asset_id) {
    await supabase.from('assets').delete().eq('id', generation.asset_id);
  }

  // Delete job
  const { error } = await supabase.from('video_generations').delete().eq('id', jobId);

  if (error) {
    console.error('Error deleting job:', error);
    return res.status(500).json({ error: 'Failed to delete job' });
  }

  return res.json({
    message: 'Video generation job deleted successfully',
  });
}

// Helper functions
function groupByGeneration(generations: any[]): any[] {
  const grouped: Record<string, any> = {};

  generations.forEach((gen: any) => {
    const genId = gen.generation_id;
    if (!grouped[genId]) {
      grouped[genId] = {
        generation_id: genId,
        client_id: gen.client_id,
        context: getContextInfo(gen),
        created_at: gen.created_at,
        jobs: [],
        status: 'pending',
        progress: { percentage: 0, completed: 0, total: 0 },
      };
    }

    grouped[genId].jobs.push({
      id: gen.id,
      variation_index: gen.variation_index,
      status: gen.status,
      output_url: gen.output_url,
      asset_id: gen.asset_id,
      error_message: gen.error_message,
      config: gen.config,
      created_at: gen.created_at,
      updated_at: gen.updated_at,
    });
  });

  // Calculate progress for each generation
  Object.values(grouped).forEach((gen: any) => {
    const totalJobs = gen.jobs.length;
    const completedJobs = gen.jobs.filter((job: any) => job.status === 'completed').length;
    const processingJobs = gen.jobs.filter((job: any) =>
      ['pending', 'processing'].includes(job.status)
    ).length;

    gen.progress = {
      percentage: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0,
      completed: completedJobs,
      total: totalJobs,
    };

    // Determine overall status
    if (completedJobs === totalJobs) {
      gen.status = 'completed';
    } else if (processingJobs > 0) {
      gen.status = 'processing';
    } else {
      gen.status = 'failed';
    }

    // Sort jobs by variation index
    gen.jobs.sort((a: any, b: any) => a.variation_index - b.variation_index);
  });

  return Object.values(grouped).sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function getUniqueGenerations(generations: any[]): any[] {
  const unique: Record<string, any> = {};

  generations.forEach((gen: any) => {
    const genId = gen.generation_id;
    if (!unique[genId] || new Date(gen.created_at) > new Date(unique[genId].created_at)) {
      unique[genId] = gen;
    }
  });

  return Object.values(unique);
}

function enhanceGenerationData(generation: any): any {
  return {
    generation_id: generation.generation_id,
    latest_job_id: generation.id,
    client_id: generation.client_id,
    context: getContextInfo(generation),
    status: generation.status,
    output_url: generation.output_url,
    asset_id: generation.asset_id,
    error_message: generation.error_message,
    config: generation.config,
    created_at: generation.created_at,
    updated_at: generation.updated_at,
  };
}

function getContextInfo(generation: any): any {
  if (generation.briefs) {
    return {
      type: 'brief',
      id: generation.brief_id,
      name: generation.briefs.name,
      client: generation.briefs.clients,
    };
  } else if (generation.matrices) {
    return {
      type: 'matrix',
      id: generation.matrix_id,
      name: generation.matrices.name,
      campaign: generation.matrices.campaigns,
    };
  } else if (generation.campaigns) {
    return {
      type: 'campaign',
      id: generation.campaign_id,
      name: generation.campaigns.name,
      client: generation.campaigns.clients,
    };
  } else {
    return {
      type: 'standalone',
      client_id: generation.client_id,
    };
  }
}

function calculateSummary(generations: any[]): any {
  const total = generations.length;
  const byStatus = generations.reduce(
    (acc, gen) => {
      acc[gen.status] = (acc[gen.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Group by generation_id to get unique generations
  const uniqueGenerations = getUniqueGenerations(generations);
  const totalGenerations = uniqueGenerations.length;

  // Calculate time-based stats
  const today = new Date().toISOString().split('T')[0];
  const todayGenerations = generations.filter((gen: any) =>
    gen.created_at.startsWith(today)
  ).length;

  const thisWeek = new Date();
  thisWeek.setDate(thisWeek.getDate() - 7);
  const weeklyGenerations = generations.filter(
    (gen: any) => new Date(gen.created_at) >= thisWeek
  ).length;

  return {
    total_jobs: total,
    total_generations: totalGenerations,
    status_breakdown: byStatus,
    today_count: todayGenerations,
    weekly_count: weeklyGenerations,
    completion_rate: total > 0 ? Math.round(((byStatus.completed || 0) / total) * 100) : 0,
  };
}

function getEmptySummary(): any {
  return {
    total_jobs: 0,
    total_generations: 0,
    status_breakdown: {},
    today_count: 0,
    weekly_count: 0,
    completion_rate: 0,
  };
}

export default withAuth(withSecurityHeaders(handler));
