import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

const MotivationSelectSchema = z.object({
  strategy_id: z.string().uuid(),
  selected: z.array(z.number()), // indices of selected motivations
  custom: z.array(z.string()).optional(),
  user_id: z.string().uuid() });

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  const parseResult = MotivationSelectSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid input', errors: parseResult.error.errors });
  }
  const { strategy_id, selected, custom = [], user_id } = parseResult.data;
  // Save selected motivations and any custom ones
  const { data, error } = await supabase!
    .from('selected_motivations')
    .insert({
      strategy_id,
      selected,
      custom,
      user_id,
      created_at: new Date().toISOString() })
    .select()
    .single();
  if (error) {
    return res
      .status(500)
      .json({ success: false, message: 'Failed to save selection', error: error.message });
  }
  return res.status(200).json({ success: true, selection: data! });
}
