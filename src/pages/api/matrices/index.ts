import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';

const MatrixCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  campaign_id: z.string().uuid('Invalid campaign ID'),
  template_id: z.string().uuid('Invalid template ID'),
  variations: z.array(z.any()).default([]),
  combinations: z.array(z.any()).default([]),
  field_assignments: z.any().default({}),
  lock_fields: z.array(z.string()).default([]),
  auto_generate: z.boolean().default(false),
  generation_settings: z.any().optional(),
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
    console.error('Matrices API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const {
    campaign_id,
    template_id,
    status,
    limit = 50,
    offset = 0,
    search,
    sort_by = 'created_at',
    sort_order = 'desc',
    include_executions = false,
  } = req.query;

  let query = supabase
    .from('matrices')
    .select(
      `
      *,
      campaigns(id, name, status, clients(name, slug)),
      templates(id, name, platform, aspect_ratio, dimensions),
      profiles!matrices_created_by_fkey(full_name)
    `
    )
    .order(sort_by as string, { ascending: sort_order === 'asc' });

  // Filter by campaign if specified
  if (campaign_id) {
    query = query.eq('campaign_id', campaign_id);
  } else {
    // Get matrices for all campaigns user has access to
    const { data: userClients } = await supabase
      .from('user_clients')
      .select('client_id')
      .eq('user_id', user.id);

    if (userClients && userClients.length > 0) {
      const clientIds = userClients.map((uc: any) => uc.client_id);

      // Get campaigns for accessible clients
      const { data: accessibleCampaigns } = await supabase
        .from('campaigns')
        .select('id')
        .in('client_id', clientIds);

      if (accessibleCampaigns && accessibleCampaigns.length > 0) {
        const campaignIds = accessibleCampaigns.map((c: any) => c.id);
        query = query.in('campaign_id', campaignIds);
      } else {
        return res.json({ data: [], count: 0 });
      }
    } else {
      return res.json({ data: [], count: 0 });
    }
  }

  // Additional filters
  if (template_id) {
    query = query.eq('template_id', template_id);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  // Pagination
  query = query.range(
    parseInt(offset as string),
    parseInt(offset as string) + parseInt(limit as string) - 1
  );

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching matrices:', error);
    return res.status(500).json({ error: 'Failed to fetch matrices' });
  }

  // Include execution statistics if requested
  let enrichedData = data || [];
  if (include_executions === 'true') {
    enrichedData = await Promise.all(
      (data || []).map(async matrix => {
        const executionStats = await getMatrixExecutionStats(matrix.id);
        return {
          ...matrix,
          execution_stats: executionStats,
        };
      })
    );
  }

  // Calculate matrix portfolio statistics
  const portfolioStats = calculateMatrixPortfolioStats(data || []);

  return res.json({
    data: enrichedData,
    count,
    portfolio_stats: portfolioStats,
    pagination: {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      total: count || 0,
    },
  });
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const validationResult = MatrixCreateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  const matrixData = validationResult.data;

  // Verify user has access to the campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('client_id, status')
    .eq('id', matrixData.campaign_id)
    .single();

  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', campaign.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this campaign' });
  }

  // Verify template exists and is accessible
  const { data: template } = await supabase
    .from('templates')
    .select('id, name, dynamic_fields, is_public, created_by')
    .eq('id', matrixData.template_id)
    .single();

  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  if (!template.is_public && template.created_by !== user.id) {
    return res.status(403).json({ error: 'Access denied to this template' });
  }

  // Auto-generate matrix if requested
  if (matrixData.auto_generate) {
    const generatedMatrix = await generateMatrixContent(matrixData, template);
    matrixData.variations = generatedMatrix.variations;
    matrixData.combinations = generatedMatrix.combinations;
    matrixData.field_assignments = generatedMatrix.field_assignments;
  }

  // Generate unique slug
  const slug = generateMatrixSlug(matrixData.name, matrixData.campaign_id);

  // Create the matrix
  const { data: matrix, error } = await supabase
    .from('matrices')
    .insert({
      ...matrixData,
      slug,
      status: 'draft',
      created_by: user.id,
      approved_by: null,
      approval_date: null,
    })
    .select(
      `
      *,
      campaigns(id, name, status, clients(name, slug)),
      templates(id, name, platform, aspect_ratio),
      profiles!matrices_created_by_fkey(full_name)
    `
    )
    .single();

  if (error) {
    console.error('Error creating matrix:', error);
    return res.status(500).json({ error: 'Failed to create matrix' });
  }

  return res.status(201).json({ data: matrix });
}

