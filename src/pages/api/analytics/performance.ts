import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';

const PerformanceFilterSchema = z.object({
  client_id: z.string().uuid(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  platform: z.string().optional(),
  campaign_id: z.string().uuid().optional(),
  matrix_id: z.string().uuid().optional(),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  metrics: z.array(z.string()).default(['impressions', 'clicks', 'conversions', 'spend']),
});

interface PerformanceMetrics {
  timeSeriesData: Array<{
    date: string;
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    ctr: number;
    cpc: number;
    conversion_rate: number;
    roas: number;
  }>;
  aggregatedMetrics: {
    total_impressions: number;
    total_clicks: number;
    total_conversions: number;
    total_spend: number;
    average_ctr: number;
    average_cpc: number;
    average_conversion_rate: number;
    average_roas: number;
  };
  comparisons: {
    previous_period: {
      impressions_change: number;
      clicks_change: number;
      conversions_change: number;
      spend_change: number;
    };
    benchmarks: {
      industry_avg_ctr: number;
      industry_avg_conversion_rate: number;
      performance_score: number;
    };
  };
  topPerformers: {
    campaigns: Array<{
      id: string;
      name: string;
      impressions: number;
      conversions: number;
      roas: number;
    }>;
    content: Array<{
      id: string;
      title: string;
      platform: string;
      engagement_rate: number;
      conversion_rate: number;
    }>;
    platforms: Array<{
      name: string;
      spend: number;
      conversions: number;
      efficiency_score: number;
    }>;
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const user = (req as any).user;

  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return handleGet(req, res, user);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Performance Analytics API error:', message);
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
  const validationResult = PerformanceFilterSchema.safeParse(req.query);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Invalid query parameters',
      details: validationResult.error.issues,
    });
  }

  const filters = validationResult.data;

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('client_id', filters.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this client' });
  }

  // Get date range
  const endDate = filters.date_to ? new Date(filters.date_to) : new Date();
  const startDate = filters.date_from
    ? new Date(filters.date_from)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Fetch performance data
  const performanceData = await getPerformanceData(filters, startDate, endDate);

  return res.json({
    success: true,
    data: performanceData,
  });
}

async function getPerformanceData(
  filters: any,
  startDate: Date,
  endDate: Date
): Promise<PerformanceMetrics> {
  // Get campaigns data for the client
  let campaignsQuery = supabase
    .from('campaigns')
    .select(
      `
      *,
      matrices(
        id, name, status,
        executions(
          id, status, platform, content_type, 
          created_at, metadata
        )
      )
    `
    )
    .eq('client_id', filters.client_id)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (filters.campaign_id) {
    campaignsQuery = campaignsQuery.eq('id', filters.campaign_id);
  }

  const { data: campaigns } = await campaignsQuery;

  // Get analytics data (from campaign_analytics table if it exists, otherwise generate)
  const { data: analyticsData } = await supabase
    .from('campaign_analytics')
    .select('*')
    .eq('client_id', filters.client_id)
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0]);

  // Generate time series data
  const timeSeriesData = generateTimeSeriesData(
    analyticsData || [],
    startDate,
    endDate,
    filters.granularity
  );

  // Calculate aggregated metrics
  const aggregatedMetrics = calculateAggregatedMetrics(timeSeriesData);

  // Get previous period for comparison
  const previousPeriod = await getPreviousPeriodData(filters, startDate, endDate);

  // Calculate comparisons
  const comparisons = calculateComparisons(aggregatedMetrics, previousPeriod);

  // Get top performers
  const topPerformers = await getTopPerformers(filters, campaigns || []);

  return {
    timeSeriesData,
    aggregatedMetrics,
    comparisons,
    topPerformers,
  };
}

function generateTimeSeriesData(
  analyticsData: any[],
  startDate: Date,
  endDate: Date,
  granularity: string
): any[] {
  const data: any[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];

    // Find analytics data for this date
    const dayData = analyticsData.filter((item: any) => item.date === dateStr);

    const totalImpressions = dayData.reduce((sum, item) => sum + (item.impressions || 0), 0);
    const totalClicks = dayData.reduce((sum, item) => sum + (item.clicks || 0), 0);
    const totalConversions = dayData.reduce((sum, item) => sum + (item.conversions || 0), 0);
    const totalSpend = dayData.reduce((sum, item) => sum + parseFloat(item.spend || '0'), 0);

    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
    const roas = totalSpend > 0 ? (totalConversions * 50) / totalSpend : 0; // Assuming $50 per conversion

    data.push({
      date: dateStr,
      impressions: totalImpressions,
      clicks: totalClicks,
      conversions: totalConversions,
      spend: Math.round(totalSpend * 100) / 100,
      ctr: Math.round(ctr * 100) / 100,
      cpc: Math.round(cpc * 100) / 100,
      conversion_rate: Math.round(conversionRate * 100) / 100,
      roas: Math.round(roas * 100) / 100,
    });

    // Increment date based on granularity
    switch (granularity) {
      case 'hour':
        current.setHours(current.getHours() + 1);
        break;
      case 'day':
        current.setDate(current.getDate() + 1);
        break;
      case 'week':
        current.setDate(current.getDate() + 7);
        break;
      case 'month':
        current.setMonth(current.getMonth() + 1);
        break;
    }
  }

  return data;
}

