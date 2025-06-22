import { createClient } from '@/lib/supabase/server';
import { getAPM, recordMetric } from './apm';
import { getLogger } from '@/lib/logger';
import { getRedisConfig } from '@/lib/config';
import { createClient as createRedisClient } from 'redis';

const logger = getLogger('metrics');

export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    load: [number, number, number]; // 1min, 5min, 15min
  };
  memory: {
    used: number;
    free: number;
    total: number;
    heapUsed: number;
    heapTotal: number;
  };
  disk: {
    used: number;
    free: number;
    total: number;
  };
  network?: {
    bytesIn: number;
    bytesOut: number;
  };
}

export interface ApplicationMetrics {
  timestamp: number;
  requests: {
    total: number;
    successful: number;
    failed: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  users: {
    active: number;
    online: number;
    newSignups: number;
  };
  ai: {
    generationsTotal: number;
    generationsSuccess: number;
    generationsFailed: number;
    totalCost: number;
    avgTokens: number;
  };
  database: {
    connections: number;
    queries: number;
    slowQueries: number;
    avgQueryTime: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    byRoute: Record<string, number>;
  };
}

export interface BusinessMetrics {
  timestamp: number;
  clients: {
    total: number;
    active: number;
    newSignups: number;
  };
  workflows: {
    created: number;
    completed: number;
    failed: number;
    avgDuration: number;
  };
  campaigns: {
    active: number;
    created: number;
    completed: number;
  };
  revenue: {
    mrr?: number;
    arr?: number;
    churn?: number;
  };
}

export class MetricsCollector {
  private supabase = createClient();
  private redis?: any;
  private intervalHandles: NodeJS.Timeout[] = [];
  private metricsBuffer: Map<string, any[]> = new Map();
  private bufferSize = 100;
  private flushInterval = 30000; // 30 seconds
  
  constructor() {
    this.initializeRedis();
    this.startBufferFlushing();
  }
  
  private async initializeRedis() {
    try {
      const config = getRedisConfig();
      this.redis = createRedisClient({
        url: config.url,
        password: config.password,
        database: config.db
      });
      
      await this.redis.connect();
      logger.info('Redis connected for metrics collection');
    } catch (error) {
      logger.warn('Redis not available for metrics', error);
    }
  }
  
  private startBufferFlushing() {
    const flushHandle = setInterval(() => {
      this.flushMetricsBuffer();
    }, this.flushInterval);
    
    this.intervalHandles.push(flushHandle);
  }
  
  // Collect system metrics
  async collectSystemMetrics(): Promise<SystemMetrics> {
    const os = await import('os');
    const process = globalThis.process;
    
    const metrics: SystemMetrics = {
      timestamp: Date.now(),
      cpu: {
        usage: process.cpuUsage().user / 1000000, // Convert to seconds
        load: os.loadavg() as [number, number, number]
      },
      memory: {
        used: process.memoryUsage().rss,
        free: os.freemem(),
        total: os.totalmem(),
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal
      },
      disk: {
        used: 0, // Would need additional library for disk metrics
        free: 0,
        total: 0
      }
    };
    
    // Store in buffer
    this.bufferMetric('system', metrics);
    
    // Send to APM
    recordMetric({ name: 'system.cpu.usage', value: metrics.cpu.usage, type: 'gauge' });
    recordMetric({ name: 'system.memory.used', value: metrics.memory.used, type: 'gauge' });
    recordMetric({ name: 'system.memory.heap_used', value: metrics.memory.heapUsed, type: 'gauge' });
    
    return metrics;
  }
  
