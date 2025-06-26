import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';
import { loggers } from '@/lib/logger';


const MatrixUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  variations: z.array(z.any()).optional(),
  combinations: z.array(z.any()).optional(),
  field_assignments: z.any().optional(),
  lock_fields: z.array(z.string()).optional(),
  status: z.enum(['draft', 'pending', 'approved', 'rejected', 'active', 'completed']).optional(),
  approval_comments: z.string().optional(),
  generation_settings: z.any().optional(),
});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const { id } = req.query;
  const user = (req as any).user;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Matrix ID is required' });
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
    console.error('Matrix API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    });
  }
}

async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  matrixId: string
): Promise<void> {
  const { include_executions = true, include_assets = true, include_analytics = false } = req.query;

  // First verify user has access to this matrix
  const { data: matrix, error } = await supabase
    .from('matrices')
    .select(
      `
      *,
      campaigns(
        id, name, status, objective, 
        clients(name, slug, primary_color, brand_guidelines)
      ),
      templates(
        id, name, platform, aspect_ratio, dimensions, 
        dynamic_fields, thumbnail_url
      ),
      profiles!matrices_created_by_fkey(full_name, avatar_url),
      profiles!matrices_approved_by_fkey(full_name, avatar_url)
    `
    )
    .eq('id', matrixId)
    .single();

  if (error || !matrix) {
    return res.status(404).json({ error: 'Matrix not found' });
  }

  // Verify user has access to the campaign's client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', matrix.campaigns.clients.id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this matrix' });
  }

  const enrichedMatrix = { ...matrix };

  // Include executions
  if (include_executions === 'true') {
    const { data: executions } = await supabase
      .from('executions')
      .select(
        `
        id,
        combination_id,
        content_type,
        platform,
        render_url,
        status,
        metadata,
        created_at,
        updated_at
      `
      )
      .eq('matrix_id', matrixId)
      .order('created_at', { ascending: false });

    enrichedMatrix.executions = executions || [];
  }

  // Include related assets
  if (include_assets === 'true') {
    const assetIds = extractAssetIdsFromMatrix(matrix);
    if (assetIds.length > 0) {
      const { data: assets } = await supabase
        .from('assets')
        .select(
          `
          id, name, type, file_url, thumbnail_url, 
          dimensions, tags, metadata
        `
        )
        .in('id', assetIds);

      enrichedMatrix.related_assets = assets || [];
    } else {
      enrichedMatrix.related_assets = [];
    }
  }

  // Include analytics
  if (include_analytics === 'true') {
    const analytics = await getMatrixAnalytics(matrixId);
    enrichedMatrix.analytics = analytics;
  }

  // Calculate matrix completeness and quality scores
  const qualityMetrics = calculateMatrixQuality(enrichedMatrix);
  enrichedMatrix.quality_metrics = qualityMetrics;

  // Generate matrix insights
  const insights = generateMatrixInsights(enrichedMatrix);
  enrichedMatrix.insights = insights;

  // Get matrix version history
  const versionHistory = await getMatrixVersionHistory(matrixId);
  enrichedMatrix.version_history = versionHistory;

  return res.json({
    data: enrichedMatrix,
  });
}

async function handlePut(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  matrixId: string
): Promise<void> {
  const validationResult = MatrixUpdateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  // First verify user has access to this matrix
  const { data: existingMatrix } = await supabase
    .from('matrices')
    .select(
      `
      campaigns(clients(id))
    `
    )
    .eq('id', matrixId)
    .single();

  if (!existingMatrix) {
    return res.status(404).json({ error: 'Matrix not found' });
  }

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', (existingMatrix as any).campaigns.clients.id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this matrix' });
  }

  const updateData = validationResult.data;

  // Handle status changes (approvals, etc.)
  if (updateData.status) {
    const statusChangeResult = await handleMatrixStatusChange(
      matrixId,
      updateData.status,
      user.id,
      updateData.approval_comments
    );

    if (!statusChangeResult.success) {
      return res.status(400).json({ error: statusChangeResult.error });
    }

    // Add approval fields if approved
    if (updateData.status === 'approved') {
      (updateData as any).approved_by = user.id;
      (updateData as any).approval_date = new Date().toISOString();
    }
  }

  // Create version history entry for significant changes
  if (updateData.variations || updateData.combinations || updateData.field_assignments) {
    await createMatrixVersionEntry(matrixId, updateData, user.id);
  }

  const { data: matrix, error } = await supabase
    .from('matrices')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', matrixId)
    .select(
      `
      *,
      campaigns(id, name, clients(name, slug)),
      templates(id, name, platform),
      profiles!matrices_created_by_fkey(full_name),
      profiles!matrices_approved_by_fkey(full_name)
    `
    )
    .single();

  if (error) {
    console.error('Error updating matrix:', error);
    return res.status(500).json({ error: 'Failed to update matrix' });
  }

  return res.json({ data: matrix });
}

