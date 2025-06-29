import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '@/utils/errorUtils';
import OpenAI from 'openai';
import { env, hasOpenAI, hasElevenLabs, hasRunway } from '@/lib/env';
import { loggers } from '@/lib/logger';
import { withEnhancedSecurity, SecurityConfigs } from '@/middleware/withEnhancedSecurity';
import { withAuth } from '@/middleware/withAuth';
import { securityValidation } from '@/utils/validation-utils';
import { z } from 'zod';

export interface GenerationPrompt {
  prompt: string;
  type: 'text' | 'image' | 'video' | 'voice';
  parameters?: Record<string, any>;
  clientId: string;
}

export interface GenerationResult {
  id: string;
  type: 'text' | 'image' | 'video' | 'voice';
  content: string | string[]; // URL for media, text content for text
  prompt: string;
  dateCreated: string;
  clientId: string;
  userId: string;
}

type ResponseData = {
  success: boolean;
  message?: string;
  result?: GenerationResult;
  errors?: any[];
  warnings?: string[];
};

// Initialize OpenAI client
const openai = hasOpenAI
  ? new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    })
  : null;

// Enhanced validation schema for AI generation
const AIGenerationSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(4000, 'Prompt too long'),
  type: z.enum(['text', 'image', 'video', 'voice'], {
    errorMap: () => ({ message: 'Type must be one of: text, image, video, voice' }),
  }),
  clientId: z.string().uuid('Invalid client ID format'),
  parameters: z
    .object({
      // Text generation parameters
      tone: z.string().optional(),
      style: z.string().optional(),
      purpose: z.string().optional(),
      // Image generation parameters
      size: z.enum(['1024x1024', '1792x1024', '1024x1792']).optional(),
      quality: z.enum(['standard', 'hd']).optional(),
      enhance: z.boolean().optional(),
      // Voice generation parameters
      voice: z.string().optional(),
      language: z.string().optional(),
    })
    .optional(),
});

// Real AI generation functions
const generateText = async (
  prompt: string,
  parameters?: Record<string, any>
): Promise<string[]> => {
  if (!openai) {
    // Fallback to mock data if OpenAI not available
    return mockGenerateText(prompt);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a senior creative copywriter and content strategist. Create compelling, varied content that connects with target audiences. Generate 3 distinct variations for each request.',
        },
        {
          role: 'user',
          content: `Create content variations for: "${prompt}". ${parameters?.tone ? `Tone: ${parameters.tone}. ` : ''}${parameters?.style ? `Style: ${parameters.style}. ` : ''}${parameters?.purpose ? `Purpose: ${parameters.purpose}. ` : ''}Provide 3 distinct variations.`,
        },
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    const content = completion.choices[0]?.message?.content || '';
    // Parse the content into variations (split by numbered lists or line breaks)
    const variations = content
      .split(/\n\d+\.|\n-/)
      .filter((v: any) => v.trim())
      .slice(0, 3);
    return variations.length > 0 ? variations.map((v: any) => v.trim()) : [content];
  } catch (error: any) {
    console.error('OpenAI text generation error:', error);
    return mockGenerateText(prompt);
  }
};

// Cleaned: Mock AI generation functions removed for production
const mockGenerateText = (_prompt: string): string[] => {
  // Cleaned: was mock AI responses
  return [];
};

const mockGenerateImage = (_prompt: string): string => {
  // Cleaned: was mock AI responses
  return '';
};

const generateImage = async (prompt: string, parameters?: Record<string, any>): Promise<string> => {
  if (!openai) {
    return mockGenerateImage(prompt);
  }

  try {
    const enhancedPrompt = parameters?.enhance
      ? await enhanceImagePrompt(prompt, parameters)
      : prompt;

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: enhancedPrompt,
      size: (parameters?.size as '1024x1024' | '1792x1024' | '1024x1792') || '1024x1024',
      quality: (parameters?.quality as 'standard' | 'hd') || 'standard',
      style: (parameters?.style as 'vivid' | 'natural') || 'vivid',
      n: 1,
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) throw new Error('No image URL returned');

    return imageUrl;
  } catch (error: any) {
    console.error('DALL-E image generation error:', error);
    return mockGenerateImage(prompt);
  }
};

