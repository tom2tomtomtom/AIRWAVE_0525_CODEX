import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { creatomateService } from '@/services/creatomate';
import { z } from 'zod';

const VideoGenerateSchema = z.object({
  brief_id: z.string().uuid().optional(),
  matrix_id: z.string().uuid().optional(),
  campaign_id: z.string().uuid().optional(),
  template_id: z.string().uuid().optional(),
  type: z
    .enum(['standalone', 'brief_based', 'matrix_based', 'campaign_based'])
    .default('standalone'),
  video_config: z.object({
    prompt: z.string().min(10),
    style: z
      .enum(['cinematic', 'documentary', 'commercial', 'social_media', 'animation'])
      .default('commercial'),
    duration: z.number().min(5).max(60).default(15),
    resolution: z.enum(['720p', '1080p', '4K']).default('1080p'),
    platform: z
      .enum(['youtube', 'instagram', 'tiktok', 'facebook', 'linkedin', 'twitter'])
      .optional(),
    aspect_ratio: z.enum(['16:9', '9:16', '1:1', '4:5']).default('16:9'),
    quality: z.enum(['draft', 'standard', 'high']).default('standard'),
  }),
  content_elements: z
    .object({
      text_overlays: z
        .array(
          z.object({
            text: z.string(),
            position: z.enum(['top', 'center', 'bottom']).default('center'),
            style: z.string().optional(),
            duration: z.number().optional(),
          })
        )
        .optional(),
      background_music: z.boolean().default(false),
      voice_over: z
        .object({
          text: z.string(),
          voice: z.string().default('neural'),
          language: z.string().default('en'),
        })
        .optional(),
      brand_elements: z
        .object({
          logo_url: z.string().optional(),
          color_scheme: z.array(z.string()).optional(),
          font_family: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  generation_settings: z
    .object({
      variations_count: z.number().min(1).max(5).default(1),
      include_captions: z.boolean().default(false),
      auto_optimize_for_platform: z.boolean().default(true),
      save_to_assets: z.boolean().default(true),
    })
    .optional(),
});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const user = (req as any).user;

  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return handleGenerate(req, res, user);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Video Generate API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    });
  }
}

async function handleGenerate(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const validationResult = VideoGenerateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  const generateData = validationResult.data;

  // Validate context-based generation
  const context = await validateGenerationContext(generateData, user.id);
  if (!context.valid) {
    return res.status(403).json({ error: context.error });
  }

  // Check generation limits
  const limitCheck = await checkGenerationLimits(context.client_id, user.id);
  if (!limitCheck.allowed) {
    return res.status(429).json({
      error: 'Generation limit exceeded',
      details: limitCheck.details,
    });
  }

  // Enhance generation prompt with context
  const enhancedConfig = await enhanceVideoConfig(generateData, context);

  // Create generation jobs
  const jobs = await createVideoGenerationJobs(enhancedConfig, context, user.id);

  // Start video generation process
  const results = await processVideoGeneration(jobs);

  return res.json({
    message: 'Video generation initiated successfully',
    data: {
      generation_id: jobs.generation_id,
      job_count: jobs.jobs.length,
      estimated_completion: jobs.estimated_completion,
      jobs: results,
    },
  });
}

