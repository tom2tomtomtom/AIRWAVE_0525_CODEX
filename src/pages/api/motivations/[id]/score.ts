import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';

const ScoreUpdateSchema = z.object({
  relevance_score: z.number().min(0).max(100).optional(),
  effectiveness_rating: z.number().min(1).max(5).optional(),
  manual_override: z.boolean().default(false),
  scoring_context: z
    .object({
      brief_alignment: z.number().min(0).max(100).optional(),
      audience_relevance: z.number().min(0).max(100).optional(),
      emotional_impact: z.number().min(0).max(100).optional(),
      brand_fit: z.number().min(0).max(100).optional(),
      market_differentiation: z.number().min(0).max(100).optional(),
    })
    .optional(),
  notes: z.string().optional(),
});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const { id } = req.query;
  const user = (req as any).user;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Motivation ID is required' });
  }

  try {
    switch (method) {
      case 'GET':
        return handleGet(req, res, user, id);
      case 'POST':
        return handlePost(req, res, user, id);
      case 'PUT':
        return handlePut(req, res, user, id);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Motivation Score API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    });
  }
}

async function handleGet(
  _req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  motivationId: string
): Promise<void> {
  // Verify user has access to this motivation
  const { data: motivation, error } = await supabase
    .from('motivations')
    .select(
      `
      id,
      title,
      description,
      category,
      relevance_score,
      effectiveness_rating,
      generation_context,
      client_id,
      brief_id,
      briefs(
        objectives,
        target_audience,
        key_messaging,
        brand_guidelines
      )
    `
    )
    .eq('id', motivationId)
    .single();

  if (error || !motivation) {
    return res.status(404).json({ error: 'Motivation not found' });
  }

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', motivation.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this motivation' });
  }

  // Calculate detailed scoring if brief exists
  let detailedScoring = null;
  if (motivation.brief_id && motivation.briefs) {
    detailedScoring = await calculateDetailedScoring(motivation, motivation.briefs);
  }

  // Get comparative scoring (vs other motivations in same brief/client)
  const comparativeScoring = await getComparativeScoring(
    motivationId,
    motivation.client_id,
    motivation.brief_id
  );

  // Get scoring history
  const scoringHistory = await getScoringHistory(motivationId);

  // Generate scoring recommendations
  const recommendations = generateScoringRecommendations(
    motivation,
    detailedScoring,
    comparativeScoring
  );

  return res.json({
    data: {
      motivation_id: motivationId,
      current_scores: {
        relevance_score: motivation.relevance_score,
        effectiveness_rating: motivation.effectiveness_rating,
      },
      detailed_scoring: detailedScoring,
      comparative_scoring: comparativeScoring,
      scoring_history: scoringHistory,
      recommendations,
    },
  });
}

