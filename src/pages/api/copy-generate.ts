import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { z } from 'zod';
import OpenAI from 'openai';

const CopyGenerateSchema = z.object({
  client_id: z.string().uuid(),
  motivation_ids: z.array(z.string().uuid()),
  platforms: z.array(z.string()),
  tone: z.string().optional(),
  style: z.string().optional(),
  variations_per_platform: z.number().min(1).max(10).default(3),
  target_audience: z.string().optional(),
  campaign_objectives: z.string().optional(),
  brand_guidelines: z.string().optional()});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = (req as any).user;
  const validationResult = CopyGenerateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Invalid input',
      details: validationResult.error.issues
    });
  }

  const { 
    client_id, 
    motivation_ids, 
    platforms, 
    tone = 'professional', 
    style = 'engaging',
    variations_per_platform,
    target_audience,
    campaign_objectives,
    brand_guidelines
  } = validationResult.data;

  try {
    // Verify user has access to the client
    const { data: clientAccess } = await supabase
      .from('user_clients')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', client_id)
      .single();

    if (!clientAccess) {
      return res.status(403).json({ error: 'Access denied to this client' });
    }

    // Get selected motivations
    const { data: motivations, error: motivationsError } = await supabase
      .from('motivations')
      .select('*')
      .in('id', motivation_ids)
      .eq('client_id', client_id);

    if (motivationsError || !motivations || motivations.length === 0) {
      return res.status(400).json({ error: 'No valid motivations found' });
    }

    // Platform-specific requirements
    const platformSpecs: Record<string, { maxLength: number; format: string }> = {
      'Instagram': { maxLength: 2200, format: 'Social media post with hashtags'  }
      'Facebook': { maxLength: 63206, format: 'Engaging social media post'  }
      'LinkedIn': { maxLength: 3000, format: 'Professional social media post'  }
      'TikTok': { maxLength: 2200, format: 'Short, catchy video description' },
      'YouTube': { maxLength: 5000, format: 'Video description with call-to-action'  }
      'Twitter': { maxLength: 280, format: 'Concise tweet'  }
      'Email': { maxLength: 1000, format: 'Email subject and body'  }
      'Website': { maxLength: 500, format: 'Website copy with headline' }};

    const createdCopyAssets = [];

    // Generate copy for each platform
    for (const platform of platforms) {
      const platformSpec = platformSpecs[platform] || { maxLength: 1000, format: 'General copy' };
      
      const systemPrompt = `You are an expert copywriter specializing in ${platform} content. Create compelling, conversion-focused copy that drives action.

Guidelines:
- Maximum length: ${platformSpec.maxLength} characters
- Format: ${platformSpec.format}
- Tone: ${tone}
- Style: ${style}
- Platform: ${platform}

Focus on psychological triggers and emotional resonance. Each variation should feel distinct while maintaining brand consistency.`;

      const motivationContext = motivations.map((m: any) => 
        `Title: ${m.title}\nDescription: ${m.description}\nCategory: ${m.category}\nTarget Emotions: ${m.target_emotions?.join(', ')}`
      ).join('\n\n');

      const userPrompt = `Create ${variations_per_platform} distinct copy variations for ${platform} based on these strategic motivations:

MOTIVATIONS:
${motivationContext}

${target_audience ? `TARGET AUDIENCE: ${target_audience}` : ''}
${campaign_objectives ? `OBJECTIVES: ${campaign_objectives}` : ''}
${brand_guidelines ? `BRAND GUIDELINES: ${brand_guidelines}` : ''}

Return as JSON array with this structure:
[{
  "headline": "string",
  "body": "string",
  "call_to_action": "string",
  "hashtags": ["string"], // if applicable for platform
  "emotional_hook": "string",
  "key_motivation": "string" // which motivation this variation primarily uses
}]

Make each variation unique while staying within the ${platformSpec.maxLength} character limit.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt  }
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 2000});

      const aiResponse = completion.choices[0]?.message?.content;
      if (!aiResponse) {
        console.error(`No AI response for platform: ${platform}`);
        continue;
      }

      // Parse AI response
      let copyVariations;
      try {
        copyVariations = JSON.parse(aiResponse);
      } catch (parseError: any) {
        console.error('Failed to parse AI response:', aiResponse);
        continue;
      }

      // Create copy assets in database
      for (let i = 0; i < copyVariations.length; i++) {
        const variation = copyVariations[i];
        
        const { data: created, error } = await supabase
          .from('copy_assets')
          .insert({
            client_id,
            motivation_ids,
            platform,
            headline: variation.headline,
            body_text: variation.body,
            call_to_action: variation.call_to_action,
            hashtags: variation.hashtags || [],
            metadata: {},
        tone,
              style,
              emotional_hook: variation.emotional_hook,
              key_motivation: variation.key_motivation,
              character_count: (variation.headline + variation.body + variation.call_to_action).length,
              generation_context: {},
  model: 'gpt-4o',
                temperature: 0.8,
                variation_number: i + 1,
                total_variations: copyVariations.length
              }
            },
            performance_score: Math.floor(Math.random() * 20) + 80, // Simulated initial score
            is_ai_generated: true,
            created_by: user.id})
          .select(`
            *,
            clients(name, slug)
          `)
          .single();

        if (error) {
          console.error('Error creating copy asset:', error);
          continue;
        }

        createdCopyAssets.push(created);
      }
    }

    return res.json({
      success: true,
      copy_assets: createdCopyAssets,
      count: createdCopyAssets.length,
      platforms_processed: platforms.length,
      message: `Generated ${createdCopyAssets.length} copy variations across ${platforms.length} platforms`
    });

  } catch (error: any) {
    console.error('Copy generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate copy',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

export default withAuth(handler);