async function validateGenerationContext(generateData: any, userId: string): Promise<any> {
  let clientId: string | null = null;
  let context: any = {};

  try {
    switch (generateData.type) {
      case 'brief_based':
        if (!generateData.brief_id) {
          return { valid: false, error: 'Brief ID required for brief-based generation' };
        }

        const { data: brief } = await supabase
          .from('briefs')
          .select('*, clients(id, name)')
          .eq('id', generateData.brief_id)
          .single();

        if (!brief) {
          return { valid: false, error: 'Brief not found' };
        }

        clientId = brief.client_id;
        context = { brief, type: 'brief' };
        break;

      case 'matrix_based':
        if (!generateData.matrix_id) {
          return { valid: false, error: 'Matrix ID required for matrix-based generation' };
        }

        const { data: matrix } = await supabase
          .from('matrices')
          .select('*, campaigns(id, name, client_id, clients(id, name))')
          .eq('id', generateData.matrix_id)
          .single();

        if (!matrix) {
          return { valid: false, error: 'Matrix not found' };
        }

        clientId = matrix.campaigns.client_id;
        context = { matrix, campaign: matrix.campaigns, type: 'matrix' };
        break;

      case 'campaign_based':
        if (!generateData.campaign_id) {
          return { valid: false, error: 'Campaign ID required for campaign-based generation' };
        }

        const { data: campaign } = await supabase
          .from('campaigns')
          .select('*, clients(id, name)')
          .eq('id', generateData.campaign_id)
          .single();

        if (!campaign) {
          return { valid: false, error: 'Campaign not found' };
        }

        clientId = campaign.client_id;
        context = { campaign, type: 'campaign' };
        break;

      case 'standalone':
        // For standalone generation, use user's default client or first accessible client
        const { data: userClients } = await supabase
          .from('user_clients')
          .select('client_id, clients(id, name)')
          .eq('user_id', userId)
          .limit(1);

        if (!userClients || userClients.length === 0) {
          return { valid: false, error: 'No accessible clients found' };
        }

        const firstClient = userClients[0];
        clientId = firstClient?.client_id;
        context = { client: firstClient?.clients, type: 'standalone' };
        break;
    }

    // Verify user has access to the client
    if (clientId) {
      const { data: clientAccess } = await supabase
        .from('user_clients')
        .select('id, role')
        .eq('user_id', userId)
        .eq('client_id', clientId)
        .single();

      if (!clientAccess) {
        return { valid: false, error: 'Access denied to this client' };
      }

      context.user_role = clientAccess.role;
    }

    return { valid: true, client_id: clientId, context };
  } catch (error: any) {
    return { valid: false, error: 'Error validating generation context' };
  }
}

async function checkGenerationLimits(
  clientId: string,
  _userId: string
): Promise<{ allowed: boolean; details?: string }> {
  try {
    // Check daily generation limit
    const today = new Date().toISOString().split('T')[0];

    const { count: todayGenerations } = await supabase
      .from('video_generations')
      .select('id', { count: 'exact' })
      .eq('client_id', clientId)
      .gte('created_at', `${today}T00:00:00Z`)
      .lte('created_at', `${today}T23:59:59Z`);

    const dailyLimit = 50; // Configurable limit
    if (todayGenerations && todayGenerations >= dailyLimit) {
      return {
        allowed: false,
        details: `Daily video generation limit (${dailyLimit}) exceeded. Current: ${todayGenerations}`,
      };
    }

    // Check concurrent generation limit
    const { count: activeGenerations } = await supabase
      .from('video_generations')
      .select('id', { count: 'exact' })
      .eq('client_id', clientId)
      .in('status', ['pending', 'processing']);

    const concurrentLimit = 5; // Configurable limit
    if (activeGenerations && activeGenerations >= concurrentLimit) {
      return {
        allowed: false,
        details: `Concurrent generation limit (${concurrentLimit}) exceeded. Wait for current generations to complete.`,
      };
    }

    return { allowed: true };
  } catch (error: any) {
    console.error('Error checking generation limits:', error);
    return {
      allowed: false,
      details: 'Error checking generation limits',
    };
  }
}

async function enhanceVideoConfig(generateData: any, context: any): Promise<any> {
  const enhanced = { ...generateData };

  // Enhance prompt based on context
  let enhancedPrompt = generateData.video_config.prompt;

  if (context.context.type === 'brief' && context.context.brief) {
    const brief = context.context.brief;
    enhancedPrompt += ` Context: ${brief.name}. Brand: ${brief.clients?.name}. Brief: ${brief.description || ''}`;
  } else if (context.context.type === 'campaign' && context.context.campaign) {
    const campaign = context.context.campaign;
    enhancedPrompt += ` Context: ${campaign.name}. Brand: ${campaign.clients?.name}. Campaign: ${campaign.description || ''}`;
  } else if (context.context.type === 'matrix' && context.context.matrix) {
    const matrix = context.context.matrix;
    enhancedPrompt += ` Context: ${matrix.name}. Campaign: ${matrix.campaigns?.name}. Brand: ${matrix.campaigns?.clients?.name}`;
  }

  enhanced.video_config.prompt = enhancedPrompt;

  // Auto-optimize for platform if enabled
  if (enhanced.generation_settings?.auto_optimize_for_platform && enhanced.video_config.platform) {
    enhanced.video_config = optimizeForPlatform(
      enhanced.video_config,
      enhanced.video_config.platform
    );
  }

  // Add brand elements if available
  if (context.context.brief?.brand_guidelines || context.context.campaign?.brand_guidelines) {
    const brandGuidelines =
      context.context.brief?.brand_guidelines || context.context.campaign?.brand_guidelines;

    if (!enhanced.content_elements) enhanced.content_elements = {};
    if (!enhanced.content_elements.brand_elements) enhanced.content_elements.brand_elements = {};

    enhanced.content_elements.brand_elements = {
      ...enhanced.content_elements.brand_elements,
      color_scheme: brandGuidelines.colors || enhanced.content_elements.brand_elements.color_scheme,
      font_family:
        brandGuidelines.typography?.primary || enhanced.content_elements.brand_elements.font_family,
      logo_url: brandGuidelines.logo_url || enhanced.content_elements.brand_elements.logo_url,
    };
  }

  return enhanced;
}

