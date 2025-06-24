import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const { id } = req.query;
  const user = (req as any).user;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Copy asset ID is required' });
  }

  try {
    switch (method) {
      case 'GET':
        return handleGet(req, res, user, id);
      case 'POST':
        return handlePost(req, res, user, id);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    // Only log errors in development to prevent information leakage
    if (process.env.NODE_ENV === 'development') {
      console.error('Copy Asset Performance API error:', error);
    }
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
    });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any, assetId: string): Promise<void> {
  const { 
    period = '30d',
    platform,
    include_predictions = false 
  } = req.query;

  // First verify user has access to this copy asset
  const { data: asset, error } = await supabase
    .from('copy_assets')
    .select(`
      id,
      title,
      type,
      platform,
      client_id,
      performance_score,
      brand_compliance_score,
      created_at
    `)
    .eq('id', assetId)
    .single();

  if (error || !asset) {
    return res.status(404).json({ error: 'Copy asset not found' });
  }

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', asset.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this copy asset' });
  }

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

  // Get campaign analytics where this copy asset was used
  let analyticsQuery = supabase
    .from('campaign_analytics')
    .select(`
      *,
      executions(
        id,
        metadata,
        campaigns(name, status)
      )
    `)
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0]);

  if (platform) {
    analyticsQuery = analyticsQuery.eq('platform', platform);
  }

  const { data: analytics } = await analyticsQuery;

  // Filter analytics to only include executions that used this copy asset
  const relevantAnalytics = analytics?.filter((analytic: any) => {
    const execution = analytic.executions;
    if (!execution || !execution.metadata) return false;
    
    // Check if the copy asset ID is referenced in the execution metadata
    const metadata = execution.metadata;
    return (
      metadata.copy_asset_id === assetId ||
      (metadata.copy_assets && metadata.copy_assets.includes(assetId)) ||
      (metadata.field_assignments && Object.values(metadata.field_assignments).some((field: any) => 
        field.content?.some((content: any) => content.copy_asset_id === assetId)
      ))
    );
  }) || [];

  // Aggregate performance metrics
  const performanceMetrics = aggregatePerformanceMetrics(relevantAnalytics);

  // Get usage frequency
  const { data: usageStats } = await supabase
    .from('executions')
    .select('id, status, created_at, campaigns(name)')
    .contains('metadata', { copy_asset_id: assetId })
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  // Calculate comparative performance
  const { data: similarAssets } = await supabase
    .from('copy_assets')
    .select('performance_score, brand_compliance_score')
    .eq('client_id', asset.client_id)
    .eq('type', asset.type)
    .neq('id', assetId);

  const comparativePerformance = calculateComparativePerformance(asset, similarAssets || []);

  // Performance trend analysis
  const trendAnalysis = analyzeTrend(relevantAnalytics);

  // Generate insights
  const insights = generatePerformanceInsights(asset, performanceMetrics, comparativePerformance, trendAnalysis);

  // Predictions (if requested)
  let predictions = null;
  if (include_predictions === 'true') {
    predictions = generatePerformancePredictions(performanceMetrics, trendAnalysis);
  }

  return res.json({
    data: {},
  asset_info: {},
  id: asset.id,
        title: asset.title,
        type: asset.type,
        platform: asset.platform,
        created_at: asset.created_at },
  current_scores: {},
  performance_score: asset.performance_score,
        brand_compliance_score: asset.brand_compliance_score },
  metrics: performanceMetrics,
      usage_stats: {},
  total_campaigns: usageStats?.length || 0,
        active_campaigns: usageStats?.filter((u: any) => u.status === 'active').length || 0,
        campaigns: usageStats || [] },
  comparative_performance: comparativePerformance,
      trend_analysis: trendAnalysis,
      insights,
      predictions,
      period: {},
  start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        period_label: period}
    }
  });
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any, assetId: string): Promise<void> {
  const {
    performance_score,
    brand_compliance_score,
    engagement_metrics,
    conversion_metrics,
    notes
  } = req.body;

  // Verify user has access to this copy asset
  const { data: asset } = await supabase
    .from('copy_assets')
    .select('client_id')
    .eq('id', assetId)
    .single();

  if (!asset) {
    return res.status(404).json({ error: 'Copy asset not found' });
  }

  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', asset.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this copy asset' });
  }

  // Update performance scores
  const updateData: any = {
    updated_at: new Date().toISOString()};

  if (performance_score !== undefined) {
    updateData.performance_score = Math.max(0, Math.min(100, performance_score));
  }

  if (brand_compliance_score !== undefined) {
    updateData.brand_compliance_score = Math.max(0, Math.min(100, brand_compliance_score));
  }

  // Update metadata with new metrics
  if (engagement_metrics || conversion_metrics) {
    const { data: currentAsset } = await supabase
      .from('copy_assets')
      .select('metadata')
      .eq('id', assetId)
      .single();

    updateData.metadata = {
      ...currentAsset?.metadata,
      performance_update: {},
  timestamp: new Date().toISOString(),
        updated_by: user.id,
        engagement_metrics,
        conversion_metrics,
        notes}
    };
  }

  const { data: updatedAsset, error } = await supabase
    .from('copy_assets')
    .update(updateData)
    .eq('id', assetId)
    .select()
    .single();

  if (error) {
    console.error('Error updating copy asset performance:', error);
    return res.status(500).json({ error: 'Failed to update performance metrics' });
  }

  return res.json({
    message: 'Performance metrics updated successfully',
    data: updatedAsset
  });
}

