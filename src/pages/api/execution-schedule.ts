import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

const ExecutionScheduleSchema = z.object({
  matrix_id: z.string().uuid(),
  platform: z.enum(['meta', 'google', 'tiktok', 'linkedin', 'custom']),
  schedule_time: z.string().datetime(), // ISO string
  budget: z.number().min(0).optional(),
  user_id: z.string().uuid(),
  config: z.record(z.any()).optional(), // platform-specific config
});

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  const parseResult = ExecutionScheduleSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid input', errors: parseResult.error.errors });
  }
  const { matrix_id, platform, schedule_time, budget, user_id, config } = parseResult.data;
  // Save execution record
  const { data, error } = await supabase!
    .from('executions')
    .insert({
      matrix_id,
      platform,
      schedule_time,
      budget,
      user_id,
      config,
      status: 'scheduled',
      created_at: new Date().toISOString() })
    .select()
    .single();
  if (error) {
    return res
      .status(500)
      .json({ success: false, message: 'Failed to schedule execution', error: error.message });
  }
  return res.status(200).json({ success: true, execution: data! });
}
