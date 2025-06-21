import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/client';
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';

const CampaignUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  objective: z.string().min(1).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  budget: z.number().min(0).optional(),
  targeting: z.any().optional(),
  platforms: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  campaign_type: z.enum(['awareness', 'consideration', 'conversion', 'retention', 'mixed']).optional(),
  kpis: z.array(z.string()).optional(),
  creative_requirements: z.any().optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).optional(),
  approval_status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const { id } = req.query;
  const user = (req as any).user;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Campaign ID is required' });
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
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('Campaign API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
    });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any, campaignId: string): Promise<void> {
    // For now, return mock campaign data since campaigns table doesn't exist yet
  // TODO: Implement actual database queries when campaigns table is ready
  
  const mockCampaign = {
    id: campaignId,
    name: campaignId.includes('test') ? 'Test Campaign' : 'Execute at the speed of AI',
    slug: 'mock-campaign',
    description: 'This is a mock campaign for development purposes.',
    objective: 'Brand Awareness',
    status: 'draft',
    priority: 'medium',
    campaign_type: 'awareness',
    client_id: '75d19828-19c3-4aff-932a-b9049d564889', // Default client ID
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    budget: {
      total: 5000,
      spent: 1250
    },
    spent: 1250,
    platforms: ['facebook', 'instagram', 'twitter'],
    targeting: {
      platforms: ['facebook', 'instagram', 'twitter'],
      audience: 'Marketing professionals',
      frequency: 'daily',
      estimatedPosts: '10'
    },
    schedule: {
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    },
    kpis: ['impressions', 'clicks', 'conversions'],
    tags: ['ai', 'marketing', 'automation'],
    creative_requirements: Record<string, unknown>
    approval_status: 'pending',
    created_by: user.id,
    dateCreated: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    // Add mock client data
    clients: {
      name: 'Redbaez',
      slug: 'redbaez',
      primary_color: '#1976d2',
      secondary_color: '#dc004e',
      brand_guidelines: {
        voiceTone: 'Friendly',
        targetAudience: 'Marketers',
        keyMessages: ['creative at the speed of ai']
      }
    },
    // Add mock matrices and executions without database queries
    matrices: [],
    executions: [],
    analytics: {
      has_data: false,
      summary: {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        ctr: 0,
        cpc: 0,
        roas: 0
      }
    },
    health_score: {
      score: 75,
      grade: 'B',
      issues: ['Missing campaign description'],
      recommendations: ['Add detailed campaign description']
    },
    timeline: [],
    insights: ['Campaign ready for launch']
  };

    return res.json({
    data: mockCampaign
  });
}

async function handlePut(req: NextApiRequest, res: NextApiResponse, user: any, campaignId: string): Promise<void> {
  const validationResult = CampaignUpdateSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: validationResult.error.issues
    });
  }

  // First verify user has access to this campaign
  const { data: existingCampaign } = await supabase
    .from('campaigns')
    .select('client_id, status, approval_status')
    .eq('id', campaignId)
    .single();

  if (!existingCampaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', existingCampaign.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this campaign' });
  }

  const updateData = validationResult.data;

  // Handle status transitions
  if (updateData.status && updateData.status !== existingCampaign.status) {
    const transitionResult = await handleStatusTransition(campaignId, existingCampaign.status, updateData.status, user.id);
    if (!transitionResult.success) {
      return res.status(400).json({ error: transitionResult.error });
    }
  }

  // Handle approval status changes
  if (updateData.approval_status && updateData.approval_status !== existingCampaign.approval_status) {
    if (updateData.approval_status === 'approved') {
      (updateData as any).approved_by = user.id;
      (updateData as any).approval_date = new Date().toISOString();
    }
  }

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select(`
      *,
      clients(name, slug),
      briefs(id, name),
      profiles!campaigns_created_by_fkey(full_name),
      profiles!campaigns_approved_by_fkey(full_name)
    `)
    .single();

  if (error) {
    console.error('Error updating campaign:', error);
    return res.status(500).json({ error: 'Failed to update campaign' });
  }

  return res.json({ data: campaign });
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse, user: any, campaignId: string): Promise<void> {
  // First verify user has access to this campaign
  const { data: existingCampaign } = await supabase
    .from('campaigns')
    .select('client_id, status')
    .eq('id', campaignId)
    .single();

  if (!existingCampaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', existingCampaign.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this campaign' });
  }

  // Check if campaign can be deleted
  if (existingCampaign.status === 'active') {
    return res.status(409).json({ 
      error: 'Cannot delete active campaign',
      details: 'Please pause or complete the campaign before deleting'
    });
  }

  // Check for dependencies
  const dependencies = await checkCampaignDependencies(campaignId);
  if (dependencies.hasActiveExecutions) {
    return res.status(409).json({ 
      error: 'Cannot delete campaign with active executions',
      details: dependencies.details
    });
  }

  // Archive related data instead of hard delete
  const { error } = await supabase
    .from('campaigns')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
      archived_by: user.id,
    })
    .eq('id', campaignId);

  if (error) {
    console.error('Error archiving campaign:', error);
    return res.status(500).json({ error: 'Failed to archive campaign' });
  }

  return res.status(200).json({ 
    message: 'Campaign archived successfully',
    note: 'Campaign data has been archived and can be restored if needed'
  });
}