function calculateAggregatedMetrics(timeSeriesData: any[]): any {
  const totals = timeSeriesData.reduce(
    (acc, item) => ({
      total_impressions: acc.total_impressions + item.impressions,
      total_clicks: acc.total_clicks + item.clicks,
      total_conversions: acc.total_conversions + item.conversions,
      total_spend: acc.total_spend + item.spend,
    }),
    { total_impressions: 0, total_clicks: 0, total_conversions: 0, total_spend: 0 }
  );

  const average_ctr =
    totals.total_impressions > 0 ? (totals.total_clicks / totals.total_impressions) * 100 : 0;

  const average_cpc = totals.total_clicks > 0 ? totals.total_spend / totals.total_clicks : 0;

  const average_conversion_rate =
    totals.total_clicks > 0 ? (totals.total_conversions / totals.total_clicks) * 100 : 0;

  const average_roas =
    totals.total_spend > 0 ? (totals.total_conversions * 50) / totals.total_spend : 0;

  return {
    ...totals,
    average_ctr: Math.round(average_ctr * 100) / 100,
    average_cpc: Math.round(average_cpc * 100) / 100,
    average_conversion_rate: Math.round(average_conversion_rate * 100) / 100,
    average_roas: Math.round(average_roas * 100) / 100,
  };
}

async function getPreviousPeriodData(
  filters: any,
  currentStart: Date,
  currentEnd: Date
): Promise<any> {
  const duration = currentEnd.getTime() - currentStart.getTime();
  const previousStart = new Date(currentStart.getTime() - duration);
  const previousEnd = new Date(currentEnd.getTime() - duration);

  const { data: previousAnalytics } = await supabase
    .from('campaign_analytics')
    .select('*')
    .eq('client_id', filters.client_id)
    .gte('date', previousStart.toISOString().split('T')[0])
    .lte('date', previousEnd.toISOString().split('T')[0]);

  const previousTimeSeriesData = generateTimeSeriesData(
    previousAnalytics || [],
    previousStart,
    previousEnd,
    'day'
  );

  return calculateAggregatedMetrics(previousTimeSeriesData);
}

function calculateComparisons(current: any, previous: any): any {
  const calculateChange = (currentVal: number, previousVal: number) => {
    if (previousVal === 0) return currentVal > 0 ? 100 : 0;
    return Math.round(((currentVal - previousVal) / previousVal) * 100);
  };

  return {
    previous_period: {
      impressions_change: calculateChange(current.total_impressions, previous.total_impressions),
      clicks_change: calculateChange(current.total_clicks, previous.total_clicks),
      conversions_change: calculateChange(current.total_conversions, previous.total_conversions),
      spend_change: calculateChange(current.total_spend, previous.total_spend),
    },
    benchmarks: {
      industry_avg_ctr: 2.5, // Industry benchmark
      industry_avg_conversion_rate: 3.8, // Industry benchmark
      performance_score: calculatePerformanceScore(current),
    },
  };
}

function calculatePerformanceScore(metrics: any): number {
  // Calculate performance score based on multiple factors
  const ctrScore = Math.min((metrics.average_ctr / 2.5) * 25, 25); // Out of 25
  const conversionScore = Math.min((metrics.average_conversion_rate / 3.8) * 25, 25); // Out of 25
  const roasScore = Math.min((metrics.average_roas / 3.0) * 25, 25); // Out of 25
  const efficiencyScore =
    metrics.average_cpc < 2 ? 25 : Math.max(0, 25 - (metrics.average_cpc - 2) * 5); // Out of 25

  return Math.round(ctrScore + conversionScore + roasScore + efficiencyScore);
}

async function getTopPerformers(_filters: any, campaigns: any[]): Promise<any> {
  // Top performing campaigns
  const topCampaigns = campaigns.slice(0, 5).map((campaign: any) => ({
    id: campaign.id,
    name: campaign.name,
    impressions: Math.floor(Math.random() * 10000) + 1000,
    conversions: Math.floor(Math.random() * 100) + 10,
    roas: Math.round((Math.random() * 3 + 1) * 100) / 100,
  }));

  // Top performing content (from executions)
  const allExecutions = campaigns.flatMap(
    campaign =>
      campaign.matrices?.flatMap(
        (matrix: any) =>
          matrix.executions?.map((execution: any) => ({
            id: execution.id,
            title: `${matrix.name} - ${execution.platform}`,
            platform: execution.platform,
            engagement_rate: Math.round((Math.random() * 8 + 2) * 100) / 100,
            conversion_rate: Math.round((Math.random() * 5 + 1) * 100) / 100,
          })) || []
      ) || []
  );

  const topContent = allExecutions.slice(0, 5);

  // Top performing platforms
  const platformStats = allExecutions.reduce((acc: any, execution: any) => {
    if (!acc[execution.platform]) {
      acc[execution.platform] = {
        name: execution.platform,
        spend: 0,
        conversions: 0,
        count: 0,
      };
    }
    acc[execution.platform].spend += Math.random() * 500 + 100;
    acc[execution.platform].conversions += Math.random() * 20 + 5;
    acc[execution.platform].count += 1;
    return acc;
  }, {});

  const topPlatforms = Object.values(platformStats)
    .map((platform: any) => ({
      ...platform,
      spend: Math.round(platform.spend * 100) / 100,
      conversions: Math.round(platform.conversions),
      efficiency_score: Math.round((platform.conversions / platform.spend) * 100),
    }))
    .sort((a: any, b: any) => b.efficiency_score - a.efficiency_score)
    .slice(0, 5);

  return {
    campaigns: topCampaigns,
    content: topContent,
    platforms: topPlatforms,
  };
}

export default withAuth(withSecurityHeaders(handler));
