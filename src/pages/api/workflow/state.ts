/**
 * @swagger
 * /api/workflow/state:
 *   get:
 *     summary: Get workflow state
 *     description: Retrieve the current state of a workflow session
 *     tags: [Workflow]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: workflowId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow session ID
 *     responses:
 *       200:
 *         description: Workflow state retrieved successfully
 *   post:
 *     summary: Update workflow state
 *     description: Update the state of a workflow session
 *     tags: [Workflow]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workflowId
 *             properties:
 *               workflowId:
 *                 type: string
 *               currentStep:
 *                 type: integer
 *               briefData:
 *                 type: object
 *               motivations:
 *                 type: array
 *               copyVariations:
 *                 type: array
 *               selectedAssets:
 *                 type: array
 *               selectedTemplate:
 *                 type: object
 *               clientId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Workflow state updated successfully
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withAPIRateLimit } from '@/lib/rate-limiter';
import {
  successResponse,
  errorResponse,
  handleApiError,
  methodNotAllowed,
  ApiErrorCode} from '@/lib/api-response';

interface WorkflowState {
  id: string;
  userId: string;
  clientId?: string;
  currentStep: number;
  briefData?: any;
  motivations?: any[];
  copyVariations?: any[];
  selectedAssets?: string[];
  selectedTemplate?: any;
  processing?: boolean;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const user = (req as any).user;

  try {
    switch (req.method) {
      case 'GET':
        return await getWorkflowState(req, res, user);
      case 'POST':
        return await updateWorkflowState(req, res, user);
      case 'DELETE':
        return await deleteWorkflowState(req, res, user);
      default:
        return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
    }
  } catch (error: any) {
    return handleApiError(res, error, 'workflow state handler');
  }
}

// GET - Retrieve workflow state
async function getWorkflowState(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any
): Promise<void> {
  try {
    const userId = user?.id;
    if (!userId) {
      return errorResponse(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { workflowId } = req.query;

    if (!workflowId) {
      return errorResponse(res, ApiErrorCode.VALIDATION_ERROR, 'Workflow ID is required', 400);
    }

    // Get workflow session
    const { data: workflow, error: workflowError } = await supabase
      .from('workflow_sessions')
      .select('*')
      .eq('id', workflowId)
      .eq('user_id', userId)
      .single();

    if (workflowError || !workflow) {
      return errorResponse(res, ApiErrorCode.NOT_FOUND, 'Workflow session not found', 404);
    }

    const workflowState: WorkflowState = {
      id: workflow.id,
      userId: workflow.user_id,
      clientId: workflow.client_id,
      currentStep: workflow.current_step || 0,
      briefData: workflow.brief_data,
      motivations: workflow.motivations || [],
      copyVariations: workflow.copy_variations || [],
      selectedAssets: workflow.selected_assets || [],
      selectedTemplate: workflow.selected_template,
      processing: workflow.processing || false,
      lastError: workflow.last_error,
      createdAt: workflow.created_at,
      updatedAt: workflow.updated_at };

    return successResponse(res, workflowState, 200, {
      timestamp: new Date().toISOString() });
  } catch (error: any) {
    return handleApiError(res, error, 'getWorkflowState');
  }
}

// POST - Update workflow state
async function updateWorkflowState(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any
): Promise<void> {
  try {
    const userId = user?.id;
    if (!userId) {
      return errorResponse(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { workflowId, ...updates } = req.body;

    if (!workflowId) {
      return errorResponse(res, ApiErrorCode.VALIDATION_ERROR, 'Workflow ID is required', 400);
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString() };

    // Map frontend fields to database fields
    if (updates.currentStep !== undefined) updateData.current_step = updates.currentStep;
    if (updates.briefData !== undefined) updateData.brief_data = updates.briefData;
    if (updates.motivations !== undefined) updateData.motivations = updates.motivations;
    if (updates.copyVariations !== undefined) updateData.copy_variations = updates.copyVariations;
    if (updates.selectedAssets !== undefined) updateData.selected_assets = updates.selectedAssets;
    if (updates.selectedTemplate !== undefined)
      updateData.selected_template = updates.selectedTemplate;
    if (updates.processing !== undefined) updateData.processing = updates.processing;
    if (updates.lastError !== undefined) updateData.last_error = updates.lastError;
    if (updates.clientId !== undefined) updateData.client_id = updates.clientId;

    // Update or create workflow session
    const { data: workflow, error: workflowError } = await supabase
      .from('workflow_sessions')
      .upsert(
        {
          id: workflowId,
          user_id: userId,
          ...updateData},
        {
          onConflict: 'id' }
      )
      .select('*')
      .single();

    if (workflowError) {
      throw new Error(`Failed to update workflow: ${workflowError.message}`);
    }

    const workflowState: WorkflowState = {
      id: workflow.id,
      userId: workflow.user_id,
      clientId: workflow.client_id,
      currentStep: workflow.current_step || 0,
      briefData: workflow.brief_data,
      motivations: workflow.motivations || [],
      copyVariations: workflow.copy_variations || [],
      selectedAssets: workflow.selected_assets || [],
      selectedTemplate: workflow.selected_template,
      processing: workflow.processing || false,
      lastError: workflow.last_error,
      createdAt: workflow.created_at,
      updatedAt: workflow.updated_at };

    return successResponse(res, workflowState, 200, {
      timestamp: new Date().toISOString() });
  } catch (error: any) {
    return handleApiError(res, error, 'updateWorkflowState');
  }
}

// DELETE - Delete workflow state
async function deleteWorkflowState(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any
): Promise<void> {
  try {
    const userId = user?.id;
    if (!userId) {
      return errorResponse(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { workflowId } = req.query;

    if (!workflowId) {
      return errorResponse(res, ApiErrorCode.VALIDATION_ERROR, 'Workflow ID is required', 400);
    }

    // Delete workflow session
    const { error: deleteError } = await supabase
      .from('workflow_sessions')
      .delete()
      .eq('id', workflowId)
      .eq('user_id', userId);

    if (deleteError) {
      throw new Error(`Failed to delete workflow: ${deleteError.message}`);
    }

    return successResponse(res, { deleted: true }, 200, {
      timestamp: new Date().toISOString() });
  } catch (error: any) {
    return handleApiError(res, error, 'deleteWorkflowState');
  }
}

export default withAuth(withAPIRateLimit(handler));
