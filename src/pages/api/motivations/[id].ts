import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';

const MotivationUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z
    .enum([
      'emotional',
      'rational',
      'social',
      'fear',
      'aspiration',
      'convenience',
      'status',
      'safety',
      'other',
    ])
    .optional(),
  relevance_score: z.number().min(0).max(100).optional(),
  tags: z.array(z.string()).optional(),
  target_emotions: z.array(z.string()).optional(),
  use_cases: z.array(z.string()).optional(),
  effectiveness_rating: z.number().min(1).max(5).optional(),
  generation_context: z.any().optional(),
});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const { id } = req.query;
  const user = (req as any).user;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Motivation ID is required' });
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
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Motivation API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    });
  }
}

async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  motivationId: string
): Promise<void> {
  const { include_usage = true, include_related = true } = req.query;

  // First verify user has access to this motivation
  const { data: motivation, error } = await supabase
    .from('motivations')
    .select(
      `
      *,
      clients(name, slug, primary_color, secondary_color),
      briefs(id, name, title, target_audience, objectives),
      profiles!motivations_created_by_fkey(full_name, avatar_url)
    `
    )
    .eq('id', motivationId)
    .single();

  if (error || !motivation) {
    return res.status(404).json({ error: 'Motivation not found' });
  }

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', motivation.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this motivation' });
  }

  const enrichedMotivation = { ...motivation };

  // Include usage statistics
  if (include_usage === 'true') {
    const usageStats = await getDetailedUsageStats(motivationId);
    enrichedMotivation.usage_stats = usageStats;
  }

  // Include related content
  if (include_related === 'true') {
    const relatedContent = await getRelatedContent(motivationId, motivation.client_id);
    enrichedMotivation.related_content = relatedContent;
  }

  // Calculate motivation insights
  const insights = await generateMotivationInsights(motivation);
  enrichedMotivation.insights = insights;

  // Get performance history if available
  const performanceHistory = await getMotivationPerformanceHistory(motivationId);
  enrichedMotivation.performance_history = performanceHistory;

  return res.json({
    data: enrichedMotivation,
  });
}

async function handlePut(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  motivationId: string
): Promise<void> {
  const validationResult = MotivationUpdateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  // First verify user has access to this motivation
  const { data: existingMotivation } = await supabase
    .from('motivations')
    .select('client_id, created_by')
    .eq('id', motivationId)
    .single();

  if (!existingMotivation) {
    return res.status(404).json({ error: 'Motivation not found' });
  }

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', existingMotivation.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this motivation' });
  }

  const updateData = {
    ...validationResult.data,
    updated_at: new Date().toISOString(),
  };

  const { data: motivation, error } = await supabase
    .from('motivations')
    .update(updateData)
    .eq('id', motivationId)
    .select(
      `
      *,
      clients(name, slug),
      briefs(name, title),
      profiles!motivations_created_by_fkey(full_name)
    `
    )
    .single();

  if (error) {
    console.error('Error updating motivation:', error);
    return res.status(500).json({ error: 'Failed to update motivation' });
  }

  return res.json({ data: motivation });
}

async function handleDelete(
  _req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  motivationId: string
): Promise<void> {
  // First verify user has access to this motivation
  const { data: existingMotivation } = await supabase
    .from('motivations')
    .select('client_id, created_by')
    .eq('id', motivationId)
    .single();

  if (!existingMotivation) {
    return res.status(404).json({ error: 'Motivation not found' });
  }

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', existingMotivation.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this motivation' });
  }

  // Check if motivation is being used
  const usageCheck = await checkMotivationUsage(motivationId);

  if (usageCheck.isInUse) {
    return res.status(409).json({
      error: 'Cannot delete motivation in use',
      details: usageCheck.usageDetails,
      suggestion: 'Remove the motivation from strategies and content variations first',
    });
  }

  const { error } = await supabase.from('motivations').delete().eq('id', motivationId);

  if (error) {
    console.error('Error deleting motivation:', error);
    return res.status(500).json({ error: 'Failed to delete motivation' });
  }

  return res.status(200).json({ message: 'Motivation deleted successfully' });
}

