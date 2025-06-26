import { NextApiRequest, NextApiResponse } from 'next';

/**
 * @swagger
 * /api/health/live:
 *   get:
 *     summary: Liveness probe
 *     description: Basic liveness check for container orchestration (Kubernetes, Docker). This endpoint confirms the application process is running and responsive.
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 alive:
 *                   type: boolean
 *                   example: true
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Process uptime in seconds
 *                 pid:
 *                   type: number
 *                   description: Process ID
 *       405:
 *         description: Method not allowed
 */

interface LivenessResponse {
  alive: boolean;
  timestamp: string;
  uptime: number;
  pid: number;
}

// Simple liveness check - just confirms the process is running
export default function handler(req: NextApiRequest, res: NextApiResponse<LivenessResponse>) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      alive: false,
      timestamp: new Date().toISOString(),
      uptime: 0,
      pid: 0 });
  }

  const response: LivenessResponse = {
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid };

  res.status(200).json(response);
}
