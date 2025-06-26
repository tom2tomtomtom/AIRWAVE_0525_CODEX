import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';
import { loggers } from '@/lib/logger';


const CampaignCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  objective: z.string().min(1, 'Objective is required'),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  budget: z.number().min(0).optional(),
  targeting: z.any().default({}),
  platforms: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  client_id: z.string().uuid('Invalid client ID'),
  brief_id: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  campaign_type: z
    .enum(['awareness', 'consideration', 'conversion', 'retention', 'mixed'])
    .default('awareness'),
  kpis: z.array(z.string()).default([]),
  creative_requirements: z.any().default({}),
});

const CampaignUpdateSchema = CampaignCreateSchema.partial().omit(['client_id'] as any);

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
    console.error('Campaigns API error:', error);
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
  loggers.general.error('Campaigns GET request - returning empty data (campaigns table not implemented)');

  // Return empty campaigns data since the campaigns table doesn't exist yet
  // TODO: Implement actual database queries when campaigns table is ready

  const { limit = 50, offset = 0 } = req.query;

  const portfolioStats = {
    total_campaigns: 0,
    status_distribution: {},
    priority_distribution: {},
    type_distribution: {},
    budget_summary: {
      total_budget: 0,
      total_spent: 0,
      remaining_budget: 0,
      utilization_rate: 0,
    },
  };

  return res.json({
    data: [],
    count: 0,
    portfolio_stats: portfolioStats,
    pagination: {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      total: 0,
    },
    message: 'Campaigns functionality not yet fully implemented',
  });
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const validationResult = CampaignCreateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  const campaignData = validationResult.data;

  // For now, create a mock campaign since the campaigns table doesn't exist
  // TODO: Implement actual database integration when campaigns table is ready

  const slug = generateCampaignSlug(campaignData.name);

  const mockCampaign = {
    id: `campaign-${Date.now()}`,
    ...campaignData,
    slug,
    status: 'draft',
    created_by: user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    approval_status: 'pending',
    // Add mock client data
    clients: {
      name: 'Mock Client',
      slug: 'mock-client',
      primary_color: '#1976d2',
    },
  };

  return res.status(201).json({
    data: mockCampaign,
    message: 'Campaign created successfully (mock implementation)',
  });
}

// Helper functions
async function getCampaignStats(campaignId: string): Promise<any> {
  try {
    // Get matrices count
    const { count: matricesCount } = await supabase
      .from('matrices')
      .select('id', { count: 'exact' })
      .eq('campaign_id', campaignId);

    // Get executions count and status breakdown
    const { data: executions } = await supabase
      .from('executions')
      .select('status')
      .eq('campaign_id', campaignId);

    const executionStats =
      executions?.reduce(
        (acc, exec) => {
          acc[exec.status] = (acc[exec.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ) || {};

    // Get campaign analytics summary
    const { data: analytics } = await supabase
      .from('campaign_analytics')
      .select('impressions, clicks, conversions, spend')
      .eq('campaign_id', campaignId);

    const analyticsTotal = analytics?.reduce(
      (acc, record) => {
        acc.impressions += record.impressions || 0;
        acc.clicks += record.clicks || 0;
        acc.conversions += record.conversions || 0;
        acc.spend += parseFloat(record.spend) || 0;
        return acc;
      },
      { impressions: 0, clicks: 0, conversions: 0, spend: 0 }
    ) || { impressions: 0, clicks: 0, conversions: 0, spend: 0 };

    return {
      matrices_count: matricesCount || 0,
      executions_count: executions?.length || 0,
      execution_status: executionStats,
      performance: {
        ...analyticsTotal,
        ctr:
          analyticsTotal.impressions > 0
            ? (analyticsTotal.clicks / analyticsTotal.impressions) * 100
            : 0,
        conversion_rate:
          analyticsTotal.clicks > 0
            ? (analyticsTotal.conversions / analyticsTotal.clicks) * 100
            : 0,
      },
    };
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error getting campaign stats:', error);
    return {
      matrices_count: 0,
      executions_count: 0,
      execution_status: {},
      performance: {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        ctr: 0,
        conversion_rate: 0,
      },
    };
  }
}

function calculatePortfolioStats(campaigns: any[]): any {
  const statusCount = campaigns.reduce(
    (acc, campaign) => {
      acc[campaign.status] = (acc[campaign.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const priorityCount = campaigns.reduce(
    (acc, campaign) => {
      acc[campaign.priority] = (acc[campaign.priority] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const typeCount = campaigns.reduce(
    (acc, campaign) => {
      acc[campaign.campaign_type] = (acc[campaign.campaign_type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const totalBudget = campaigns.reduce((sum, campaign) => sum + (campaign.budget || 0), 0);
  const totalSpent = campaigns.reduce((sum, campaign) => sum + (campaign.spent || 0), 0);

  return {
    total_campaigns: campaigns.length,
    status_distribution: statusCount,
    priority_distribution: priorityCount,
    type_distribution: typeCount,
    budget_summary: {
      total_budget: totalBudget,
      total_spent: totalSpent,
      remaining_budget: totalBudget - totalSpent,
      utilization_rate: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
    },
  };
}

function generateCampaignSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 50);
}

async function initializeCampaignAnalytics(campaignId: string): Promise<void> {
  try {
    // Create initial analytics record for tracking
    await supabase.from('campaign_analytics').insert({
      campaign_id: campaignId,
      platform: 'consolidated',
      date: new Date().toISOString().split('T')[0],
      impressions: 0,
      clicks: 0,
      conversions: 0,
      spend: 0,
      raw_data: {
        initialized: true,
        created_at: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error initializing campaign analytics:', error);
    // Don't throw error, as this is not critical for campaign creation
  }
}

export default withAuth(withSecurityHeaders(handler));
