import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';

const VersionCreateSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  notes: z.string().optional(),
  is_major: z.boolean().default(false)});

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
      case 'POST':
        return handlePost(req, res, user, id);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Copy Asset Versions API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
    });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any, assetId: string): Promise<void> {
  const { limit = 20, offset = 0 } = req.query;

  // First verify user has access to this copy asset
  const { data: asset } = await supabase
    .from('copy_assets')
    .select('client_id, title')
    .eq('id', assetId)
    .single();

  if (!asset) {
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

  // Get version history
  const { data: versions, error, count } = await supabase
    .from('copy_asset_versions')
    .select(`
      id,
      version_number,
      content,
      notes,
      is_major,
      created_at,
      created_by,
      profiles(full_name, avatar_url)
    `)
    .eq('copy_asset_id', assetId)
    .order('version_number', { ascending: false })
    .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

  if (error) {
    console.error('Error fetching copy asset versions:', error);
    return res.status(500).json({ error: 'Failed to fetch version history' });
  }

  // Get current version (the live copy asset)
  const { data: currentVersion } = await supabase
    .from('copy_assets')
    .select(`
      content,
      updated_at,
      created_by,
      profiles!copy_assets_created_by_fkey(full_name, avatar_url)
    `)
    .eq('id', assetId)
    .single();

  // Calculate version statistics
  const versionStats = {
    total_versions: (count || 0) + 1, // +1 for current version
    major_versions: versions?.filter((v: any) => v.is_major).length || 0,
    minor_versions: versions?.filter((v: any) => !v.is_major).length || 0,
    first_created: versions && versions.length > 0 
      ? versions[versions.length - 1].created_at 
      : currentVersion?.updated_at,
    last_updated: currentVersion?.updated_at};

  // Enrich versions with change analysis
  const enrichedVersions = versions?.map((version, index) => {
    const nextVersion = index < versions.length - 1 ? versions[index + 1] : currentVersion;
    const changes = nextVersion ? analyzeContentChanges(version.content, nextVersion.content) : null;
    
    return {
      ...version,
      change_analysis: changes,
      is_current: false};
  }) || [];

  // Add current version as the first item
  if (currentVersion) {
    enrichedVersions.unshift({
      id: 'current',
      version_number: (versions?.[0]?.version_number || 0) + 1,
      content: currentVersion.content,
      notes: 'Current version',
      is_major: false,
      created_at: currentVersion.updated_at,
      created_by: currentVersion.created_by,
      profiles: currentVersion.profiles,
      change_analysis: versions && versions.length > 0 
        ? analyzeContentChanges(versions[0].content, currentVersion.content)
        : null,
      is_current: true});
  }

  return res.json({
    data: {},
  asset_title: asset.title,
      versions: enrichedVersions,
      statistics: versionStats },
  count: versionStats.total_versions,
    pagination: {},
  limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      total: versionStats.total_versions}
  });
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any, assetId: string): Promise<void> {
  const validationResult = VersionCreateSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: validationResult.error.issues
    });
  }

  const versionData = validationResult.data;

  // First verify user has access to this copy asset and get current content
  const { data: asset } = await supabase
    .from('copy_assets')
    .select('client_id, content, title')
    .eq('id', assetId)
    .single();

  if (!asset) {
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

  // Check if content is actually different
  if (asset.content === versionData.content) {
    return res.status(400).json({ 
      error: 'No changes detected',
      details: 'New content is identical to current version'
    });
  }

  // Get next version number
  const { data: latestVersion } = await supabase
    .from('copy_asset_versions')
    .select('version_number')
    .eq('copy_asset_id', assetId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  const nextVersionNumber = (latestVersion?.version_number || 0) + 1;

  // Store current content as a version before updating
  const { error: versionError } = await supabase
    .from('copy_asset_versions')
    .insert({
      copy_asset_id: assetId,
      version_number: nextVersionNumber,
      content: asset.content,
      notes: `Previous version (auto-saved before update)`,
      is_major: false,
      created_by: user.id});

  if (versionError) {
    console.error('Error creating version:', versionError);
    return res.status(500).json({ error: 'Failed to create version history' });
  }

  // Update the copy asset with new content
  const updateData = {
    content: versionData.content,
    character_count: versionData.content.length,
    word_count: versionData.content.split(/\s+/).length,
    updated_at: new Date().toISOString(),
    metadata: {},
        version_notes: versionData.notes,
      is_major_update: versionData.is_major,
      previous_version: nextVersionNumber
      }
  };

  const { data: updatedAsset, error: updateError } = await supabase
    .from('copy_assets')
    .update(updateData)
    .eq('id', assetId)
    .select(`
      *,
      profiles!copy_assets_created_by_fkey(full_name, avatar_url)
    `)
    .single();

  if (updateError) {
    console.error('Error updating copy asset:', updateError);
    return res.status(500).json({ error: 'Failed to update copy asset' });
  }

  // Create a version entry for the new content (if marked as major)
  if (versionData.is_major) {
    await supabase
      .from('copy_asset_versions')
      .insert({
        copy_asset_id: assetId,
        version_number: nextVersionNumber + 1,
        content: versionData.content,
        notes: versionData.notes || 'Major version update',
        is_major: true,
        created_by: user.id});
  }

  // Analyze changes
  const changeAnalysis = analyzeContentChanges(asset.content, versionData.content);

  return res.status(201).json({
    message: 'Copy asset version created successfully',
    data: {},
  asset: updatedAsset,
      version_number: versionData.is_major ? nextVersionNumber + 1 : nextVersionNumber,
      change_analysis: changeAnalysis}
  });
}

