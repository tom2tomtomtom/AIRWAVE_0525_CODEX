/**
 * Performance Dashboard for AIRWAVE
 * Real-time performance monitoring and visualization
 * Provides metrics aggregation and dashboard data generation
 */

// import { metrics } from './metrics-collector'; // Not used directly
import { alerting } from './alerting-system';

// Dashboard data structures
export interface DashboardMetric {
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  change: number;
  timestamp: Date;
  status: 'good' | 'warning' | 'critical';
}

export interface DashboardChart {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'gauge';
  data: ChartDataPoint[];
  config: ChartConfig;
}

export interface ChartDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
  category?: string;
}

export interface ChartConfig {
  yAxis?: {
    min?: number;
    max?: number;
    label?: string;
  };
  xAxis?: {
    label?: string;
    format?: 'time' | 'category';
  };
  colors?: string[];
  thresholds?: { value: number; color: string; label: string }[];
}

export interface DashboardSection {
  id: string;
  title: string;
  metrics: DashboardMetric[];
  charts: DashboardChart[];
  alerts: number;
}

export interface PerformanceDashboard {
  overview: {
    health: 'healthy' | 'degraded' | 'critical';
    uptime: number;
    activeAlerts: number;
    lastUpdated: Date;
  };
  sections: DashboardSection[];
}

// Performance metrics calculator
class PerformanceMetricsCalculator {
  private metricHistory: Map<string, Array<{ value: number; timestamp: number }>> = new Map();
  private readonly historyLimit = 1000;
  private readonly timeWindows = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000};

  public addMetricPoint(metricName: string, value: number, timestamp: number = Date.now()): void {
    let history = this.metricHistory.get(metricName);
    if (!history) {
      history = [];
      this.metricHistory.set(metricName, history);
    }

    history.push({ value, timestamp });

    // Maintain history limit
    if (history.length > this.historyLimit) {
      history.splice(0, history.length - this.historyLimit);
    }
  }

  public getMetricValue(metricName: string, timeWindow: string = '5m', aggregation: 'avg' | 'sum' | 'max' | 'min' | 'last' = 'avg'): number | null {
    const history = this.metricHistory.get(metricName);
    if (!history || history.length === 0) return null;

    const windowMs = this.timeWindows[timeWindow as keyof typeof this.timeWindows] || this.timeWindows['5m'];
    const cutoff = Date.now() - windowMs;
    const relevantPoints = history.filter(point => point.timestamp >= cutoff);

    if (relevantPoints.length === 0) return null;

    switch (aggregation) {
      case 'avg':
        return relevantPoints.reduce((sum, point) => sum + point.value, 0) / relevantPoints.length;
      case 'sum':
        return relevantPoints.reduce((sum, point) => sum + point.value, 0);
      case 'max':
        return Math.max(...relevantPoints.map(point => point.value));
      case 'min':
        return Math.min(...relevantPoints.map(point => point.value));
      case 'last':
        return relevantPoints[relevantPoints.length - 1]?.value || 0;
      default:
        return null;
    }
  }

  public getMetricTrend(metricName: string, timeWindow: string = '15m'): { trend: 'up' | 'down' | 'stable'; change: number } {
    const history = this.metricHistory.get(metricName);
    if (!history || history.length < 2) return { trend: 'stable', change: 0 };

    const windowMs = this.timeWindows[timeWindow as keyof typeof this.timeWindows] || this.timeWindows['15m'];
    const cutoff = Date.now() - windowMs;
    const relevantPoints = history.filter(point => point.timestamp >= cutoff);

    if (relevantPoints.length < 2) return { trend: 'stable', change: 0 };

    const firstHalf = relevantPoints.slice(0, Math.floor(relevantPoints.length / 2));
    const secondHalf = relevantPoints.slice(Math.floor(relevantPoints.length / 2));

    const firstAvg = firstHalf.reduce((sum, point) => sum + point.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, point) => sum + point.value, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    const threshold = 5; // 5% threshold for trend detection

    if (Math.abs(change) < threshold) {
      return { trend: 'stable', change: 0 };
    }

    return {
      trend: change > 0 ? 'up' : 'down',
      change: Math.abs(change)};
  }

  public getChartData(metricName: string, timeWindow: string = '1h', points: number = 50): ChartDataPoint[] {
    const history = this.metricHistory.get(metricName);
    if (!history || history.length === 0) return [];

    const windowMs = this.timeWindows[timeWindow as keyof typeof this.timeWindows] || this.timeWindows['1h'];
    const cutoff = Date.now() - windowMs;
    const relevantPoints = history.filter(point => point.timestamp >= cutoff);

    if (relevantPoints.length === 0) return [];

    // Downsample if we have too many points
    if (relevantPoints.length > points) {
      const step = Math.floor(relevantPoints.length / points);
      return relevantPoints
        .filter((_, index) => index % step === 0)
        .map(point => ({
          timestamp: new Date(point.timestamp),
          value: point.value}));
    }

    return relevantPoints.map(point => ({
      timestamp: new Date(point.timestamp),
      value: point.value}));
  }
}

