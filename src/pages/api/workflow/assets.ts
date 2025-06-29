/**
 * @swagger
 * /api/workflow/assets:
 *   post:
 *     summary: Select assets for workflow
 *     description: Add assets to the current workflow session
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
 *               - assetIds
 *               - workflowId
 *             properties:
 *               assetIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of asset IDs to select
 *               workflowId:
 *                 type: string
 *                 description: Workflow session ID
 *               clientId:
 *                 type: string
 *                 description: Client ID for the workflow
 *     responses:
 *       200:
 *         description: Assets selected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 selectedAssets:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Asset'
 *   get:
 *     summary: Get workflow assets
 *     description: Retrieve assets selected for a specific workflow
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
 *         description: Workflow assets retrieved successfully
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withAPIRateLimit } from '@/lib/rate-limiter';
import { successResponse, errorResponse, handleApiError, methodNotAllowed, validateRequiredFields, ApiErrorCode } from '@/lib/api-response';

interface WorkflowAsset {
  id: string;
  type: 'image' | 'video' | 'copy' | 'template';
  url?: string;
  content?: string;
  metadata?: Record<string, any>;
  selected: boolean;
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const user = (req as any).user;

  try {
    switch (req.method) {
      case 'GET':
        return await getWorkflowAssets(req, res, user);
      case 'POST':
        return await selectWorkflowAssets(req, res, user);
      case 'DELETE':
        return await removeWorkflowAsset(req, res, user);
      default:
        return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
    }
  } catch (error: any) {
    return handleApiError(res, error, 'workflow assets handler');
  }
}

// GET - Retrieve assets for a workflow session
async function getWorkflowAssets(
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
      .select('id, selected_assets, client_id')
      .eq('id', workflowId)
      .eq('user_id', userId)
      .single();

    if (workflowError || !workflow) {
      return errorResponse(res, ApiErrorCode.NOT_FOUND, 'Workflow session not found', 404);
    }

    const selectedAssets = workflow.selected_assets || [];

    // If no assets selected, return empty array
    if (selectedAssets.length === 0) {
      return successResponse(res, [], 200, {
        timestamp: new Date().toISOString()
      });
    }

    // Get full asset details
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select(`
        id,
        name,
        type,
        file_url,
        thumbnail_url,
        description,
        tags,
        metadata,
        file_size,
        mime_type,
        duration,
        dimensions,
        created_at
      `)
      .in('id', selectedAssets);

    if (assetsError) {
      throw new Error(`Failed to fetch assets: ${assetsError.message}`);
    }

    // Convert to workflow asset format
    const workflowAssets: WorkflowAsset[] = (assets || []).map((asset: any) => ({
      id: asset.id,
      type: asset.type === 'voice' ? 'copy' : asset.type, // Map voice to copy for workflow
      url: asset.file_url,
      content: asset.type === 'text' ? asset.description : undefined,
      metadata: {
        ...asset.metadata,
        name: asset.name,
        description: asset.description,
        tags: asset.tags,
        thumbnailUrl: asset.thumbnail_url,
        size: asset.file_size,
        mimeType: asset.mime_type,
        duration: asset.duration,
        width: asset.dimensions?.width,
        height: asset.dimensions?.height,
        dateCreated: asset.created_at },
  selected: true}));

    return successResponse(res, workflowAssets, 200, {
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    return handleApiError(res, error, 'getWorkflowAssets');
  }
}

// POST - Select assets for workflow
async function selectWorkflowAssets(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any
): Promise<void> {
  try {
    const userId = user?.id;
    if (!userId) {
      return errorResponse(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { assetIds, workflowId, clientId } = req.body;

    // Validate required fields
    const missingFields = validateRequiredFields(req.body, ['assetIds', 'workflowId']);
    if (missingFields.length > 0) {
      return errorResponse(
        res,
        ApiErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${missingFields.join(', ')}`,
        400
      );
    }

    if (!Array.isArray(assetIds)) {
      return errorResponse(res, ApiErrorCode.VALIDATION_ERROR, 'assetIds must be an array', 400);
    }

    // Verify assets exist and user has access
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('id, client_id')
      .in('id', assetIds);

    if (assetsError) {
      throw new Error(`Failed to verify assets: ${assetsError.message}`);
    }

    if (!assets || assets.length !== assetIds.length) {
      return errorResponse(res, ApiErrorCode.NOT_FOUND, 'Some assets not found', 404);
    }

    // Update or create workflow session
    const { data: _workflow, error: workflowError } = await supabase
      .from('workflow_sessions')
      .upsert({
        id: workflowId,
        user_id: userId,
        client_id: clientId,
        selected_assets: assetIds,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (workflowError) {
      throw new Error(`Failed to update workflow: ${workflowError.message}`);
    }

    return successResponse(res, { selectedAssets: assetIds }, 200, {
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    return handleApiError(res, error, 'selectWorkflowAssets');
  }
}

// DELETE - Remove asset from workflow
async function removeWorkflowAsset(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any
): Promise<void> {
  try {
    const userId = user?.id;
    if (!userId) {
      return errorResponse(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { workflowId, assetId } = req.query;

    if (!workflowId || !assetId) {
      return errorResponse(res, ApiErrorCode.VALIDATION_ERROR, 'Workflow ID and Asset ID are required', 400);
    }

    // Get current workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('workflow_sessions')
      .select('selected_assets')
      .eq('id', workflowId)
      .eq('user_id', userId)
      .single();

    if (workflowError || !workflow) {
      return errorResponse(res, ApiErrorCode.NOT_FOUND, 'Workflow session not found', 404);
    }

    const currentAssets = workflow.selected_assets || [];
    const updatedAssets = currentAssets.filter((id: string) => id !== assetId);

    // Update workflow
    const { error: updateError } = await supabase
      .from('workflow_sessions')
      .update({
        selected_assets: updatedAssets,
        updated_at: new Date().toISOString()
      })
      .eq('id', workflowId)
      .eq('user_id', userId);

    if (updateError) {
      throw new Error(`Failed to update workflow: ${updateError.message}`);
    }

    return successResponse(res, { removedAssetId: assetId }, 200, {
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    return handleApiError(res, error, 'removeWorkflowAsset');
  }
}

export default withAuth(withAPIRateLimit(handler));
