import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';

interface AnalyticsOverview {
  performanceData: Array<{
    date: string;
    views: number;
    engagement: number;
    conversions: number;
    impressions: number;
    clicks: number;
    spend: number;
  }>;
  platformData: Array<{
    name: string;
    value: number;
    color: string;
    campaigns: number;
    spend: number;
  }>;
  topPerformingContent: Array<{
    id: string;
    title: string;
    platform: string;
    views: number;
    engagement: number;
    conversion: number;
    trend: 'up' | 'down' | 'neutral';
    campaignId: string;
    matrixId?: string;
  }>;
  kpiSummary: {
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalSpend: number;
    averageCTR: number;
    averageConversionRate: number;
    averageCPC: number;
    roas: number;
  };
  trends: {
    impressions: { value: number; change: number };
    clicks: { value: number; change: number };
    conversions: { value: number; change: number };
    spend: { value: number; change: number };
  };
  dateRange: {
    start: string;
    end: string;
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = (req as any).user;
  const { clientId, startDate, endDate, platform, campaignId } = req.query;

  try {
    const analytics = await getAnalyticsOverview(user.id, {
      clientId: clientId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      platform: platform as string,
      campaignId: campaignId as string,
    });

    return res.json({ success: true, data: analytics });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Analytics overview API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    });
  }
}

