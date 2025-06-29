/**
 * Workflow Health Check API
 * Provides comprehensive health status for workflow dependencies
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { redisManager } from '@/lib/redis/redis-config';
import { aiCircuitBreaker } from '@/lib/circuit-breaker/ai-circuit-breaker';
import { aiResponseCache } from '@/lib/caching/ai-response-cache';
import { workflowMetrics } from '@/lib/monitoring/workflow-metrics';
import { aiCostMonitor } from '@/lib/monitoring/ai-cost-monitor';

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details?: string;
  lastChecked: number;
}

interface WorkflowHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  checks: HealthCheckResult[];
  summary: {
    totalChecks: number;
    healthyChecks: number;
    degradedChecks: number;
    unhealthyChecks: number;
  };
  metrics: {
    activeSessions: number;
    averageResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const healthStatus = await performHealthChecks();
    
    // Set appropriate HTTP status based on overall health
    const httpStatus = healthStatus.overall === 'healthy' ? 200 : 
                      healthStatus.overall === 'degraded' ? 206 : 503;
    
    res.status(httpStatus).json(healthStatus);
  } catch (error: any) {
    console.error('Health check failed:', error);
    res.status(500).json({
      overall: 'unhealthy',
      error: 'Health check system failure',
      timestamp: Date.now()
    });
  }
}

/**
 * Perform all health checks
 */
async function performHealthChecks(): Promise<WorkflowHealthStatus> {
  const checks: HealthCheckResult[] = [];
  
  // Run all health checks in parallel
  const [
    redisCheck,
    aiServicesCheck,
    cacheCheck,
    metricsCheck,
    costMonitorCheck,
    databaseCheck,
  ] = await Promise.allSettled([
    checkRedisHealth(),
    checkAIServicesHealth(),
    checkCacheHealth(),
    checkMetricsHealth(),
    checkCostMonitorHealth(),
    checkDatabaseHealth(),
  ]);

  // Process results
  if (redisCheck.status === 'fulfilled') checks.push(redisCheck.value);
  if (aiServicesCheck.status === 'fulfilled') checks.push(aiServicesCheck.value);
  if (cacheCheck.status === 'fulfilled') checks.push(cacheCheck.value);
  if (metricsCheck.status === 'fulfilled') checks.push(metricsCheck.value);
  if (costMonitorCheck.status === 'fulfilled') checks.push(costMonitorCheck.value);
  if (databaseCheck.status === 'fulfilled') checks.push(databaseCheck.value);

  // Calculate summary
  const summary = {
    totalChecks: checks.length,
    healthyChecks: checks.filter((c: any) => c.status === 'healthy').length,
    degradedChecks: checks.filter((c: any) => c.status === 'degraded').length,
    unhealthyChecks: checks.filter((c: any) => c.status === 'unhealthy').length
  };

  // Determine overall status
  let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (summary.unhealthyChecks > 0) {
    overall = 'unhealthy';
  } else if (summary.degradedChecks > 0) {
    overall = 'degraded';
  }

  // Get workflow metrics
  const metrics = await getWorkflowMetrics();

  return {
    overall,
    timestamp: Date.now(),
    checks,
    summary,
    metrics
  };
}

/**
 * Check Redis health
 */
async function checkRedisHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const isAvailable = await redisManager.isAvailable();
    const responseTime = Date.now() - startTime;
    
    if (isAvailable) {
      // Test basic operations
      const testKey = `health_check_${Date.now()}`;
      await redisManager.set(testKey, 'test', 10);
      const value = await redisManager.get(testKey);
      await redisManager.del(testKey);
      
      if (value === 'test') {
        return {
          service: 'Redis',
          status: responseTime < 100 ? 'healthy' : 'degraded',
          responseTime,
          details: responseTime < 100 ? 'All operations working normally' : 'Slow response times detected',
          lastChecked: Date.now()
        };
      }
    }
    
    return {
      service: 'Redis',
      status: 'unhealthy',
      responseTime,
      details: 'Redis operations failing',
      lastChecked: Date.now()
    };
  } catch (error: any) {
    return {
      service: 'Redis',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: `Redis error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: Date.now()
    };
  }
}

/**
 * Check AI services health via circuit breaker
 */
async function checkAIServicesHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const circuitStatus = await aiCircuitBreaker.getStatus();
    const services = Object.keys(circuitStatus);
    
    let healthyServices = 0;
    let degradedServices = 0;
    let unhealthyServices = 0;
    
    for (const [, status] of Object.entries(circuitStatus)) {
      if (status.state === 'CLOSED') {
        healthyServices++;
      } else if (status.state === 'HALF_OPEN') {
        degradedServices++;
      } else {
        unhealthyServices++;
      }
    }
    
    const responseTime = Date.now() - startTime;
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let details = `${healthyServices}/${services.length} services healthy`;
    
    if (unhealthyServices > 0) {
      overallStatus = 'unhealthy';
      details = `${unhealthyServices} services down, ${degradedServices} degraded`;
    } else if (degradedServices > 0) {
      overallStatus = 'degraded';
      details = `${degradedServices} services degraded`;
    }
    
    return {
      service: 'AI Services',
      status: overallStatus,
      responseTime,
      details,
      lastChecked: Date.now()
    };
  } catch (error: any) {
    return {
      service: 'AI Services',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: `Circuit breaker check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: Date.now()
    };
  }
}

