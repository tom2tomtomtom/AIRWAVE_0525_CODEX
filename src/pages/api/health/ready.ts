import { NextApiRequest, NextApiResponse } from 'next';
import { getConfig } from '@/lib/config';
import { loggers } from '@/lib/logger';

interface ReadinessCheck {
  service: string;
  ready: boolean;
  error?: string;
}

interface ReadinessResponse {
  ready: boolean;
  timestamp: string;
  checks: ReadinessCheck[];
}

// Check if the application is ready to serve traffic
export default async function handler(req: NextApiRequest, res: NextApiResponse<ReadinessResponse>) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      ready: false,
      timestamp: new Date().toISOString(),
      checks: [{ service: 'http', ready: false, error: 'Method not allowed' }]
    });
  }
  
  const checks: ReadinessCheck[] = [];
  
  try {
    const config = getConfig();
    
    // Check environment configuration
    checks.push({
      service: 'configuration',
      ready: true
    });
    
    // Check database connectivity
    try {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = createClient();
      
      const { error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
      
      checks.push({
        service: 'database',
        ready: !error,
        error: error?.message
      });
    } catch (error) {
      checks.push({
        service: 'database',
        ready: false,
        error: error instanceof Error ? error.message : 'Database connection failed'
      });
    }
    
    // Check if required secrets are available
    const requiredSecrets = ['JWT_SECRET', 'NEXTAUTH_SECRET'];
    const secretsReady = requiredSecrets.every(secret => config[secret as keyof typeof config]);
    
    checks.push({
      service: 'secrets',
      ready: secretsReady,
      error: secretsReady ? undefined : 'Required secrets missing'
    });
    
    // Check if in maintenance mode
    checks.push({
      service: 'maintenance',
      ready: !config.MAINTENANCE_MODE,
      error: config.MAINTENANCE_MODE ? 'Application in maintenance mode' : undefined
    });
    
    const allReady = checks.every(check => check.ready);
    
    const response: ReadinessResponse = {
      ready: allReady,
      timestamp: new Date().toISOString(),
      checks
    };
    
    loggers.general.debug('Readiness check completed', { ready: allReady, checks });
    
    res.status(allReady ? 200 : 503).json(response);
    
  } catch (error) {
    loggers.general.error('Readiness check failed', error);
    
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      checks: [{
        service: 'readiness-check',
        ready: false,
        error: error instanceof Error ? error.message : 'Readiness check execution failed'
      }]
    });
  }
}