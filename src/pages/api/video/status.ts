import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { creatomateService } from '@/services/creatomate';

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const user = (req as any).user;

  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { generation_id, job_id } = req.query;

  if (!generation_id && !job_id) {
    return res.status(400).json({
      error: 'Either generation_id or job_id is required',
    });
  }

  try {
    if (generation_id) {
      return await handleGenerationStatus(req, res, user, generation_id as string);
    } else {
      return await handleJobStatus(req, res, user, job_id as string);
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Video Status API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    });
  }
}

async function handleGenerationStatus(
  _req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  generationId: string
): Promise<void> {
  // Get all jobs for this generation
  const { data: generations, error } = await supabase
    .from('video_generations')
    .select(
      `
      *,
      briefs(id, name, clients(id, name)),
      campaigns(id, name, clients(id, name)),
      matrices(id, name, campaigns(id, name, clients(id, name)))
    `
    )
    .eq('generation_id', generationId)
    .order('variation_index');

  if (error || !generations || generations.length === 0) {
    return res.status(404).json({ error: 'Generation not found' });
  }

  // Verify user has access to this generation
  const clientId = generations[0].client_id;
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this generation' });
  }

  // Update status for each job
  const updatedJobs = await Promise.all(
    generations.map(async generation => {
      if (generation.status === 'processing' && generation.render_job_id) {
        try {
          // Check status with Creatomate
          const renderStatus = await creatomateService.getRenderStatus(generation.render_job_id);

          // Update database if status changed
          if (renderStatus.status !== generation.status) {
            const updateData: any = {
              status: renderStatus.status,
              updated_at: new Date().toISOString(),
            };

            if (renderStatus.status === 'succeeded' && renderStatus.url) {
              updateData.output_url = renderStatus.url;
              updateData.metadata = {
                ...generation.metadata,
                completed_at: renderStatus.completed_at,
                render_url: renderStatus.url,
              };

              // Save to assets if configured
              if (generation.config?.generation_settings?.save_to_assets) {
                await saveVideoToAssets(generation, renderStatus.url);
              }
            } else if (renderStatus.status === 'failed') {
              updateData.error_message = renderStatus.error;
              updateData.metadata = {
                ...generation.metadata,
                failed_at: new Date().toISOString(),
                error: renderStatus.error,
              };
            }

            const { error: updateError } = await supabase
              .from('video_generations')
              .update(updateData)
              .eq('id', generation.id);

            if (!updateError) {
              return { ...generation, ...updateData };
            }
          }
        } catch (error: any) {
          console.error('Error updating generation status:', error);
        }
      }

      return generation;
    })
  );

  // Calculate overall progress
  const overallProgress = calculateOverallProgress(updatedJobs);

  return res.json({
    data: {
      generation_id: generationId,
      total_jobs: updatedJobs.length,
      progress: overallProgress,
      jobs: updatedJobs.map((job: any) => ({
        id: job.id,
        variation_index: job.variation_index,
        status: job.status,
        progress: getJobProgress(job),
        output_url: job.output_url,
        error_message: job.error_message,
        created_at: job.created_at,
        updated_at: job.updated_at,
        config: job.config,
      })),
      context: getGenerationContext(updatedJobs[0]),
      estimated_completion: getEstimatedCompletion(updatedJobs),
    },
  });
}

async function handleJobStatus(
  _req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  jobId: string
): Promise<void> {
  // Get specific job
  const { data: generation, error } = await supabase
    .from('video_generations')
    .select(
      `
      *,
      briefs(id, name, clients(id, name)),
      campaigns(id, name, clients(id, name)),
      matrices(id, name, campaigns(id, name, clients(id, name)))
    `
    )
    .eq('id', jobId)
    .single();

  if (error || !generation) {
    return res.status(404).json({ error: 'Video generation job not found' });
  }

  // Verify user has access
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', generation.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this generation job' });
  }

  // Update status if still processing
  let updatedGeneration = generation;
  if (generation.status === 'processing' && generation.render_job_id) {
    try {
      const renderStatus = await creatomateService.getRenderStatus(generation.render_job_id);

      if (renderStatus.status !== generation.status) {
        const updateData: any = {
          status: renderStatus.status,
          updated_at: new Date().toISOString(),
        };

        if (renderStatus.status === 'succeeded' && renderStatus.url) {
          updateData.output_url = renderStatus.url;
          updateData.metadata = {
            ...generation.metadata,
            completed_at: renderStatus.completed_at,
            render_url: renderStatus.url,
          };

          // Save to assets if configured
          if (generation.config?.generation_settings?.save_to_assets) {
            const assetId = await saveVideoToAssets(generation, renderStatus.url);
            updateData.asset_id = assetId;
          }
        } else if (renderStatus.status === 'failed') {
          updateData.error_message = renderStatus.error;
        }

        const { data: updated, error: updateError } = await supabase
          .from('video_generations')
          .update(updateData)
          .eq('id', jobId)
          .select()
          .single();

        if (!updateError && updated) {
          updatedGeneration = updated;
        }
      }
    } catch (error: any) {
      console.error('Error updating job status:', error);
    }
  }

  return res.json({
    data: {
      id: updatedGeneration.id,
      generation_id: updatedGeneration.generation_id,
      variation_index: updatedGeneration.variation_index,
      status: updatedGeneration.status,
      progress: getJobProgress(updatedGeneration),
      output_url: updatedGeneration.output_url,
      asset_id: updatedGeneration.asset_id,
      error_message: updatedGeneration.error_message,
      render_job_id: updatedGeneration.render_job_id,
      config: updatedGeneration.config,
      context: getGenerationContext(updatedGeneration),
      created_at: updatedGeneration.created_at,
      updated_at: updatedGeneration.updated_at,
      estimated_completion: getJobEstimatedCompletion(updatedGeneration),
    },
  });
}

