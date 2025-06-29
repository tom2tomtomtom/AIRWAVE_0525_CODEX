// API endpoint for performance dashboard data
import { NextApiRequest, NextApiResponse } from 'next';
import { metrics } from './vitals';

interface DashboardData {
  overview: {
    totalSessions: number;
    totalMetrics: number;
    timeRange: string;
    lastUpdated: string;
  };
  coreWebVitals: {
    lcp: MetricSummary;
    fid: MetricSummary;
    cls: MetricSummary;
  };
  loadingMetrics: {
    fcp: MetricSummary;
    ttfb: MetricSummary;
  };
  trends: {
    hourly: Array<{ hour: string; good: number; poor: number; total: number }>;
    daily: Array<{ date: string; averageScore: number; totalMetrics: number }>;
  };
  topIssues: Array<{
    url: string;
    metric: string;
    averageValue: number;
    occurrences: number;
    rating: string;
  }>;
}

interface MetricSummary {
  average: number;
  p75: number;
  p90: number;
  good: number;
  needsImprovement: number;
  poor: number;
  totalSamples: number;
  trend: 'improving' | 'stable' | 'degrading';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<DashboardData | { error: string }>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { timeRange = '24h' } = req.query;
    
    // Filter metrics by time range
    const now = Date.now();
    const timeRangeMs = getTimeRangeMs(timeRange as string);
    const filteredMetrics = metrics.filter(m => now - m.timestamp < timeRangeMs);

    // Generate dashboard data
    const dashboardData: DashboardData = {
      overview: generateOverview(filteredMetrics, timeRange as string),
      coreWebVitals: generateCoreWebVitals(filteredMetrics),
      loadingMetrics: generateLoadingMetrics(filteredMetrics),
      trends: generateTrends(filteredMetrics),
      topIssues: generateTopIssues(filteredMetrics),
    };

