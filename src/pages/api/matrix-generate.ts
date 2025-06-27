import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { z } from 'zod';
import OpenAI from 'openai';
import { withAuth } from '@/middleware/withAuth';

const MatrixGenerateSchema = z.object({
  template_id: z.string().uuid(),
  asset_ids: z.array(z.string().uuid()),
  content_id: z.string().uuid(),
  user_id: z.string().uuid(),
  lock_fields: z.array(z.string()).optional(),
  variation_count: z.number().min(1).max(20).default(6),
});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  const parseResult = MatrixGenerateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid input', errors: parseResult.error.errors });
  }
  const {
    template_id,
    asset_ids,
    content_id,
    user_id,
    lock_fields = [],
    variation_count,
  } = parseResult.data;
  // Fetch template, assets, and content
  const { data: template, error: templateError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', template_id)
    .single();
  if (templateError || !template) {
    return res.status(404).json({ success: false, message: 'Template not found' });
  }
  const { data: assets, error: assetError } = await supabase
    .from('assets')
    .select('*')
    .in('id', asset_ids);
  if (assetError || !assets || assets.length === 0) {
    return res.status(404).json({ success: false, message: 'Assets not found' });
  }
  const { data: content, error: contentError } = await supabase
    .from('generated_content')
    .select('*')
    .eq('id', content_id)
    .single();
  if (contentError || !content) {
    return res.status(404).json({ success: false, message: 'Generated content not found' });
  }
  try {
    // Compose prompt for AI to generate variations
    const prompt = `Given the following template, assets, and campaign content, generate ${variation_count} unique campaign variations.\n\nTemplate:\n${JSON.stringify(template)}\n\nAssets:\n${JSON.stringify(assets)}\n\nContent:\n${JSON.stringify(content.content)}\n\nLock these fields: ${lock_fields.join(', ')}\n\nReturn an array of objects, each describing a variation (asset assignments, content, and any locked fields).`;
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a creative campaign matrix generator.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 1500,
    });

    const variations = completion.choices[0]?.message?.content;
    // Save matrix
    const { data: matrix, error: saveError } = await supabase
      .from('matrices')
      .insert({
        template_id,
        asset_ids,
        content_id,
        user_id,
        lock_fields,
        variation_count,
        variations,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (saveError) {
      return res
        .status(500)
        .json({ success: false, message: 'Failed to save matrix', error: saveError.message });
    }
    return res.status(200).json({ success: true, matrix });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export default withAuth(handler);
