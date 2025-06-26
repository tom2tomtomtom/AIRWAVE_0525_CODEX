import { NextApiRequest, NextApiResponse } from 'next';
import { loggers } from '@/lib/logger';

/**
 * @swagger
 * /api/health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Readiness check for container orchestration. Verifies the application is ready to serve traffic by checking critical dependencies.
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ready:
 *                   type: boolean
 *                   example: true
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 checks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       service:
 *                         type: string
 *                       ready:
 *                         type: boolean
 *                       error:
 *                         type: string
 *       503:
 *         description: Service not ready
 *       405:
 *         description: Method not allowed
 */

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
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReadinessResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      ready: false,
      timestamp: new Date().toISOString(),
      checks: [{ service: 'http', ready: false, error: 'Method not allowed' }] });
  }

  const checks: ReadinessCheck[] = [];

  try {
    // Check basic environment variables
    const hasBasicConfig = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NODE_ENV);
    checks.push({
      service: 'configuration',
      ready: hasBasicConfig,
      error: hasBasicConfig ? undefined : 'Basic environment configuration missing' });

    // Check database connectivity
    try {
      const { createServiceClient } = await import('@/lib/supabase/server-simple');
      const supabase = createServiceClient();

      const { error } = await supabase.from('profiles').select('id').limit(1);

      checks.push({
        service: 'database',
        ready: !error,
        error: error?.message });
    } catch (error) {
      checks.push({
        service: 'database',
        ready: false,
        error: error instanceof Error ? error.message : 'Database connection failed' });
    }

    // Check if required secrets are available
    const jwtSecret = process.env.JWT_SECRET;
    const nextAuthSecret = process.env.NEXTAUTH_SECRET;
    const secretsReady = !!(jwtSecret && nextAuthSecret);

    checks.push({
      service: 'secrets',
      ready: secretsReady,
      error: secretsReady ? undefined : 'Required authentication secrets missing' });

    // Check if in maintenance mode
    const maintenanceMode = process.env.MAINTENANCE_MODE === 'true';
    checks.push({
      service: 'maintenance',
      ready: !maintenanceMode,
      error: maintenanceMode ? 'Application in maintenance mode' : undefined });

    const allReady = checks.every(check => check.ready);

    const response: ReadinessResponse = {
      ready: allReady,
      timestamp: new Date().toISOString(),
      checks,
    };

    loggers.general.debug('Readiness check completed', { ready: allReady, checks });

    res.status(allReady ? 200 : 503).json(response);
  } catch (error) {
    loggers.general.error('Readiness check failed', error);

    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      checks: [
        {
          service: 'readiness-check',
          ready: false,
          error: error instanceof Error ? error.message : 'Readiness check execution failed' },
      ],
    });
  }
}