// Main dashboard generator
export class PerformanceDashboardGenerator {
  private static instance: PerformanceDashboardGenerator;
  private calculator = new PerformanceMetricsCalculator();

  private constructor() {
    // Start collecting metrics
    this.startMetricsCollection();
  }

  static getInstance(): PerformanceDashboardGenerator {
    if (!PerformanceDashboardGenerator.instance) {
      PerformanceDashboardGenerator.instance = new PerformanceDashboardGenerator();
    }
    return PerformanceDashboardGenerator.instance;
  }

  private startMetricsCollection(): void {
    // Simulate metrics collection - in production, this would integrate with your actual metrics
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Every 30 seconds
  }

  private collectSystemMetrics(): void {
    const now = Date.now();

    // Simulate various metrics
    this.calculator.addMetricPoint('api.requests.total', Math.floor(Math.random() * 100) + 50, now);
    this.calculator.addMetricPoint('api.requests.duration', Math.random() * 1000 + 200, now);
    this.calculator.addMetricPoint('api.requests.error_rate', Math.random() * 0.1, now);
    this.calculator.addMetricPoint('database.queries.duration', Math.random() * 500 + 50, now);
    this.calculator.addMetricPoint('ai.requests.total', Math.floor(Math.random() * 20) + 5, now);
    this.calculator.addMetricPoint('video.generation.total', Math.floor(Math.random() * 10) + 1, now);
    this.calculator.addMetricPoint('system.memory.usage', Math.random() * 0.3 + 0.4, now);
    this.calculator.addMetricPoint('system.cpu.usage', Math.random() * 0.4 + 0.3, now);
  }

  public generateDashboard(): PerformanceDashboard {
    const activeAlerts = alerting.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical').length;
    const highAlerts = activeAlerts.filter(alert => alert.severity === 'high').length;

    // Determine overall health
    let health: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (criticalAlerts > 0) {
      health = 'critical';
    } else if (highAlerts > 0 || activeAlerts.length > 5) {
      health = 'degraded';
    }

    return {
      overview: {
        health,
        uptime: this.calculateUptime(),
        activeAlerts: activeAlerts.length,
        lastUpdated: new Date()
      },
  sections: [
        this.generateAPISection(),
        this.generateDatabaseSection(),
        this.generateAISection(),
        this.generateSystemSection(),
        this.generateBusinessSection(),
      ]};
  }

  private generateAPISection(): DashboardSection {
    const requestRate = this.calculator.getMetricValue('api.requests.total', '5m', 'sum') || 0;
    const avgResponseTime = this.calculator.getMetricValue('api.requests.duration', '5m', 'avg') || 0;
    const errorRate = this.calculator.getMetricValue('api.requests.error_rate', '5m', 'avg') || 0;

    const requestTrend = this.calculator.getMetricTrend('api.requests.total');
    const responseTrend = this.calculator.getMetricTrend('api.requests.duration');

    return {
      id: 'api',
      title: 'API Performance',
      metrics: [
        {
          name: 'Request Rate',
          value: requestRate,
          unit: 'req/min',
          trend: requestTrend.trend,
          change: requestTrend.change,
          timestamp: new Date(),
          status: requestRate < 10 ? 'warning' : 'good'
        },
        {
          name: 'Avg Response Time',
          value: avgResponseTime,
          unit: 'ms',
          trend: responseTrend.trend,
          change: responseTrend.change,
          timestamp: new Date(),
          status: avgResponseTime > 1000 ? 'critical' : avgResponseTime > 500 ? 'warning' : 'good'
        },
        {
          name: 'Error Rate',
          value: errorRate * 100,
          unit: '%',
          trend: 'stable',
          change: 0,
          timestamp: new Date(),
          status: errorRate > 0.1 ? 'critical' : errorRate > 0.05 ? 'warning' : 'good' }
      ],
      charts: [
        {
          id: 'api-requests',
          title: 'API Requests Over Time',
          type: 'line',
          data: this.calculator.getChartData('api.requests.total', '1h'),
          config: {
            yAxis: { label: 'Requests/min', min: 0 },
            xAxis: { label: 'Time', format: 'time' },
            colors: ['#2196f3']
          }
        },
        {
          id: 'api-response-time',
          title: 'Response Time Distribution',
          type: 'line',
          data: this.calculator.getChartData('api.requests.duration', '1h'),
          config: {
            yAxis: { label: 'Response Time (ms)', min: 0 },
            xAxis: { label: 'Time', format: 'time' },
            colors: ['#ff9800'],
            thresholds: [
              { value: 500, color: '#ffeb3b', label: 'Warning' },
              { value: 1000, color: '#f44336', label: 'Critical' }
            ]
          }
        }
      ],
      alerts: 0};
  }

