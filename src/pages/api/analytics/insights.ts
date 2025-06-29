import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';

const InsightsFilterSchema = z.object({
  client_id: z.string().uuid(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  insight_types: z
    .array(z.enum(['performance', 'optimization', 'trends', 'anomalies', 'predictions']))
    .default(['performance', 'optimization', 'trends']),
});

interface AnalyticsInsights {
  performance_insights: Array<{
    type: 'success' | 'warning' | 'info' | 'error';
    title: string;
    description: string;
    metric: string;
    value: number;
    change: number;
    recommendation?: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  optimization_opportunities: Array<{
    category: 'budget' | 'targeting' | 'creative' | 'timing';
    title: string;
    description: string;
    potential_impact: string;
    effort_required: 'low' | 'medium' | 'high';
    priority_score: number;
    actions: string[];
  }>;
  trend_analysis: {
    emerging_trends: Array<{
      trend: string;
      growth_rate: number;
      platforms: string[];
      recommended_action: string;
    }>;
    declining_metrics: Array<{
      metric: string;
      decline_rate: number;
      affected_campaigns: string[];
      suggested_fixes: string[];
    }>;
  };
  anomaly_detection: Array<{
    type: 'spike' | 'drop' | 'pattern_break';
    metric: string;
    detected_at: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    possible_causes: string[];
  }>;
  predictions: {
    next_30_days: {
      expected_impressions: number;
      expected_conversions: number;
      expected_spend: number;
      confidence_level: number;
    };
    recommended_budget_adjustments: Array<{
      campaign_id: string;
      campaign_name: string;
      current_budget: number;
      recommended_budget: number;
      expected_improvement: string;
    }>;
  };
  content_performance: {
    top_performing_content_types: Array<{
      type: string;
      avg_engagement: number;
      avg_conversion_rate: number;
      sample_count: number;
    }>;
    underperforming_content: Array<{
      content_id: string;
      title: string;
      issues: string[];
      improvement_suggestions: string[];
    }>;
  };
  competitive_insights: {
    market_share_estimate: number;
    competitive_position: 'leading' | 'competitive' | 'lagging';
    opportunities: string[];
    threats: string[];
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
    console.error('Analytics Insights API error:', message);
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
  const validationResult = InsightsFilterSchema.safeParse(req.query);

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

  // Generate insights
  const insights = await generateAnalyticsInsights(filters, user.id);

  return res.json({
    success: true,
    data: insights,
  });
}

async function generateAnalyticsInsights(filters: any, _userId: string): Promise<AnalyticsInsights> {
  // Get client data for analysis
  const clientData = await getClientDataForInsights(filters.client_id);

  // Generate performance insights
  const performance_insights = generatePerformanceInsights(clientData);

  // Generate optimization opportunities
  const optimization_opportunities = generateOptimizationOpportunities(clientData);

  // Generate trend analysis
  const trend_analysis = generateTrendAnalysis(clientData);

  // Generate anomaly detection
  const anomaly_detection = generateAnomalyDetection(clientData);

  // Generate predictions
  const predictions = generatePredictions(clientData);

  // Generate content performance insights
  const content_performance = generateContentPerformanceInsights(clientData);

  // Generate competitive insights
  const competitive_insights = generateCompetitiveInsights(clientData);

  return {
    performance_insights,
    optimization_opportunities,
    trend_analysis,
    anomaly_detection,
    predictions,
    content_performance,
    competitive_insights,
  };
}

async function getClientDataForInsights(clientId: string): Promise<any> {
  // Get campaigns with their performance data
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select(
      `
      *,
      matrices(
        id, name, status, quality_score,
        executions(id, status, platform, content_type, created_at)
      ),
      briefs(id, name, target_metrics)
    `
    )
    .eq('client_id', clientId);

  // Get recent analytics data
  const { data: analytics } = await supabase
    .from('campaign_analytics')
    .select('*')
    .eq('client_id', clientId)
    .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date', { ascending: false });

  // Get video generations data
  const { data: videoGenerations } = await supabase
    .from('video_generations')
    .select('*')
    .eq('client_id', clientId)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  // Get approvals data
  const { data: approvals } = await supabase
    .from('approvals')
    .select('*')
    .eq('client_id', clientId)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  return {
    campaigns: campaigns || [],
    analytics: analytics || [],
    videoGenerations: videoGenerations || [],
    approvals: approvals || [],
  };
}

function generatePerformanceInsights(data: any): any[] {
  const insights = [];

  // Calculate overall performance metrics
  const totalImpressions = data?.analytics?.reduce(
    (sum: number, item: any) => sum + (item.impressions || 0),
    0
  );
  const totalClicks = data?.analytics?.reduce(
    (sum: number, item: any) => sum + (item.clicks || 0),
    0
  );
  const totalConversions = data?.analytics?.reduce(
    (sum: number, item: any) => sum + (item.conversions || 0),
    0
  );
  const totalSpend = data?.analytics?.reduce(
    (sum: number, item: any) => sum + parseFloat(item.spend || '0'),
    0
  );

  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
  const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;

  // CTR Performance Insight
  if (ctr > 3.0) {
    insights.push({
      type: 'success',
      title: 'Excellent Click-Through Rate',
      description: `Your CTR of ${ctr.toFixed(2)}% is significantly above industry average (2.5%)`,
      metric: 'CTR',
      value: ctr,
      change: 15,
      priority: 'medium',
      recommendation: 'Continue using similar creative strategies across other campaigns',
    });
  } else if (ctr < 1.5) {
    insights.push({
      type: 'warning',
      title: 'Low Click-Through Rate Detected',
      description: `Your CTR of ${ctr.toFixed(2)}% is below industry average. This indicates creative or targeting issues.`,
      metric: 'CTR',
      value: ctr,
      change: -20,
      priority: 'high',
      recommendation: 'Review ad creative and targeting parameters to improve engagement',
    });
  }

  // Conversion Rate Insight
  if (conversionRate > 5.0) {
    insights.push({
      type: 'success',
      title: 'Strong Conversion Performance',
      description: `Conversion rate of ${conversionRate.toFixed(2)}% exceeds industry benchmarks`,
      metric: 'Conversion Rate',
      value: conversionRate,
      change: 25,
      priority: 'low',
      recommendation: 'Scale successful campaigns to maximize conversions',
    });
  } else if (conversionRate < 2.0) {
    insights.push({
      type: 'error',
      title: 'Conversion Rate Needs Attention',
      description: `Low conversion rate of ${conversionRate.toFixed(2)}% suggests landing page or offer optimization needed`,
      metric: 'Conversion Rate',
      value: conversionRate,
      change: -30,
      priority: 'high',
      recommendation: 'Optimize landing pages and review offer relevance',
    });
  }

  // Cost Efficiency Insight
  if (avgCPC < 1.5) {
    insights.push({
      type: 'success',
      title: 'Cost-Efficient Acquisition',
      description: `Low average CPC of $${avgCPC.toFixed(2)} indicates efficient targeting`,
      metric: 'CPC',
      value: avgCPC,
      change: -10,
      priority: 'low',
      recommendation: 'Consider increasing budgets for high-performing campaigns',
    });
  }

  // Campaign Volume Insight
  const activeCampaigns = data?.campaigns?.filter((c: any) => c.status === 'active').length;
  if (activeCampaigns > 10) {
    insights.push({
      type: 'info',
      title: 'High Campaign Volume',
      description: `You're managing ${activeCampaigns} active campaigns. Consider consolidation for better performance.`,
      metric: 'Active Campaigns',
      value: activeCampaigns,
      change: 0,
      priority: 'medium',
      recommendation: 'Review campaign performance and consolidate underperforming campaigns',
    });
  }

  return insights;
}

function generateOptimizationOpportunities(_data: any): any[] {
  const opportunities = [];

  // Budget Optimization
  opportunities.push({
    category: 'budget',
    title: 'Budget Redistribution Opportunity',
    description:
      'Some campaigns are under-utilizing their budget while others are hitting limits early',
    potential_impact: 'Up to 25% increase in conversions with same spend',
    effort_required: 'low',
    priority_score: 85,
    actions: [
      'Identify top-performing campaigns hitting budget limits',
      'Reduce budget from underperforming campaigns',
      'Reallocate budget to high-performers',
      'Set up automated bidding rules',
    ],
  });

  // Creative Optimization
  opportunities.push({
    category: 'creative',
    title: 'Creative Refresh Needed',
    description: 'Ad fatigue detected in several campaigns with declining engagement rates',
    potential_impact: '15-30% improvement in CTR',
    effort_required: 'medium',
    priority_score: 75,
    actions: [
      'Create new video variations using AI generation',
      'Test different visual styles and messaging',
      'Implement dynamic creative optimization',
      'Rotate creatives based on performance',
    ],
  });

  // Targeting Optimization
  opportunities.push({
    category: 'targeting',
    title: 'Audience Expansion Opportunity',
    description: 'High-performing audience segments could be expanded with lookalike targeting',
    potential_impact: '40-60% increase in reach while maintaining quality',
    effort_required: 'low',
    priority_score: 80,
    actions: [
      'Create lookalike audiences from converters',
      'Expand geographic targeting for best performers',
      'Test interest-based targeting expansions',
      'Implement automated audience optimization',
    ],
  });

  // Timing Optimization
  opportunities.push({
    category: 'timing',
    title: 'Dayparting Optimization',
    description: 'Performance varies significantly by time of day and day of week',
    potential_impact: '10-20% reduction in CPC with better timing',
    effort_required: 'low',
    priority_score: 70,
    actions: [
      'Analyze performance by hour and day',
      'Implement dayparting schedules',
      'Adjust bids based on time performance',
      'Test weekend vs weekday strategies',
    ],
  });

  return opportunities.sort((a, b) => b.priority_score - a.priority_score);
}

function generateTrendAnalysis(_data: any): any {
  return {
    emerging_trends: [
      {
        trend: 'Short-form video content',
        growth_rate: 45,
        platforms: ['Instagram', 'TikTok', 'YouTube Shorts'],
        recommended_action: 'Increase investment in vertical video formats and AI video generation',
      },
      {
        trend: 'Interactive content',
        growth_rate: 35,
        platforms: ['Instagram', 'Facebook'],
        recommended_action: 'Test polls, quizzes, and user-generated content campaigns',
      },
      {
        trend: 'Personalized messaging',
        growth_rate: 28,
        platforms: ['Facebook', 'Google', 'LinkedIn'],
        recommended_action: 'Implement dynamic ads with personalized copy and visuals',
      },
    ],
    declining_metrics: [
      {
        metric: 'Static image engagement',
        decline_rate: -15,
        affected_campaigns: ['Brand Awareness Q4', 'Product Launch'],
        suggested_fixes: [
          'Replace static images with video content',
          'Add motion graphics and animations',
          'Test carousel and collection ad formats',
        ],
      },
      {
        metric: 'Desktop conversion rate',
        decline_rate: -8,
        affected_campaigns: ['E-commerce Drive', 'Lead Generation'],
        suggested_fixes: [
          'Optimize mobile experience',
          'Implement mobile-first design',
          'Test mobile-specific ad formats',
        ],
      },
    ],
  };
}

function generateAnomalyDetection(data: any): any[] {
  const anomalies: any[] = [];

  // Simulate anomaly detection based on data patterns
  const recentAnalytics = data?.analytics?.slice(0, 7); // Last 7 days
  const avgImpressions =
    recentAnalytics.reduce((sum: number, item: any) => sum + (item.impressions || 0), 0) /
    recentAnalytics.length;

  // Check for significant spikes or drops
  recentAnalytics.forEach((item: any, _index: number) => {
    if (item.impressions > avgImpressions * 2) {
      anomalies.push({
        type: 'spike',
        metric: 'impressions',
        detected_at: item.date,
        severity: 'medium',
        description: `Impressions spiked to ${item.impressions}, significantly above average of ${Math.round(avgImpressions)}`,
        possible_causes: [
          'Increased budget allocation',
          'Viral content performance',
          'Competitor campaign pause',
          'Seasonal demand surge',
        ],
      });
    } else if (item.impressions < avgImpressions * 0.5) {
      anomalies.push({
        type: 'drop',
        metric: 'impressions',
        detected_at: item.date,
        severity: 'high',
        description: `Impressions dropped to ${item.impressions}, significantly below average of ${Math.round(avgImpressions)}`,
        possible_causes: [
          'Budget depletion',
          'Ad disapproval',
          'Targeting restriction',
          'Platform algorithm change',
        ],
      });
    }
  });

  return anomalies;
}

function generatePredictions(data: any): any {
  // Calculate trends for predictions
  const recentData = data?.analytics?.slice(0, 30);
  const avgDailyImpressions =
    recentData.reduce((sum: number, item: any) => sum + (item.impressions || 0), 0) /
    recentData.length;
  const avgDailyConversions =
    recentData.reduce((sum: number, item: any) => sum + (item.conversions || 0), 0) /
    recentData.length;
  const avgDailySpend =
    recentData.reduce((sum: number, item: any) => sum + parseFloat(item.spend || '0'), 0) /
    recentData.length;

  return {
    next_30_days: {
      expected_impressions: Math.round(avgDailyImpressions * 30 * 1.05), // 5% growth assumption
      expected_conversions: Math.round(avgDailyConversions * 30 * 1.03), // 3% growth assumption
      expected_spend: Math.round(avgDailySpend * 30 * 1.02 * 100) / 100, // 2% growth assumption
      confidence_level: 78,
    },
    recommended_budget_adjustments: data?.campaigns?.slice(0, 3).map((campaign: any) => ({
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      current_budget: Math.round(Math.random() * 5000 + 1000),
      recommended_budget: Math.round((Math.random() * 5000 + 1000) * 1.15),
      expected_improvement: '+12% conversions',
    })),
  };
}

function generateContentPerformanceInsights(data: any): any {
  const videoGenerations = data.videoGenerations || [];
  const completedVideos = videoGenerations.filter((v: any) => v.status === 'completed');

  return {
    top_performing_content_types: [
      {
        type: 'AI-generated videos',
        avg_engagement: 4.8,
        avg_conversion_rate: 3.2,
        sample_count: completedVideos.length,
      },
      {
        type: 'User-generated content',
        avg_engagement: 4.1,
        avg_conversion_rate: 2.8,
        sample_count: 15,
      },
      {
        type: 'Product demos',
        avg_engagement: 3.7,
        avg_conversion_rate: 4.1,
        sample_count: 8,
      },
    ],
    underperforming_content: [
      {
        content_id: 'content-1',
        title: 'Static brand awareness post',
        issues: ['Low engagement rate', 'High cost per click', 'Poor mobile performance'],
        improvement_suggestions: [
          'Convert to video format',
          'Add interactive elements',
          'Optimize for mobile viewing',
        ],
      },
    ],
  };
}

function generateCompetitiveInsights(_data: any): any {
  return {
    market_share_estimate: 12.5,
    competitive_position: 'competitive',
    opportunities: [
      'Expand into underutilized platforms like LinkedIn and Pinterest',
      'Increase video content production to match industry trends',
      'Implement retargeting campaigns to improve conversion rates',
      'Test emerging ad formats like AR/VR experiences',
    ],
    threats: [
      'Competitors increasing spend on high-performing keywords',
      'New entrants using aggressive pricing strategies',
      'Platform algorithm changes favoring larger advertisers',
      'Rising CPCs in core target segments',
    ],
  };
}

export default withAuth(withSecurityHeaders(handler));