// Helper functions
async function getCampaignAnalytics(campaignId: string, period: string): Promise<any> {
  try {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    const { data: analytics } = await supabase
      .from('campaign_analytics')
      .select('*')
      .eq('campaign_id', campaignId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (!analytics || analytics.length === 0) {
      return {
        has_data: false,
        period,
        summary: {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          spend: 0,
          ctr: 0,
          cpc: 0,
          roas: 0,
        }
      };
    }

    // Aggregate totals
    const totals = analytics.reduce((acc, record) => {
      acc.impressions += record.impressions || 0;
      acc.clicks += record.clicks || 0;
      acc.conversions += record.conversions || 0;
      acc.spend += parseFloat(record.spend) || 0;
      return acc;
    }, { impressions: 0, clicks: 0, conversions: 0, spend: 0 });

    // Calculate derived metrics
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    const roas = totals.spend > 0 ? (totals.conversions * 50) / totals.spend : 0; // Assuming $50 avg order value

    // Platform breakdown
    const platformBreakdown = analytics.reduce((acc, record) => {
      if (!acc[record.platform]) {
        acc[record.platform] = { impressions: 0, clicks: 0, conversions: 0, spend: 0 };
      }
      acc[record.platform].impressions += record.impressions || 0;
      acc[record.platform].clicks += record.clicks || 0;
      acc[record.platform].conversions += record.conversions || 0;
      acc[record.platform].spend += parseFloat(record.spend) || 0;
      return acc;
    }, {} as Record<string, any>);

    // Daily performance
    const dailyPerformance = analytics.map(record => ({
      date: record.date,
      impressions: record.impressions || 0,
      clicks: record.clicks || 0,
      conversions: record.conversions || 0,
      spend: parseFloat(record.spend) || 0,
      ctr: record.impressions > 0 ? (record.clicks / record.impressions) * 100 : 0,
    }));

    return {
      has_data: true,
      period,
      summary: {
        ...totals,
        ctr: Math.round(ctr * 100) / 100,
        cpc: Math.round(cpc * 100) / 100,
        roas: Math.round(roas * 100) / 100,
      },
      platform_breakdown: platformBreakdown,
      daily_performance: dailyPerformance,
      date_range: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      }
    };
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('Error getting campaign analytics:', error);
    return {
      has_data: false,
      period,
      error: 'Failed to retrieve analytics data',
    };
  }
}

function calculateCampaignHealth(campaign: any): any {
  let healthScore = 100;
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check campaign setup
  if (!campaign.description || campaign.description.length < 20) {
    healthScore -= 10;
    issues.push('Missing or insufficient campaign description');
    recommendations.push('Add detailed campaign description');
  }

  if (!campaign.start_date || !campaign.end_date) {
    healthScore -= 15;
    issues.push('Missing campaign dates');
    recommendations.push('Set campaign start and end dates');
  }

  if (!campaign.budget || campaign.budget <= 0) {
    healthScore -= 10;
    issues.push('No budget allocated');
    recommendations.push('Set campaign budget');
  }

  if (!campaign.platforms || campaign.platforms.length === 0) {
    healthScore -= 10;
    issues.push('No platforms selected');
    recommendations.push('Select target platforms');
  }

  if (!campaign.kpis || campaign.kpis.length === 0) {
    healthScore -= 5;
    issues.push('No KPIs defined');
    recommendations.push('Define campaign KPIs');
  }

  // Check matrices and executions
  const matricesCount = campaign.matrices?.length || 0;
  const executionsCount = campaign.executions?.length || 0;

  if (matricesCount === 0) {
    healthScore -= 20;
    issues.push('No campaign matrices created');
    recommendations.push('Create campaign matrices');
  }

  if (executionsCount === 0 && matricesCount > 0) {
    healthScore -= 15;
    issues.push('Matrices created but no executions');
    recommendations.push('Execute campaign matrices');
  }

  // Check approval status
  if (campaign.approval_status === 'rejected') {
    healthScore -= 25;
    issues.push('Campaign rejected');
    recommendations.push('Address rejection feedback and resubmit');
  }

  return {
    score: Math.max(0, healthScore),
    grade: healthScore >= 90 ? 'A' : healthScore >= 80 ? 'B' : healthScore >= 70 ? 'C' : healthScore >= 60 ? 'D' : 'F',
    issues,
    recommendations,
  };
}