// Helper functions
async function getMatrixExecutionStats(matrixId: string): Promise<any> {
  try {
    const { data: executions } = await supabase
      .from('executions')
      .select('status, platform, content_type, created_at')
      .eq('matrix_id', matrixId);

    if (!executions) return { total: 0, by_status: {}, by_platform: {} };

    const statusBreakdown = executions.reduce(
      (acc, exec) => {
        acc[exec.status] = (acc[exec.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const platformBreakdown = executions.reduce(
      (acc, exec) => {
        acc[exec.platform] = (acc[exec.platform] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      total: executions.length,
      by_status: statusBreakdown,
      by_platform: platformBreakdown,
      last_execution: executions.length > 0 ? executions[executions.length - 1]?.created_at : null,
    };
  } catch (error: any) {
    console.error('Error getting execution stats:', error);
    return { total: 0, by_status: {}, by_platform: {} };
  }
}

function calculateMatrixPortfolioStats(matrices: any[]): any {
  const statusCount = matrices.reduce(
    (acc, matrix) => {
      acc[matrix.status] = (acc[matrix.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const templateCount = matrices.reduce(
    (acc, matrix) => {
      const templateName = matrix.templates?.name || 'Unknown';
      acc[templateName] = (acc[templateName] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const platformCount = matrices.reduce(
    (acc, matrix) => {
      const platform = matrix.templates?.platform || 'Unknown';
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const avgVariations =
    matrices.length > 0
      ? matrices.reduce((sum, matrix) => sum + (matrix.variations?.length || 0), 0) /
        matrices.length
      : 0;

  return {
    total_matrices: matrices.length,
    status_distribution: statusCount,
    template_distribution: templateCount,
    platform_distribution: platformCount,
    average_variations: Math.round(avgVariations * 100) / 100,
  };
}

function generateMatrixSlug(name: string, campaignId: string): string {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 30);

  // Add campaign prefix for uniqueness
  const campaignPrefix = campaignId.substring(0, 8);
  return `${campaignPrefix}-${baseSlug}`;
}

async function generateMatrixContent(matrixData: any, template: any): Promise<any> {
  try {
    // This is a simplified auto-generation
    // In a real implementation, this would use AI to generate optimal combinations

    const variations: any[] = [];
    const combinations: any[] = [];
    const fieldAssignments: any = {};

    // Generate basic variations
    const variationCount = matrixData.generation_settings?.variation_count || 4;
    for (let i = 0; i < variationCount; i++) {
      variations.push({
        id: `var-${i + 1}`,
        name: `Variation ${String.fromCharCode(65 + i)}`,
        isActive: true,
        isDefault: i === 0,
      });
    }

    // Generate field assignments based on template
    if (template.dynamic_fields) {
      template.dynamic_fields.forEach((field: any) => {
        fieldAssignments[field.id] = {
          status: 'pending',
          content: variations.map((v: any) => ({
            id: `content-${field.id}-${v.id}`,
            variationId: v.id,
            content: field.defaultValue || '',
          })),
          assets: [],
        };
      });
    }

    // Generate basic combinations
    combinations.push({
      id: 'combo-1',
      name: 'Primary Combination',
      variationIds: [variations[0]?.id],
      isSelected: true,
      performanceScore: 0,
    });

    if (variations.length > 1) {
      combinations.push({
        id: 'combo-2',
        name: 'A/B Test Combination',
        variationIds: variations.slice(0, 2).map((v: any) => v.id),
        isSelected: true,
        performanceScore: 0,
      });
    }

    return {
      variations,
      combinations,
      field_assignments: fieldAssignments,
    };
  } catch (error: any) {
    console.error('Error generating matrix content:', error);
    return {
      variations: [],
      combinations: [],
      field_assignments: {},
    };
  }
}

export default withAuth(withSecurityHeaders(handler));