async function createVideoGenerationJobs(config: any, context: any, userId: string): Promise<any> {
  const generationId = `videogen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const jobs = [];

  const variationsCount = config.generation_settings?.variations_count || 1;

  for (let i = 0; i < variationsCount; i++) {
    const jobId = `${generationId}-var-${i + 1}`;

    // Create slight variations for each job
    const variationConfig = createVariationConfig(config, i);

    const job = {
      id: jobId,
      generation_id: generationId,
      variation_index: i + 1,
      config: variationConfig,
      context: context.context,
      client_id: context.client_id,
      created_by: userId,
      status: 'pending',
      estimated_duration: calculateEstimatedDuration(variationConfig),
    };

    jobs.push(job);
  }

  const totalEstimatedDuration = jobs.reduce((sum, job) => sum + job.estimated_duration, 0);
  const estimatedCompletion = new Date(Date.now() + totalEstimatedDuration * 1000);

  return {
    generation_id: generationId,
    jobs,
    estimated_completion: estimatedCompletion.toISOString(),
    client_id: context.client_id,
    total_variations: variationsCount,
  };
}

async function processVideoGeneration(jobsData: any): Promise<any> {
  const results = [];

  for (const job of jobsData.jobs) {
    try {
      // Create generation record in database
      const { data: _generation, error } = await supabase
        .from('video_generations')
        .insert({
          id: job.id,
          generation_id: jobsData.generation_id,
          client_id: jobsData.client_id,
          brief_id: job.context.brief?.id,
          matrix_id: job.context.matrix?.id,
          campaign_id: job.context.campaign?.id,
          variation_index: job.variation_index,
          config: job.config,
          status: 'pending',
          created_by: job.created_by,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating generation record:', error);
        results.push({
          job_id: job.id,
          status: 'failed',
          error: getErrorMessage(error),
        });
        continue;
      }

      // Start video generation process
      const renderResult = await startVideoRender(job);

      // Update generation record with render info
      await supabase
        .from('video_generations')
        .update({
          status: renderResult.success ? 'processing' : 'failed',
          render_job_id: renderResult.job_id,
          metadata: {
            ...job.config,
            render_started_at: new Date().toISOString(),
            estimated_completion: renderResult.estimated_completion,
          },
        })
        .eq('id', job.id);

      results.push({
        job_id: job.id,
        status: renderResult.success ? 'processing' : 'failed',
        render_job_id: renderResult.job_id,
        estimated_completion: renderResult.estimated_completion,
      });
    } catch (error: any) {
      const message = getErrorMessage(error);
      console.error('Error processing video generation job:', error);
      results.push({
        job_id: job.id,
        status: 'failed',
        error: message,
      });
    }
  }

  return {
    total_jobs: jobsData.jobs.length,
    successful: results.filter((r: any) => r.status === 'processing').length,
    failed: results.filter((r: any) => r.status === 'failed').length,
    results,
  };
}

function optimizeForPlatform(videoConfig: any, platform: string): any {
  const optimized = { ...videoConfig };

  switch (platform) {
    case 'youtube':
      optimized.aspect_ratio = '16:9';
      optimized.duration = Math.max(optimized.duration, 30); // Minimum 30s for YouTube
      optimized.resolution = '1080p';
      break;
    case 'instagram':
      optimized.aspect_ratio = '1:1';
      optimized.duration = Math.min(optimized.duration, 60); // Max 60s for feed posts
      break;
    case 'tiktok':
      optimized.aspect_ratio = '9:16';
      optimized.duration = Math.min(optimized.duration, 60); // Max 60s for TikTok
      optimized.style = 'social_media';
      break;
    case 'facebook':
      optimized.aspect_ratio = '16:9';
      optimized.duration = Math.min(optimized.duration, 240); // Max 4 minutes
      break;
    case 'linkedin':
      optimized.aspect_ratio = '16:9';
      optimized.duration = Math.min(optimized.duration, 30); // Keep short for LinkedIn
      optimized.style = 'documentary'; // Professional style
      break;
    case 'twitter':
      optimized.aspect_ratio = '16:9';
      optimized.duration = Math.min(optimized.duration, 140); // Max 2:20
      break;
  }

  return optimized;
}

function createVariationConfig(baseConfig: any, variationIndex: number): any {
  const variation = { ...baseConfig };

  // Create variations in the prompt
  if (variationIndex > 0) {
    const variations = [
      ', with dynamic transitions',
      ', with subtle animations',
      ', with modern aesthetics',
      ', with vibrant colors',
      ', with minimalist design',
    ];

    const variationText = variations[variationIndex % variations.length];
    variation.video_config.prompt += variationText;
  }

  // Vary style slightly
  if (variationIndex > 0 && variation.video_config.style === 'commercial') {
    const styleVariations = ['cinematic', 'documentary', 'commercial'];
    variation.video_config.style = styleVariations[variationIndex % styleVariations.length];
  }

  return variation;
}

function calculateEstimatedDuration(config: any): number {
  // Base duration in seconds
  let duration = 120; // 2 minutes base

  // Add time based on video length
  duration += config.video_config.duration * 2; // 2 seconds per video second

  // Add time based on quality
  if (config.video_config.quality === 'high') {
    duration += 60;
  } else if (config.video_config.quality === 'draft') {
    duration -= 30;
  }

  // Add time for complex elements
  if (config.content_elements?.voice_over) {
    duration += 30;
  }

  if (config.content_elements?.text_overlays?.length > 0) {
    duration += config.content_elements.text_overlays.length * 10;
  }

  return Math.max(60, duration); // Minimum 1 minute
}

async function startVideoRender(job: any): Promise<any> {
  try {
    // Convert config to Creatomate format
    const renderOptions = convertToCreatomateFormat(job);

    // Start render using Creatomate service
    const render = await creatomateService.renderVideo(renderOptions);

    return {
      success: true,
      job_id: render.id,
      estimated_completion: new Date(Date.now() + job.estimated_duration * 1000).toISOString(),
    };
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error starting video render:', error);
    return {
      success: false,
      error: message,
    };
  }
}

function convertToCreatomateFormat(job: any): any {
  const config = job.config.video_config;
  const content = job.config.content_elements || {};

  // Select appropriate template based on config
  const templateId = selectCreatomateTemplate(config);

  const modifications: any = {};

  // Add text overlays
  if (content.text_overlays) {
    content.text_overlays.forEach((overlay: any, index: number) => {
      modifications[`text_${index + 1}`] = {
        text: overlay.text,
        position: overlay.position,
        duration: overlay.duration || config.duration,
      };
    });
  }

  // Add voice over
  if (content.voice_over) {
    modifications.voice_over = {
      text: content.voice_over.text,
      voice: content.voice_over.voice,
      language: content.voice_over.language,
    };
  }

  // Add brand elements
  if (content.brand_elements) {
    if (content.brand_elements.logo_url) {
      modifications.logo = {
        source: content.brand_elements.logo_url,
      };
    }

    if (content.brand_elements.color_scheme) {
      modifications.primary_color = content.brand_elements.color_scheme[0];
      if (content.brand_elements.color_scheme[1]) {
        modifications.secondary_color = content.brand_elements.color_scheme[1];
      }
    }
  }

  return {
    templateId,
    modifications,
    webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/creatomate`,
    metadata: {
      job_id: job.id,
      generation_id: job.generation_id,
      client_id: job.client_id,
      variation_index: job.variation_index,
    },
  };
}

function selectCreatomateTemplate(config: any): string {
  // Template selection logic based on config
  const templateMap: Record<string, string> = {
    'youtube_16:9': 'template-3', // YouTube template
    'instagram_1:1': 'template-2', // Square template
    'tiktok_9:16': 'template-4', // Vertical template
    'facebook_16:9': 'template-2', // Horizontal template
    'linkedin_16:9': 'template-5', // Professional template
    default: 'template-1', // Default template
  };

  const key = config.platform ? `${config.platform}_${config.aspect_ratio}` : 'default';
  return templateMap[key] || templateMap.default || 'template-1';
}

export default withAuth(withSecurityHeaders(handler));
