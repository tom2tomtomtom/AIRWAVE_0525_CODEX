import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/auth';
import { supabase } from '@/lib/supabase';
import { errorResponse, ApiErrorCode } from '@/lib/api-response';

interface ExecutionStats {
  total_executions: number;
  pending_executions: number;
  processing_executions: number;
  completed_executions: number;
  failed_executions: number;
  success_rate: number;
  average_completion_time: number;
  total_processing_time: number;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return errorResponse(res, ApiErrorCode.METHOD_NOT_ALLOWED, 'Method not allowed', 405);
  }

  try {
    const { client_id } = req.query;

    if (!client_id || typeof client_id !== 'string') {
      return errorResponse(res, ApiErrorCode.VALIDATION_ERROR, 'Client ID is required', 400);
    }

    if (!supabase) {
      return errorResponse(res, ApiErrorCode.INTERNAL_ERROR, 'Database connection error', 500);
    }

    // Get execution statistics
    const { data: executions, error: executionsError } = await supabase
      .from('executions')
      .select(
        `
        id,
        status,
        created_at,
        completed_at,
        matrices!inner(
          client_id
        )
      `
      )
      .eq('matrices.client_id', client_id);

    if (executionsError) {
      console.error('Error fetching executions:', executionsError);
      return errorResponse(res, ApiErrorCode.DATABASE_ERROR, 'Failed to fetch executions', 500);
    }

    const totalExecutions = executions?.length || 0;
    const pendingExecutions = executions?.filter((e: any) => e.status === 'pending').length || 0;
    const processingExecutions =
      executions?.filter((e: any) => e.status === 'processing').length || 0;
    const completedExecutions =
      executions?.filter((e: any) => e.status === 'completed').length || 0;
    const failedExecutions = executions?.filter((e: any) => e.status === 'failed').length || 0;

    // Calculate success rate
    const finishedExecutions = completedExecutions + failedExecutions;
    const successRate = finishedExecutions > 0 ? completedExecutions / finishedExecutions : 0;

    // Calculate average completion time (in minutes)
    const completedWithTimes =
      executions?.filter((e: any) => e.status === 'completed' && e.created_at && e.completed_at) ||
      [];

    let averageCompletionTime = 0;
    let totalProcessingTime = 0;

    if (completedWithTimes.length > 0) {
      const completionTimes = completedWithTimes.map((e: any) => {
        const created = new Date(e.created_at).getTime();
        const completed = new Date(e.completed_at).getTime();
        return (completed - created) / (1000 * 60); // Convert to minutes
      });

      totalProcessingTime = completionTimes.reduce((sum, time) => sum + time, 0);
      averageCompletionTime = totalProcessingTime / completionTimes.length;
    }

    const stats: ExecutionStats = {
      total_executions: totalExecutions,
      pending_executions: pendingExecutions,
      processing_executions: processingExecutions,
      completed_executions: completedExecutions,
      failed_executions: failedExecutions,
      success_rate: successRate,
      average_completion_time: averageCompletionTime,
      total_processing_time: totalProcessingTime };

    res.status(200).json({
      success: true,
      data: stats });
  } catch (error: any) {
    console.error('Error in execution stats API:', error);
    return errorResponse(res, ApiErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}

export default withAuth(handler);