async function handleDelete(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  matrixId: string
): Promise<void> {
  // First verify user has access to this matrix
  const { data: existingMatrix } = await supabase
    .from('matrices')
    .select(
      `
      status,
      campaigns(clients(id))
    `
    )
    .eq('id', matrixId)
    .single();

  if (!existingMatrix) {
    return res.status(404).json({ error: 'Matrix not found' });
  }

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', (existingMatrix as any).campaigns.clients.id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this matrix' });
  }

  // Check if matrix can be deleted
  if (existingMatrix.status === 'active') {
    return res.status(409).json({
      error: 'Cannot delete active matrix',
      details: 'Please pause or complete the matrix before deleting',
    });
  }

  // Check for active executions
  const { data: activeExecutions } = await supabase
    .from('executions')
    .select('id')
    .eq('matrix_id', matrixId)
    .in('status', ['pending', 'processing', 'active'])
    .limit(1);

  if (activeExecutions && activeExecutions.length > 0) {
    return res.status(409).json({
      error: 'Cannot delete matrix with active executions',
      details: 'Please cancel or complete executions first',
    });
  }

  // Soft delete by updating status
  const { error } = await supabase
    .from('matrices')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
      archived_by: user.id,
    })
    .eq('id', matrixId);

  if (error) {
    console.error('Error archiving matrix:', error);
    return res.status(500).json({ error: 'Failed to archive matrix' });
  }

  return res.status(200).json({
    message: 'Matrix archived successfully',
    note: 'Matrix data has been archived and can be restored if needed',
  });
}

// Helper functions
function extractAssetIdsFromMatrix(matrix: any): string[] {
  const assetIds: string[] = [];

  try {
    // Extract from field assignments
    if (matrix.field_assignments) {
      Object.values(matrix.field_assignments).forEach((field: any) => {
        if (field.assets) {
          field.assets.forEach((asset: any) => {
            if (asset.assetId) {
              assetIds.push(asset.assetId);
            }
          });
        }
      });
    }

    // Extract from variations metadata
    if (matrix.variations) {
      matrix.variations.forEach((variation: any) => {
        if (variation.assets) {
          variation.assets.forEach((assetId: string) => {
            assetIds.push(assetId);
          });
        }
      });
    }

    return [...new Set(assetIds)]; // Remove duplicates
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error extracting asset IDs:', error);
    return [];
  }
}

async function getMatrixAnalytics(matrixId: string): Promise<any> {
  try {
    // Get execution performance data
    const { data: executions } = await supabase
      .from('executions')
      .select(
        `
        id, status, platform, content_type, created_at,
        campaign_analytics(
          impressions, clicks, conversions, spend, ctr, cpc
        )
      `
      )
      .eq('matrix_id', matrixId);

    if (!executions || executions.length === 0) {
      return {
        has_data: false,
        message: 'No execution data available',
      };
    }

    // Aggregate performance metrics
    const totalMetrics = executions.reduce(
      (acc, execution) => {
        execution.campaign_analytics?.forEach((analytics: any) => {
          acc.impressions += analytics.impressions || 0;
          acc.clicks += analytics.clicks || 0;
          acc.conversions += analytics.conversions || 0;
          acc.spend += parseFloat(analytics.spend) || 0;
        });
        return acc;
      },
      { impressions: 0, clicks: 0, conversions: 0, spend: 0 }
    );

    // Calculate derived metrics
    const ctr =
      totalMetrics.impressions > 0 ? (totalMetrics.clicks / totalMetrics.impressions) * 100 : 0;
    const cpc = totalMetrics.clicks > 0 ? totalMetrics.spend / totalMetrics.clicks : 0;
    const conversionRate =
      totalMetrics.clicks > 0 ? (totalMetrics.conversions / totalMetrics.clicks) * 100 : 0;

    // Platform breakdown
    const platformBreakdown = executions.reduce(
      (acc, execution) => {
        if (!acc[execution.platform]) {
          acc[execution.platform] = { executions: 0, impressions: 0, clicks: 0 };
        }
        acc[execution.platform].executions += 1;

        execution.campaign_analytics?.forEach((analytics: any) => {
          acc[execution.platform].impressions += analytics.impressions || 0;
          acc[execution.platform].clicks += analytics.clicks || 0;
        });

        return acc;
      },
      {} as Record<string, any>
    );

    return {
      has_data: true,
      summary: {
        ...totalMetrics,
        ctr: Math.round(ctr * 100) / 100,
        cpc: Math.round(cpc * 100) / 100,
        conversion_rate: Math.round(conversionRate * 100) / 100,
        total_executions: executions.length,
      },
      platform_breakdown: platformBreakdown,
    };
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error getting matrix analytics:', error);
    return {
      has_data: false,
      error: 'Failed to retrieve analytics data',
    };
  }
}

