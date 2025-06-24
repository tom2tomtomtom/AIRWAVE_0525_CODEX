/**
 * @swagger
 * /api/workflow/generate-assets:
 *   post:
 *     summary: Generate AI assets for workflow
 *     description: Generate AI images based on brief data and motivations for workflow use
 *     tags: [Workflow, AI]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workflowId
 *               - prompts
 *             properties:
 *               workflowId:
 *                 type: string
 *                 description: Workflow session ID
 *               prompts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     text:
 *                       type: string
 *                     purpose:
 *                       type: string
 *                     size:
 *                       type: string
 *                 description: Array of prompts to generate images for
 *               clientId:
 *                 type: string
 *                 description: Client ID for the workflow
 *               briefData:
 *                 type: object
 *                 description: Brief data for context
 *     responses:
 *       200:
 *         description: Assets generated successfully
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withAPIRateLimit } from '@/lib/rate-limiter';
import { successResponse, errorResponse, handleApiError, methodNotAllowed, validateRequiredFields, ApiErrorCode } from '@/lib/api-response';
// Simple AICostController stub
class AICostController {
  static getInstance() {
    return new AICostController();
  }

  async checkBudget(service: string, model: string, tokens: number, userId: string) : Promise<void> {
    return { allowed: true, budgetRemaining: 1000, reason: 'Budget check passed' };
  }

  async trackUsage(service: string, model: string, tokens: number, cost: number, userId: string, metadata: any) : Promise<void> {
    console.log(`Tracked usage: ${service}/${model} - ${tokens} tokens, $${cost}`, metadata);
  }
}

interface GenerateAssetsRequest {
  workflowId: string;
  prompts: Array<{
    text: string;
    purpose?: string;
    size?: string;
    quality?: string;
    style?: string;
  }>;
  clientId?: string;
  briefData?: any;
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const user = (req as any).user;

  try {
    switch (req.method) {
      case 'POST':
        return await generateWorkflowAssets(req, res, user);
      default:
        return methodNotAllowed(res, ['POST']);
    }
  } catch (error: any) {
    return handleApiError(res, error, 'workflow generate assets handler');
  }
}

async function generateWorkflowAssets(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any
): Promise<void> {
  try {
    const userId = user?.id;
    if (!userId) {
      return errorResponse(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { workflowId, prompts, clientId, briefData }: GenerateAssetsRequest = req.body;

    // Validate required fields
    const missingFields = validateRequiredFields(req.body, ['workflowId', 'prompts']);
    if (missingFields.length > 0) {
      return errorResponse(
        res,
        ApiErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${missingFields.join(', ')}`,
        400
      );
    }

    if (!Array.isArray(prompts) || prompts.length === 0) {
      return errorResponse(res, ApiErrorCode.VALIDATION_ERROR, 'Prompts must be a non-empty array', 400);
    }

    // Verify workflow exists
    const { data: workflow, error: workflowError } = await supabase
      .from('workflow_sessions')
      .select('id, client_id')
      .eq('id', workflowId)
      .eq('user_id', userId)
      .single();

    if (workflowError || !workflow) {
      return errorResponse(res, ApiErrorCode.NOT_FOUND, 'Workflow session not found', 404);
    }

    const costController = AICostController.getInstance();
    const generatedAssets = [];
    const errors = [];

    // Process each prompt
    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      
      try {
        // Check AI cost budget
        const costCheck = await costController.checkBudget(
          'openai',
          'dall-e-3',
          1000, // Estimated tokens for image generation
          userId
        );

        if (!costCheck.allowed) {
          errors.push({
            prompt: prompt.text,
            error: costCheck.reason || 'Budget exceeded'
          });
          continue;
        }

        // Enhanced prompt based on brief data
        let enhancedPrompt = prompt.text;
        if (briefData) {
          const context = [];
          if (briefData.targetAudience) context.push(`for ${briefData.targetAudience}`);
          if (briefData.industry) context.push(`in ${briefData.industry} industry`);
          if (briefData.brandGuidelines) context.push('following brand guidelines');
          
          if (context.length > 0) {
            enhancedPrompt = `${prompt.text}, ${context.join(', ')}, professional quality`;
          }
        }

        // Call DALL-E API (simplified - in real implementation, this would call the actual API)
        const imageData = await generateImage({
          prompt: enhancedPrompt,
          size: prompt.size || '1024x1024',
          quality: prompt.quality || 'standard',
          style: prompt.style || 'vivid',
          purpose: prompt.purpose || 'general'
        });

        // Create asset record
        const assetData = {
          name: `AI Generated - ${prompt.purpose || 'Image'} ${i + 1}`,
          type: 'image',
          file_url: imageData.url,
          thumbnail_url: imageData.url, // For demo, same as main URL
          description: `Generated from prompt: ${prompt.text}`,
          tags: ['ai-generated', prompt.purpose || 'general', 'workflow'],
          client_id: clientId || workflow.client_id,
          created_by: userId,
          metadata: {},
        ai_generated: true,
            original_prompt: prompt.text,
            enhanced_prompt: enhancedPrompt,
            generation_settings: {},
  size: prompt.size || '1024x1024',
              quality: prompt.quality || 'standard',
              style: prompt.style || 'vivid' },
  workflow_id: workflowId,
            brief_context: briefData ? {
              title: briefData.title,
              targetAudience: briefData.targetAudience,
              industry: briefData.industry
            } : null
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: asset, error: assetError } = await supabase
          .from('assets')
          .insert(assetData)
          .select(`
            id,
            name,
            type,
            file_url,
            thumbnail_url,
            description,
            tags,
            metadata,
            created_at
          `)
          .single();

        if (assetError) {
          errors.push({
            prompt: prompt.text,
            error: 'Failed to save asset to database'
          });
          continue;
        }

        // Track AI cost
        await costController.trackUsage(
          'openai',
          'dall-e-3',
          1000, // Estimated tokens
          0.04, // Estimated cost for DALL-E 3
          userId,
          {
            operation: 'image_generation',
            prompt: prompt.text,
            workflow_id: workflowId
          }
        );

        generatedAssets.push({
          id: asset.id,
          type: 'image',
          url: asset.file_url,
          metadata: {},
        ...asset.metadata,
            name: asset.name,
            description: asset.description,
            tags: asset.tags,
            thumbnailUrl: asset.thumbnail_url,
            dateCreated: asset.created_at,
            aiGenerated: true },
  selected: false
        });

      } catch (error: any) {
        console.error(`Error generating asset for prompt ${i}:`, error);
        errors.push({
          prompt: prompt.text,
          error: 'Failed to generate image'
        });
      }
    }

    return successResponse(res, {
      generatedAssets,
      errors,
      totalGenerated: generatedAssets.length,
      totalErrors: errors.length
    }, 200, {
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    return handleApiError(res, error, 'generateWorkflowAssets');
  }
}

// Mock image generation function - replace with actual DALL-E API call
async function generateImage(params: {},
  prompt: string;
  size: string;
  quality: string;
  style: string;
  purpose: string;
}): Promise<{ url: string; revised_prompt?: string }> {
  // In demo mode, return placeholder
  const isDemoMode = !process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  
  if (isDemoMode) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Return demo image URL
    const colors = ['4CAF50', '2196F3', 'FF9800', '9C27B0', 'F44336'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const [width, height] = params.size.split('x');
    
    return {
      url: `https://via.placeholder.com/${width}x${height}/${color}/white?text=AI+Generated`,
      revised_prompt: `[DEMO] ${params.prompt}`
    };
  }

  // TODO: Implement actual DALL-E API call
  throw new Error('DALL-E API integration not implemented');
}

export default withAuth(withAPIRateLimit(handler));
