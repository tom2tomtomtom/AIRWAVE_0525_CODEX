import { NextApiRequest, NextApiResponse } from 'next';
import { loggers } from '@/lib/logger';

interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  error?: string;
  details?: Record<string, any>;
}

interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: HealthCheck[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
}

// Individual health check functions
const checkDatabase = async (): Promise<HealthCheck> => {
  const start = Date.now();
  try {
    const { createServiceClient } = await import('@/lib/supabase/server-simple');
    const supabase = createServiceClient();

    // Simple query to test database connectivity
    const { data: _data, error } = await supabase.from('profiles').select('id').limit(1);

    if (error) throw error;

    return {
      service: 'database',
      status: 'healthy',
      responseTime: Date.now() - start,
      details: {
        connection: 'active',
        queryExecuted: true },
    };
  } catch (error) {
    return {
      service: 'database',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown database error' };
  }
};

const checkRedis = async (): Promise<HealthCheck> => {
  const start = Date.now();
  try {
    const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

    // Skip Redis check if not configured
    if (!redisUrl || redisUrl === 'redis://localhost:6379') {
      return {
        service: 'redis',
        status: 'degraded',
        responseTime: Date.now() - start,
        details: {
          message: 'Redis not configured or using default local instance' },
      };
    }

    // Skip Redis for now to avoid import issues
    return {
      service: 'redis',
      status: 'degraded',
      responseTime: Date.now() - start,
      details: {
        message: 'Redis check disabled for deployment' },
    };
  } catch (error) {
    return {
      service: 'redis',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown Redis error' };
  }
};

const checkExternalAPIs = async (): Promise<HealthCheck[]> => {
  const checks: HealthCheck[] = [];

  // Check OpenAI API if configured
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const start = Date.now();
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      checks.push({
        service: 'openai',
        status: response.ok ? 'healthy' : 'degraded',
        responseTime: Date.now() - start,
        details: {
          statusCode: response.status,
          available: response.ok },
      });
    } catch (error) {
      checks.push({
        service: 'openai',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'OpenAI API check failed' });
    }
  }

  // Check Supabase API
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const start = Date.now();
    try {
      const response = await fetch(`${supabaseUrl}/health`, {
        signal: AbortSignal.timeout(5000) });

      checks.push({
        service: 'supabase',
        status: response.ok ? 'healthy' : 'degraded',
        responseTime: Date.now() - start,
        details: {
          statusCode: response.status,
          available: response.ok },
      });
    } catch (error) {
      checks.push({
        service: 'supabase',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Supabase health check failed' });
    }
  }

  return checks;
};

const checkSystemResources = (): HealthCheck => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Convert bytes to MB
    const memoryInMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024) };

    // Simple health check based on heap usage
    const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (heapUsagePercent > 90) status = 'unhealthy';
    else if (heapUsagePercent > 75) status = 'degraded';

    return {
      service: 'system',
      status,
      details: {
        memory: memoryInMB,
        heapUsagePercent: Math.round(heapUsagePercent),
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system },
      },
    };
  } catch (error) {
    return {
      service: 'system',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'System resource check failed' };
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<HealthResponse>) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: 'unknown',
      checks: [],
      summary: { total: 0, healthy: 0, unhealthy: 1, degraded: 0  }
    });
  }

  const startTime = Date.now();

  try {
    // Run all health checks in parallel
    const [databaseCheck, redisCheck, systemCheck, ...apiChecks] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkSystemResources(),
      ...(await checkExternalAPIs()),
    ]);

    const allChecks = [databaseCheck, redisCheck, systemCheck, ...apiChecks];

    // Calculate summary
    const summary = {
      total: allChecks.length,
      healthy: allChecks.filter(check => check.status === 'healthy').length,
      unhealthy: allChecks.filter(check => check.status === 'unhealthy').length,
      degraded: allChecks.filter(check => check.status === 'degraded').length };

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (summary.unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    }

    const response: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: allChecks,
      summary,
    };

    // Log health check results
    loggers.general.info('Health check completed', {
      status: overallStatus,
      duration: Date.now() - startTime,
      summary,
    });

    // Set appropriate HTTP status code
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json(response);
  } catch (error) {
    loggers.general.error('Health check failed', error);

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: [
        {
          service: 'health-check',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Health check execution failed' },
      ],
      summary: { total: 1, healthy: 0, unhealthy: 1, degraded: 0  }
    });
  }
}
