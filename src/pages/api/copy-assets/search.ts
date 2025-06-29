import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const user = (req as any).user;

  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      q: query,
      client_id,
      type,
      platform,
      tone,
      ai_generated,
      performance_min,
      performance_max,
      character_min,
      character_max,
      word_min,
      word_max,
      tags,
      sentiment,
      limit = 20,
      offset = 0,
    } = req.query;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters long',
      });
    }

    // Get accessible client IDs
    let clientIds: string[] = [];
    if (client_id) {
      clientIds = [client_id as string];
    } else {
      const { data: userClients } = await supabase
        .from('user_clients')
        .select('client_id')
        .eq('user_id', user.id);

      if (!userClients || userClients.length === 0) {
        return res.json({ data: [], count: 0, suggestions: [] });
      }

      clientIds = userClients.map((uc: any) => uc.client_id);
    }

    // Build the search query
    let searchQuery = supabase
      .from('copy_assets')
      .select(
        `
        *,
        clients(name, slug),
        profiles!copy_assets_created_by_fkey(full_name),
        briefs(name)
      `
      )
      .in('client_id', clientIds);

    // Text search across multiple fields
    const searchTerm = query.trim();
    searchQuery = searchQuery.or(`
      content.ilike.%${searchTerm}%,
      title.ilike.%${searchTerm}%,
      metadata->>'keywords'.ilike.%${searchTerm}%
    `);

    // Additional filters
    if (type) {
      searchQuery = searchQuery.eq('type', type);
    }

    if (platform) {
      searchQuery = searchQuery.eq('platform', platform);
    }

    if (tone) {
      searchQuery = searchQuery.eq('tone', tone);
    }

    if (ai_generated !== undefined) {
      searchQuery = searchQuery.eq('ai_generated', ai_generated === 'true');
    }

    if (performance_min || performance_max) {
      const min = performance_min ? parseFloat(performance_min as string) : 0;
      const max = performance_max ? parseFloat(performance_max as string) : 100;
      searchQuery = searchQuery.gte('performance_score', min).lte('performance_score', max);
    }

    if (character_min || character_max) {
      const min = character_min ? parseInt(character_min as string) : 0;
      const max = character_max ? parseInt(character_max as string) : 10000;
      searchQuery = searchQuery.gte('character_count', min).lte('character_count', max);
    }

    if (word_min || word_max) {
      const min = word_min ? parseInt(word_min as string) : 0;
      const max = word_max ? parseInt(word_max as string) : 2000;
      searchQuery = searchQuery.gte('word_count', min).lte('word_count', max);
    }

    if (tags && typeof tags === 'string') {
      const tagArray = tags.split(',').map((t: any) => t.trim());
      searchQuery = searchQuery.overlaps('tags', tagArray);
    }

    if (sentiment) {
      searchQuery = searchQuery.eq('metadata->>sentiment', sentiment);
    }

    // Apply pagination and ordering
    searchQuery = searchQuery
      .order('performance_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(
        parseInt(offset as string),
        parseInt(offset as string) + parseInt(limit as string) - 1
      );

    const { data: results, error, count } = await searchQuery;

    if (error) {
      console.error('Error searching copy assets:', error);
      return res.status(500).json({ error: 'Failed to search copy assets' });
    }

    // Generate search suggestions based on the query
    const suggestions = await generateSearchSuggestions(searchTerm, clientIds);

    // Add search relevance scoring and highlighting
    const enrichedResults = (results || []).map((result: any) => ({
      ...result,
      search_relevance: calculateRelevanceScore(result, searchTerm),
      highlighted_content: highlightMatches(result.content, searchTerm),
      highlighted_title: result.title ? highlightMatches(result.title, searchTerm) : null,
    }));

    // Sort by relevance
    enrichedResults.sort((a, b) => b.search_relevance - a.search_relevance);

    return res.json({
      data: enrichedResults,
      count,
      query: searchTerm,
      suggestions,
      filters_applied: {
        type,
        platform,
        tone,
        ai_generated,
        sentiment,
        performance_range:
          performance_min || performance_max ? [performance_min, performance_max] : null,
        character_range: character_min || character_max ? [character_min, character_max] : null,
        word_range: word_min || word_max ? [word_min, word_max] : null,
        tags: tags
          ? typeof tags === 'string'
            ? tags.split(',').map((t: any) => t.trim())
            : tags
          : null,
      },
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: count || 0,
      },
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Copy Assets Search API error:', message, error);
    return res.status(500).json({
      error: 'Internal server error',
      details:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : undefined,
    });
  }
}

async function generateSearchSuggestions(query: string, clientIds: string[]): Promise<string[]> {
  try {
    // Get popular tags from recent copy assets
    const { data: popularTags } = await supabase
      .from('copy_assets')
      .select('tags')
      .in('client_id', clientIds)
      .not('tags', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    // Extract and count tag frequencies
    const tagFrequency: Record<string, number> = {};
    popularTags?.forEach((asset: any) => {
      asset.tags?.forEach((tag: string) => {
        if (tag.toLowerCase().includes(query.toLowerCase())) {
          tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
        }
      });
    });

    // Get popular content types and tones
    const { data: popularTypes } = await supabase
      .from('copy_assets')
      .select('type, tone')
      .in('client_id', clientIds)
      .not('type', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    const suggestions: string[] = [];

    // Add matching tags
    Object.entries(tagFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([tag]) => suggestions.push(tag));

    // Add matching types and tones
    const types = new Set<string>();
    const tones = new Set<string>();

    popularTypes?.forEach((asset: any) => {
      if (asset.type && asset.type.toLowerCase().includes(query.toLowerCase())) {
        types.add(asset.type);
      }
      if (asset.tone && asset.tone.toLowerCase().includes(query.toLowerCase())) {
        tones.add(asset.tone);
      }
    });

    suggestions.push(...Array.from(types).slice(0, 3));
    suggestions.push(...Array.from(tones).slice(0, 3));

    return [...new Set(suggestions)].slice(0, 8);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error generating search suggestions:', message, error);
    return [];
  }
}

function calculateRelevanceScore(asset: any, query: string): number {
  const lowerQuery = query.toLowerCase();
  let score = 0;

  // Title match (highest weight)
  if (asset.title && asset.title.toLowerCase().includes(lowerQuery)) {
    score += 10;
  }

  // Content match
  if (asset.content.toLowerCase().includes(lowerQuery)) {
    score += 5;
  }

  // Tag match
  if (asset.tags && asset.tags.some((tag: string) => tag.toLowerCase().includes(lowerQuery))) {
    score += 8;
  }

  // Type/tone match
  if (asset.type && asset.type.toLowerCase().includes(lowerQuery)) {
    score += 6;
  }
  if (asset.tone && asset.tone.toLowerCase().includes(lowerQuery)) {
    score += 4;
  }

  // Performance bonus
  if (asset.performance_score) {
    score += asset.performance_score / 20; // Max 5 points
  }

  // Recency bonus
  const daysSinceCreated =
    (Date.now() - new Date(asset.created_at).getTime()) / (1000 * 60 * 60 * 24);
  score += Math.max(0, 5 - daysSinceCreated / 30); // Max 5 points, decreasing over 30 days

  return score;
}

function highlightMatches(text: string, query: string): string {
  if (!text || !query) return text;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

export default withAuth(withSecurityHeaders(handler));