function analyzeContentChanges(oldContent: string, newContent: string): any {
  if (!oldContent || !newContent) return null;

  const oldWords = oldContent.split(/\s+/);
  const newWords = newContent.split(/\s+/);

  const changes = {
    character_change: newContent.length - oldContent.length,
    word_change: newWords.length - oldWords.length,
    similarity_score: calculateSimilarity(oldContent, newContent),
    change_type: determineChangeType(oldContent, newContent),
    key_changes: identifyKeyChanges(oldContent, newContent)};

  return changes;
}

function calculateSimilarity(text1: string, text2: string): number {
  // Simple similarity calculation using Jaccard similarity
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter((x: any) => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? Math.round((intersection.size / union.size) * 100) : 0;
}

function determineChangeType(oldContent: string, newContent: string): string {
  const similarity = calculateSimilarity(oldContent, newContent);
  
  if (similarity > 80) return 'minor_edit';
  if (similarity > 50) return 'moderate_revision';
  if (similarity > 20) return 'major_rewrite';
  return 'complete_rewrite';
}

function identifyKeyChanges(oldContent: string, newContent: string): string[] {
  const changes: string[] = [];
  
  const oldLength = oldContent.length;
  const newLength = newContent.length;
  
  // Length changes
  if (Math.abs(newLength - oldLength) > oldLength * 0.2) {
    if (newLength > oldLength) {
      changes.push(`Significant content expansion (+${newLength - oldLength} characters)`);
    } else {
      changes.push(`Significant content reduction (-${oldLength - newLength} characters)`);
    }
  }
  
  // Tone changes (basic detection)
  const oldTone = analyzeTone(oldContent);
  const newTone = analyzeTone(newContent);
  
  if (oldTone !== newTone) {
    changes.push(`Tone shift from ${oldTone} to ${newTone}`);
  }
  
  // Structure changes
  const oldSentences = oldContent.split(/[.!?]+/).length;
  const newSentences = newContent.split(/[.!?]+/).length;
  
  if (Math.abs(newSentences - oldSentences) > 2) {
    changes.push(`Structure change (${oldSentences} → ${newSentences} sentences)`);
  }
  
  return changes;
}

function analyzeTone(text: string): string {
  const lowerText = text.toLowerCase();
  
  const excitementWords = ['amazing', 'incredible', 'fantastic', 'awesome', 'exciting'];
  const professionalWords = ['professional', 'quality', 'excellence', 'expertise', 'efficient'];
  const casualWords = ['hey', 'cool', 'nice', 'fun', 'easy'];
  const urgentWords = ['now', 'today', 'immediate', 'urgent', 'limited'];
  
  const excitementScore = excitementWords.filter((word: any) => lowerText.includes(word)).length;
  const professionalScore = professionalWords.filter((word: any) => lowerText.includes(word)).length;
  const casualScore = casualWords.filter((word: any) => lowerText.includes(word)).length;
  const urgentScore = urgentWords.filter((word: any) => lowerText.includes(word)).length;
  
  const scores: Record<string, number> = { excitement: excitementScore, professional: professionalScore, casual: casualScore, urgent: urgentScore };
  const maxTone = Object.entries(scores).reduce((a, b) => (scores[a[0]] || 0) > (scores[b[0]] || 0) ? a : b);
  
  return maxTone[1] > 0 ? maxTone[0] : 'neutral';
}

export default withAuth(withSecurityHeaders(handler));