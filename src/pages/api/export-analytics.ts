import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

const ExportAnalyticsSchema = z.object({
  campaign_id: z.string().uuid(),
  user_id: z.string().uuid(),
  export_type: z.enum(['bundle', 'analytics', 'comparisons', 'insights']),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  const parseResult = ExportAnalyticsSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid input', errors: parseResult.error.errors });
  }
  const { campaign_id, user_id: _user_id, export_type } = parseResult.data;

  try {
    if (export_type === 'bundle') {
      // Gather all assets for the campaign and return download links (could be zipped in production)
      const { data: assets, error } = await supabase!
        .from('assets')
        .select('*')
        .eq('campaign_id', campaign_id);
      if (error) {
        return res
          .status(500)
          .json({ success: false, message: 'Failed to fetch assets', error: error.message });
      }
      return res.status(200).json({ success: true, assets });
    }
    if (export_type === 'analytics') {
      // Return analytics for the campaign
      const { data: analytics, error } = await supabase!
        .from('analytics')
        .select('*')
        .eq('campaign_id', campaign_id);
      if (error) {
        return res
          .status(500)
          .json({ success: false, message: 'Failed to fetch analytics', error: error.message });
      }
      return res.status(200).json({ success: true, analytics });
    }
    if (export_type === 'comparisons') {
      // Return variation comparison data
      const { data: comparisons, error } = await supabase!
        .from('analytics')
        .select('variation_id,metrics')
        .eq('campaign_id', campaign_id);
      if (error) {
        return res
          .status(500)
          .json({ success: false, message: 'Failed to fetch comparisons', error: error.message });
      }
      return res.status(200).json({ success: true, comparisons });
    }
    if (export_type === 'insights') {
      // Return insights/recommendations
      const { data: insights, error } = await supabase!
        .from('analytics')
        .select('insights')
        .eq('campaign_id', campaign_id);
      if (error) {
        return res
          .status(500)
          .json({ success: false, message: 'Failed to fetch insights', error: error.message });
      }
      return res.status(200).json({ success: true, insights });
    }
    return res.status(400).json({ success: false, message: 'Invalid export_type' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