async function handlePost(
  _req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  motivationId: string
): Promise<void> {
  // AUTO-CALCULATE scoring based on brief and context

  // Verify user has access to this motivation
  const { data: motivation } = await supabase
    .from('motivations')
    .select(
      `
      id,
      title,
      description,
      category,
      client_id,
      brief_id,
      briefs(
        objectives,
        target_audience,
        key_messaging,
        brand_guidelines
      )
    `
    )
    .eq('id', motivationId)
    .single();

  if (!motivation) {
    return res.status(404).json({ error: 'Motivation not found' });
  }

  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', motivation.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this motivation' });
  }

  // Calculate comprehensive scoring
  const autoScoring = await calculateComprehensiveScoring(motivation);

  // Update the motivation with new scores
  const { data: updatedMotivation, error } = await supabase
    .from('motivations')
    .update({
      relevance_score: autoScoring.overall_score,
      effectiveness_rating: autoScoring.effectiveness_rating,
      generation_context: {
        ...(motivation as any).generation_context,
        auto_scoring: {
          timestamp: new Date().toISOString(),
          scores: autoScoring.detailed_scores,
          calculated_by: user.id,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', motivationId)
    .select()
    .single();

  if (error) {
    console.error('Error updating motivation scores:', error);
    return res.status(500).json({ error: 'Failed to update motivation scores' });
  }

  return res.json({
    message: 'Motivation scoring calculated successfully',
    data: {
      motivation: updatedMotivation,
      scoring_details: autoScoring,
    },
  });
}

async function handlePut(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  motivationId: string
): Promise<void> {
  // MANUAL scoring update
  const validationResult = ScoreUpdateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  const scoreData = validationResult.data;

  // Verify user has access to this motivation
  const { data: motivation } = await supabase
    .from('motivations')
    .select('client_id, generation_context')
    .eq('id', motivationId)
    .single();

  if (!motivation) {
    return res.status(404).json({ error: 'Motivation not found' });
  }

  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', motivation.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this motivation' });
  }

  // Build update object
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (scoreData.relevance_score !== undefined) {
    updateData.relevance_score = scoreData.relevance_score;
  }

  if (scoreData.effectiveness_rating !== undefined) {
    updateData.effectiveness_rating = scoreData.effectiveness_rating;
  }

  // Update generation context with manual scoring info
  updateData.generation_context = {
    ...motivation.generation_context,
    manual_scoring: {
      timestamp: new Date().toISOString(),
      scored_by: user.id,
      manual_override: scoreData.manual_override,
      scoring_context: scoreData.scoring_context,
      notes: scoreData.notes,
    },
  };

  const { data: updatedMotivation, error } = await supabase
    .from('motivations')
    .update(updateData)
    .eq('id', motivationId)
    .select()
    .single();

  if (error) {
    console.error('Error updating motivation scores:', error);
    return res.status(500).json({ error: 'Failed to update motivation scores' });
  }

  return res.json({
    message: 'Motivation scores updated successfully',
    data: updatedMotivation,
  });
}

// Helper functions
async function calculateDetailedScoring(motivation: any, brief: any): Promise<any> {
  const scores = {
    brief_alignment: 0,
    audience_relevance: 0,
    emotional_impact: 0,
    brand_fit: 0,
    market_differentiation: 0,
  };

  // Brief alignment scoring
  if (brief.objectives) {
    const objectiveText = JSON.stringify(brief.objectives).toLowerCase();
    const motivationText = `${motivation.title} ${motivation.description}`.toLowerCase();
    scores.brief_alignment = calculateTextAlignment(objectiveText, motivationText);
  }

  // Audience relevance scoring
  if (brief.target_audience) {
    const audienceText = brief.target_audience.toLowerCase();
    const motivationText = `${motivation.title} ${motivation.description}`.toLowerCase();
    scores.audience_relevance = calculateAudienceRelevance(
      audienceText,
      motivationText,
      motivation.category
    );
  }

  // Emotional impact scoring based on category
  scores.emotional_impact = calculateEmotionalImpact(motivation.category, motivation.description);

  // Brand fit scoring
  if (brief.brand_guidelines) {
    scores.brand_fit = calculateBrandFit(brief.brand_guidelines, motivation);
  }

  // Market differentiation scoring
  scores.market_differentiation = await calculateMarketDifferentiation(motivation);

  // Calculate overall score
  const overall =
    Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length;

  return {
    detailed_scores: scores,
    overall_score: Math.round(overall),
    scoring_method: 'algorithm_v1',
    calculated_at: new Date().toISOString(),
  };
}

async function calculateComprehensiveScoring(motivation: any): Promise<any> {
  const scores = {
    keyword_relevance: calculateKeywordRelevance(motivation),
    category_effectiveness: getCategoryEffectiveness(motivation.category),
    content_quality: calculateContentQuality(motivation.description),
    uniqueness: await calculateUniqueness(motivation),
  };

  // Calculate overall score
  const weights: Record<string, number> = {
    keyword_relevance: 0.3,
    category_effectiveness: 0.25,
    content_quality: 0.25,
    uniqueness: 0.2,
  };

  const overall = Object.entries(scores).reduce((sum, [key, score]) => {
    return sum + score * (weights[key] || 0);
  }, 0);

  // Calculate effectiveness rating (1-5 scale)
  const effectiveness_rating = Math.min(5, Math.max(1, Math.round(overall / 20)));

  return {
    overall_score: Math.round(overall),
    effectiveness_rating,
    detailed_scores: scores,
    weights_used: weights,
  };
}

