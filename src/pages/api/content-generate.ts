import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { z } from 'zod';
import OpenAI from 'openai';

const ContentGenerateSchema = z.object({
  selected_motivation_id: z.string().uuid(),
  content_types: z.array(z.enum(['copy', 'headline', 'cta', 'description'])),
  tone: z.string().optional(),
  style: z.string().optional(),
  user_id: z.string().uuid()
});

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  const parseResult = ContentGenerateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid input', errors: parseResult.error.errors });
  }
  const { selected_motivation_id, content_types, tone, style, user_id } = parseResult.data;
  // Get selected motivations
  const { data: selection, error } = await supabase!
    .from('selected_motivations')
    .select('*')
    .eq('id', selected_motivation_id)
    .single();
  if (error || !selection) {
    return res.status(404).json({ success: false, message: 'Selected motivations not found' });
  }
  try {
    // Compose prompt for AI
    const prompt = `Generate the following campaign content types for a creative campaign, using these motivations and context.\n\nMotivations:\n${selection!.selected.map((i: number, idx: number) => `${idx + 1}. ${selection!.motivations[i] || ''}`).join('\n')}\n\nCustom motivations:\n${(selection!.custom || []).join('\n')}\n\nContent types: ${content_types.join(', ')}\nTone: ${tone || 'default'}\nStyle: ${style || 'default'}\n\nFor each type, provide 3 variations. Return results as a JSON object: { type: string, variations: string[] }[]`;
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a senior creative copywriter.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1200
    });

    const content = completion.choices[0]?.message?.content;
    // Save generated content
    const { data: saved, error: saveError } = await supabase!
      .from('generated_content')
      .insert({
        selected_motivation_id,
        content_types,
        tone,
        style,
        content,
        user_id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    if (saveError) {
      return res
        .status(500)
        .json({ success: false, message: 'Failed to save content', error: saveError.message });
    }
    return res.status(200).json({ success: true, content: saved });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
