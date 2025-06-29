import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';

const CopyAssetUpdateSchema = z.object({
  content: z.string().min(1).optional(),
  type: z.enum(['headline', 'body', 'cta', 'subject_line', 'description', 'caption', 'script', 'other']).optional(),
  title: z.string().optional(),
  platform: z.enum(['facebook', 'instagram', 'youtube', 'tiktok', 'linkedin', 'twitter', 'email', 'universal']).optional(),
  tone: z.string().optional(),
  style: z.string().optional(),
  language: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.any().optional(),
  performance_score: z.number().min(0).max(100).optional(),
  brand_compliance_score: z.number().min(0).max(100).optional()
});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const { id } = req.query;
  const user = (req as any).user;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Copy asset ID is required' });
  }

  try {
    switch (method) {
      case 'GET':
        return handleGet(req, res, user, id);
      case 'PUT':
        return handlePut(req, res, user, id);
      case 'DELETE':
        return handleDelete(req, res, user, id);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Copy Asset API error:', message, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
    });
  }
}

async function handleGet(_req: NextApiRequest, res: NextApiResponse, user: any, assetId: string): Promise<void> {
  // First verify user has access to this copy asset
  const { data: asset, error } = await supabase
    .from('copy_assets')
    .select(`
      *,
      clients(name, slug, primary_color, secondary_color),
      profiles!copy_assets_created_by_fkey(full_name, avatar_url),
      briefs(id, name, title)
    `)
    .eq('id', assetId)
    .single();

  if (error || !asset) {
    return res.status(404).json({ error: 'Copy asset not found' });
  }

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', asset.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this copy asset' });
  }

  // Get related motivations if any
  let relatedMotivations: any[] = [];
  if (asset.motivation_ids && asset.motivation_ids.length > 0) {
    const { data: motivations } = await supabase
      .from('motivations')
      .select(`
        id,
        title,
        description,
        category,
        relevance_score
      `)
      .in('id', asset.motivation_ids);
    
    relatedMotivations = motivations || [];
  }

  // Get usage in content variations
  const { data: contentVariations } = await supabase
    .from('content_variations')
    .select(`
      id,
      content_type,
      platform,
      performance_score,
      created_at
    `)
    .contains('motivation_ids', asset.motivation_ids)
    .eq('client_id', asset.client_id)
    .limit(10);

  // Calculate advanced analytics
  const analytics = {
    character_count: asset.content.length,
    word_count: asset.content.split(/\s+/).length,
    sentence_count: asset.content.split(/[.!?]+/).filter((s: string) => s.trim().length > 0).length,
    readability_score: calculateReadabilityScore(asset.content),
    sentiment: analyzeSentiment(asset.content),
    keyword_density: calculateKeywordDensity(asset.content),
    platform_compliance: checkPlatformCompliance(asset.content, asset.platform)
  };

  // Get version history (if implemented)
  const { data: versions } = await supabase
    .from('copy_asset_versions')
    .select(`
      id,
      version_number,
      content,
      created_at,
      created_by,
      profiles(full_name)
    `)
    .eq('copy_asset_id', assetId)
    .order('version_number', { ascending: false })
    .limit(10);

  return res.json({
    data: {
      ...asset,
      related_motivations: relatedMotivations,
      usage_in_variations: contentVariations || [],
      analytics,
      version_history: versions || []
    }
  });
}

async function handlePut(req: NextApiRequest, res: NextApiResponse, user: any, assetId: string): Promise<void> {
  const validationResult = CopyAssetUpdateSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: validationResult.error.issues
    });
  }

  // First verify user has access to this copy asset
  const { data: existingAsset } = await supabase
    .from('copy_assets')
    .select('client_id, created_by, content')
    .eq('id', assetId)
    .single();

  if (!existingAsset) {
    return res.status(404).json({ error: 'Copy asset not found' });
  }

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', existingAsset.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this copy asset' });
  }

  const updateData = validationResult.data;

  // Update content metrics if content changed
  if (updateData.content && updateData.content !== existingAsset.content) {
    (updateData as any).character_count = updateData.content.length;
    (updateData as any).word_count = updateData.content.split(/\s+/).length;
    
    // Update metadata with new analytics
    updateData.metadata = {
      ...updateData.metadata,
      readability_score: calculateReadabilityScore(updateData.content),
      sentiment: analyzeSentiment(updateData.content),
      updated_timestamp: new Date().toISOString()
    };

    // Create version history entry
    await supabase
      .from('copy_asset_versions')
      .insert({
        copy_asset_id: assetId,
        content: existingAsset.content,
        created_by: user.id,
        version_number: await getNextVersionNumber(assetId)
      });
  }

  const { data: asset, error } = await supabase
    .from('copy_assets')
    .update({
      ...updateData,
      updated_at: new Date().toISOString()
    })
    .eq('id', assetId)
    .select(`
      *,
      clients(name, slug),
      profiles!copy_assets_created_by_fkey(full_name),
      briefs(name)
    `)
    .single();

  if (error) {
    console.error('Error updating copy asset:', error);
    return res.status(500).json({ error: 'Failed to update copy asset' });
  }

  return res.json({ data: asset });
}