  // Collect application metrics
  async collectApplicationMetrics(): Promise<ApplicationMetrics> {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    try {
      // Request metrics (would typically come from middleware)
      const requestMetrics = await this.getRequestMetrics(oneHourAgo, now);
      
      // User metrics
      const userMetrics = await this.getUserMetrics(oneHourAgo, now);
      
      // AI metrics
      const aiMetrics = await this.getAIMetrics(oneHourAgo, now);
      
      // Database metrics
      const dbMetrics = await this.getDatabaseMetrics();
      
      // Error metrics
      const errorMetrics = await this.getErrorMetrics(oneHourAgo, now);
      
      const metrics: ApplicationMetrics = {
        timestamp: now,
        requests: requestMetrics,
        users: userMetrics,
        ai: aiMetrics,
        database: dbMetrics,
        errors: errorMetrics
      };
      
      // Store in buffer
      this.bufferMetric('application', metrics);
      
      // Send key metrics to APM
      recordMetric({ name: 'app.requests.total', value: requestMetrics.total, type: 'counter' });
      recordMetric({ name: 'app.users.active', value: userMetrics.active, type: 'gauge' });
      recordMetric({ name: 'app.ai.generations', value: aiMetrics.generationsTotal, type: 'counter' });
      recordMetric({ name: 'app.errors.total', value: errorMetrics.total, type: 'counter' });
      
      return metrics;
      
    } catch (error) {
      logger.error('Failed to collect application metrics', error);
      throw error;
    }
  }
  
  // Collect business metrics
  async collectBusinessMetrics(): Promise<BusinessMetrics> {
    const now = Date.now();
    const oneDayAgo = now - 86400000;
    
    try {
      // Client metrics
      const { data: clientsData } = await this.supabase
        .from('clients')
        .select('id, created_at, is_active');
      
      const totalClients = clientsData?.length || 0;
      const activeClients = clientsData?.filter(c => c.is_active).length || 0;
      const newClients = clientsData?.filter(c => 
        new Date(c.created_at).getTime() > oneDayAgo
      ).length || 0;
      
      // Workflow metrics
      const { data: workflowsData } = await this.supabase
        .from('workflows')
        .select('id, status, created_at, completed_at')
        .gte('created_at', new Date(oneDayAgo).toISOString());
      
      const workflowsCreated = workflowsData?.length || 0;
      const workflowsCompleted = workflowsData?.filter(w => w.status === 'completed').length || 0;
      const workflowsFailed = workflowsData?.filter(w => w.status === 'failed').length || 0;
      
      const completedWorkflows = workflowsData?.filter(w => w.completed_at) || [];
      const avgDuration = completedWorkflows.length > 0 
        ? completedWorkflows.reduce((sum, w) => {
            const duration = new Date(w.completed_at).getTime() - new Date(w.created_at).getTime();
            return sum + duration;
          }, 0) / completedWorkflows.length
        : 0;
      
      // Campaign metrics
      const { data: campaignsData } = await this.supabase
        .from('campaigns')
        .select('id, status, created_at')
        .gte('created_at', new Date(oneDayAgo).toISOString());
      
      const campaignsCreated = campaignsData?.length || 0;
      const activeCampaigns = campaignsData?.filter(c => c.status === 'active').length || 0;
      const completedCampaigns = campaignsData?.filter(c => c.status === 'completed').length || 0;
      
      const metrics: BusinessMetrics = {
        timestamp: now,
        clients: {
          total: totalClients,
          active: activeClients,
          newSignups: newClients
        },
        workflows: {
          created: workflowsCreated,
          completed: workflowsCompleted,
          failed: workflowsFailed,
          avgDuration
        },
        campaigns: {
          active: activeCampaigns,
          created: campaignsCreated,
          completed: completedCampaigns
        },
        revenue: {
          // Would be populated from billing system
        }
      };
      
      // Store in buffer
      this.bufferMetric('business', metrics);
      
      // Send to APM
      recordMetric({ name: 'business.clients.total', value: totalClients, type: 'gauge' });
      recordMetric({ name: 'business.workflows.created', value: workflowsCreated, type: 'counter' });
      recordMetric({ name: 'business.campaigns.active', value: activeCampaigns, type: 'gauge' });
      
      return metrics;
      
    } catch (error) {
      logger.error('Failed to collect business metrics', error);
      throw error;
    }
  }
  
  // Helper methods for specific metric types
  private async getRequestMetrics(startTime: number, endTime: number) {
    // This would typically come from request logging middleware
    // For now, return mock data
    return {
      total: 0,
      successful: 0,
      failed: 0,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0
    };
  }
  