async function getAnalyticsOverview(
  userId: string,
  filters: {
    clientId?: string;
    startDate?: string;
    endDate?: string;
    platform?: string;
    campaignId?: string;
  }
): Promise<AnalyticsOverview> {
  // Set default date range (last 30 days)
  const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
  const startDate = filters.startDate
    ? new Date(filters.startDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  if (!supabase) {
    throw new Error('Database connection error');
  }

  // Get user's accessible clients
  const { data: userClients } = await supabase
    .from('user_clients')
    .select('client_id')
    .eq('user_id', userId);

  const clientIds = userClients?.map((uc: any) => uc.client_id) || [];

  if (clientIds.length === 0) {
    return getEmptyAnalytics(startDate, endDate);
  }

  // Filter by specific client if provided
  const targetClientIds = filters.clientId ? [filters.clientId] : clientIds;

  // Build base query for campaigns
  let campaignQuery = supabase
    .from('campaigns')
    .select(
      `
      id, name, platform, client_id,
      campaign_analytics(
        date, impressions, clicks, conversions, spend,
        ctr, conversion_rate, cpc, created_at
      )
    `
    )
    .in('client_id', targetClientIds)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  // Apply filters
  if (filters.platform) {
    campaignQuery = campaignQuery.eq('platform', filters.platform);
  }

  if (filters.campaignId) {
    campaignQuery = campaignQuery.eq('id', filters.campaignId);
  }

  const { data: campaigns } = await campaignQuery;

  // Calculate performance data by date
  const performanceData = calculateDailyPerformance(campaigns || [], startDate, endDate);

  // Calculate platform distribution
  const platformData = calculatePlatformDistribution(campaigns || []);

  // Get top performing content
  const topPerformingContent = await getTopPerformingContent(targetClientIds, startDate, endDate);

  // Calculate KPI summary
  const kpiSummary = calculateKPISummary(campaigns || []);

  // Calculate trends (compare with previous period)
  const trends = await calculateTrends(targetClientIds, startDate, endDate);

  return {
    performanceData,
    platformData,
    topPerformingContent,
    kpiSummary,
    trends,
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
  };
}

function calculateDailyPerformance(campaigns: any[], startDate: Date, endDate: Date): Array<any> {
  const dailyData: Record<string, any> = {};

  // Initialize all dates in range
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    if (dateStr) {
      dailyData[dateStr] = {
      date: dateStr,
      views: 0,
      engagement: 0,
      conversions: 0,
      impressions: 0,
      clicks: 0,
      spend: 0,
    };
    }
  }

  // Aggregate analytics data by date
  campaigns.forEach((campaign: any) => {
    campaign.campaign_analytics?.forEach((analytics: any) => {
      const dateStr = analytics.date || analytics.created_at?.split('T')[0];
      if (dateStr && dailyData[dateStr]) {
        dailyData[dateStr].impressions += analytics.impressions || 0;
        dailyData[dateStr].clicks += analytics.clicks || 0;
        dailyData[dateStr].conversions += analytics.conversions || 0;
        dailyData[dateStr].spend += parseFloat(analytics.spend) || 0;
        // Calculate derived metrics
        dailyData[dateStr].views = dailyData[dateStr].impressions; // Views = Impressions for simplicity
        dailyData[dateStr].engagement = Math.round(dailyData[dateStr].clicks * 0.1); // Estimated engagement
      }
    });
  });

  return Object.values(dailyData).sort(
    (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

function calculatePlatformDistribution(campaigns: any[]): Array<any> {
  const platformColors: Record<string, string> = {
    Instagram: '#E1306C',
    Facebook: '#1877F2',
    Twitter: '#1DA1F2',
    LinkedIn: '#0A66C2',
    YouTube: '#FF0000',
    TikTok: '#000000',
    Pinterest: '#BD081C',
  };

  const platformStats: Record<string, any> = {};
  let totalImpressions = 0;

  campaigns.forEach((campaign: any) => {
    const platform = campaign.platform || 'Unknown';
    if (!platformStats[platform]) {
      platformStats[platform] = {
        name: platform,
        color: platformColors[platform] || '#666666',
        campaigns: 0,
        impressions: 0,
        spend: 0,
      };
    }

    platformStats[platform].campaigns += 1;

    campaign.campaign_analytics?.forEach((analytics: any) => {
      platformStats[platform].impressions += analytics.impressions || 0;
      platformStats[platform].spend += parseFloat(analytics.spend) || 0;
      totalImpressions += analytics.impressions || 0;
    });
  });

  // Calculate percentages
  return Object.values(platformStats).map((platform: any) => ({
    ...platform,
    value: totalImpressions > 0 ? Math.round((platform.impressions / totalImpressions) * 100) : 0,
  }));
}

async function getTopPerformingContent(
  clientIds: string[],
  startDate: Date,
  endDate: Date
): Promise<Array<any>> {
  try {
    // Get campaigns with their analytics, ordered by performance
    const { data: campaigns } = await (supabase!
      .from('campaigns')
      .select(
        `
        id, name, platform, client_id,
        campaign_analytics(impressions, clicks, conversions, ctr),
        matrices(id, name)
      `
      )
      .in('client_id', clientIds)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(10));

    return (campaigns || [])
      .map((campaign: any) => {
        const totalImpressions =
          campaign.campaign_analytics?.reduce(
            (sum: number, a: any) => sum + (a.impressions || 0),
            0
          ) || 0;
        const totalClicks =
          campaign.campaign_analytics?.reduce((sum: number, a: any) => sum + (a.clicks || 0), 0) ||
          0;
        const totalConversions =
          campaign.campaign_analytics?.reduce(
            (sum: number, a: any) => sum + (a.conversions || 0),
            0
          ) || 0;

        const engagementRate = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

        return {
          id: campaign.id,
          title: campaign.name,
          platform: campaign.platform || 'Unknown',
          views: totalImpressions,
          engagement: Math.round(engagementRate * 100) / 100,
          conversion: Math.round(conversionRate * 100) / 100,
          trend: engagementRate > 5 ? 'up' : engagementRate < 2 ? 'down' : 'neutral',
          campaignId: campaign.id,
          matrixId: campaign.matrices?.[0]?.id,
        };
      })
      .sort((a, b) => b.views - a.views);
  } catch (error: any) {
    console.error('Error fetching top performing content:', error);
    return [];
  }
}

function calculateKPISummary(campaigns: any[]): any {
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalConversions = 0;
  let totalSpend = 0;

  campaigns.forEach((campaign: any) => {
    campaign.campaign_analytics?.forEach((analytics: any) => {
      totalImpressions += analytics.impressions || 0;
      totalClicks += analytics.clicks || 0;
      totalConversions += analytics.conversions || 0;
      totalSpend += parseFloat(analytics.spend) || 0;
    });
  });

  const averageCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const averageConversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
  const averageCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const roas = totalSpend > 0 ? (totalConversions * 50) / totalSpend : 0; // Assuming $50 avg order value

  return {
    totalImpressions,
    totalClicks,
    totalConversions,
    totalSpend: Math.round(totalSpend * 100) / 100,
    averageCTR: Math.round(averageCTR * 100) / 100,
    averageConversionRate: Math.round(averageConversionRate * 100) / 100,
    averageCPC: Math.round(averageCPC * 100) / 100,
    roas: Math.round(roas * 100) / 100,
  };
}

async function calculateTrends(clientIds: string[], startDate: Date, endDate: Date): Promise<any> {
  // Calculate previous period for comparison
  const periodLength = endDate.getTime() - startDate.getTime();
  const previousStartDate = new Date(startDate.getTime() - periodLength);
  const previousEndDate = new Date(startDate.getTime() - 1);

  try {
    // Get current period data
    const { data: currentCampaigns } = await supabase!
      .from('campaigns')
      .select(`campaign_analytics(impressions, clicks, conversions, spend)`)
      .in('client_id', clientIds)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    // Get previous period data
    const { data: previousCampaigns } = await supabase!
      .from('campaigns')
      .select(`campaign_analytics(impressions, clicks, conversions, spend)`)
      .in('client_id', clientIds)
      .gte('created_at', previousStartDate.toISOString())
      .lte('created_at', previousEndDate.toISOString());

    const currentMetrics = calculatePeriodMetrics(currentCampaigns || []);
    const previousMetrics = calculatePeriodMetrics(previousCampaigns || []);

    return {
      impressions: {
        value: currentMetrics.impressions,
        change: calculatePercentageChange(currentMetrics.impressions, previousMetrics.impressions),
      },
      clicks: {
        value: currentMetrics.clicks,
        change: calculatePercentageChange(currentMetrics.clicks, previousMetrics.clicks),
      },
      conversions: {
        value: currentMetrics.conversions,
        change: calculatePercentageChange(currentMetrics.conversions, previousMetrics.conversions),
      },
      spend: {
        value: currentMetrics.spend,
        change: calculatePercentageChange(currentMetrics.spend, previousMetrics.spend),
      },
    };
  } catch (error: any) {
    console.error('Error calculating trends:', error);
    return {
      impressions: { value: 0, change: 0 },
      clicks: { value: 0, change: 0 },
      conversions: { value: 0, change: 0 },
      spend: { value: 0, change: 0 },
    };
  }
}

function calculatePeriodMetrics(campaigns: any[]): any {
  let impressions = 0;
  let clicks = 0;
  let conversions = 0;
  let spend = 0;

  campaigns.forEach((campaign: any) => {
    campaign.campaign_analytics?.forEach((analytics: any) => {
      impressions += analytics.impressions || 0;
      clicks += analytics.clicks || 0;
      conversions += analytics.conversions || 0;
      spend += parseFloat(analytics.spend) || 0;
    });
  });

  return { impressions, clicks, conversions, spend };
}

function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function getEmptyAnalytics(startDate: Date, endDate: Date): AnalyticsOverview {
  return {
    performanceData: [],
    platformData: [],
    topPerformingContent: [],
    kpiSummary: {
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalSpend: 0,
      averageCTR: 0,
      averageConversionRate: 0,
      averageCPC: 0,
      roas: 0,
    },
    trends: {
      impressions: { value: 0, change: 0 },
      clicks: { value: 0, change: 0 },
      conversions: { value: 0, change: 0 },
      spend: { value: 0, change: 0 },
    },
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
  };
}

export default withAuth(withSecurityHeaders(handler));