// Helper functions
function aggregatePerformanceMetrics(analytics: any[]): any {
  const totals = {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    spend: 0,
    reach: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    roas: 0};

  if (analytics.length === 0) return totals;

  analytics.forEach((metric: any) => {
    totals.impressions += metric.impressions || 0;
    totals.clicks += metric.clicks || 0;
    totals.conversions += metric.conversions || 0;
    totals.spend += parseFloat(metric.spend) || 0;
  });

  // Calculate derived metrics
  totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  totals.cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  totals.cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
  totals.roas = totals.spend > 0 ? (totals.conversions * 50) / totals.spend : 0; // Assuming $50 avg order value

  return totals;
}

function calculateComparativePerformance(asset: any, similarAssets: any[]): any {
  if (similarAssets.length === 0) {
    return {
      performance_percentile: null,
      compliance_percentile: null,
      ranking: null};
  }

  const performanceScores = similarAssets.map((a: any) => a.performance_score).filter((s: any) => s !== null);
  const complianceScores = similarAssets.map((a: any) => a.brand_compliance_score).filter((s: any) => s !== null);

  const performancePercentile = asset.performance_score 
    ? calculatePercentile(performanceScores, asset.performance_score)
    : null;

  const compliancePercentile = asset.brand_compliance_score
    ? calculatePercentile(complianceScores, asset.brand_compliance_score)
    : null;

  return {
    performance_percentile: performancePercentile,
    compliance_percentile: compliancePercentile,
    total_similar_assets: similarAssets.length,
    avg_performance_score: performanceScores.length > 0 ? performanceScores.reduce((a, b) => a + b, 0) / performanceScores.length : null,
    avg_compliance_score: complianceScores.length > 0 ? complianceScores.reduce((a, b) => a + b, 0) / complianceScores.length : null};
}

function calculatePercentile(scores: number[], value: number): number {
  const belowCount = scores.filter((score: any) => score < value).length;
  return Math.round((belowCount / scores.length) * 100);
}

function analyzeTrend(analytics: any[]): any {
  if (analytics.length < 2) {
    return {
      direction: 'insufficient_data',
      change_percentage: 0,
      confidence: 0};
  }

  // Sort by date
  const sortedAnalytics = analytics.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate trend for key metrics
  const firstHalf = sortedAnalytics.slice(0, Math.floor(sortedAnalytics.length / 2));
  const secondHalf = sortedAnalytics.slice(Math.floor(sortedAnalytics.length / 2));

  const firstHalfAvg = firstHalf.reduce((sum, a) => sum + (a.ctr || 0), 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, a) => sum + (a.ctr || 0), 0) / secondHalf.length;

  const changePercentage = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

  return {
    direction: changePercentage > 5 ? 'improving' : changePercentage < -5 ? 'declining' : 'stable',
    change_percentage: Math.round(changePercentage * 100) / 100,
    confidence: Math.min(analytics.length / 10, 1), // Higher confidence with more data points
  };
}

function generatePerformanceInsights(asset: any, metrics: any, comparative: any, trend: any): string[] {
  const insights: string[] = [];

  // Performance insights
  if (comparative.performance_percentile) {
    if (comparative.performance_percentile > 75) {
      insights.push('This copy asset is performing in the top 25% of similar content');
    } else if (comparative.performance_percentile < 25) {
      insights.push('This copy asset is underperforming compared to similar content');
    }
  }

  // CTR insights
  if (metrics.ctr > 2) {
    insights.push('Excellent click-through rate indicates strong audience engagement');
  } else if (metrics.ctr < 0.5) {
    insights.push('Low click-through rate suggests the copy may need optimization');
  }

  // Trend insights
  if (trend.direction === 'improving' && trend.confidence > 0.5) {
    insights.push(`Performance is trending upward with a ${trend.change_percentage}% improvement`);
  } else if (trend.direction === 'declining' && trend.confidence > 0.5) {
    insights.push(`Performance is declining by ${Math.abs(trend.change_percentage)}% - consider refreshing the copy`);
  }

  // Brand compliance insights
  if (asset.brand_compliance_score > 90) {
    insights.push('Excellent brand compliance - this copy aligns well with brand guidelines');
  } else if (asset.brand_compliance_score < 70) {
    insights.push('Consider reviewing brand compliance - this copy may deviate from guidelines');
  }

  return insights;
}

function generatePerformancePredictions(metrics: any, trend: any): any {
  if (trend.direction === 'insufficient_data') {
    return {
      next_7_days: null,
      next_30_days: null,
      confidence: 0,
      notes: 'Insufficient data for predictions'};
  }

  const currentCTR = metrics.ctr;
  const trendMultiplier = 1 + (trend.change_percentage / 100);

  return {
    next_7_days: {},
  expected_ctr: Math.round(currentCTR * Math.pow(trendMultiplier, 0.25) * 100) / 100,
      confidence: trend.confidence * 0.8 },
  next_30_days: {},
  expected_ctr: Math.round(currentCTR * trendMultiplier * 100) / 100,
      confidence: trend.confidence * 0.6 },
  methodology: 'Predictions based on historical trend analysis and performance indicators'};
}

export default withAuth(withSecurityHeaders(handler));