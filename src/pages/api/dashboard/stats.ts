import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';

interface DashboardStats {
  totalAssets: {
    count: number;
    change: string;
    trend: 'up' | 'down' | 'neutral';
  };
  aiGenerated: {
    count: number;
    change: string;
    trend: 'up' | 'down' | 'neutral';
  };
  activeCampaigns: {
    count: number;
    change: string;
    trend: 'up' | 'down' | 'neutral';
  };
  templatesUsed: {
    count: number;
    change: string;
    trend: 'up' | 'down' | 'neutral';
  };
  totalClients: {
    count: number;
    change: string;
    trend: 'up' | 'down' | 'neutral';
  };
  pendingApprovals: {
    count: number;
    change: string;
    trend: 'up' | 'down' | 'neutral';
  };
  recentActivity: Array<{
    id: string;
    type: 'campaign' | 'asset' | 'matrix' | 'approval';
    title: string;
    description: string;
    timestamp: string;
    user: string;
    client?: string;
  }>;
  performanceMetrics: {
    totalImpressions: number;
    totalClicks: number;
    averageCTR: number;
    totalSpend: number;
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = (req as any).user;

  try {
    const stats = await getDashboardStats(user.id);
    return res.json({ success: true, data: stats });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Dashboard stats API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    });
  }
}

async function getDashboardStats(userId: string): Promise<DashboardStats> {
  // Get user's accessible clients
  const { data: userClients } = await supabase!
    .from('user_clients')
    .select('client_id')
    .eq('user_id', userId);

  const clientIds = userClients?.map((uc: any) => uc.client_id) || [];

  if (clientIds.length === 0) {
    return getEmptyStats();
  }

  // Fetch current period stats (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const sixtyDaysAgoStr = sixtyDaysAgo.toISOString();

  // Parallel queries for performance
  const [
    currentAssets,
    previousAssets,
    currentCampaigns,
    previousCampaigns,
    matrices,
    approvals,
    recentActivities,
    analytics,
  ] = await Promise.all([
    // Current assets (last 30 days)
    supabase!
      .from('assets')
      .select('id, created_at, metadata')
      .in('client_id', clientIds)
      .gte('created_at', thirtyDaysAgoStr),

    // Previous assets (30-60 days ago)
    supabase!
      .from('assets')
      .select('id, created_at, metadata')
      .in('client_id', clientIds)
      .gte('created_at', sixtyDaysAgoStr)
      .lt('created_at', thirtyDaysAgoStr),

    // Current campaigns
    supabase!
      .from('campaigns')
      .select('id, status, created_at')
      .in('client_id', clientIds)
      .gte('created_at', thirtyDaysAgoStr),

    // Previous campaigns
    supabase!
      .from('campaigns')
      .select('id, status, created_at')
      .in('client_id', clientIds)
      .gte('created_at', sixtyDaysAgoStr)
      .lt('created_at', thirtyDaysAgoStr),

    // Matrices (for templates used)
    supabase!
      .from('matrices')
      .select('id, template_id, created_at')
      .gte('created_at', thirtyDaysAgoStr),

    // Pending approvals
    supabase!.from('approvals').select('id, status, created_at').eq('status', 'pending'),

    // Recent activities
    getRecentActivities(clientIds, userId),

    // Performance analytics
    getPerformanceMetrics(clientIds),
  ]);

  // Calculate asset stats
  const totalAssetsCount = currentAssets.data?.length || 0;
  const previousAssetsCount = previousAssets.data?.length || 0;
  const assetChange = calculatePercentageChange(totalAssetsCount, previousAssetsCount);

  // Calculate AI generated assets
  const aiGeneratedCount =
    currentAssets.data?.filter(
      (asset: any) => asset.metadata?.source === 'ai' || asset.metadata?.generated === true
    ).length || 0;
  const previousAiCount =
    previousAssets.data?.filter(
      (asset: any) => asset.metadata?.source === 'ai' || asset.metadata?.generated === true
    ).length || 0;
  const aiChange = calculatePercentageChange(aiGeneratedCount, previousAiCount);

  // Calculate campaign stats
  const activeCampaignsCount =
    currentCampaigns.data?.filter((c: any) => ['active', 'running', 'scheduled'].includes(c.status))
      .length || 0;
  const previousActiveCampaigns =
    previousCampaigns.data?.filter((c: any) =>
      ['active', 'running', 'scheduled'].includes(c.status)
    ).length || 0;
  const campaignChange = calculatePercentageChange(activeCampaignsCount, previousActiveCampaigns);

  // Calculate templates used
  const uniqueTemplates = new Set(matrices.data?.map((m: any) => m.template_id) || []);
  const templatesUsedCount = uniqueTemplates.size;
  const templatesChange = '+0%'; // TODO: Calculate based on previous period

  // Calculate client count
  const totalClientsCount = clientIds.length;
  const clientsChange = '+0%'; // TODO: Calculate based on user access changes

  // Calculate pending approvals
  const pendingApprovalsCount = approvals.data?.length || 0;
  const approvalsChange = '+0%'; // TODO: Calculate trend

  return {
    totalAssets: {
      count: totalAssetsCount,
      change: assetChange,
      trend: getTrend(assetChange),
    },
    aiGenerated: {
      count: aiGeneratedCount,
      change: aiChange,
      trend: getTrend(aiChange),
    },
    activeCampaigns: {
      count: activeCampaignsCount,
      change: campaignChange,
      trend: getTrend(campaignChange),
    },
    templatesUsed: {
      count: templatesUsedCount,
      change: templatesChange,
      trend: 'neutral',
    },
    totalClients: {
      count: totalClientsCount,
      change: clientsChange,
      trend: 'neutral',
    },
    pendingApprovals: {
      count: pendingApprovalsCount,
      change: approvalsChange,
      trend: 'neutral',
    },
    recentActivity: recentActivities,
    performanceMetrics: analytics,
  };
}