async function getComparativeScoring(
  motivationId: string,
  clientId: string,
  briefId?: string
): Promise<any> {
  try {
    let query = supabase
      .from('motivations')
      .select('relevance_score, effectiveness_rating, category')
      .eq('client_id', clientId)
      .neq('id', motivationId)
      .not('relevance_score', 'is', null);

    if (briefId) {
      query = query.eq('brief_id', briefId);
    }

    const { data: similarMotivations } = await query;

    if (!similarMotivations || similarMotivations.length === 0) {
      return {
        has_comparison_data: false,
        message: 'No comparable motivations found',
      };
    }

    const scores = similarMotivations.map((m: any) => m.relevance_score);
    const ratings = similarMotivations
      .filter((m: any) => m.effectiveness_rating)
      .map((m: any) => m.effectiveness_rating);

    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const avgRating =
      ratings.length > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null;

    return {
      has_comparison_data: true,
      total_comparable: similarMotivations.length,
      average_relevance_score: Math.round(avgScore * 100) / 100,
      average_effectiveness_rating: avgRating ? Math.round(avgRating * 100) / 100 : null,
      percentile_ranking: null, // Would need current motivation score to calculate
    };
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error getting comparative scoring:', message, error);
    return {
      has_comparison_data: false,
      message: 'Error retrieving comparison data',
    };
  }
}

async function getScoringHistory(_motivationId: string): Promise<any[]> {
  try {
    // This would typically come from an audit table or version history
    // For now, we'll return empty array since we don't have scoring history table
    return [];
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error getting scoring history:', message, error);
    return [];
  }
}

function generateScoringRecommendations(
  motivation: any,
  detailedScoring: any,
  comparativeScoring: any
): string[] {
  const recommendations: string[] = [];

  const currentScore = motivation.relevance_score || 0;

  // Score-based recommendations
  if (currentScore < 40) {
    recommendations.push('Consider refining the motivation to better align with brief objectives');
  } else if (currentScore > 80) {
    recommendations.push('Strong motivation - consider using as a primary driver for content');
  }

  // Category-based recommendations
  const categoryRecommendations: Record<string, string> = {
    emotional: 'Test emotional variations to maximize impact',
    rational: 'Support with data and logical arguments',
    social: 'Leverage social proof and community elements',
    fear: 'Balance with positive outcomes and solutions',
    aspiration: 'Connect to future-state visioning',
  };

  if (motivation.category && categoryRecommendations[motivation.category]) {
    const categoryRec = categoryRecommendations[motivation.category];
    if (categoryRec) {
      recommendations.push(categoryRec);
    }
  }

  // Comparative recommendations
  if (comparativeScoring.has_comparison_data) {
    if (currentScore < comparativeScoring.average_relevance_score - 10) {
      recommendations.push(
        'Below-average performance compared to similar motivations - consider revision'
      );
    } else if (currentScore > comparativeScoring.average_relevance_score + 10) {
      recommendations.push('Above-average performance - good candidate for A/B testing');
    }
  }

  // Detailed scoring recommendations
  if (detailedScoring) {
    const scores = detailedScoring.detailed_scores;

    if (scores.brief_alignment < 60) {
      recommendations.push('Improve alignment with brief objectives');
    }

    if (scores.emotional_impact < 50) {
      recommendations.push('Consider strengthening emotional appeal');
    }

    if (scores.brand_fit < 70) {
      recommendations.push('Review brand guidelines compatibility');
    }
  }

  return recommendations;
}

