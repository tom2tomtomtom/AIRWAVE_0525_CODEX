/**
 * Performance Dashboard API
 * Provides real-time performance metrics and optimization insights
 */

import { NextApiRequest, NextApiResponse } from 'next';
import {
  getAPIPerformanceStats,
  clearPerformanceData,
} from '@/middleware/performance/apiOptimization';
import { cacheManager } from '@/lib/cache/strategy';

interface PerformanceDashboard {
  success: true;
  data: {
    overview: {
      total_requests: number;
      average_response_time: number;
      cache_hit_rate: number;
      total_endpoints: number;
      slow_endpoints: string[];
      error_rate: number;
    };
    endpoints: {
      [endpoint: string]: {
        request_count: number;
        average_response_time: number;
        min_response_time: number;
        max_response_time: number;
        cache_hits: number;
        cache_misses: number;
        error_count: number;
        last_accessed: string;
        performance_grade: 'A' | 'B' | 'C' | 'D' | 'F';
      };
    };
    cache: {
      memory_usage: any;
      total_cached_items: number;
      cache_efficiency: number;
      top_cached_items: Array<{
        key: string;
        namespace: string;
        access_count: number;
        last_accessed: string;
      }>;
    };
    system: {
      memory_usage: NodeJS.MemoryUsage;
      uptime: number;
      cpu_usage?: number;
      active_connections?: number;
    };
    recommendations: Array<{
      type: 'cache' | 'query' | 'endpoint' | 'system';
      severity: 'low' | 'medium' | 'high';
      message: string;
      endpoint?: string;
      action: string;
    }>;
  };
  meta: {
    generated_at: string;
    data_window: string;
    auto_refresh_interval: number;
  };
}

/**
 * Performance analyzer class
 */
class PerformanceAnalyzer {
  /**
   * Analyze API performance metrics
   */
  analyzePerformance(): PerformanceDashboard['data'] {
    const stats = getAPIPerformanceStats();
    const cacheStats = cacheManager.getStats();

    // Analyze endpoints
    const endpointAnalysis = this.analyzeEndpoints(stats.monitor);
    const overview = this.buildOverview(endpointAnalysis);
    const cache = this.analyzeCachePerformance(cacheStats, stats.queryOptimizer);
    const system = this.getSystemMetrics();
    const recommendations = this.generateRecommendations(endpointAnalysis, cache, system);

    return {
      overview,
      endpoints: endpointAnalysis,
      cache,
      system,
      recommendations,
    };
  }

  /**
   * Analyze individual endpoint performance
   */
  private analyzeEndpoints(monitorData: any): PerformanceDashboard['data']['endpoints'] {
    const endpoints: PerformanceDashboard['data']['endpoints'] = {};

    for (const [endpoint, metrics] of Object.entries(monitorData)) {
      const metricArray = metrics as any[];
      if (!metricArray || metricArray.length === 0) continue;

      const responseTimes = metricArray.filter(m => m.duration).map(m => m.duration);

      const cacheHits = metricArray.filter(m => m.cacheHit).length;
      const cacheMisses = metricArray.length - cacheHits;
      const errors = metricArray.filter(m => m.error).length;

      const avgResponseTime =
        responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0;

      const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
      const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;

      const lastAccessed =
        metricArray.length > 0
          ? new Date(Math.max(...metricArray.map(m => m.startTime))).toISOString()
          : new Date().toISOString();

      const performanceGrade = this.calculatePerformanceGrade(
        avgResponseTime,
        cacheHits / (cacheHits + cacheMisses) || 0,
        errors / metricArray.length || 0
      );

      endpoints[endpoint] = {
        request_count: metricArray.length,
        average_response_time: Math.round(avgResponseTime),
        min_response_time: minResponseTime,
        max_response_time: maxResponseTime,
        cache_hits: cacheHits,
        cache_misses: cacheMisses,
        error_count: errors,
        last_accessed: lastAccessed,
        performance_grade: performanceGrade,
      };
    }

    return endpoints;
  }

  /**
   * Build overview statistics
   */
  private buildOverview(
    endpointAnalysis: PerformanceDashboard['data']['endpoints']
  ): PerformanceDashboard['data']['overview'] {
    const endpoints = Object.entries(endpointAnalysis);
    const totalRequests = endpoints.reduce((sum, [_, data]) => sum + data.request_count, 0);
    const totalResponseTime = endpoints.reduce(
      (sum, [_, data]) => sum + data.average_response_time * data.request_count,
      0
    );
    const totalCacheHits = endpoints.reduce((sum, [_, data]) => sum + data.cache_hits, 0);
    const totalCacheMisses = endpoints.reduce((sum, [_, data]) => sum + data.cache_misses, 0);
    const totalErrors = endpoints.reduce((sum, [_, data]) => sum + data.error_count, 0);

    const avgResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
    const cacheHitRate =
      totalCacheHits + totalCacheMisses > 0
        ? (totalCacheHits / (totalCacheHits + totalCacheMisses)) * 100
        : 0;
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    // Identify slow endpoints (> 1 second average)
    const slowEndpoints = endpoints
      .filter(([_, data]) => data.average_response_time > 1000)
      .map(([endpoint]) => endpoint)
      .slice(0, 5);

    return {
      total_requests: totalRequests,
      average_response_time: Math.round(avgResponseTime),
      cache_hit_rate: Math.round(cacheHitRate * 100) / 100,
      total_endpoints: endpoints.length,
      slow_endpoints: slowEndpoints,
      error_rate: Math.round(errorRate * 100) / 100,
    };
  }

