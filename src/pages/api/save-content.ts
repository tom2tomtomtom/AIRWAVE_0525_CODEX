import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '@/utils/errorUtils';
import { getServiceSupabase } from '@/lib/supabase';
import { z } from 'zod';

// Request schema for saving generated content
const SaveContentSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['text', 'voice']),
  content: z.string().min(1),
  client_id: z.string(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    // Validate request
    const validationResult = SaveContentSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: validationResult.error.errors});
    }

    const { name, type, content, client_id, tags = [], metadata = {} } = validationResult.data;

    // Use service role to bypass RLS for asset creation
    const serviceSupabase = getServiceSupabase();
    
    // Create asset record for text/voice content
    const { data: asset, error: assetError } = await serviceSupabase
      .from('assets')
      .insert({
        name,
        type,
        url: '#', // No URL for text content
        thumbnail_url: null,
        mime_type: type === 'text' ? 'text/plain' : 'audio/mpeg',
        width: null,
        height: null,
        client_id,
        tags,
        metadata: {
        ...metadata,
          content, // Store the actual text/voice content in metadata
          saved_at: new Date().toISOString() },
  created_at: new Date().toISOString()})
      .select()
      .single();

    if (assetError) {
      console.error('Asset creation error:', assetError);
      throw new Error('Failed to save content');
    }

    return res.status(200).json({
      success: true,
      message: 'Content saved successfully',
      asset});

  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Save content API error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to save content',
      error: error instanceof Error ? error.message : 'Unknown error'});
  }
}