/**
 * Check cache health
 */
async function checkCacheHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const stats = await aiResponseCache.getStats();
    const responseTime = Date.now() - startTime;
    
    // Consider cache healthy if it's responding and has reasonable stats
    const status = responseTime < 50 ? 'healthy' : 'degraded';
    const details = `${stats.totalKeys} cached items, ${(stats.memoryUsage / 1024 / 1024).toFixed(1)}MB used`;
    
    return {
      service: 'AI Cache',
      status,
      responseTime,
      details,
      lastChecked: Date.now()
    };
  } catch (error: any) {
    return {
      service: 'AI Cache',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: `Cache check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: Date.now()
    };
  }
}

/**
 * Check metrics collection health
 */
async function checkMetricsHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const realtimeStatus = await workflowMetrics.getRealTimeStatus();
    const responseTime = Date.now() - startTime;
    
    const hasPerformanceIssues = realtimeStatus.performanceAlerts.filter((a: any) => a.severity === 'high').length > 0;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let details = `${realtimeStatus.activeSessions} active sessions`;
    
    if (hasPerformanceIssues) {
      status = 'degraded';
      details += `, ${realtimeStatus.performanceAlerts.length} performance alerts`;
    }
    
    return {
      service: 'Workflow Metrics',
      status,
      responseTime,
      details,
      lastChecked: Date.now()
    };
  } catch (error: any) {
    return {
      service: 'Workflow Metrics',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: `Metrics check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: Date.now()
    };
  }
}

/**
 * Check cost monitor health
 */
async function checkCostMonitorHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    // Test cost monitor by getting dashboard data for a test user
    const dashboardData = await aiCostMonitor.getDashboardData('health_check_user');
    const responseTime = Date.now() - startTime;
    
    const hasCriticalAlerts = dashboardData.recentAlerts.filter((a: any) => a.severity === 'critical').length > 0;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let details = `${dashboardData.overallPercentUsed.toFixed(1)}% budget used`;
    
    if (hasCriticalAlerts) {
      status = 'degraded';
      details += `, ${dashboardData.recentAlerts.length} recent alerts`;
    }
    
    return {
      service: 'Cost Monitor',
      status,
      responseTime,
      details,
      lastChecked: Date.now()
    };
  } catch (error: any) {
    return {
      service: 'Cost Monitor',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: `Cost monitor check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: Date.now()
    };
  }
}

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    // Test database connection with a simple query
    const response = await fetch('/api/health/database', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }});
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      return {
        service: 'Database',
        status: responseTime < 200 ? 'healthy' : 'degraded',
        responseTime,
        details: data.details || 'Database connection successful',
        lastChecked: Date.now()
    };
    } else {
      return {
        service: 'Database',
        status: 'unhealthy',
        responseTime,
        details: `Database check failed with status ${response.status}`,
        lastChecked: Date.now()
    };
    }
  } catch (error: any) {
    return {
      service: 'Database',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: `Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: Date.now()
    };
  }
}

/**
 * Get workflow metrics summary
 */
async function getWorkflowMetrics(): Promise<{
  activeSessions: number;
  averageResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
}> {
  try {
    const realtimeStatus = await workflowMetrics.getRealTimeStatus();
    
    // Calculate average response time from performance alerts
    const performanceAlerts = realtimeStatus.performanceAlerts;
    const avgResponseTime = performanceAlerts.length > 0 
      ? performanceAlerts.reduce((sum, alert) => {
          const match = alert.issue?.match(/(\d+\.?\d*)s/);
          return sum + (match && match[1] ? parseFloat(match[1]) * 1000 : 0);
        }, 0) / performanceAlerts.length
      : 0;
    
    // Calculate error rate
    const totalErrors = realtimeStatus.recentErrors.length;
    const totalSessions = realtimeStatus.activeSessions || 1;
    const errorRate = totalErrors / totalSessions;
    
    // Get cache stats for hit rate
    const cacheHitRate = 0.85; // Placeholder - would calculate from actual cache metrics
    
    return {
      activeSessions: realtimeStatus.activeSessions,
      averageResponseTime: avgResponseTime,
      errorRate,
      cacheHitRate};
  } catch (error: any) {
    console.error('Error getting workflow metrics:', error);
    return {
      activeSessions: 0,
      averageResponseTime: 0,
      errorRate: 0,
      cacheHitRate: 0};
  }
}