  /**
   * Analyze cache performance
   */
  private analyzeCachePerformance(
    cacheStats: any,
    _queryOptimizerStats: any
  ): PerformanceDashboard['data']['cache'] {
    const totalCachedItems = Object.values(cacheStats.memoryStats || {}).reduce(
      (sum: number, stats: any) => sum + (stats?.size || 0),
      0
    );

    // Calculate cache efficiency (simplified)
    const cacheEfficiency = totalCachedItems > 0 ? 85 : 0; // Mock calculation

    // Mock top cached items (would come from actual cache statistics)
    const topCachedItems = [
      {
        key: 'api-responses:clients',
        namespace: 'api-responses',
        access_count: 45,
        last_accessed: new Date().toISOString(),
      },
      {
        key: 'api-responses:analytics',
        namespace: 'api-responses',
        access_count: 32,
        last_accessed: new Date().toISOString(),
      },
    ];

    return {
      memory_usage: cacheStats.memoryStats,
      total_cached_items: totalCachedItems,
      cache_efficiency: cacheEfficiency,
      top_cached_items: topCachedItems,
    };
  }

  /**
   * Get system metrics
   */
  private getSystemMetrics(): PerformanceDashboard['data']['system'] {
    return {
      memory_usage: process.memoryUsage(),
      uptime: process.uptime(),
      // cpu_usage and active_connections would require additional monitoring
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    endpointAnalysis: PerformanceDashboard['data']['endpoints'],
    cache: PerformanceDashboard['data']['cache'],
    system: PerformanceDashboard['data']['system']
  ): PerformanceDashboard['data']['recommendations'] {
    const recommendations: PerformanceDashboard['data']['recommendations'] = [];

    // Check for slow endpoints
    Object.entries(endpointAnalysis).forEach(([endpoint, data]) => {
      if (data.average_response_time > 1000) {
        recommendations.push({
          type: 'endpoint',
          severity: 'high',
          message: `Endpoint ${endpoint} has slow response time (${data.average_response_time}ms)`,
          endpoint,
          action: 'Optimize database queries, add caching, or implement pagination',
        });
      }

      if (
        data.cache_hits / (data.cache_hits + data.cache_misses) < 0.3 &&
        data.request_count > 10
      ) {
        recommendations.push({
          type: 'cache',
          severity: 'medium',
          message: `Low cache hit rate for ${endpoint} (${((data.cache_hits / (data.cache_hits + data.cache_misses)) * 100).toFixed(1)}%)`,
          endpoint,
          action: 'Increase cache TTL or improve cache key strategy',
        });
      }

      if (data.error_count / data.request_count > 0.05) {
        recommendations.push({
          type: 'endpoint',
          severity: 'high',
          message: `High error rate for ${endpoint} (${((data.error_count / data.request_count) * 100).toFixed(1)}%)`,
          endpoint,
          action: 'Investigate error causes and improve error handling',
        });
      }
    });

    // Check cache efficiency
    if (cache.cache_efficiency < 70) {
      recommendations.push({
        type: 'cache',
        severity: 'medium',
        message: `Cache efficiency is below optimal (${cache.cache_efficiency}%)`,
        action: 'Review cache strategy and increase cache hit rate',
      });
    }

    // Check memory usage
    const memoryUsagePercent = (system.memory_usage.heapUsed / system.memory_usage.heapTotal) * 100;
    if (memoryUsagePercent > 80) {
      recommendations.push({
        type: 'system',
        severity: 'high',
        message: `High memory usage (${memoryUsagePercent.toFixed(1)}%)`,
        action: 'Investigate memory leaks or increase available memory',
      });
    }

    return recommendations;
  }

  /**
   * Calculate performance grade for an endpoint
   */
  private calculatePerformanceGrade(
    avgResponseTime: number,
    cacheHitRate: number,
    errorRate: number
  ): 'A' | 'B' | 'C' | 'D' | 'F' {
    let score = 100;

    // Response time scoring
    if (avgResponseTime > 2000) score -= 40;
    else if (avgResponseTime > 1000) score -= 20;
    else if (avgResponseTime > 500) score -= 10;

    // Cache hit rate scoring
    if (cacheHitRate < 0.3) score -= 20;
    else if (cacheHitRate < 0.5) score -= 10;

    // Error rate scoring
    if (errorRate > 0.05) score -= 30;
    else if (errorRate > 0.01) score -= 10;

    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}

/**
 * Main handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PerformanceDashboard | { success: false; error: string }>
): Promise<void> {
  try {
    // Handle different actions
    if (req.method === 'DELETE') {
      // Clear performance data
      clearPerformanceData();
      res.status(200).json({
        success: true,
        data: {} as any,
        meta: {
          generated_at: new Date().toISOString(),
          data_window: 'cleared',
          auto_refresh_interval: 30,
        },
      });
      return;
    }

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET', 'DELETE']);
      res.status(405).json({ success: false, error: 'Method not allowed' });
      return;
    }

    // Generate performance dashboard
    const analyzer = new PerformanceAnalyzer();
    const data = analyzer.analyzePerformance();

    const response: PerformanceDashboard = {
      success: true,
      data,
      meta: {
        generated_at: new Date().toISOString(),
        data_window: 'last_hour', // Could be configurable
        auto_refresh_interval: 30, // seconds
      },
    };

    // Set cache headers (short cache for real-time data)
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.setHeader('X-Refresh-Interval', '30');

    res.status(200).json(response);
  } catch (error) {
    console.error('Performance dashboard error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