// Helper functions
async function getDetailedUsageStats(motivationId: string): Promise<any> {
  try {
    // Get strategy usage with details
    const { data: strategyUsage } = await supabase
      .from('strategy_motivations')
      .select(
        `
        strategies(id, title, created_at, status)
      `
      )
      .eq('motivation_id', motivationId);

    // Get content variations usage
    const { data: contentUsage } = await supabase
      .from('content_variations')
      .select('id, content_type, platform, performance_score, created_at')
      .contains('motivation_ids', [motivationId]);

    // Get copy assets usage
    const { data: copyUsage } = await supabase
      .from('copy_assets')
      .select('id, title, type, platform, performance_score, created_at')
      .contains('motivation_ids', [motivationId]);

    // Get executions that used this motivation
    const { data: executionUsage } = await supabase
      .from('executions')
      .select(
        `
        id,
        status,
        created_at,
        campaigns(name)
      `
      )
      .contains('metadata', { motivation_id: motivationId });

    return {
      strategies: strategyUsage?.map((s: any) => s.strategies) || [],
      content_variations: contentUsage || [],
      copy_assets: copyUsage || [],
      executions: executionUsage || [],
      totals: {
        strategy_count: strategyUsage?.length || 0,
        content_count: contentUsage?.length || 0,
        copy_count: copyUsage?.length || 0,
        execution_count: executionUsage?.length || 0,
      },
    };
  } catch (error: any) {
    console.error('Error getting detailed usage stats:', error);
    return {
      strategies: [],
      content_variations: [],
      copy_assets: [],
      executions: [],
      totals: { strategy_count: 0, content_count: 0, copy_count: 0, execution_count: 0 },
    };
  }
}

async function getRelatedContent(motivationId: string, clientId: string): Promise<any> {
  try {
    // Get other motivations from the same brief
    const { data: siblingMotivations } = await supabase
      .from('motivations')
      .select('id, title, category, relevance_score, brief_id')
      .eq('client_id', clientId)
      .neq('id', motivationId)
      .limit(5);

    // Get motivations with similar categories
    const { data: currentMotivation } = await supabase
      .from('motivations')
      .select('category, brief_id')
      .eq('id', motivationId)
      .single();

    const { data: similarMotivations } = await supabase
      .from('motivations')
      .select('id, title, category, relevance_score')
      .eq('client_id', clientId)
      .eq('category', currentMotivation?.category)
      .neq('id', motivationId)
      .limit(5);

    // Get content variations that might benefit from this motivation
    const { data: suggestedContent } = await supabase
      .from('content_variations')
      .select('id, content, content_type, platform, performance_score')
      .eq('client_id', clientId)
      .is('motivation_ids', null)
      .limit(3);

    return {
      sibling_motivations: siblingMotivations || [],
      similar_motivations: similarMotivations || [],
      suggested_content: suggestedContent || [],
    };
  } catch (error: any) {
    console.error('Error getting related content:', error);
    return {
      sibling_motivations: [],
      similar_motivations: [],
      suggested_content: [],
    };
  }
}

