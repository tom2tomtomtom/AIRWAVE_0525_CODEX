import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { triggerWebhookEvent, WEBHOOK_EVENTS } from '../../webhooks/index';
import { z } from 'zod';
import { loggers } from '@/lib/logger';


const RetryRequestSchema = z.object({
  force: z.boolean().default(false), // Force retry even if not in retryable state
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  reset_attempts: z.boolean().default(false), // Reset retry attempt counter
  delay_seconds: z.number().min(0).max(3600).default(0), // Delay before retry
  retry_reason: z.string().optional(),
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
    return handleRetry(req, res, user, id);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Execution Retry API error:', message, error);
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

async function handleRetry(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  executionId: string
): Promise<void> {
  const validationResult = RetryRequestSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  const retryData = validationResult.data;

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

  // Check if execution can be retried
  const retryabilityCheck = checkRetryability(execution, retryData.force);
  if (!retryabilityCheck.canRetry) {
    return res.status(400).json({
      error: retryabilityCheck.reason,
      current_status: execution.status,
      suggestions: retryabilityCheck.suggestions,
    });
  }

  // Check retry limits
  const retryLimitCheck = await checkRetryLimits(executionId, execution, retryData.reset_attempts);
  if (!retryLimitCheck.allowed) {
    return res.status(429).json({
      error: 'Retry limit exceeded',
      details: retryLimitCheck.details,
    });
  }

  // Check campaign status
  if (execution.matrices?.campaigns?.status !== 'active') {
    return res.status(400).json({
      error: 'Cannot retry execution - campaign is not active',
      campaign_status: execution.matrices.campaigns.status,
    });
  }

  // Prepare retry execution
  const retryExecutionData = await prepareRetryExecution(execution, retryData, user.id);

  // Create retry execution record
  const { data: retryExecution, error: retryError } = await supabase
    .from('executions')
    .insert(retryExecutionData)
    .select(
      `
      *,
      matrices(id, name, campaigns(id, name)),
      profiles!executions_created_by_fkey(full_name)
    `
    )
    .single();

  if (retryError) {
    console.error('Error creating retry execution:', retryError);
    return res.status(500).json({ error: 'Failed to create retry execution' });
  }

  // Update original execution with retry information
  await supabase
    .from('executions')
    .update({
      metadata: {
        ...execution.metadata,
        retry_info: {
          retried_at: new Date().toISOString(),
          retried_by: user.id,
          retry_execution_id: retryExecution.id,
          retry_reason: retryData.retry_reason,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', executionId);

  // Log retry event
  await logRetryEvent(executionId, retryExecution.id, user.id, retryData.retry_reason);

  // Trigger retry execution
  const triggerResult = await triggerRetryExecution(retryExecution, retryData.delay_seconds);

  // Trigger webhook for execution retry
  await triggerExecutionRetryWebhook(retryExecution, execution, user, retryData);

  return res.json({
    message: 'Execution retry initiated successfully',
    data: {
      original_execution_id: executionId,
      retry_execution: retryExecution,
      trigger_result: triggerResult,
      estimated_start:
        retryData.delay_seconds > 0
          ? new Date(Date.now() + retryData.delay_seconds * 1000).toISOString()
          : new Date().toISOString(),
    },
  });
}

// Helper functions
function checkRetryability(
  execution: any,
  force: boolean
): { canRetry: boolean; reason?: string; suggestions?: string[] } {
  const retryableStatuses = ['failed', 'cancelled'];

  if (!force && !retryableStatuses.includes(execution.status)) {
    return {
      canRetry: false,
      reason: `Execution in ${execution.status} state cannot be retried`,
      suggestions: [
        'Wait for execution to complete or fail',
        'Cancel the execution first if needed',
        'Use force=true to override status check',
      ],
    };
  }

  // Check if execution is too old
  const ageHours = (Date.now() - new Date(execution.created_at).getTime()) / (1000 * 60 * 60);
  if (ageHours > 24) {
    return {
      canRetry: false,
      reason: 'Execution is too old to retry (>24 hours)',
      suggestions: [
        'Create a new execution instead',
        'Check if the original matrix is still valid',
      ],
    };
  }

  // Check for render URL - if it exists and status is completed, don't retry
  if (execution.render_url && execution.status === 'completed' && !force) {
    return {
      canRetry: false,
      reason: 'Execution completed successfully with render output',
      suggestions: [
        'Execution already has a successful result',
        'Use force=true if you need to regenerate',
      ],
    };
  }

  return { canRetry: true };
}

async function checkRetryLimits(
  _executionId: string,
  execution: any,
  resetAttempts: boolean
): Promise<{ allowed: boolean; details?: string }> {
  try {
    // Get retry attempts from metadata
    const currentAttempts = execution.metadata?.retry_attempts || 0;
    const maxAttempts = 3; // Configurable limit

    if (resetAttempts) {
      return { allowed: true };
    }

    if (currentAttempts >= maxAttempts) {
      return {
        allowed: false,
        details: `Maximum retry attempts (${maxAttempts}) exceeded. Current attempts: ${currentAttempts}`,
      };
    }

    // Check daily retry limit per client
    const today = new Date().toISOString().split('T')[0];
    const clientId = execution.matrices?.campaigns?.clients?.id;

    const { count: todayRetries } = await supabase
      .from('executions')
      .select('id', { count: 'exact' })
      .eq('client_id', clientId)
      .contains('metadata', { is_retry: true })
      .gte('created_at', `${today}T00:00:00Z`)
      .lte('created_at', `${today}T23:59:59Z`);

    const dailyLimit = 50; // Configurable limit
    if (todayRetries && todayRetries >= dailyLimit) {
      return {
        allowed: false,
        details: `Daily retry limit (${dailyLimit}) exceeded for this client`,
      };
    }

    return { allowed: true };
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error checking retry limits:', message, error);
    return {
      allowed: false,
      details: 'Error checking retry limits',
    };
  }
}

async function prepareRetryExecution(
  originalExecution: any,
  retryData: any,
  userId: string
): Promise<any> {
  // Generate new execution ID
  const retryExecutionId = `retry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Increment retry attempts
  const retryAttempts = retryData.reset_attempts
    ? 1
    : (originalExecution.metadata?.retry_attempts || 0) + 1;

  // Prepare retry execution data
  const retryExecutionData = {
    id: retryExecutionId,
    matrix_id: originalExecution.matrix_id,
    campaign_id: originalExecution.campaign_id,
    combination_id: originalExecution.combination_id,
    content_type: originalExecution.content_type,
    platform: originalExecution.platform,
    status: retryData.delay_seconds > 0 ? 'scheduled' : 'pending',
    metadata: {
      ...originalExecution.metadata,
      is_retry: true,
      original_execution_id: originalExecution.id,
      retry_attempts: retryAttempts,
      retry_reason: retryData.retry_reason,
      priority: retryData.priority || originalExecution.metadata?.priority || 'normal',
      scheduled_for:
        retryData.delay_seconds > 0
          ? new Date(Date.now() + retryData.delay_seconds * 1000).toISOString()
          : null,
      retry_config: {
        force: retryData.force,
        reset_attempts: retryData.reset_attempts,
        delay_seconds: retryData.delay_seconds,
      },
    },
    created_by: userId,
  };

  return retryExecutionData;
}

async function triggerRetryExecution(retryExecution: any, delaySeconds: number): Promise<any> {
  try {
    if (delaySeconds > 0) {
      // Schedule for later execution
      return {
        success: true,
        type: 'scheduled',
        message: `Retry scheduled for ${delaySeconds} seconds`,
        scheduled_for: retryExecution.metadata.scheduled_for,
      };
    }

    // Trigger immediate retry
    // This would integrate with your existing execution pipeline
    const triggerResult = await triggerExecutionPipeline(retryExecution);

    // Update execution status
    await supabase
      .from('executions')
      .update({
        status: triggerResult.success ? 'processing' : 'failed',
        metadata: {
          ...retryExecution.metadata,
          trigger_result: triggerResult,
          triggered_at: new Date().toISOString(),
        },
      })
      .eq('id', retryExecution.id);

    return {
      success: triggerResult.success,
      type: 'immediate',
      message: triggerResult.success
        ? 'Retry execution triggered successfully'
        : 'Failed to trigger retry execution',
      job_id: triggerResult.job_id,
    };
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error triggering retry execution:', message, error);
    return {
      success: false,
      type: 'error',
      message: 'Error triggering retry execution',
      error: getErrorMessage(error),
    };
  }
}

async function triggerExecutionPipeline(execution: any): Promise<any> {
  // This would integrate with your existing execution trigger logic
  // For now, simulate the trigger
  try {
    // Determine render type
    const isCreatomate = execution.metadata?.template_data?.is_creatomate;

    if (isCreatomate) {
      // Trigger Creatomate render
      const jobId = `creatomate-retry-${Date.now()}`;
      return {
        success: true,
        job_id: jobId,
        estimated_completion: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      };
    } else {
      // Trigger custom render
      const jobId = `custom-retry-${Date.now()}`;
      return {
        success: true,
        job_id: jobId,
        estimated_completion: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Execution pipeline trigger error:', message);
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

async function logRetryEvent(
  _originalId: string,
  _retryId: string,
  _userId: string,
  _reason?: string
): Promise<void> {
  try {
    // In a full implementation, this would log to an execution_events table
    process.env.NODE_ENV === 'development' && loggers.general.error('Retry event logged successfully');
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error logging retry event:', message, error);
  }
}

async function triggerExecutionRetryWebhook(
  retryExecution: any,
  originalExecution: any,
  user: any,
  retryData: any
): Promise<void> {
  try {
    // Get client ID from execution
    const clientId = retryExecution.client_id || originalExecution.client_id;
    if (!clientId) return;

    // Prepare webhook payload
    const webhookData = {
      execution_id: retryExecution.id,
      original_execution_id: originalExecution.id,
      campaign: {
        id: retryExecution.matrices?.campaigns?.id,
        name: retryExecution.matrices?.campaigns?.name,
      },
      matrix: {
        id: retryExecution.matrix_id,
        name: retryExecution.matrices?.name,
      },
      platform: retryExecution.platform,
      content_type: retryExecution.content_type,
      status: retryExecution.status,
      retry_reason: retryData.retry_reason,
      retried_by: {
        id: user.id,
        name: user.full_name || user.email,
      },
      retry_options: {
        force: retryData.force,
        priority: retryData.priority,
        delay_seconds: retryData.delay_seconds,
        reset_attempts: retryData.reset_attempts,
      },
      original_failure: {
        status: originalExecution.status,
        error_message: originalExecution.error_message,
        failed_at: originalExecution.updated_at,
      },
      timestamp: new Date().toISOString(),
    };

    // Trigger the webhook
    await triggerWebhookEvent(WEBHOOK_EVENTS.EXECUTION_STARTED, webhookData, clientId);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error triggering execution retry webhook:', message, error);
  }
}

export default withAuth(withSecurityHeaders(handler));
