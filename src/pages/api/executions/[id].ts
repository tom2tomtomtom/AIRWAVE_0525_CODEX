import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';

const ExecutionUpdateSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled', 'scheduled']).optional(),
  render_url: z.string().optional(),
  metadata: z.any().optional(),
  error_message: z.string().optional(),
  completion_percentage: z.number().min(0).max(100).optional()});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const { id } = req.query;
  const user = (req as any).user;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Execution ID is required' });
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
    console.error('Execution API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
    });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any, executionId: string): Promise<void> {
  const { include_logs = false, include_analytics = false } = req.query;

  // First verify user has access to this execution
  const { data: execution, error } = await supabase
    .from('executions')
    .select(`
      *,
      matrices(
        id, name,
        campaigns(
          id, name, 
          clients(id, name, slug)
        )
      ),
      profiles!executions_created_by_fkey(full_name, avatar_url)
    `)
    .eq('id', executionId)
    .single();

  if (error || !execution) {
    return res.status(404).json({ error: 'Execution not found' });
  }

  // Verify user has access to the client
  const clientId = execution.matrices?.campaigns?.clients?.id;
  if (!clientId) {
    return res.status(404).json({ error: 'Execution data incomplete' });
  }

  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this execution' });
  }

  const enrichedExecution = { ...execution };

  // Include execution logs if requested
  if (include_logs === 'true') {
    const logs = await getExecutionLogs(executionId);
    enrichedExecution.logs = logs;
  }

  // Include analytics if requested
  if (include_analytics === 'true') {
    const analytics = await getExecutionAnalytics(executionId);
    enrichedExecution.analytics = analytics;
  }

  // Calculate execution progress and insights
  const progress = calculateExecutionProgress(execution);
  enrichedExecution.progress = progress;

  // Get related executions (from same matrix)
  const relatedExecutions = await getRelatedExecutions(execution.matrix_id, executionId);
  enrichedExecution.related_executions = relatedExecutions;

  // Generate execution insights
  const insights = generateExecutionInsights(execution);
  enrichedExecution.insights = insights;

  return res.json({
    data: enrichedExecution
  });
}

async function handlePut(req: NextApiRequest, res: NextApiResponse, user: any, executionId: string): Promise<void> {
  const validationResult = ExecutionUpdateSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: validationResult.error.issues
    });
  }

  // Verify user has access to this execution
  const { data: existingExecution } = await supabase
    .from('executions')
    .select(`
      status,
      matrices(campaigns(clients(id)))
    `)
    .eq('id', executionId)
    .single();

  if (!existingExecution) {
    return res.status(404).json({ error: 'Execution not found' });
  }

  const clientId = (existingExecution as any).matrices?.campaigns?.clients?.id;
  if (!clientId) {
    return res.status(404).json({ error: 'Execution data incomplete' });
  }

  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this execution' });
  }

  const updateData = validationResult.data;

  // Validate status transitions
  if (updateData.status) {
    const transitionResult = validateStatusTransition(existingExecution.status, updateData.status);
    if (!transitionResult.valid) {
      return res.status(400).json({ error: transitionResult.error });
    }
  }

  // Log the status change
  if (updateData.status && updateData.status !== existingExecution.status) {
    await logExecutionEvent(executionId, 'status_change', {
      from: existingExecution.status,
      to: updateData.status,
      changed_by: user.id,
      timestamp: new Date().toISOString()});
  }

  const { data: execution, error } = await supabase
    .from('executions')
    .update({
      ...updateData,
      updated_at: new Date().toISOString()})
    .eq('id', executionId)
    .select(`
      *,
      matrices(id, name, campaigns(id, name)),
      profiles!executions_created_by_fkey(full_name)
    `)
    .single();

  if (error) {
    console.error('Error updating execution:', error);
    return res.status(500).json({ error: 'Failed to update execution' });
  }

  // Trigger notifications if status changed to completed/failed
  if (updateData.status && ['completed', 'failed'].includes(updateData.status)) {
    await triggerExecutionNotification(execution, updateData.status);
  }

  return res.json({ data: execution });
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse, user: any, executionId: string): Promise<void> {
  // Verify user has access to this execution
  const { data: existingExecution } = await supabase
    .from('executions')
    .select(`
      status,
      matrices(campaigns(clients(id)))
    `)
    .eq('id', executionId)
    .single();

  if (!existingExecution) {
    return res.status(404).json({ error: 'Execution not found' });
  }

  const clientId = (existingExecution as any).matrices?.campaigns?.clients?.id;
  if (!clientId) {
    return res.status(404).json({ error: 'Execution data incomplete' });
  }

  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this execution' });
  }

  // Check if execution can be deleted
  if (['processing', 'pending'].includes(existingExecution.status)) {
    return res.status(409).json({ 
      error: 'Cannot delete active execution',
      details: 'Cancel the execution first, then delete'
    });
  }

  // Soft delete by updating status
  const { error } = await supabase
    .from('executions')
    .update({
      status: 'cancelled',
      metadata: {},
        ...(existingExecution as any).metadata,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id },
  updated_at: new Date().toISOString()})
    .eq('id', executionId);

  if (error) {
    console.error('Error deleting execution:', error);
    return res.status(500).json({ error: 'Failed to delete execution' });
  }

  await logExecutionEvent(executionId, 'deleted', {
    deleted_by: user.id,
    timestamp: new Date().toISOString()});

  return res.status(200).json({ 
    message: 'Execution deleted successfully'});
}