  private async getUserMetrics(startTime: number, endTime: number) {
    const { data: sessions } = await this.supabase
      .from('user_sessions')
      .select('user_id, created_at, is_active')
      .gte('last_activity', new Date(startTime).toISOString());
    
    const { data: newUsers } = await this.supabase
      .from('profiles')
      .select('id')
      .gte('created_at', new Date(startTime).toISOString());
    
    return {
      active: sessions?.length || 0,
      online: sessions?.filter(s => s.is_active).length || 0,
      newSignups: newUsers?.length || 0
    };
  }
  
  private async getAIMetrics(startTime: number, endTime: number) {
    const { data: generations } = await this.supabase
      .from('ai_generations')
      .select('status, total_tokens, cost_usd')
      .gte('created_at', new Date(startTime).toISOString());
    
    const total = generations?.length || 0;
    const successful = generations?.filter(g => g.status === 'success').length || 0;
    const failed = total - successful;
    const totalCost = generations?.reduce((sum, g) => sum + (g.cost_usd || 0), 0) || 0;
    const avgTokens = total > 0 
      ? (generations?.reduce((sum, g) => sum + (g.total_tokens || 0), 0) || 0) / total
      : 0;
    
    return {
      generationsTotal: total,
      generationsSuccess: successful,
      generationsFailed: failed,
      totalCost,
      avgTokens
    };
  }
  
  private async getDatabaseMetrics() {
    // These would come from database monitoring
    return {
      connections: 0,
      queries: 0,
      slowQueries: 0,
      avgQueryTime: 0
    };
  }
  
  private async getErrorMetrics(startTime: number, endTime: number) {
    // This would come from error logging
    return {
      total: 0,
      byType: {},
      byRoute: {}
    };
  }
  
  // Buffer management
  private bufferMetric(type: string, metric: any): void {
    if (!this.metricsBuffer.has(type)) {
      this.metricsBuffer.set(type, []);
    }
    
    const buffer = this.metricsBuffer.get(type)!;
    buffer.push(metric);
    
    // If buffer is full, flush it
    if (buffer.length >= this.bufferSize) {
      this.flushMetricType(type);
    }
  }
  
  private async flushMetricsBuffer(): Promise<void> {
    for (const [type] of this.metricsBuffer) {
      await this.flushMetricType(type);
    }
  }
  
  private async flushMetricType(type: string): Promise<void> {
    const buffer = this.metricsBuffer.get(type);
    if (!buffer || buffer.length === 0) return;
    
    try {
      // Store in database
      const { error } = await this.supabase
        .from('performance_metrics')
        .insert(
          buffer.map(metric => ({
            metric_name: `${type}_metrics`,
            metric_type: 'gauge',
            value: JSON.stringify(metric).length, // Store size as value
            tags: { type, timestamp: metric.timestamp },
            timestamp: new Date(metric.timestamp).toISOString()
          }))
        );
      
      if (error) {
        logger.warn(`Failed to store ${type} metrics`, error);
      }
      
      // Store in Redis for real-time access
      if (this.redis) {
        await this.redis.setex(
          `metrics:${type}:latest`,
          300, // 5 minutes TTL
          JSON.stringify(buffer[buffer.length - 1])
        );
      }
      
      // Clear buffer
      this.metricsBuffer.set(type, []);
      
    } catch (error) {
      logger.error(`Failed to flush ${type} metrics`, error);
    }
  }
  
  // Real-time metrics retrieval
  async getLatestMetrics(type: 'system' | 'application' | 'business'): Promise<any | null> {
    if (this.redis) {
      try {
        const data = await this.redis.get(`metrics:${type}:latest`);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        logger.warn(`Failed to get latest ${type} metrics from Redis`, error);
      }
    }
    
    // Fallback to database
    const { data } = await this.supabase
      .from('performance_metrics')
      .select('*')
      .eq('metric_name', `${type}_metrics`)
      .order('timestamp', { ascending: false })
      .limit(1);
    
    return data?.[0] || null;
  }
  
