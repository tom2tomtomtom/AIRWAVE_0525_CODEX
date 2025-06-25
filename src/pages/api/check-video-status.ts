import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '@/utils/errorUtils';
import { supabase } from '@/lib/supabase';
import { hasCreatomate } from '@/lib/env';
import { creatomateService } from '@/services/creatomate';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }

  const { job_id, asset_id } = req.query;

  if (!job_id && !asset_id) {
    return res.status(400).json({
      success: false,
      message: 'Must provide either job_id or asset_id',
    });
  }

  try {
    let jobId = job_id as string;

    // If only asset_id provided, get job_id from asset metadata
    if (!jobId && asset_id) {
      const { data: asset, error } = await supabase
        .from('assets')
        .select('metadata')
        .eq('id', asset_id)
        .single();

      if (error || !asset?.metadata?.generation_job_id) {
        return res.status(404).json({
          success: false,
          message: 'Asset not found or no generation job associated',
        });
      }

      jobId = asset.metadata.generation_job_id;
    }

    // Check render status from Creatomate
    if (!hasCreatomate) {
      return res.status(503).json({
        success: false,
        message: 'Video generation service not available',
      });
    }

    const job = await creatomateService.getRenderStatus(jobId);

    // Get asset details if we have asset_id
    let asset = null;
    if (asset_id) {
      const { data } = await supabase.from('assets').select('*').eq('id', asset_id).single();
      asset = data;
    }

    return res.status(200).json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress: (job as any).progress || 0,
        created_at: job.created_at,
        completed_at: job.completed_at,
        url: job.url,
        error: job.error,
      },
      asset,
      message: getStatusMessage(job.status, (job as any).progress),
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Status check error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: 'Render job not found',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to check video status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function getStatusMessage(status: string, progress?: number): string {
  switch (status) {
    case 'pending':
      return 'Your video is queued for generation...';
    case 'rendering':
      return `Generating your video... ${progress || 0}% complete`;
    case 'completed':
      return 'Your video is ready!';
    case 'failed':
      return 'Video generation failed. Please try again.';
    default:
      return 'Checking status...';
  }
}