    res.status(200).json(dashboardData);

  } catch (error) {
    console.error('Error generating dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function getTimeRangeMs(timeRange: string): number {
  switch (timeRange) {
    case '1h': return 60 * 60 * 1000;
    case '24h': return 24 * 60 * 60 * 1000;
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    case '30d': return 30 * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

function generateOverview(metrics: any[], timeRange: string) {
  const uniqueSessions = new Set(metrics.map(m => m.sessionId)).size;
  
  return {
    totalSessions: uniqueSessions,
    totalMetrics: metrics.length,
    timeRange,
    lastUpdated: new Date().toISOString(),
  };
}

function generateCoreWebVitals(metrics: any[]) {
  const lcpMetrics = metrics.filter(m => m.metric.name === 'LCP').map(m => m.metric);
  const fidMetrics = metrics.filter(m => m.metric.name === 'FID').map(m => m.metric);
  const clsMetrics = metrics.filter(m => m.metric.name === 'CLS').map(m => m.metric);

  return {
    lcp: generateMetricSummary(lcpMetrics),
    fid: generateMetricSummary(fidMetrics),
    cls: generateMetricSummary(clsMetrics),
  };
}

function generateLoadingMetrics(metrics: any[]) {
  const fcpMetrics = metrics.filter(m => m.metric.name === 'FCP').map(m => m.metric);
  const ttfbMetrics = metrics.filter(m => m.metric.name === 'TTFB').map(m => m.metric);

  return {
    fcp: generateMetricSummary(fcpMetrics),
    ttfb: generateMetricSummary(ttfbMetrics),
  };
}

function generateMetricSummary(metricValues: any[]): MetricSummary {
  if (metricValues.length === 0) {
    return {
      average: 0,
      p75: 0,
      p90: 0,
      good: 0,
      needsImprovement: 0,
      poor: 0,
      totalSamples: 0,
      trend: 'stable',
    };
  }

  const values = metricValues.map(m => m.value).sort((a, b) => a - b);
  const ratings = metricValues.map(m => m.rating);

  return {
    average: values.reduce((sum, val) => sum + val, 0) / values.length,
    p75: values[Math.floor(values.length * 0.75)] || 0,
    p90: values[Math.floor(values.length * 0.90)] || 0,
    good: ratings.filter(r => r === 'good').length,
    needsImprovement: ratings.filter(r => r === 'needs-improvement').length,
    poor: ratings.filter(r => r === 'poor').length,
    totalSamples: values.length,
    trend: calculateTrend(metricValues),
  };
}

function calculateTrend(metricValues: any[]): 'improving' | 'stable' | 'degrading' {
  if (metricValues.length < 10) return 'stable';

  const sorted = metricValues.sort((a, b) => a.timestamp - b.timestamp);
  const midpoint = Math.floor(sorted.length / 2);
  
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);
  
  const firstAvg = firstHalf.reduce((sum, m) => sum + m.value, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, m) => sum + m.value, 0) / secondHalf.length;
  
  const change = ((secondAvg - firstAvg) / firstAvg) * 100;
  
  if (change < -5) return 'improving';
  if (change > 5) return 'degrading';
  return 'stable';
}

function generateTrends(metrics: any[]) {
  const now = Date.now();
  const hourly = [];
  const daily = [];

  // Generate hourly trends for last 24 hours
  for (let i = 23; i >= 0; i--) {
    const hourStart = now - (i * 60 * 60 * 1000);
    const hourEnd = hourStart + (60 * 60 * 1000);
    
    const hourMetrics = metrics.filter(m => 
      m.timestamp >= hourStart && m.timestamp < hourEnd
    );
    
    const good = hourMetrics.filter(m => m.metric.rating === 'good').length;
    const poor = hourMetrics.filter(m => m.metric.rating === 'poor').length;
    
    hourly.push({
      hour: new Date(hourStart).toISOString().slice(11, 16),
      good,
      poor,
      total: hourMetrics.length,
    });
  }

  // Generate daily trends for last 7 days
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - (i * 24 * 60 * 60 * 1000);
    const dayEnd = dayStart + (24 * 60 * 60 * 1000);
    
    const dayMetrics = metrics.filter(m => 
      m.timestamp >= dayStart && m.timestamp < dayEnd
    );
    
    const averageScore = dayMetrics.length > 0 
      ? dayMetrics.reduce((sum, m) => sum + (m.metric.rating === 'good' ? 100 : m.metric.rating === 'needs-improvement' ? 75 : 50), 0) / dayMetrics.length
      : 0;
    
    daily.push({
      date: new Date(dayStart).toISOString().slice(0, 10),
      averageScore,
      totalMetrics: dayMetrics.length,
    });
  }

  return { hourly, daily };
}

function generateTopIssues(metrics: any[]) {
  const issueMap = new Map<string, { values: number[]; ratings: string[] }>();

  metrics.forEach(m => {
    if (m.metric.rating !== 'good') {
      const key = `${m.url}:${m.metric.name}`;
      if (!issueMap.has(key)) {
        issueMap.set(key, { values: [], ratings: [] });
      }
      issueMap.get(key)!.values.push(m.metric.value);
      issueMap.get(key)!.ratings.push(m.metric.rating);
    }
  });

  const issues = Array.from(issueMap.entries()).map(([key, data]) => {
    const [url, metric] = key.split(':');
    const safeUrl = url || 'unknown';
    const safeMetric = metric || 'unknown';
    const averageValue = data.values.reduce((sum, val) => sum + val, 0) / data.values.length;
    const poorCount = data.ratings.filter(r => r === 'poor').length;
    
    return {
      url: safeUrl.length > 50 ? safeUrl.slice(0, 50) + '...' : safeUrl,
      metric: safeMetric,
      averageValue,
      occurrences: data.values.length,
      rating: poorCount > data.values.length / 2 ? 'poor' : 'needs-improvement',
    };
  });

  return issues
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10);
}