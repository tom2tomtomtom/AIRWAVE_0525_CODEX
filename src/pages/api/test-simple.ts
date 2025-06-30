import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    success: true,
    message: 'API route is working!',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
  });
}