  // Historical metrics
  async getHistoricalMetrics(
    type: 'system' | 'application' | 'business',
    startTime: number,
    endTime: number,
    granularity: 'minute' | 'hour' | 'day' = 'hour'
  ): Promise<any[]> {
    const { data } = await this.supabase
      .from('performance_metrics')
      .select('*')
      .eq('metric_name', `${type}_metrics`)
      .gte('timestamp', new Date(startTime).toISOString())
      .lte('timestamp', new Date(endTime).toISOString())
      .order('timestamp', { ascending: true });
    
    return data || [];
  }
  
  // Metrics dashboard data
  async getDashboardData(): Promise<{
    system: SystemMetrics | null;
    application: ApplicationMetrics | null;
    business: BusinessMetrics | null;
    alerts: Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high' | 'critical' }>;
  }> {
    const [system, application, business] = await Promise.all([
      this.getLatestMetrics('system'),
      this.getLatestMetrics('application'),
      this.getLatestMetrics('business')
    ]);
    
    // Generate alerts based on metrics
    const alerts = this.generateAlerts(system, application, business);
    
    return {
      system,
      application,
      business,
      alerts
    };
  }
  
  private generateAlerts(system: any, application: any, business: any): Array<{
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> {
    const alerts = [];
    
    // System alerts
    if (system) {
      if (system.memory.used / system.memory.total > 0.9) {
        alerts.push({
          type: 'memory',
          message: 'High memory usage detected',
          severity: 'high'
        });
      }
      
      if (system.cpu.load[0] > 5) {
        alerts.push({
          type: 'cpu',
          message: 'High CPU load detected',
          severity: 'medium'
        });
      }
    }
    
    // Application alerts
    if (application) {
      if (application.errors.total > 100) {
        alerts.push({
          type: 'errors',
          message: 'High error rate detected',
          severity: 'critical'
        });
      }
      
      if (application.requests.avgResponseTime > 2000) {
        alerts.push({
          type: 'performance',
          message: 'Slow response times detected',
          severity: 'medium'
        });
      }
    }
    
    return alerts;
  }
  
  // Start automated collection
  startAutomatedCollection(intervals: {
    system: number;
    application: number;
    business: number;
  } = {
    system: 30000,     // 30 seconds
    application: 60000, // 1 minute
    business: 300000   // 5 minutes
  }): void {
    // System metrics
    const systemHandle = setInterval(() => {
      this.collectSystemMetrics().catch(error => {
        logger.error('Failed to collect system metrics', error);
      });
    }, intervals.system);
    
    // Application metrics
    const appHandle = setInterval(() => {
      this.collectApplicationMetrics().catch(error => {
        logger.error('Failed to collect application metrics', error);
      });
    }, intervals.application);
    
    // Business metrics
    const businessHandle = setInterval(() => {
      this.collectBusinessMetrics().catch(error => {
        logger.error('Failed to collect business metrics', error);
      });
    }, intervals.business);
    
    this.intervalHandles.push(systemHandle, appHandle, businessHandle);
    
    logger.info('Automated metrics collection started', intervals);
  }
  
  // Stop collection and cleanup
  async stop(): Promise<void> {
    // Clear intervals
    this.intervalHandles.forEach(handle => clearInterval(handle));
    this.intervalHandles = [];
    
    // Flush remaining metrics
    await this.flushMetricsBuffer();
    
    // Disconnect Redis
    if (this.redis) {
      await this.redis.disconnect();
    }
    
    logger.info('Metrics collection stopped');
  }
}

// Singleton instance
let metricsInstance: MetricsCollector | null = null;

export const getMetricsCollector = (): MetricsCollector => {
  if (!metricsInstance) {
    metricsInstance = new MetricsCollector();
  }
  return metricsInstance;
};

// Initialize metrics collection
export const initializeMetrics = (): MetricsCollector => {
  const collector = getMetricsCollector();
  collector.startAutomatedCollection();
  return collector;
};

// Convenience functions
export const collectSystemMetrics = () => getMetricsCollector().collectSystemMetrics();
export const collectApplicationMetrics = () => getMetricsCollector().collectApplicationMetrics();
export const collectBusinessMetrics = () => getMetricsCollector().collectBusinessMetrics();
export const getDashboardData = () => getMetricsCollector().getDashboardData();