import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const envCheck = {
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasSupabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasCreatomate: !!process.env.CREATOMATE_API_KEY,
    hasElevenlabs: !!process.env.ELEVENLABS_API_KEY,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  };

  res.status(200).json({
    status: 'healthy',
    message: 'Simple health check API is working!',
    environment: envCheck,
  });
}
