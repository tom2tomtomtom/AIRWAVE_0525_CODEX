import { NextApiRequest, NextApiResponse } from 'next';

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
      pid: 0
    });
  }
  
  const response: LivenessResponse = {
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid
  };
  
  res.status(200).json(response);
}