  private generateDatabaseSection(): DashboardSection {
    const queryDuration = this.calculator.getMetricValue('database.queries.duration', '5m', 'avg') || 0;
    const connectionHealth = 1; // Simplified - would check actual DB health

    return {
      id: 'database',
      title: 'Database Performance',
      metrics: [
        {
          name: 'Avg Query Time',
          value: queryDuration,
          unit: 'ms',
          trend: 'stable',
          change: 0,
          timestamp: new Date(),
          status: queryDuration > 300 ? 'warning' : 'good'
        },
        {
          name: 'Connection Health',
          value: connectionHealth,
          unit: '',
          trend: 'stable',
          change: 0,
          timestamp: new Date(),
          status: connectionHealth < 1 ? 'critical' : 'good' }
      ],
      charts: [
        {
          id: 'db-query-time',
          title: 'Database Query Performance',
          type: 'line',
          data: this.calculator.getChartData('database.queries.duration', '1h'),
          config: {
            yAxis: { label: 'Query Time (ms)', min: 0 },
            xAxis: { label: 'Time', format: 'time' },
            colors: ['#4caf50'],
            thresholds: [
              { value: 200, color: '#ffeb3b', label: 'Slow' },
              { value: 500, color: '#f44336', label: 'Very Slow' }
            ]
          }
        }
      ],
      alerts: 0};
  }

  private generateAISection(): DashboardSection {
    const aiRequests = this.calculator.getMetricValue('ai.requests.total', '5m', 'sum') || 0;
    const estimatedCost = aiRequests * 0.02; // Simplified cost calculation

    return {
      id: 'ai',
      title: 'AI Services',
      metrics: [
        {
          name: 'AI Requests',
          value: aiRequests,
          unit: 'req/5min',
          trend: 'stable',
          change: 0,
          timestamp: new Date(),
          status: 'good'
        },
        {
          name: 'Estimated Cost',
          value: estimatedCost,
          unit: '$',
          trend: 'stable',
          change: 0,
          timestamp: new Date(),
          status: estimatedCost > 10 ? 'warning' : 'good' }
      ],
      charts: [
        {
          id: 'ai-usage',
          title: 'AI Service Usage',
          type: 'line',
          data: this.calculator.getChartData('ai.requests.total', '1h'),
          config: {
            yAxis: { label: 'Requests', min: 0 },
            xAxis: { label: 'Time', format: 'time' },
            colors: ['#9c27b0']
          }
        }
      ],
      alerts: 0};
  }

  private generateSystemSection(): DashboardSection {
    const memoryUsage = this.calculator.getMetricValue('system.memory.usage', '5m', 'avg') || 0;
    const cpuUsage = this.calculator.getMetricValue('system.cpu.usage', '5m', 'avg') || 0;

    return {
      id: 'system',
      title: 'System Resources',
      metrics: [
        {
          name: 'Memory Usage',
          value: memoryUsage * 100,
          unit: '%',
          trend: 'stable',
          change: 0,
          timestamp: new Date(),
          status: memoryUsage > 0.8 ? 'critical' : memoryUsage > 0.7 ? 'warning' : 'good'
        },
        {
          name: 'CPU Usage',
          value: cpuUsage * 100,
          unit: '%',
          trend: 'stable',
          change: 0,
          timestamp: new Date(),
          status: cpuUsage > 0.8 ? 'critical' : cpuUsage > 0.6 ? 'warning' : 'good' }
      ],
      charts: [
        {
          id: 'system-resources',
          title: 'System Resource Usage',
          type: 'line',
          data: [
            ...this.calculator.getChartData('system.memory.usage', '1h').map(d => ({ ...d, category: 'Memory' })),
            ...this.calculator.getChartData('system.cpu.usage', '1h').map(d => ({ ...d, category: 'CPU' })),
          ],
          config: {
            yAxis: { label: 'Usage (%)', min: 0, max: 100 },
            xAxis: { label: 'Time', format: 'time' },
            colors: ['#ff5722', '#795548']
          }
        }
      ],
      alerts: 0};
  }

  private generateBusinessSection(): DashboardSection {
    const videoGenerations = this.calculator.getMetricValue('video.generation.total', '5m', 'sum') || 0;

    return {
      id: 'business',
      title: 'Business Metrics',
      metrics: [
        {
          name: 'Video Generations',
          value: videoGenerations,
          unit: 'videos/5min',
          trend: 'stable',
          change: 0,
          timestamp: new Date(),
          status: 'good' }
      ],
      charts: [
        {
          id: 'video-generation',
          title: 'Video Generation Activity',
          type: 'bar',
          data: this.calculator.getChartData('video.generation.total', '24h', 24),
          config: {
            yAxis: { label: 'Videos Generated', min: 0 },
            xAxis: { label: 'Hour', format: 'time' },
            colors: ['#00bcd4']
          }
        }
      ],
      alerts: 0};
  }

  private calculateUptime(): number {
    // Simplified uptime calculation - in production, track actual uptime
    return 99.9;
  }

  // Public methods for external metric updates
  public updateMetric(metricName: string, value: number): void {
    this.calculator.addMetricPoint(metricName, value);
  }

  public getMetricHistory(metricName: string, timeWindow: string = '1h'): ChartDataPoint[] {
    return this.calculator.getChartData(metricName, timeWindow);
  }
}

// Global dashboard instance
export const performanceDashboard = PerformanceDashboardGenerator.getInstance();

export default PerformanceDashboardGenerator;