async function generateMotivationInsights(motivation: any): Promise<string[]> {
  const insights: string[] = [];

  // Relevance insights
  if (motivation.relevance_score > 80) {
    insights.push('High relevance score indicates strong alignment with brief objectives');
  } else if (motivation.relevance_score < 40) {
    insights.push('Low relevance score suggests this motivation may need refinement');
  }

  // Category insights
  const categoryInsights: Record<string, string> = {
    emotional: 'Emotional motivations often drive higher engagement rates',
    rational: 'Rational motivations work well for B2B and high-consideration purchases',
    social: 'Social motivations are effective for community-driven campaigns',
    fear: 'Fear-based motivations should be balanced with positive outcomes',
    aspiration: 'Aspirational motivations resonate well with lifestyle brands',
    convenience: 'Convenience motivations are powerful for busy target audiences',
    status: 'Status motivations work well for premium and luxury positioning',
    safety: 'Safety motivations are crucial for health and security products',
  };

  if (motivation.category) {
    const categoryInsight = categoryInsights[motivation.category];
    if (categoryInsight) {
      insights.push(categoryInsight);
    }
  }

  // AI generation insights
  if (motivation.is_ai_generated) {
    insights.push('AI-generated motivation - consider human review for brand alignment');
  }

  // Usage insights based on creation date
  const daysSinceCreated =
    (Date.now() - new Date(motivation.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreated > 30) {
    insights.push(
      'This motivation has been available for over a month - consider refreshing or testing variations'
    );
  }

  return insights;
}

async function getMotivationPerformanceHistory(motivationId: string): Promise<any> {
  try {
    // Get performance data from campaigns that used this motivation
    const { data: performance } = await supabase
      .from('campaign_analytics')
      .select(
        `
        date,
        platform,
        impressions,
        clicks,
        conversions,
        ctr,
        executions!inner(
          metadata
        )
      `
      )
      .contains('executions.metadata', { motivation_id: motivationId })
      .order('date', { ascending: true })
      .limit(30);

    if (!performance || performance.length === 0) {
      return {
        has_data: false,
        message: 'No performance data available yet',
      };
    }

    // Aggregate performance by date
    const dailyPerformance = performance.reduce((acc: Record<string, any>, record) => {
      const date = record.date;
      if (!acc[date]) {
        acc[date] = {
          date,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          platforms: new Set(),
        };
      }

      acc[date].impressions += record.impressions || 0;
      acc[date].clicks += record.clicks || 0;
      acc[date].conversions += record.conversions || 0;
      acc[date].platforms.add(record.platform);

      return acc;
    }, {});

    // Convert to array and calculate CTR
    const performanceArray = Object.values(dailyPerformance).map((day: any) => ({
      ...day,
      ctr: day.impressions > 0 ? (day.clicks / day.impressions) * 100 : 0,
      platforms: Array.from(day.platforms),
    }));

    // Calculate trends
    const avgCTR =
      performanceArray.reduce((sum, day) => sum + day.ctr, 0) / performanceArray.length;
    const totalImpressions = performanceArray.reduce((sum, day) => sum + day.impressions, 0);
    const totalClicks = performanceArray.reduce((sum, day) => sum + day.clicks, 0);

    return {
      has_data: true,
      daily_performance: performanceArray,
      summary: {
        avg_ctr: Math.round(avgCTR * 100) / 100,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        date_range: {
          start: performanceArray[0]?.date,
          end: performanceArray[performanceArray.length - 1]?.date,
        },
      },
    };
  } catch (error: any) {
    console.error('Error getting performance history:', error);
    return {
      has_data: false,
      message: 'Error retrieving performance data',
    };
  }
}

async function checkMotivationUsage(
  motivationId: string
): Promise<{ isInUse: boolean; usageDetails: string[] }> {
  const usageDetails: string[] = [];

  try {
    // Check strategy usage
    const { count: strategyCount } = await supabase
      .from('strategy_motivations')
      .select('id', { count: 'exact' })
      .eq('motivation_id', motivationId);

    if (strategyCount && strategyCount > 0) {
      usageDetails.push(`Used in ${strategyCount} strategies`);
    }

    // Check content variations
    const { count: contentCount } = await supabase
      .from('content_variations')
      .select('id', { count: 'exact' })
      .contains('motivation_ids', [motivationId]);

    if (contentCount && contentCount > 0) {
      usageDetails.push(`Used in ${contentCount} content variations`);
    }

    // Check copy assets
    const { count: copyCount } = await supabase
      .from('copy_assets')
      .select('id', { count: 'exact' })
      .contains('motivation_ids', [motivationId]);

    if (copyCount && copyCount > 0) {
      usageDetails.push(`Used in ${copyCount} copy assets`);
    }

    // Check active executions
    const { count: executionCount } = await supabase
      .from('executions')
      .select('id', { count: 'exact' })
      .contains('metadata', { motivation_id: motivationId })
      .in('status', ['pending', 'processing', 'active']);

    if (executionCount && executionCount > 0) {
      usageDetails.push(`Used in ${executionCount} active executions`);
    }

    return {
      isInUse: usageDetails.length > 0,
      usageDetails,
    };
  } catch (error: any) {
    console.error('Error checking motivation usage:', error);
    return {
      isInUse: false,
      usageDetails: ['Error checking usage'],
    };
  }
}

export default withAuth(withSecurityHeaders(handler));