const enhanceImagePrompt = async (
  prompt: string,
  parameters?: Record<string, any>
): Promise<string> => {
  if (!openai) return prompt;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert DALL-E prompt engineer. Enhance prompts to be more specific, visually descriptive, and likely to produce high-quality images. Keep the core concept but add technical and artistic details.',
        },
        {
          role: 'user',
          content: `Enhance this image prompt for DALL-E 3: "${prompt}". ${parameters?.purpose ? `Purpose: ${parameters.purpose}. ` : ''}${parameters?.style ? `Artistic style: ${parameters.style}. ` : ''}Make it more specific and visually descriptive while keeping the original intent.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    return completion.choices[0]?.message?.content?.trim() || prompt;
  } catch (error: any) {
    console.error('Prompt enhancement error:', error);
    return prompt;
  }
};

const generateVideo = async (
  _prompt: string,
  _parameters?: Record<string, any>
): Promise<string> => {
  if (!hasRunway) {
    throw new Error(
      'Video generation service not configured. Please set up Runway ML integration.'
    );
  }

  try {
    // Implement Runway ML video generation
    process.env.NODE_ENV === 'development' &&
      loggers.general.error('Runway ML video generation requested');
    throw new Error('Runway ML integration not yet implemented');
  } catch (error: any) {
    console.error('Runway video generation error:', error);
    throw error;
  }
};

const generateVoice = async (
  _prompt: string,
  _parameters?: Record<string, any>
): Promise<string> => {
  if (!hasElevenLabs) {
    throw new Error(
      'Voice generation service not configured. Please set up ElevenLabs integration.'
    );
  }

  try {
    // Implement ElevenLabs voice generation
    // const _voice = parameters?.voice || 'alloy';
    // const _language = parameters?.language || 'en';

    process.env.NODE_ENV === 'development' &&
      loggers.general.error('ElevenLabs voice generation requested');
    throw new Error('ElevenLabs integration not yet implemented');
  } catch (error: any) {
    console.error('ElevenLabs voice generation error:', error);
    throw error;
  }
};

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>): Promise<void> {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Extract user ID from headers (set by withAuth middleware)
    const userId = req.headers['x-user-id'] as string;

    // Enhanced validation using Zod schema
    const validationResult = AIGenerationSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: validationResult.error.errors,
      });
    }

    const { prompt, type, parameters: _parameters, clientId } = validationResult.data;

    // Security validation on prompt
    const securityCheck = securityValidation.validateAndSanitize(prompt, {
      allowHTML: false,
      maxLength: 4000,
      checkMalicious: true,
      throwOnMalicious: false,
    });

    if (!securityCheck.isValid) {
      loggers.general.warn('Malicious content detected in AI generation prompt', {
        userId,
        type,
        prompt: prompt.substring(0, 100),
        warnings: securityCheck.warnings.join(', '),
        ip: Array.isArray(req.headers['x-forwarded-for'])
          ? req.headers['x-forwarded-for'][0]
          : req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      });

      return res.status(400).json({
        success: false,
        message: 'Prompt contains potentially harmful content',
        warnings: securityCheck.warnings,
      });
    }

    // Use sanitized prompt
    const sanitizedPrompt = securityCheck.sanitized;

    // Generate content based on type using sanitized prompt
    let content: string | string[];
    switch (type) {
      case 'text':
        content = await generateText(sanitizedPrompt, _parameters);
        break;
      case 'image':
        content = await generateImage(sanitizedPrompt, _parameters);
        break;
      case 'video':
        content = await generateVideo(sanitizedPrompt, _parameters);
        break;
      case 'voice':
        content = await generateVoice(sanitizedPrompt, _parameters);
        break;
      default:
        content = [];
    }

    // Create generation result
    const result: GenerationResult = {
      id: 'gen_' + Math.random().toString(36).substring(2, 9),
      type: type as 'text' | 'image' | 'video' | 'voice',
      content,
      prompt: sanitizedPrompt,
      dateCreated: new Date().toISOString(),
      clientId,
      userId,
    };

    // Return the result
    return res.status(200).json({
      success: true,
      result,
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error generating content:', message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Apply enhanced security with authentication and comprehensive AI protection
export default withAuth(
  withEnhancedSecurity(
    {
      ...SecurityConfigs.api,
      rateLimit: { windowMs: 15 * 60 * 1000, max: 30 }, // 30 requests per 15 minutes (balanced for AI)
      analysis: {
        ...SecurityConfigs.api.analysis,
        checkUserAgent: true,
        detectBots: true,
        logSuspiciousActivity: true,
      },
      validation: {
        body: [
          { field: 'prompt', type: 'string', required: true, minLength: 1, maxLength: 4000 },
          { field: 'type', type: 'string', required: true },
          { field: 'clientId', type: 'string', required: true },
        ],
      },
    },
    handler
  )
);