async function saveVideoToAssets(generation: any, videoUrl: string): Promise<string | null> {
  try {
    // Download video and upload to storage
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error('Failed to download video');
    }

    const videoBuffer = Buffer.from(await response.arrayBuffer());
    const filename = `generated-video-${generation.id}-${Date.now()}.mp4`;

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('assets')
      .upload(`${generation.client_id}/videos/${filename}`, videoBuffer, {
        contentType: 'video/mp4',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading video to storage:', uploadError);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('assets').getPublicUrl(uploadData.path);

    // Create asset record
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .insert({
        client_id: generation.client_id,
        name: `Generated Video - Variation ${generation.variation_index}`,
        type: 'video',
        file_path: uploadData.path,
        file_url: urlData.publicUrl,
        file_size: videoBuffer.length,
        metadata: {
          generation_id: generation.generation_id,
          job_id: generation.id,
          render_job_id: generation.render_job_id,
          config: generation.config,
          source: 'ai_generated',
          duration: generation.config?.video_config?.duration,
          resolution: generation.config?.video_config?.resolution,
          style: generation.config?.video_config?.style,
          platform: generation.config?.video_config?.platform,
        },
        created_by: generation.created_by,
      })
      .select()
      .single();

    if (assetError) {
      console.error('Error creating asset record:', assetError);
      return null;
    }

    return asset.id;
  } catch (error: any) {
    console.error('Error saving video to assets:', error);
    return null;
  }
}

function calculateOverallProgress(jobs: any[]): any {
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((job: any) => job.status === 'completed').length;
  const failedJobs = jobs.filter((job: any) => job.status === 'failed').length;
  const processingJobs = jobs.filter((job: any) => job.status === 'processing').length;
  const pendingJobs = jobs.filter((job: any) => job.status === 'pending').length;

  const overallPercentage = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

  let status = 'pending';
  if (completedJobs === totalJobs) {
    status = 'completed';
  } else if (failedJobs === totalJobs) {
    status = 'failed';
  } else if (processingJobs > 0 || (completedJobs > 0 && completedJobs < totalJobs)) {
    status = 'processing';
  }

  return {
    status,
    percentage: overallPercentage,
    completed: completedJobs,
    failed: failedJobs,
    processing: processingJobs,
    pending: pendingJobs,
    total: totalJobs,
  };
}

function getJobProgress(job: any): any {
  let percentage = 0;
  let message = 'Queued for generation';

  switch (job.status) {
    case 'pending':
      percentage = 5;
      message = 'Queued for generation';
      break;
    case 'processing':
      percentage = 50; // Could be enhanced with actual render progress
      message = 'Generating video...';
      break;
    case 'completed':
      percentage = 100;
      message = 'Video generated successfully';
      break;
    case 'failed':
      percentage = 0;
      message = job.error_message || 'Video generation failed';
      break;
  }

  return {
    percentage,
    message,
    status: job.status,
  };
}

function getGenerationContext(generation: any): any {
  const context: any = {
    client_id: generation.client_id,
    type: 'standalone',
  };

  if (generation.briefs) {
    context.type = 'brief';
    context.brief = {
      id: generation.brief_id,
      name: generation.briefs.name,
      client: generation.briefs.clients,
    };
  } else if (generation.matrices) {
    context.type = 'matrix';
    context.matrix = {
      id: generation.matrix_id,
      name: generation.matrices.name,
      campaign: generation.matrices.campaigns,
    };
  } else if (generation.campaigns) {
    context.type = 'campaign';
    context.campaign = {
      id: generation.campaign_id,
      name: generation.campaigns.name,
      client: generation.campaigns.clients,
    };
  }

  return context;
}

function getEstimatedCompletion(jobs: any[]): string | null {
  const processingJobs = jobs.filter((job: any) => job.status === 'processing');
  const pendingJobs = jobs.filter((job: any) => job.status === 'pending');

  if (processingJobs.length === 0 && pendingJobs.length === 0) {
    return null; // All jobs are completed or failed
  }

  // Estimate remaining time based on average processing time
  const avgProcessingTime = 120; // 2 minutes average
  const remainingJobs = processingJobs.length + pendingJobs.length;
  const estimatedSeconds = remainingJobs * avgProcessingTime;

  return new Date(Date.now() + estimatedSeconds * 1000).toISOString();
}

function getJobEstimatedCompletion(job: any): string | null {
  if (['completed', 'failed'].includes(job.status)) {
    return null;
  }

  const createdAt = new Date(job.created_at).getTime();
  const now = Date.now();
  const elapsed = (now - createdAt) / 1000; // seconds

  const estimatedTotal = job.metadata?.estimated_duration || 120; // 2 minutes default
  const remaining = Math.max(0, estimatedTotal - elapsed);

  return new Date(now + remaining * 1000).toISOString();
}

export default withAuth(withSecurityHeaders(handler));
