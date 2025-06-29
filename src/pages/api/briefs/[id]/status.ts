import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const { id } = req.query;
  const user = (req as any).user;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Brief ID is required' });
  }

  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // First verify user has access to this brief
    const { data: brief, error } = await supabase
      .from('briefs')
      .select(
        `
        id,
        name,
        parsing_status,
        parsed_at,
        confidence_scores,
        client_id,
        created_at,
        updated_at,
        objectives,
        target_audience,
        key_messaging,
        brand_guidelines
      `
      )
      .eq('id', id)
      .single();

    if (error || !brief) {
      return res.status(404).json({ error: 'Brief not found' });
    }

    // Verify user has access to the client
    const { data: clientAccess } = await supabase
      .from('user_clients')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', brief.client_id)
      .single();

    if (!clientAccess) {
      return res.status(403).json({ error: 'Access denied to this brief' });
    }

    // Get associated motivations count
    const { count: motivationsCount } = await supabase
      .from('motivations')
      .select('id', { count: 'exact' })
      .eq('brief_id', id);

    // Get content variations count
    const { count: contentVariationsCount } = await supabase
      .from('content_variations')
      .select('id', { count: 'exact' })
      .eq('brief_id', id);

    // Calculate parsing progress
    let progress = 0;
    const status = brief.parsing_status;
    let message = '';

    switch (brief.parsing_status) {
      case 'pending':
        progress = 10;
        message = 'Brief queued for processing';
        break;
      case 'processing':
        progress = 50;
        message = 'AI is analyzing your brief content';
        break;
      case 'completed':
        progress = 100;
        message = 'Brief successfully processed';
        break;
      case 'error':
        progress = 0;
        message = 'Error occurred during processing';
        break;
      default:
        progress = 0;
        message = 'Unknown status';
    }

    // Calculate completeness score
    let completenessScore = 0;
    const completenessDetails: Record<string, boolean> = {};

    if (brief.objectives) {
      completenessScore += 25;
      completenessDetails.objectives = true;
    }
    if (brief.target_audience) {
      completenessScore += 25;
      completenessDetails.target_audience = true;
    }
    if (brief.key_messaging && Object.keys(brief.key_messaging).length > 0) {
      completenessScore += 25;
      completenessDetails.key_messaging = true;
    }
    if (brief.brand_guidelines && Object.keys(brief.brand_guidelines).length > 0) {
      completenessScore += 25;
      completenessDetails.brand_guidelines = true;
    }

    // Determine next steps
    const nextSteps: string[] = [];
    if (brief.parsing_status === 'completed') {
      if ((motivationsCount || 0) === 0) {
        nextSteps.push('Generate strategic motivations');
      }
      if ((contentVariationsCount || 0) === 0 && (motivationsCount || 0) > 0) {
        nextSteps.push('Generate content variations');
      }
      if ((motivationsCount || 0) > 0 && (contentVariationsCount || 0) > 0) {
        nextSteps.push('Create campaign matrix');
      }
    } else if (brief.parsing_status === 'error') {
      nextSteps.push('Retry brief parsing');
      nextSteps.push('Edit brief manually');
    }

    return res.json({
      data: {
        id: brief.id,
        name: brief.name,
        parsing_status: status,
        progress,
        message,
        parsed_at: brief.parsed_at,
        completeness_score: completenessScore,
        completeness_details: completenessDetails,
        confidence_scores: brief.confidence_scores,
        related_counts: {
          motivations: motivationsCount || 0,
          content_variations: contentVariationsCount || 0,
        },
        next_steps: nextSteps,
        last_updated: brief.updated_at,
        timestamps: {
          created: brief.created_at,
          updated: brief.updated_at,
          parsed: brief.parsed_at,
        },
      },
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Brief status API error:', message, error);
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

export default withAuth(withSecurityHeaders(handler));