async function handleDelete(_req: NextApiRequest, res: NextApiResponse, user: any, assetId: string): Promise<void> {
  // First verify user has access to this copy asset
  const { data: existingAsset } = await supabase
    .from('copy_assets')
    .select('client_id, created_by')
    .eq('id', assetId)
    .single();

  if (!existingAsset) {
    return res.status(404).json({ error: 'Copy asset not found' });
  }

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', existingAsset.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this copy asset' });
  }

  // Check if copy asset is being used in active campaigns
  const { data: activeUsage } = await supabase
    .from('executions')
    .select('id, status')
    .contains('metadata', { copy_asset_id: assetId })
    .in('status', ['pending', 'processing', 'active'])
    .limit(1);

  if (activeUsage && activeUsage.length > 0) {
    return res.status(409).json({ 
      error: 'Cannot delete copy asset in use by active campaigns',
      details: 'Please pause or complete related campaigns first'
    });
  }

  // Delete version history first
  await supabase
    .from('copy_asset_versions')
    .delete()
    .eq('copy_asset_id', assetId);

  const { error } = await supabase
    .from('copy_assets')
    .delete()
    .eq('id', assetId);

  if (error) {
    console.error('Error deleting copy asset:', error);
    return res.status(500).json({ error: 'Failed to delete copy asset' });
  }

  return res.status(200).json({ message: 'Copy asset deleted successfully' });
}

// Helper functions
function calculateReadabilityScore(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s: any) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w: any) => w.length > 0);
  
  if (sentences.length === 0 || words.length === 0) return 50;
  
  const avgWordsPerSentence = words.length / sentences.length;
  const avgCharsPerWord = text.replace(/\s+/g, '').length / words.length;
  
  const score = Math.max(0, 100 - (avgWordsPerSentence * 2 + avgCharsPerWord * 5));
  return Math.min(100, Math.round(score));
}

function analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best', 'awesome', 'perfect'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disappointing', 'failed'];
  
  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter((word: any) => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter((word: any) => lowerText.includes(word)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

function calculateKeywordDensity(text: string): Record<string, number> {
  const words = text.toLowerCase().split(/\s+/).filter((w: any) => w.length > 3);
  const frequency: Record<string, number> = {};
  
  words.forEach((word: any) => {
    frequency[word] = (frequency[word] || 0) + 1;
  });
  
  const total = words.length;
  const density: Record<string, number> = {};
  
  Object.entries(frequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([word, count]) => {
      density[word] = Math.round((count / total) * 100 * 100) / 100;
    });
  
  return density;
}

function checkPlatformCompliance(content: string, platform?: string): Record<string, boolean> {
  const compliance: Record<string, boolean> = {};
  
  if (!platform) return compliance;
  
  const length = content.length;
  
  switch (platform) {
    case 'twitter':
      compliance.character_limit = length <= 280;
      break;
    case 'facebook':
      compliance.character_limit = length <= 63206;
      compliance.recommended_length = length <= 125;
      break;
    case 'instagram':
      compliance.character_limit = length <= 2200;
      compliance.recommended_length = length <= 150;
      break;
    case 'linkedin':
      compliance.character_limit = length <= 3000;
      compliance.recommended_length = length <= 200;
      break;
    case 'email':
      compliance.subject_line_length = length <= 50;
      break;
  }
  
  return compliance;
}

async function getNextVersionNumber(copyAssetId: string): Promise<number> {
  const { data } = await supabase
    .from('copy_asset_versions')
    .select('version_number')
    .eq('copy_asset_id', copyAssetId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();
  
  return (data?.version_number || 0) + 1;
}

export default withAuth(withSecurityHeaders(handler));