// Helper functions
async function getExecutionLogs(executionId: string): Promise<any[]> {
  try {
    // Get logs from execution_logs table (would need to create this table)
    // For now, return mock logs based on execution events
    const { data: execution } = await supabase
      .from('executions')
      .select('created_at, updated_at, status, metadata')
      .eq('id', executionId)
      .single();

    if (!execution) return [];

    const logs = [
      {
        timestamp: execution.created_at,
        level: 'info',
        message: 'Execution created',
        details: { status: 'pending' }
      },
    ];

    if (execution.status !== 'pending') {
      logs.push({
        timestamp: execution.updated_at,
        level: execution.status === 'failed' ? 'error' : 'info',
        message: `Execution ${execution.status}`,
        details: { status: execution.status }
      });
    }

    return logs;
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error getting execution logs:', error);
    return [];
  }
}

async function getExecutionAnalytics(executionId: string): Promise<any> {
  try {
    const { data: analytics } = await supabase
      .from('campaign_analytics')
      .select('*')
      .eq('execution_id', executionId)
      .order('date', { ascending: false });

    if (!analytics || analytics.length === 0) {
      return { has_data: false };
    }

    const totals = analytics.reduce((acc, record) => {
      acc.impressions += record.impressions || 0;
      acc.clicks += record.clicks || 0;
      acc.conversions += record.conversions || 0;
      acc.spend += parseFloat(record.spend) || 0;
      return acc;
    }, { impressions: 0, clicks: 0, conversions: 0, spend: 0 });

    return {
      has_data: true,
      summary: totals,
      daily_data: analytics};
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error getting execution analytics:', error);
    return { has_data: false, error: 'Failed to retrieve analytics' };
  }
}

