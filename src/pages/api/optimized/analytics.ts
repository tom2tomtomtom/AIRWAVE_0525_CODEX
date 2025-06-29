/**
 * Optimized Analytics API Endpoint
 * High-performance analytics with caching and aggregation
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { withAPIOptimization, BatchProcessor } from '@/middleware/performance/apiOptimization';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Analytics query schema
const AnalyticsQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'quarter', 'year']).default('month'),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  client_id: z.string().uuid().optional(),
  metrics: z
    .array(z.enum(['campaigns', 'videos', 'views', 'engagement', 'conversion', 'revenue']))
    .default(['campaigns', 'videos', 'views']),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
});

interface AnalyticsMetric {
  date: string;
  value: number;
  change?: number;
  percentage_change?: number;
}

interface AnalyticsResponse {
  success: true;
  data: {
    [metric: string]: AnalyticsMetric[];
  };
  summary: {
    total_campaigns: number;
    total_videos: number;
    total_views: number;
    avg_engagement: number;
    period_start: string;
    period_end: string;
    cache_hit: boolean;
    query_time: number;
  };
}

/**
 * Optimized analytics aggregation
 */
class AnalyticsAggregator {
  private supabase;
  private batchProcessor: BatchProcessor<any, any>;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Batch processor for multiple metric queries
    this.batchProcessor = new BatchProcessor(
      this.processBatchQueries.bind(this),
      5, // batch size
      500 // 500ms flush interval
    );
  }

  /**
   * Get analytics data with aggressive caching
   */
  async getAnalytics(params: z.infer<typeof AnalyticsQuerySchema>): Promise<AnalyticsResponse> {
    const startTime = Date.now();

    // Generate date range
    const { start_date, end_date } = this.getDateRange(
      params.period,
      params.start_date,
      params.end_date
    );

    // Build cache key
    const cacheKey = this.buildCacheKey(params, start_date, end_date);

    // Try cache first (analytics data changes infrequently)
    const cached = await this.getCachedAnalytics(cacheKey);
    if (cached) {
      return {
        ...cached,
        summary: {
          ...cached.summary,
          cache_hit: true,
          query_time: Date.now() - startTime,
        },
      };
    }

    // Fetch fresh data
    const data = await this.fetchAnalyticsData(params, start_date, end_date);
    const summary = await this.buildSummary(params, start_date, end_date);

    const response: AnalyticsResponse = {
      success: true,
      data,
      summary: {
        ...summary,
        period_start: start_date,
        period_end: end_date,
        cache_hit: false,
        query_time: Date.now() - startTime,
      },
    };

    // Cache the result (analytics can be cached longer)
    await this.setCachedAnalytics(cacheKey, response, 15 * 60 * 1000); // 15 minutes

    return response;
  }

  /**
   * Fetch analytics data with optimized queries
   */
  private async fetchAnalyticsData(
    params: z.infer<typeof AnalyticsQuerySchema>,
    startDate: string,
    endDate: string
  ): Promise<{ [metric: string]: AnalyticsMetric[] }> {
    const data: { [metric: string]: AnalyticsMetric[] } = {};

    // Build optimized queries for each metric
    const queries = params.metrics.map(metric => ({
      metric,
      query: this.buildMetricQuery(metric, params, startDate, endDate),
    }));

    // Execute queries in parallel with batching
    const results = await Promise.all(
      queries.map(({ metric, query }) => this.batchProcessor.add({ metric, query }))
    );

    // Process results
    for (let i = 0; i < results.length; i++) {
      const metric = queries[i]?.metric;
      const result = results[i];
      if (metric) {
        data[metric] = this.processMetricData(result, params.granularity);
      }
    }

    return data;
  }

  /**
   * Build optimized metric query
   */
  private buildMetricQuery(
    metric: string,
    _params: z.infer<typeof AnalyticsQuerySchema>,
    startDate: string,
    endDate: string
  ): any {
    const baseQuery = this.supabase.from(this.getTableForMetric(metric));

    switch (metric) {
      case 'campaigns':
        return baseQuery
          .select('created_at, status')
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .eq('status', 'active');

      case 'videos':
        return baseQuery
          .select('created_at, status, views')
          .gte('created_at', startDate)
          .lte('created_at', endDate);

      case 'views':
        return baseQuery
          .select('date, views, unique_views')
          .gte('date', startDate)
          .lte('date', endDate);

      case 'engagement':
        return baseQuery
          .select('date, likes, shares, comments, click_through_rate')
          .gte('date', startDate)
          .lte('date', endDate);

      default:
        return baseQuery.select('*').gte('created_at', startDate).lte('created_at', endDate);
    }
  }

  /**
   * Process batch queries efficiently
   */
  private async processBatchQueries(
    queries: Array<{ metric: string; query: any }>
  ): Promise<any[]> {
    // Execute all queries in parallel
    const results = await Promise.all(
      queries.map(async ({ query }) => {
        const { data, error } = await query;
        if (error) throw error;
        return data;
      })
    );

    return results;
  }

  /**
   * Process metric data into time series
   */
  private processMetricData(rawData: any[], granularity: string): AnalyticsMetric[] {
    if (!rawData || rawData.length === 0) return [];

    // Group data by time period
    const grouped = this.groupByTimePeriod(rawData, granularity);

    // Convert to analytics metrics
    return Object.entries(grouped).map(([date, values]: [string, any[]]) => {
      const value = this.aggregateValues(values);
      return {
        date,
        value,
        change: 0, // Could calculate change from previous period
        percentage_change: 0,
      };
    });
  }

  /**
   * Group data by time period
   */
  private groupByTimePeriod(data: any[], granularity: string): { [date: string]: any[] } {
    const grouped: { [date: string]: any[] } = {};

    data.forEach(item => {
      const date = this.formatDateByGranularity(
        new Date(item.created_at || item.date),
        granularity
      );

      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date]?.push(item);
    });

    return grouped;
  }

  /**
   * Aggregate values for a time period
   */
  private aggregateValues(values: any[]): number {
    if (values.length === 0) return 0;

    // For most metrics, we want the count
    return values.length;
  }

  /**
   * Format date by granularity
   */
  private formatDateByGranularity(date: Date, granularity: string): string {
    switch (granularity) {
      case 'hour':
        return date.toISOString().slice(0, 13) + ':00:00.000Z';
      case 'day':
        return date.toISOString().slice(0, 10);
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().slice(0, 10);
      case 'month':
        return date.toISOString().slice(0, 7) + '-01';
      default:
        return date.toISOString().slice(0, 10);
    }
  }

  /**
   * Build summary statistics with optimized single query
   */
  private async buildSummary(
    params: z.infer<typeof AnalyticsQuerySchema>,
    startDate: string,
    endDate: string
  ): Promise<
    Omit<AnalyticsResponse['summary'], 'period_start' | 'period_end' | 'cache_hit' | 'query_time'>
  > {
    // Try optimized materialized view first
    try {
      const { data: summaryData, error } = await this.supabase.rpc('get_analytics_summary', {
        start_date: startDate,
        end_date: endDate,
        client_id_param: params.client_id || null,
      });

      if (!error && summaryData && summaryData.length > 0) {
        const summary = summaryData[0];
        return {
          total_campaigns: summary.campaign_count || 0,
          total_videos: summary.video_count || 0,
          total_views: summary.total_views || 0,
          avg_engagement: summary.avg_engagement || 0,
        };
      }
    } catch (error) {
      console.warn('Analytics summary RPC failed, falling back to individual queries');
    }

    // Fallback to original individual queries
    const [campaignCount, videoCount, totalViews] = await Promise.all([
      this.supabase
        .from('campaigns')
        .select('id', { count: 'exact' })
        .gte('created_at', startDate)
        .lte('created_at', endDate),

      this.supabase
        .from('videos')
        .select('id', { count: 'exact' })
        .gte('created_at', startDate)
        .lte('created_at', endDate),

      this.supabase
        .from('video_analytics')
        .select('views')
        .gte('date', startDate)
        .lte('date', endDate),
    ]);

    const views = totalViews.data?.reduce((sum, item) => sum + (item.views || 0), 0) || 0;

    return {
      total_campaigns: campaignCount.count || 0,
      total_videos: videoCount.count || 0,
      total_views: views,
      avg_engagement: 0, // Calculate based on engagement data
    };
  }

  /**
   * Helper methods
   */
  private getTableForMetric(metric: string): string {
    switch (metric) {
      case 'campaigns':
        return 'campaigns';
      case 'videos':
        return 'videos';
      case 'views':
      case 'engagement':
        return 'video_analytics';
      default:
        return 'campaigns';
    }
  }

  private getDateRange(
    period: string,
    startDate?: string,
    endDate?: string
  ): { start_date: string; end_date: string } {
    const now = new Date();
    const end = endDate ? new Date(endDate) : now;
    let start: Date;

    switch (period) {
      case 'day':
        start = new Date(end);
        start.setDate(end.getDate() - 1);
        break;
      case 'week':
        start = new Date(end);
        start.setDate(end.getDate() - 7);
        break;
      case 'month':
        start = new Date(end);
        start.setMonth(end.getMonth() - 1);
        break;
      case 'quarter':
        start = new Date(end);
        start.setMonth(end.getMonth() - 3);
        break;
      case 'year':
        start = new Date(end);
        start.setFullYear(end.getFullYear() - 1);
        break;
      default:
        start = startDate
          ? new Date(startDate)
          : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return {
      start_date: start.toISOString(),
      end_date: end.toISOString(),
    };
  }

  private buildCacheKey(params: any, startDate: string, endDate: string): string {
    return `analytics:${JSON.stringify(params)}:${startDate}:${endDate}`;
  }

  private async getCachedAnalytics(key: string): Promise<AnalyticsResponse | null> {
    // Use longer cache for analytics
    try {
      const cached = await this.supabase
        .from('analytics_cache')
        .select('data')
        .eq('cache_key', key)
        .gte('expires_at', new Date().toISOString())
        .single();

      return cached.data?.data || null;
    } catch {
      return null;
    }
  }

  private async setCachedAnalytics(
    key: string,
    data: AnalyticsResponse,
    ttl: number
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttl);
      await this.supabase.from('analytics_cache').upsert({
        cache_key: key,
        data,
        expires_at: expiresAt.toISOString(),
      });
    } catch (error) {
      console.warn('Failed to cache analytics:', error);
    }
  }
}

/**
 * Main handler
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalyticsResponse | { success: false; error: string }>
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const params = AnalyticsQuerySchema.parse(req.query);
    const aggregator = new AnalyticsAggregator();
    const response = await aggregator.getAnalytics(params);

    // Set cache headers based on cache hit
    if (response.summary.cache_hit) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', 'public, max-age=900'); // 15 minutes
    } else {
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Analytics API error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

// Apply optimizations with longer cache for analytics
export default withAPIOptimization(handler, {
  enableCaching: true,
  cacheTTL: 15 * 60 * 1000, // 15 minutes for analytics
  enableCompression: true,
  enableMetrics: true,
});
