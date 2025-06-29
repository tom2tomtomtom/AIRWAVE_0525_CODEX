import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/auth';
import { supabase } from '@/lib/supabase';
import { errorResponse, ApiErrorCode } from '@/lib/api-response';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return errorResponse(res, ApiErrorCode.METHOD_NOT_ALLOWED, 'Method not allowed', 405);
  }

  try {
    const { queueId, action } = req.query;

    if (!queueId || typeof queueId !== 'string') {
      return errorResponse(res, ApiErrorCode.VALIDATION_ERROR, 'Queue ID is required', 400);
    }

    if (!action || typeof action !== 'string') {
      return errorResponse(res, ApiErrorCode.VALIDATION_ERROR, 'Action is required', 400);
    }

    // Parse queue ID to get matrix_id and campaign_id
    const [matrixId, campaignId] = queueId.split('-');

    if (!matrixId || !campaignId) {
      return errorResponse(res, ApiErrorCode.VALIDATION_ERROR, 'Invalid queue ID format', 400);
    }

    // Get executions for this queue
    const { data: executions, error: fetchError } = await supabase!
      .from('executions')
      .select('id, status')
      .eq('matrix_id', matrixId)
      .eq('campaign_id', campaignId);

    if (fetchError) {
      console.error('Error fetching executions:', fetchError);
      return errorResponse(res, ApiErrorCode.DATABASE_ERROR, 'Failed to fetch executions', 500);
    }

    if (!executions || executions.length === 0) {
      return errorResponse(res, ApiErrorCode.NOT_FOUND, 'No executions found for this queue', 404);
    }

    let updateData: any = {};
    let statusFilter: string[] = [];

    switch (action) {
      case 'pause':
        updateData = { status: 'paused' };
        statusFilter = ['pending', 'processing'];
        break;
      case 'resume':
        updateData = { status: 'pending' };
        statusFilter = ['paused'];
        break;
      case 'stop':
        updateData = { status: 'cancelled' };
        statusFilter = ['pending', 'processing', 'paused'];
        break;
      case 'retry':
        // For retry, we'll handle the retry_count increment separately
        updateData = {
          status: 'pending',
          error_message: null,
        };
        statusFilter = ['failed'];
        break;
      default:
        return errorResponse(res, ApiErrorCode.VALIDATION_ERROR, 'Invalid action', 400);
    }

    // Filter executions that can be affected by this action
    const targetExecutions = executions.filter((e: any) => statusFilter.includes(e.status));

    if (targetExecutions.length === 0) {
      return errorResponse(
        res,
        ApiErrorCode.VALIDATION_ERROR,
        `No executions in appropriate status for ${action}`,
        400
      );
    }

    // Update executions
    const executionIds = targetExecutions.map((e: any) => e.id);
    const { error: updateError } = await supabase!
      .from('executions')
      .update(updateData)
      .in('id', executionIds);

    if (updateError) {
      console.error('Error updating executions:', updateError);
      return errorResponse(res, ApiErrorCode.DATABASE_ERROR, 'Failed to update executions', 500);
    }

    // Log the queue action
    await supabase!.from('execution_logs').insert({
      execution_id: null, // Queue-level action
      action: `queue_${action}`,
      details: {
        queue_id: queueId,
        matrix_id: matrixId,
        campaign_id: campaignId,
        affected_executions: executionIds.length,
        execution_ids: executionIds,
      },
      created_at: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: `Queue ${action} completed successfully`,
      data: {
        queue_id: queueId,
        action,
        affected_executions: executionIds.length,
      },
    });
  } catch (error: any) {
    console.error('Error in queue action API:', error);
    return errorResponse(res, ApiErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}

export default withAuth(handler);
