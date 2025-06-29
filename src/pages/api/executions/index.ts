import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';

const ExecutionFilterSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  matrix_id: z.string().uuid().optional(),
  status: z
    .enum(['pending', 'processing', 'completed', 'failed', 'cancelled', 'scheduled'])
    .optional(),
  platform: z.string().optional(),
  content_type: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  sort_by: z.enum(['created_at', 'updated_at', 'status', 'priority']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  include_analytics: z.boolean().default(false),
});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const user = (req as any).user;

  try {
    switch (method) {
      case 'GET':
        return handleGet(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Executions API error:', message, error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined,
    });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const validationResult = ExecutionFilterSchema.safeParse(req.query);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Invalid query parameters',
      details: validationResult.error.issues,
    });
  }

  const filters = validationResult.data;

  let query = supabase
    .from('executions')
    .select(
      `
      *,
      matrices(
        id, name, 
        campaigns(id, name, clients(id, name, slug))
      ),
      profiles!executions_created_by_fkey(full_name)
    `
    )
    .order(filters.sort_by, { ascending: filters.sort_order === 'asc' });

  // Filter by client access for the user
  const { data: userClients } = await supabase
    .from('user_clients')
    .select('client_id')
    .eq('user_id', user.id);

  if (!userClients || userClients.length === 0) {
    return res.json({ data: [], count: 0 });
  }

  const clientIds = userClients.map((uc: any) => uc.client_id);

  // Apply filters
  if (filters.campaign_id) {
    query = query.eq('campaign_id', filters.campaign_id);
  }

  if (filters.matrix_id) {
    query = query.eq('matrix_id', filters.matrix_id);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.platform) {
    query = query.eq('platform', filters.platform);
  }

  if (filters.content_type) {
    query = query.eq('content_type', filters.content_type);
  }

  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  // Filter by priority if specified
  if (filters.priority) {
    query = query.eq('metadata->>priority', filters.priority);
  }

  // Apply client access filter by joining through campaigns
  query = query.in('matrices.campaigns.clients.id', clientIds);

  // Pagination
  query = query.range(filters.offset, filters.offset + filters.limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching executions:', error);
    return res.status(500).json({ error: 'Failed to fetch executions' });
  }

  // Filter out executions where user doesn't have access
  const accessibleExecutions = (data || []).filter(
    (execution: any) =>
      execution.matrices?.campaigns?.clients?.id &&
      clientIds.includes(execution.matrices.campaigns.clients.id)
  );

  // Include analytics if requested
  let enrichedData = accessibleExecutions;
  if (filters.include_analytics) {
    enrichedData = await Promise.all(
      accessibleExecutions.map(async execution => {
        const analytics = await getExecutionAnalytics(execution.id);
        return {
          ...execution,
          analytics,
        };
      })
    );
  }

  // Calculate execution statistics
  const statistics = calculateExecutionStatistics(accessibleExecutions);

  return res.json({
    data: enrichedData,
    count: accessibleExecutions.length,
    statistics,
    pagination: {
      limit: filters.limit,
      offset: filters.offset,
      total: count || 0,
    },
  });
}

// Helper functions
async function getExecutionAnalytics(executionId: string): Promise<any> {
  try {
    // Get campaign analytics for this execution
    const { data: analytics } = await supabase
      .from('campaign_analytics')
      .select('*')
      .eq('execution_id', executionId)
      .order('date', { ascending: false })
      .limit(30);

    if (!analytics || analytics.length === 0) {
      return {
        has_data: false,
        message: 'No analytics data available',
      };
    }

    // Aggregate metrics
    const totals = analytics.reduce(
      (acc, record) => {
        acc.impressions += record.impressions || 0;
        acc.clicks += record.clicks || 0;
        acc.conversions += record.conversions || 0;
        acc.spend += parseFloat(record.spend) || 0;
        return acc;
      },
      { impressions: 0, clicks: 0, conversions: 0, spend: 0 }
    );

    // Calculate derived metrics
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    const conversionRate = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;

    return {
      has_data: true,
      summary: {
        ...totals,
        ctr: Math.round(ctr * 100) / 100,
        cpc: Math.round(cpc * 100) / 100,
        conversion_rate: Math.round(conversionRate * 100) / 100,
      },
      daily_data: analytics.map((record: any) => ({
        date: record.date,
        impressions: record.impressions || 0,
        clicks: record.clicks || 0,
        conversions: record.conversions || 0,
        spend: parseFloat(record.spend) || 0,
      })),
    };
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error getting execution analytics:', message, error);
    return {
      has_data: false,
      error: 'Failed to retrieve analytics',
    };
  }
}

function calculateExecutionStatistics(executions: any[]): any {
  const statusCount = executions.reduce(
    (acc, execution) => {
      acc[execution.status] = (acc[execution.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const platformCount = executions.reduce(
    (acc, execution) => {
      acc[execution.platform] = (acc[execution.platform] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const contentTypeCount = executions.reduce(
    (acc, execution) => {
      acc[execution.content_type] = (acc[execution.content_type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Calculate success rate
  const completedCount = statusCount.completed || 0;
  const failedCount = statusCount.failed || 0;
  const totalFinished = completedCount + failedCount;
  const successRate = totalFinished > 0 ? (completedCount / totalFinished) * 100 : 0;

  // Calculate average execution time for completed executions
  const completedExecutions = executions.filter((e: any) => e.status === 'completed');
  const avgExecutionTime =
    completedExecutions.length > 0
      ? completedExecutions.reduce((sum, execution) => {
          const start = new Date(execution.created_at).getTime();
          const end = new Date(execution.updated_at).getTime();
          return sum + (end - start);
        }, 0) /
        completedExecutions.length /
        1000 /
        60 // Convert to minutes
      : 0;

  return {
    total_executions: executions.length,
    status_distribution: statusCount,
    platform_distribution: platformCount,
    content_type_distribution: contentTypeCount,
    success_rate: Math.round(successRate * 100) / 100,
    average_execution_time_minutes: Math.round(avgExecutionTime * 100) / 100,
    active_executions: (statusCount.pending || 0) + (statusCount.processing || 0),
  };
}

export default withAuth(withSecurityHeaders(handler));