function calculateMatrixQuality(matrix: any): any {
  let qualityScore = 100;
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check basic completeness
  if (!matrix.description || matrix.description.length < 10) {
    qualityScore -= 10;
    issues.push('Missing or insufficient description');
    recommendations.push('Add detailed matrix description');
  }

  // Check variations
  const variationsCount = matrix.variations?.length || 0;
  if (variationsCount === 0) {
    qualityScore -= 30;
    issues.push('No variations defined');
    recommendations.push('Create at least 2 variations for testing');
  } else if (variationsCount === 1) {
    qualityScore -= 15;
    issues.push('Only one variation defined');
    recommendations.push('Add more variations for A/B testing');
  }

  // Check combinations
  const combinationsCount = matrix.combinations?.length || 0;
  if (combinationsCount === 0) {
    qualityScore -= 20;
    issues.push('No combinations generated');
    recommendations.push('Generate test combinations');
  }

  // Check field assignments
  const fieldAssignments = matrix.field_assignments || {};
  const assignedFields = Object.keys(fieldAssignments).length;
  const totalFields = matrix.templates?.dynamic_fields?.length || 0;

  if (totalFields > 0) {
    const assignmentRatio = assignedFields / totalFields;
    if (assignmentRatio < 0.5) {
      qualityScore -= 20;
      issues.push('Many template fields unassigned');
      recommendations.push('Complete field assignments for all template fields');
    } else if (assignmentRatio < 1) {
      qualityScore -= 10;
      issues.push('Some template fields unassigned');
      recommendations.push('Review and complete remaining field assignments');
    }
  }

  // Check asset usage
  const relatedAssets = matrix.related_assets?.length || 0;
  if (relatedAssets === 0) {
    qualityScore -= 15;
    issues.push('No assets assigned');
    recommendations.push('Assign relevant assets to matrix fields');
  }

  return {
    score: Math.max(0, qualityScore),
    grade:
      qualityScore >= 90
        ? 'A'
        : qualityScore >= 80
          ? 'B'
          : qualityScore >= 70
            ? 'C'
            : qualityScore >= 60
              ? 'D'
              : 'F',
    completeness: {
      variations: variationsCount > 0,
      combinations: combinationsCount > 0,
      field_assignments: assignedFields > 0,
      assets: relatedAssets > 0,
    },
    issues,
    recommendations,
  };
}

function generateMatrixInsights(matrix: any): string[] {
  const insights: string[] = [];

  // Variations insights
  const variationsCount = matrix.variations?.length || 0;
  if (variationsCount > 5) {
    insights.push(`High variation count (${variationsCount}) allows for comprehensive testing`);
  } else if (variationsCount === 2) {
    insights.push('Perfect setup for A/B testing with 2 variations');
  }

  // Template insights
  if (matrix.templates?.platform) {
    const platform = matrix.templates.platform;
    insights.push(`Optimized for ${platform} - ensure content follows platform best practices`);
  }

  // Status insights
  if (matrix.status === 'draft') {
    insights.push('Matrix in draft - ready for review and approval');
  } else if (matrix.status === 'approved' && matrix.executions?.length === 0) {
    insights.push('Approved matrix ready for execution');
  }

  // Performance insights
  if (matrix.analytics?.has_data) {
    const ctr = matrix.analytics.summary.ctr;
    if (ctr > 2) {
      insights.push('Excellent performance - consider scaling successful variations');
    } else if (ctr < 0.5) {
      insights.push('Low performance - consider optimizing creative elements');
    }
  }

  // Campaign context insights
  if (matrix.campaigns?.objective) {
    insights.push(`Aligned with ${matrix.campaigns.objective} campaign objective`);
  }

  return insights;
}

async function getMatrixVersionHistory(matrixId: string): Promise<any[]> {
  try {
    // This would come from a matrix_versions table in a full implementation
    // For now, return empty array as we don't have version tracking table
    return [];
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error getting matrix version history:', error);
    return [];
  }
}

async function handleMatrixStatusChange(
  matrixId: string,
  newStatus: string,
  userId: string,
  comments?: string
): Promise<{ success: boolean; error?: string }> {
  // Define valid status transitions
  const validTransitions: Record<string, string[]> = {
    draft: ['pending', 'archived'],
    pending: ['approved', 'rejected', 'draft'],
    approved: ['active', 'draft'],
    rejected: ['draft', 'archived'],
    active: ['completed', 'archived'],
    completed: ['archived'],
    archived: [], // Archived matrices cannot be changed
  };

  // Get current status
  const { data: matrix } = await supabase
    .from('matrices')
    .select('status')
    .eq('id', matrixId)
    .single();

  if (!matrix) {
    return { success: false, error: 'Matrix not found' };
  }

  const currentStatus = matrix.status;

  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    return {
      success: false,
      error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
    };
  }

  // Additional validation for specific transitions
  if (newStatus === 'active') {
    // Check if matrix has valid combinations
    const { data: matrixData } = await supabase
      .from('matrices')
      .select('combinations')
      .eq('id', matrixId)
      .single();

    if (!matrixData?.combinations || matrixData.combinations.length === 0) {
      return {
        success: false,
        error: 'Cannot activate matrix without valid combinations',
      };
    }
  }

  return { success: true };
}

async function createMatrixVersionEntry(
  matrixId: string,
  changes: any,
  userId: string
): Promise<void> {
  try {
    // In a full implementation, this would create entries in a matrix_versions table
    // For now, we'll just log the change
    process.env.NODE_ENV === 'development' &&
      loggers.general.error('Creating matrix version entry for:', matrixId);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error creating matrix version entry:', error);
  }
}

export default withAuth(withSecurityHeaders(handler));
