import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';
import { loggers } from '@/lib/logger';


const CancelRequestSchema = z.object({
  reason: z.string().optional(),
  force: z.boolean().default(false), // Force cancel even if in non-cancellable state
  cleanup_resources: z.boolean().default(true), // Clean up external resources (Creatomate jobs)
});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const { id } = req.query;
  const user = (req as any).user;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Execution ID is required' });
  }

  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return handleCancel(req, res, user, id);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Execution Cancel API error:', message, error);
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

async function handleCancel(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  executionId: string
): Promise<void> {
  const validationResult = CancelRequestSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  const cancelData = validationResult.data;

  // First verify user has access to this execution
  const { data: execution, error } = await supabase
    .from('executions')
    .select(
      `
      *,
      matrices(
        id, name,
        campaigns(
          id, name, status,
          clients(id, name)
        )
      )
    `
    )
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

  // Check if execution can be cancelled
  const cancellabilityCheck = checkCancellability(execution, cancelData.force);
  if (!cancellabilityCheck.canCancel) {
    return res.status(400).json({
      error: cancellabilityCheck.reason,
      current_status: execution.status,
      suggestions: cancellabilityCheck.suggestions,
    });
  }

  // Attempt to cancel external resources first
  const cleanupResults = [];
  if (cancelData.cleanup_resources) {
    const externalCleanup = await cleanupExternalResources(execution);
    cleanupResults.push(externalCleanup);
  }

  // Update execution status to cancelled
  const { data: cancelledExecution, error: cancelError } = await supabase
    .from('executions')
    .update({
      status: 'cancelled',
      metadata: {
        ...execution.metadata,
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancel_reason: cancelData.reason,
        force_cancelled: cancelData.force,
        cleanup_results: cleanupResults,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', executionId)
    .select(
      `
      *,
      matrices(id, name, campaigns(id, name)),
      profiles!executions_created_by_fkey(full_name)
    `
    )
    .single();

  if (cancelError) {
    console.error('Error cancelling execution:', cancelError);
    return res.status(500).json({ error: 'Failed to cancel execution' });
  }

  // Log cancellation event
  await logCancellationEvent(executionId, user.id, cancelData.reason, cancelData.force);

  // Trigger notifications
  await triggerCancellationNotification(cancelledExecution, user);

  // Handle related executions if this was part of a batch
  const relatedResults = await handleRelatedExecutions(execution, cancelData.force);

  return res.json({
    message: 'Execution cancelled successfully',
    data: {
      execution: cancelledExecution,
      cleanup_results: cleanupResults,
      related_executions: relatedResults,
      cancelled_at: new Date().toISOString(),
    },
  });
}

// Helper functions
function checkCancellability(
  execution: any,
  force: boolean
): { canCancel: boolean; reason?: string; suggestions?: string[] } {
  const cancellableStatuses = ['pending', 'processing', 'scheduled'];

  if (!force && !cancellableStatuses.includes(execution.status)) {
    return {
      canCancel: false,
      reason: `Execution in ${execution.status} state cannot be cancelled`,
      suggestions: [
        'Completed and failed executions cannot be cancelled',
        'Use force=true to override status check for cleanup purposes',
      ],
    };
  }

  // Check if execution is already being cancelled
  if (execution.metadata?.cancellation_in_progress) {
    return {
      canCancel: false,
      reason: 'Execution cancellation already in progress',
      suggestions: [
        'Wait for the current cancellation to complete',
        'Check execution status in a few moments',
      ],
    };
  }

  // Check if execution has critical dependencies
  if (execution.metadata?.has_dependencies && !force) {
    return {
      canCancel: false,
      reason: 'Execution has critical dependencies',
      suggestions: [
        'Review dependent executions first',
        'Use force=true to override dependency check',
        'Cancel dependent executions individually',
      ],
    };
  }

  return { canCancel: true };
}

async function cleanupExternalResources(execution: any): Promise<any> {
  const cleanupResult = {
    success: false,
    resources_cleaned: [] as any[],
    errors: [] as any[],
    timestamp: new Date().toISOString(),
  };

  try {
    // Check if this is a Creatomate execution
    const jobId = execution.metadata?.job_id;
    const isCreatomate = execution.metadata?.template_data?.is_creatomate;

    if (isCreatomate && jobId) {
      // Attempt to cancel Creatomate job
      const creatomateResult = await cancelCreatomateJob(jobId);
      if (creatomateResult.success) {
        cleanupResult.resources_cleaned.push({
          type: 'creatomate_job',
          resource_id: jobId,
          status: 'cancelled',
        });
      } else {
        cleanupResult.errors.push({
          type: 'creatomate_job',
          resource_id: jobId,
          error: creatomateResult.error,
        });
      }
    }

    // Check for other external resources
    if (execution.metadata?.webhook_ids) {
      // Cancel any pending webhooks
      const webhookResults = await cancelPendingWebhooks(execution.metadata.webhook_ids);
      cleanupResult.resources_cleaned.push(...webhookResults.cleaned);
      cleanupResult.errors.push(...webhookResults.errors);
    }

    // Check for file storage cleanup
    if (execution.metadata?.temp_files) {
      const fileCleanup = await cleanupTempFiles(execution.metadata.temp_files);
      if (fileCleanup.success) {
        cleanupResult.resources_cleaned.push({
          type: 'temp_files',
          count: fileCleanup.files_cleaned,
        });
      }
    }

    cleanupResult.success = cleanupResult.errors.length === 0;
    return cleanupResult;
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error cleaning up external resources:', message, error);
    cleanupResult.errors.push({
      type: 'general_cleanup',
      error: error instanceof Error ? error.message : String(error),
    });
    return cleanupResult;
  }
}

async function cancelCreatomateJob(jobId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // In a real implementation, this would call Creatomate API
    // For now, simulate the cancellation
    process.env.NODE_ENV === 'development' && loggers.general.error('Cancelling Creatomate render:', jobId);
    // Mock API call delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return { success: true };
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Creatomate job cancellation error:', message);
    return {
      success: false,
      error: `Failed to cancel Creatomate job: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function cancelPendingWebhooks(
  webhookIds: string[]
): Promise<{ cleaned: any[]; errors: any[] }> {
  const cleaned: any[] = [];
  const errors: any[] = [];

  for (const webhookId of webhookIds) {
    try {
      // Simulate webhook cancellation
      process.env.NODE_ENV === 'development' && loggers.general.error('Cleaning up webhook:', webhookId);
      cleaned.push({
        type: 'webhook',
        resource_id: webhookId,
        status: 'cancelled',
      });
    } catch (error: any) {
      const message = getErrorMessage(error);
      console.error('Webhook cancellation error:', message);
      errors.push({
        type: 'webhook',
        resource_id: webhookId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { cleaned, errors };
}

async function cleanupTempFiles(
  tempFiles: string[]
): Promise<{ success: boolean; files_cleaned: number }> {
  try {
    // Simulate file cleanup
    process.env.NODE_ENV === 'development' &&
      loggers.general.error('Cleaning up temp files:', tempFiles.length);
    return { success: true, files_cleaned: tempFiles.length };
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error cleaning up temp files:', message, error);
    return { success: false, files_cleaned: 0 };
  }
}

async function handleRelatedExecutions(execution: any, force: boolean): Promise<any> {
  try {
    // Find related executions in the same matrix
    const { data: relatedExecutions } = await supabase
      .from('executions')
      .select('id, status, metadata')
      .eq('matrix_id', execution.matrix_id)
      .neq('id', execution.id)
      .in('status', ['pending', 'processing']);

    if (!relatedExecutions || relatedExecutions.length === 0) {
      return { affected_count: 0, actions: [] };
    }

    const actions: any[] = [];

    // Check if any related executions depend on this one
    for (const related of relatedExecutions) {
      const dependsOnCancelled = related.metadata?.dependencies?.includes(execution.id);

      if (dependsOnCancelled) {
        if (force) {
          // Cancel dependent executions
          await supabase
            .from('executions')
            .update({
              status: 'cancelled',
              metadata: {
                ...related.metadata,
                cancelled_due_to_dependency: execution.id,
                cancelled_at: new Date().toISOString(),
              },
            })
            .eq('id', related.id);

          actions.push({
            execution_id: related.id,
            action: 'cancelled',
            reason: 'dependency_cancelled',
          });
        } else {
          actions.push({
            execution_id: related.id,
            action: 'flagged',
            reason: 'dependency_cancelled',
            recommendation: 'Review and potentially cancel',
          });
        }
      }
    }

    return {
      affected_count: relatedExecutions.length,
      actions,
    };
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error handling related executions:', message, error);
    return {
      affected_count: 0,
      actions: [],
      error: 'Failed to process related executions',
    };
  }
}

async function logCancellationEvent(
  executionId: string,
  userId: string,
  reason?: string,
  force?: boolean
): Promise<void> {
  try {
    // In a full implementation, this would log to an execution_events table
    console.log(`Execution cancelled: ${executionId} by user ${userId}`, {
      reason,
      force,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error logging cancellation event:', message, error);
  }
}

async function triggerCancellationNotification(execution: any, _user: any): Promise<void> {
  try {
    // In a full implementation, this would trigger real-time notifications
    // via WebSocket or Server-Sent Events to relevant stakeholders
    process.env.NODE_ENV === 'development' &&
      loggers.general.error('Triggering cancellation notification for execution:', execution.id);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error triggering cancellation notification:', message, error);
  }
}

export default withAuth(withSecurityHeaders(handler));