async function getCampaignTimeline(campaignId: string): Promise<any[]> {
  try {
    const timeline: any[] = [];

    // Get campaign creation
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('created_at, created_by, approval_date, approved_by, profiles!campaigns_created_by_fkey(full_name)')
      .eq('id', campaignId)
      .single();

    if (campaign) {
      timeline.push({
        date: campaign.created_at,
        event: 'Campaign Created',
        description: 'Campaign was created',
        user: (campaign.profiles as any)?.[0]?.full_name,
        type: 'creation',
      });

      if (campaign.approval_date) {
        timeline.push({
          date: campaign.approval_date,
          event: 'Campaign Approved',
          description: 'Campaign was approved for execution',
          user: campaign.approved_by,
          type: 'approval',
        });
      }
    }

    // Get matrices creation
    const { data: matrices } = await supabase
      .from('matrices')
      .select('created_at, name, profiles!matrices_created_by_fkey(full_name)')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });

    matrices?.forEach(matrix => {
      timeline.push({
        date: matrix.created_at,
        event: 'Matrix Created',
        description: `Matrix "${matrix.name}" was created`,
        user: (matrix.profiles as any)?.[0]?.full_name,
        type: 'matrix',
      });
    });

    // Get executions
    const { data: executions } = await supabase
      .from('executions')
      .select('created_at, status, platform, content_type')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });

    executions?.forEach(execution => {
      timeline.push({
        date: execution.created_at,
        event: 'Execution Started',
        description: `${execution.content_type} execution for ${execution.platform}`,
        type: 'execution',
        status: execution.status,
      });
    });

    // Sort timeline by date
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return timeline;
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('Error getting campaign timeline:', error);
    return [];
  }
}

async function generateCampaignInsights(campaign: any): Promise<string[]> {
  const insights: string[] = [];

  // Performance insights
  if (campaign.analytics?.has_data) {
    const summary = campaign.analytics.summary;
    
    if (summary.ctr > 2) {
      insights.push('Excellent click-through rate indicates strong creative performance');
    } else if (summary.ctr < 0.5) {
      insights.push('Low CTR suggests creative optimization opportunities');
    }

    if (summary.roas > 4) {
      insights.push('Strong return on ad spend indicates effective targeting');
    } else if (summary.roas < 2) {
      insights.push('Consider optimizing targeting to improve ROAS');
    }
  }

  // Timeline insights
  const daysRunning = campaign.start_date ? 
    Math.floor((Date.now() - new Date(campaign.start_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;

  if (daysRunning > 30 && campaign.status === 'active') {
    insights.push('Long-running campaign may benefit from creative refresh');
  }

  // Budget insights
  if (campaign.budget && campaign.spent) {
    const utilization = (campaign.spent / campaign.budget) * 100;
    
    if (utilization > 90) {
      insights.push('Campaign approaching budget limit');
    } else if (utilization < 50 && daysRunning > 7) {
      insights.push('Low budget utilization - consider increasing bids or expanding targeting');
    }
  }

  // Matrix insights
  const matricesCount = campaign.matrices?.length || 0;
  const executionsCount = campaign.executions?.length || 0;

  if (matricesCount > 0 && executionsCount === 0) {
    insights.push('Matrices ready for execution - consider launching campaign');
  }

  if (executionsCount > 10) {
    insights.push('High execution volume - monitor for creative fatigue');
  }

  return insights;
}

async function handleStatusTransition(campaignId: string, currentStatus: string, newStatus: string, userId: string): Promise<{ success: boolean; error?: string }> {
  // Define valid status transitions
  const validTransitions: Record<string, string[]> = {
    draft: ['active', 'archived'],
    active: ['paused', 'completed', 'archived'],
    paused: ['active', 'completed', 'archived'],
    completed: ['archived'],
    archived: [], // Archived campaigns cannot be changed
  };

  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    return {
      success: false,
      error: `Invalid status transition from ${currentStatus} to ${newStatus}`
    };
  }

  // Additional validation for specific transitions
  if (newStatus === 'active') {
    // Check if campaign has matrices
    const { count: matricesCount } = await supabase
      .from('matrices')
      .select('id', { count: 'exact' })
      .eq('campaign_id', campaignId);

    if (!matricesCount || matricesCount === 0) {
      return {
        success: false,
        error: 'Cannot activate campaign without matrices'
      };
    }
  }

  return { success: true };
}

async function checkCampaignDependencies(campaignId: string): Promise<{ hasActiveExecutions: boolean; details: string[] }> {
  const details: string[] = [];

  try {
    // Check for active executions
    const { data: activeExecutions } = await supabase
      .from('executions')
      .select('id, status')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'processing', 'active']);

    if (activeExecutions && activeExecutions.length > 0) {
      details.push(`${activeExecutions.length} active executions`);
    }

    return {
      hasActiveExecutions: (activeExecutions?.length || 0) > 0,
      details,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('Error checking campaign dependencies:', error);
    return {
      hasActiveExecutions: false,
      details: ['Error checking dependencies'],
    };
  }
}

export default withAuth(withSecurityHeaders(handler));