function calculateExecutionProgress(execution: any): any {
  const now = new Date().getTime();
  const created = new Date(execution.created_at).getTime();
  const updated = new Date(execution.updated_at).getTime();

  let progressPercentage = 0;
  let estimatedCompletion = null;
  const timeElapsed = (now - created) / 1000; // seconds

  switch (execution.status) {
    case 'pending':
      progressPercentage = 5;
      estimatedCompletion = new Date(now + 2 * 60 * 1000); // 2 minutes
      break;
    case 'processing':
      progressPercentage = execution.metadata?.completion_percentage || 50;
      // Estimate completion based on elapsed time
      const avgProcessingTime = 3 * 60; // 3 minutes average
      const remainingTime = Math.max(0, avgProcessingTime - timeElapsed);
      estimatedCompletion = new Date(now + remainingTime * 1000);
      break;
    case 'completed':
      progressPercentage = 100;
      break;
    case 'failed':
    case 'cancelled':
      progressPercentage = 0;
      break;
    default:
      progressPercentage = 0;
  }

  return {
    percentage: progressPercentage,
    estimated_completion: estimatedCompletion?.toISOString(),
    time_elapsed_seconds: Math.round(timeElapsed),
    status_message: getStatusMessage(execution.status, progressPercentage)};
}

async function getRelatedExecutions(matrixId: string, excludeId: string): Promise<any[]> {
  try {
    const { data: executions } = await supabase
      .from('executions')
      .select('id, status, platform, content_type, created_at')
      .eq('matrix_id', matrixId)
      .neq('id', excludeId)
      .order('created_at', { ascending: false })
      .limit(5);

    return executions || [];
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error getting related executions:', error);
    return [];
  }
}

function generateExecutionInsights(execution: any): string[] {
  const insights: string[] = [];
  const now = new Date().getTime();
  const created = new Date(execution.created_at).getTime();
  const ageMinutes = (now - created) / 1000 / 60;

  // Status-based insights
  switch (execution.status) {
    case 'pending':
      if (ageMinutes > 10) {
        insights.push('Execution has been pending for over 10 minutes - check queue status');
      }
      break;
    case 'processing':
      if (ageMinutes > 15) {
        insights.push('Long processing time detected - consider checking render service');
      }
      break;
    case 'failed':
      insights.push('Execution failed - check error logs and consider retry');
      break;
    case 'completed':
      if (ageMinutes < 2) {
        insights.push('Quick completion - excellent render performance');
      }
      break;
  }

  // Platform-specific insights
  if (execution.platform === 'youtube' && execution.content_type === 'video') {
    insights.push('YouTube video execution - ensure video meets platform requirements');
  }

  // Priority insights
  if (execution.metadata?.priority === 'urgent' && execution.status === 'pending') {
    insights.push('Urgent execution still pending - escalate if needed');
  }

  return insights;
}

function validateStatusTransition(currentStatus: string, newStatus: string): { valid: boolean; error?: string } {
  const validTransitions: Record<string, string[]> = {
    pending: ['processing', 'cancelled', 'failed'],
    processing: ['completed', 'failed', 'cancelled'],
    scheduled: ['pending', 'cancelled'],
    completed: [], // Completed executions cannot change status
    failed: ['pending'], // Failed executions can be retried
    cancelled: ['pending'], // Cancelled executions can be retried
  };

  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    return {
      valid: false,
      error: `Invalid status transition from ${currentStatus} to ${newStatus}`
    };
  }

  return { valid: true };
}

async function logExecutionEvent(executionId: string, eventType: string, details: any): Promise<void> {
  try {
    // In a full implementation, this would log to an execution_events table
    process.env.NODE_ENV === 'development' && console.log('Logging execution event:', event);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error logging execution event:', error);
  }
}

async function triggerExecutionNotification(execution: any, status: string): Promise<void> {
  try {
    // In a full implementation, this would trigger real-time notifications
    // via WebSocket or Server-Sent Events
    process.env.NODE_ENV === 'development' && console.log('Triggering execution notification for:', execution.id);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error triggering execution notification:', error);
  }
}

function getStatusMessage(status: string, percentage: number): string {
  const messages: Record<string, string> = {
    pending: 'Queued for processing',
    processing: `Processing... ${percentage}% complete`,
    completed: 'Execution completed successfully',
    failed: 'Execution failed',
    cancelled: 'Execution cancelled',
    scheduled: 'Scheduled for future execution'};

  return messages[status] || 'Unknown status';
}

export default withAuth(withSecurityHeaders(handler));