import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

const ApprovalWorkflowSchema = z.object({
  execution_id: z.string().uuid(),
  user_id: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'comment']),
  comment: z.string().optional(),
  version: z.number().optional() });

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  const parseResult = ApprovalWorkflowSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid input', errors: parseResult.error.errors });
  }
  const { execution_id, user_id, action, comment, version } = parseResult.data;
  // Save approval action
  const { data, error } = await supabase!
    .from('approvals')
    .insert({
      execution_id,
      user_id,
      action,
      comment,
      version,
      created_at: new Date().toISOString() })
    .select()
    .single();
  if (error) {
    return res
      .status(500)
      .json({ success: false, message: 'Failed to save approval action', error: error.message });
  }
  return res.status(200).json({ success: true, approval: data });
}
