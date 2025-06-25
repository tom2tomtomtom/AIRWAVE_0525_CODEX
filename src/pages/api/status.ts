import type { NextApiRequest, NextApiResponse } from 'next';

interface StatusResponse {
  status: 'ok';
  timestamp: string;
}

export default function handler(_req: NextApiRequest, res: NextApiResponse<StatusResponse>): void {
  // Simple status check - always returns OK if the server is running
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString() });
}