async function getRecentActivities(clientIds: string[], _userId: string): Promise<Array<any>> {
  try {
    // Get recent campaigns
    const { data: campaigns } = await supabase!
      .from('campaigns')
      .select(
        `
        id, name, created_at, updated_at,
        clients(name)
      `
      )
      .in('client_id', clientIds)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get recent assets
    const { data: assets } = await supabase!
      .from('assets')
      .select(
        `
        id, name, created_at, type,
        clients(name)
      `
      )
      .in('client_id', clientIds)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get recent matrices
    const { data: matrices } = await supabase!
      .from('matrices')
      .select(
        `
        id, name, created_at,
        campaigns(name, clients(name))
      `
      )
      .order('created_at', { ascending: false })
      .limit(5);

    const activities: Array<any> = [];

    // Add campaign activities
    campaigns?.forEach((campaign: any) => {
      activities.push({
        id: `campaign-${campaign.id}`,
        type: 'campaign',
        title: `Campaign Created: ${campaign.name}`,
        description: `New campaign created for ${(campaign as any).clients?.name}`,
        timestamp: campaign.created_at,
        user: 'User', // TODO: Get actual user name
        client: (campaign as any).clients?.name,
      });
    });

    // Add asset activities
    assets?.forEach((asset: any) => {
      activities.push({
        id: `asset-${asset.id}`,
        type: 'asset',
        title: `Asset Uploaded: ${asset.name}`,
        description: `New ${asset.type} asset added`,
        timestamp: asset.created_at,
        user: 'User',
        client: (asset as any).clients?.name,
      });
    });

    // Add matrix activities
    matrices?.forEach((matrix: any) => {
      activities.push({
        id: `matrix-${matrix.id}`,
        type: 'matrix',
        title: `Matrix Created: ${matrix.name}`,
        description: `New matrix for ${(matrix as any).campaigns?.clients?.name}`,
        timestamp: matrix.created_at,
        user: 'User',
        client: (matrix as any).campaigns?.clients?.name,
      });
    });

    // Sort by timestamp and return top 10
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  } catch (error: any) {
    console.error('Error fetching recent activities:', error);
    return [];
  }
}

async function getPerformanceMetrics(clientIds: string[]): Promise<any> {
  try {
    // Get campaign analytics for accessible clients
    const { data: analytics } = await supabase!
      .from('campaign_analytics')
      .select(
        `
        impressions, clicks, spend,
        campaigns(client_id)
      `
      )
      .in('campaigns.client_id', clientIds);

    if (!analytics || analytics.length === 0) {
      return {
        totalImpressions: 0,
        totalClicks: 0,
        averageCTR: 0,
        totalSpend: 0,
      };
    }

    const totalImpressions = analytics.reduce((sum, a) => sum + (a.impressions || 0), 0);
    const totalClicks = analytics.reduce((sum, a) => sum + (a.clicks || 0), 0);
    const totalSpend = analytics.reduce((sum, a) => sum + (parseFloat(a.spend) || 0), 0);
    const averageCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    return {
      totalImpressions,
      totalClicks,
      averageCTR: Math.round(averageCTR * 100) / 100,
      totalSpend: Math.round(totalSpend * 100) / 100,
    };
  } catch (error: any) {
    console.error('Error fetching performance metrics:', error);
    return {
      totalImpressions: 0,
      totalClicks: 0,
      averageCTR: 0,
      totalSpend: 0,
    };
  }
}

function calculatePercentageChange(current: number, previous: number): string {
  if (previous === 0) {
    return current > 0 ? '+100%' : '0%';
  }

  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${Math.round(change)}%`;
}

function getTrend(change: string): 'up' | 'down' | 'neutral' {
  if (change.startsWith('+') && !change.startsWith('+0')) {
    return 'up';
  } else if (change.startsWith('-')) {
    return 'down';
  }
  return 'neutral';
}

function getEmptyStats(): DashboardStats {
  return {
    totalAssets: { count: 0, change: '0%', trend: 'neutral' },
    aiGenerated: { count: 0, change: '0%', trend: 'neutral' },
    activeCampaigns: { count: 0, change: '0%', trend: 'neutral' },
    templatesUsed: { count: 0, change: '0%', trend: 'neutral' },
    totalClients: { count: 0, change: '0%', trend: 'neutral' },
    pendingApprovals: { count: 0, change: '0%', trend: 'neutral' },
    recentActivity: [],
    performanceMetrics: {
      totalImpressions: 0,
      totalClicks: 0,
      averageCTR: 0,
      totalSpend: 0,
    },
  };
}

export default withAuth(withSecurityHeaders(handler));