// Scoring calculation helpers
function calculateTextAlignment(text1: string, text2: string): number {
  const words1 = new Set(text1.split(/\s+/).filter((w: any) => w.length > 3));
  const words2 = new Set(text2.split(/\s+/).filter((w: any) => w.length > 3));

  const intersection = new Set([...words1].filter((x: any) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? Math.round((intersection.size / union.size) * 100) : 0;
}

function calculateAudienceRelevance(
  audienceText: string,
  motivationText: string,
  category: string
): number {
  // Basic audience relevance scoring
  let score = calculateTextAlignment(audienceText, motivationText);

  // Category bonuses for specific audiences
  if (audienceText.includes('young') && ['social', 'aspiration'].includes(category)) score += 10;
  if (audienceText.includes('professional') && ['rational', 'status'].includes(category))
    score += 10;
  if (audienceText.includes('family') && ['safety', 'emotional'].includes(category)) score += 10;

  return Math.min(100, score);
}

function calculateEmotionalImpact(category: string, description: string): number {
  const emotionalWords = [
    'feel',
    'emotion',
    'heart',
    'passion',
    'love',
    'fear',
    'hope',
    'dream',
    'worry',
    'excited',
  ];
  const lowerDesc = description.toLowerCase();

  const base = emotionalWords.filter((word: any) => lowerDesc.includes(word)).length * 10;

  // Category-based emotional impact
  const categoryImpact: Record<string, number> = {
    emotional: 80,
    fear: 75,
    aspiration: 70,
    social: 65,
    status: 60,
    rational: 40,
    convenience: 30,
    safety: 50,
  };

  return Math.min(100, base + (categoryImpact[category] || 50));
}

function calculateBrandFit(_brandGuidelines: any, _motivation: any): number {
  // Placeholder brand fit calculation
  // In real implementation, this would analyze brand voice, values, etc.
  return Math.floor(Math.random() * 30) + 70; // Random score between 70-100
}

async function calculateMarketDifferentiation(_motivation: any): Promise<number> {
  // Placeholder market differentiation calculation
  // In real implementation, this would analyze competitor motivations
  return Math.floor(Math.random() * 40) + 60; // Random score between 60-100
}

function calculateKeywordRelevance(motivation: any): number {
  // Simple keyword relevance based on title and description quality
  const text = `${motivation.title} ${motivation.description}`;
  const wordCount = text.split(/\s+/).length;
  const uniqueWords = new Set(text.toLowerCase().split(/\s+/)).size;

  return Math.min(100, (uniqueWords / wordCount) * 100 + wordCount * 2);
}

function getCategoryEffectiveness(category: string): number {
  // Based on general marketing effectiveness research
  const effectiveness: Record<string, number> = {
    emotional: 85,
    aspiration: 80,
    social: 75,
    fear: 70,
    rational: 65,
    status: 60,
    convenience: 55,
    safety: 75,
    other: 50,
  };

  return effectiveness[category] || 50;
}

function calculateContentQuality(description: string): number {
  const wordCount = description.split(/\s+/).length;
  const sentenceCount = description.split(/[.!?]+/).filter((s: any) => s.trim().length > 0).length;

  let score = 50;

  // Length scoring
  if (wordCount >= 10 && wordCount <= 50) score += 20;
  if (wordCount > 50) score += 10;

  // Structure scoring
  if (sentenceCount >= 2) score += 15;
  if (sentenceCount >= 3) score += 10;

  // Quality indicators
  if (description.includes('because')) score += 5;
  if (description.includes('that')) score += 5;
  if (description.includes('when')) score += 5;

  return Math.min(100, score);
}

async function calculateUniqueness(_motivation: any): Promise<number> {
  // Placeholder uniqueness calculation
  // In real implementation, this would compare against existing motivations
  return Math.floor(Math.random() * 30) + 70; // Random score between 70-100
}

export default withAuth(withSecurityHeaders(handler));
