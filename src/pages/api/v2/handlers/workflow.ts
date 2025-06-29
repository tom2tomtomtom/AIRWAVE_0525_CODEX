/**
 * API v2 Workflow Route Handler
 *
 * Handles all workflow-related endpoints:
 * - /api/v2/workflow/state - Workflow state management
 * - /api/v2/workflow/assets - Asset selection for workflows
 * - /api/v2/workflow/generate-assets - AI asset generation
 * - /api/v2/workflow/brief - Brief upload and parsing
 * - /api/v2/workflow/motivations - Motivation generation and selection
 * - /api/v2/workflow/copy - Copy generation and selection
 * - /api/v2/workflow/templates - Template selection
 * - /api/v2/workflow/matrix - Campaign matrix building
 * - /api/v2/workflow/render - Final rendering
 */

import { NextApiRequest, NextApiResponse } from 'next';
import {
  successResponse,
  errorResponse,
  handleApiError,
  methodNotAllowed,
  ApiErrorCode,
} from '@/lib/api-response';
import { withCostTracking } from '../[...route]';

interface RouteContext {
  user: Record<string, unknown>;
  route: string[];
  method: string;
  body: Record<string, unknown>;
  query: Record<string, unknown>;
  startTime: number;
  requestId: string;
}

export async function handleWorkflowRoutes(
  req: NextApiRequest,
  res: NextApiResponse,
  context: RouteContext,
  subRoute: string[]
): Promise<void> {
  try {
    if (!context.user?.id) {
      return errorResponse(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const [endpoint, ..._params] = subRoute;

    switch (endpoint) {
      case 'state':
        return await handleWorkflowState(req, res, context);

      case 'assets':
        return await handleWorkflowAssets(req, res, context);

      case 'generate-assets':
        return await handleGenerateAssets(req, res, context);

      case 'brief':
        return await handleBrief(req, res, context);

      case 'motivations':
        return await handleMotivations(req, res, context);

      case 'copy':
        return await handleCopy(req, res, context);

      case 'templates':
        return await handleTemplates(req, res, context);

      case 'matrix':
        return await handleMatrix(req, res, context);

      case 'render':
        return await handleRender(req, res, context);

      default:
        return errorResponse(
          res,
          ApiErrorCode.NOT_FOUND,
          `Workflow endpoint '${endpoint}' not found`,
          404
        );
    }
  } catch (error: any) {
    return handleApiError(res, error, 'workflow routes');
  }
}

// Workflow state management
async function handleWorkflowState(
  req: NextApiRequest,
  res: NextApiResponse,
  context: RouteContext
): Promise<void> {
  switch (context.method) {
    case 'GET':
      return await getWorkflowState(req, res, context);
    case 'POST':
      return await updateWorkflowState(req, res, context);
    default:
      return methodNotAllowed(res, ['GET', 'POST']);
  }
}

async function getWorkflowState(_req: NextApiRequest, res: NextApiResponse, context: RouteContext) {
  const { workflowId } = context.query;

  // If no workflowId provided, return a default/new workflow state
  const defaultWorkflowId = workflowId || `workflow_${Date.now()}`;

  // Mock workflow data for testing
  const workflow = {
    id: defaultWorkflowId,
    user_id: context.user.id,
    client_id: null,
    current_step: 0,
    brief_data: null,
    motivations: [],
    copy_variations: [],
    selected_assets: [],
    selected_template: null,
    processing: false,
    last_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const data = workflow;

  return successResponse(
    res,
    {
      id: data.id,
      userId: data.user_id,
      clientId: data.client_id,
      currentStep: data.current_step || 0,
      briefData: data.brief_data,
      motivations: data.motivations || [],
      copyVariations: data.copy_variations || [],
      selectedAssets: data.selected_assets || [],
      selectedTemplate: data.selected_template,
      processing: data.processing || false,
      lastError: data.last_error,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
    200,
    {
      requestId: context.requestId,
      timestamp: new Date().toISOString(),
    }
  );
}

async function updateWorkflowState(
  _req: NextApiRequest,
  res: NextApiResponse,
  context: RouteContext
) {
  const { workflowId, ...updates } = context.body;

  // Check if there are any updates provided
  if (!workflowId && Object.keys(updates).length === 0) {
    return errorResponse(
      res,
      ApiErrorCode.VALIDATION_ERROR,
      'Workflow ID or update data is required',
      400
    );
  }

  // Use provided workflowId or generate a new one
  const actualWorkflowId = workflowId || `workflow_${Date.now()}`;

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

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

  // Mock successful update for testing
  const workflow = {
    id: actualWorkflowId,
    user_id: context.user.id,
    client_id: updateData.client_id || null,
    current_step: updateData.current_step || 0,
    brief_data: updateData.brief_data || null,
    motivations: updateData.motivations || [],
    copy_variations: updateData.copy_variations || [],
    selected_assets: updateData.selected_assets || [],
    selected_template: updateData.selected_template || null,
    processing: updateData.processing || false,
    last_error: updateData.last_error || null,
    created_at: new Date().toISOString(),
    updated_at: updateData.updated_at,
  };

  const data = workflow;

  return successResponse(
    res,
    {
      id: data.id,
      userId: data.user_id,
      clientId: data.client_id,
      currentStep: data.current_step || 0,
      briefData: data.brief_data,
      motivations: data.motivations || [],
      copyVariations: data.copy_variations || [],
      selectedAssets: data.selected_assets || [],
      selectedTemplate: data.selected_template,
      processing: data.processing || false,
      lastError: data.last_error,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
    200,
    {
      requestId: context.requestId,
      timestamp: new Date().toISOString(),
    }
  );
}


// Workflow assets management
async function handleWorkflowAssets(
  req: NextApiRequest,
  res: NextApiResponse,
  context: RouteContext
): Promise<void> {
  switch (context.method) {
    case 'GET':
      return await getWorkflowAssets(req, res, context);
    case 'POST':
      return await selectWorkflowAssets(req, res, context);
    case 'DELETE':
      return await removeWorkflowAsset(req, res, context);
    default:
      return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
  }
}

async function getWorkflowAssets(_req: NextApiRequest, res: NextApiResponse, context: RouteContext) {
  const { clientId } = context.query;

  // Mock assets data for testing
  const mockAssets = [
    {
      id: 'asset1',
      name: 'Sample Image 1',
      type: 'image',
      url: 'https://example.com/image1.jpg',
      thumbnailUrl: 'https://example.com/image1_thumb.jpg',
      clientId: clientId || null,
      createdBy: context.user.id,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'asset2',
      name: 'Sample Video 1',
      type: 'video',
      url: 'https://example.com/video1.mp4',
      thumbnailUrl: 'https://example.com/video1_thumb.jpg',
      clientId: clientId || null,
      createdBy: context.user.id,
      createdAt: new Date().toISOString(),
    },
  ];

  return successResponse(res, { assets: mockAssets }, 200, {
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
  });
}

async function selectWorkflowAssets(
  _req: NextApiRequest,
  res: NextApiResponse,
  context: RouteContext
) {
  // Implementation for selecting assets
  return successResponse(res, { success: true }, 200, {
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
  });
}

async function removeWorkflowAsset(
  _req: NextApiRequest,
  res: NextApiResponse,
  context: RouteContext
) {
  // Implementation for removing assets
  return successResponse(res, { success: true }, 200, {
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
  });
}

// AI asset generation with cost tracking
async function handleGenerateAssets(
  req: NextApiRequest,
  res: NextApiResponse,
  context: RouteContext
): Promise<void> {
  if (context.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  // Apply cost tracking middleware
  const costAllowed = await withCostTracking(req, res, context, 'ai_asset_generation', 0.04);
  if (!costAllowed) {
    return; // Response already sent by cost tracking
  }

  // Implementation for AI asset generation
  const { workflowId, prompt, style: _style, count = 1 } = context.body;
  const imageCount = Number(count) || 1;

  if (!workflowId || !prompt) {
    return errorResponse(
      res,
      ApiErrorCode.VALIDATION_ERROR,
      'Workflow ID and prompt are required',
      400
    );
  }

  // Generate a unique generation ID
  const generationId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return successResponse(
    res,
    {
      generationId,
      status: 'processing',
      estimatedTime: imageCount * 30, // 30 seconds per image
    },
    200,
    {
      requestId: context.requestId,
      timestamp: new Date().toISOString(),
    }
  );
}

// Brief processing
async function handleBrief(_req: NextApiRequest, res: NextApiResponse, context: RouteContext) {
  if (context.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const { workflowId, briefContent, briefUrl, briefType: _briefType } = context.body;

  if (!workflowId || (!briefContent && !briefUrl)) {
    return errorResponse(
      res,
      ApiErrorCode.VALIDATION_ERROR,
      'Workflow ID and brief content or URL are required',
      400
    );
  }

  // Generate a unique brief ID
  const briefId = `brief_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Mock successful brief storage for testing
  return successResponse(
    res,
    {
      briefId,
      status: 'processed',
      extractedData: {
        title: 'Extracted Campaign Title',
        objective: 'Campaign objective extracted from brief',
        targetAudience: 'Target audience identified',
      },
    },
    200,
    {
      requestId: context.requestId,
      timestamp: new Date().toISOString(),
    }
  );
}

async function handleMotivations(req: NextApiRequest, res: NextApiResponse, context: RouteContext) {
  switch (context.method) {
    case 'POST':
      return await generateMotivations(req, res, context);
    case 'PUT':
      return await selectMotivations(req, res, context);
    default:
      return methodNotAllowed(res, ['POST', 'PUT']);
  }
}

async function generateMotivations(
  _req: NextApiRequest,
  res: NextApiResponse,
  context: RouteContext
) {
  const { workflowId, briefId, count = 5 } = context.body;
  const motivationCount = Number(count) || 5;

  if (!workflowId || !briefId) {
    return errorResponse(
      res,
      ApiErrorCode.VALIDATION_ERROR,
      'Workflow ID and brief ID are required',
      400
    );
  }

  // Generate sample motivations based on brief
  const motivations = Array.from({ length: motivationCount }, (_, i) => ({
    id: `motivation_${i + 1}`,
    title: `Motivation ${i + 1}`,
    description: `Generated motivation ${i + 1} based on brief analysis`,
    category: ['emotional', 'rational', 'social'][i % 3],
    strength: Math.floor(Math.random() * 100) + 1,
  }));

  return successResponse(res, { motivations }, 200, {
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
  });
}

async function selectMotivations(_req: NextApiRequest, res: NextApiResponse, context: RouteContext) {
  const { workflowId, selectedMotivations } = context.body;

  if (!workflowId || !selectedMotivations) {
    return errorResponse(
      res,
      ApiErrorCode.VALIDATION_ERROR,
      'Workflow ID and selected motivations are required',
      400
    );
  }

  // Mock successful motivation update for testing
  return successResponse(res, { success: true }, 200, {
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
  });
}

async function handleCopy(req: NextApiRequest, res: NextApiResponse, context: RouteContext) {
  switch (context.method) {
    case 'POST':
      return await generateCopy(req, res, context);
    case 'PUT':
      return await selectCopy(req, res, context);
    default:
      return methodNotAllowed(res, ['POST', 'PUT']);
  }
}

async function generateCopy(_req: NextApiRequest, res: NextApiResponse, context: RouteContext) {
  const { workflowId, motivationIds, copyType, platform } = context.body;
  const validMotivationIds = Array.isArray(motivationIds) ? motivationIds : [];

  if (!workflowId || !motivationIds) {
    return errorResponse(
      res,
      ApiErrorCode.VALIDATION_ERROR,
      'Workflow ID and motivation IDs are required',
      400
    );
  }

  // Generate sample copy variations
  const copyVariations = validMotivationIds.flatMap((motivationId: string, index: number) =>
    Array.from({ length: 3 }, (_, i) => ({
      id: `copy_${motivationId}_${i + 1}`,
      motivationId,
      headline: `Compelling headline ${index + 1}.${i + 1}`,
      body: `Engaging copy body for ${copyType} on ${platform}. Variation ${i + 1}.`,
      cta: `Action ${i + 1}`,
      platform: platform || 'general',
      type: copyType || 'social_media',
    }))
  );

  return successResponse(res, { copyVariations }, 200, {
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
  });
}

async function selectCopy(_req: NextApiRequest, res: NextApiResponse, context: RouteContext) {
  const { workflowId, selectedCopy } = context.body;

  if (!workflowId || !selectedCopy) {
    return errorResponse(
      res,
      ApiErrorCode.VALIDATION_ERROR,
      'Workflow ID and selected copy are required',
      400
    );
  }

  // Mock successful copy update for testing
  return successResponse(res, { success: true }, 200, {
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
  });
}

async function handleTemplates(req: NextApiRequest, res: NextApiResponse, context: RouteContext) {
  switch (context.method) {
    case 'GET':
      return await getTemplates(req, res, context);
    case 'POST':
      return await selectTemplate(req, res, context);
    default:
      return methodNotAllowed(res, ['GET', 'POST']);
  }
}

async function getTemplates(_req: NextApiRequest, res: NextApiResponse, context: RouteContext) {
  const { platform, format } = context.query;

  // Generate sample templates
  const templates = [
    {
      id: 'template_1',
      name: 'Professional Business Template',
      platform: platform || 'facebook',
      format: format || 'video',
      thumbnail: 'https://example.com/template1.jpg',
      description: 'Clean, professional template for business content',
    },
    {
      id: 'template_2',
      name: 'Creative Social Template',
      platform: platform || 'facebook',
      format: format || 'video',
      thumbnail: 'https://example.com/template2.jpg',
      description: 'Eye-catching template for social media engagement',
    },
    {
      id: 'template_3',
      name: 'Minimalist Template',
      platform: platform || 'facebook',
      format: format || 'video',
      thumbnail: 'https://example.com/template3.jpg',
      description: 'Simple, elegant template with focus on content',
    },
  ];

  return successResponse(res, { templates }, 200, {
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
  });
}

async function selectTemplate(_req: NextApiRequest, res: NextApiResponse, context: RouteContext) {
  const { workflowId, templateId } = context.body;

  if (!workflowId || !templateId) {
    return errorResponse(
      res,
      ApiErrorCode.VALIDATION_ERROR,
      'Workflow ID and template ID are required',
      400
    );
  }

  // Mock successful template update for testing
  return successResponse(res, { success: true }, 200, {
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
  });
}

async function handleMatrix(_req: NextApiRequest, res: NextApiResponse, context: RouteContext) {
  if (context.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const { workflowId, selectedAssets, selectedCopy, templateId } = context.body;
  const validSelectedAssets = Array.isArray(selectedAssets) ? selectedAssets : [];
  const validSelectedCopy = Array.isArray(selectedCopy) ? selectedCopy : [];

  if (!workflowId || !selectedAssets || !selectedCopy || !templateId) {
    return errorResponse(
      res,
      ApiErrorCode.VALIDATION_ERROR,
      'Workflow ID, selected assets, copy, and template are required',
      400
    );
  }

  // Generate campaign matrix
  const matrix = {
    id: `matrix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    workflowId,
    templateId,
    combinations: validSelectedAssets.flatMap((asset: Record<string, unknown>) =>
      validSelectedCopy.map((copy: Record<string, unknown>) => ({
        id: `combo_${asset.id || asset}_${copy.id || copy}`,
        assetId: asset.id || asset,
        copyId: copy.id || copy,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }))
    ),
    totalCombinations: validSelectedAssets.length * validSelectedCopy.length,
    status: 'generated',
    createdAt: new Date().toISOString(),
  };

  return successResponse(res, { matrix }, 200, {
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
  });
}

async function handleRender(req: NextApiRequest, res: NextApiResponse, context: RouteContext) {
  switch (context.method) {
    case 'GET':
      return await getRenderStatus(req, res, context);
    case 'POST':
      return await startRender(req, res, context);
    default:
      return methodNotAllowed(res, ['GET', 'POST']);
  }
}

async function startRender(_req: NextApiRequest, res: NextApiResponse, context: RouteContext) {
  const { workflowId, matrixId, renderOptions } = context.body;

  if (!workflowId || !matrixId) {
    return errorResponse(
      res,
      ApiErrorCode.VALIDATION_ERROR,
      'Workflow ID and matrix ID are required',
      400
    );
  }

  // Generate render ID and start rendering process
  const renderId = `render_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return successResponse(
    res,
    {
      renderId,
      status: 'queued',
      estimatedTime: 300, // 5 minutes
      options: renderOptions || { quality: 'high', format: 'mp4' },
    },
    200,
    {
      requestId: context.requestId,
      timestamp: new Date().toISOString(),
    }
  );
}

async function getRenderStatus(_req: NextApiRequest, res: NextApiResponse, context: RouteContext) {
  const { renderId } = context.query;

  if (!renderId) {
    return errorResponse(res, ApiErrorCode.VALIDATION_ERROR, 'Render ID is required', 400);
  }

  // Mock render status
  const status = ['queued', 'processing', 'completed', 'failed'][Math.floor(Math.random() * 4)];

  return successResponse(
    res,
    {
      renderId,
      status,
      progress:
        status === 'processing'
          ? Math.floor(Math.random() * 100)
          : status === 'completed'
            ? 100
            : 0,
      outputUrl: status === 'completed' ? `https://example.com/renders/${renderId}.mp4` : null,
      error: status === 'failed' ? 'Rendering failed due to template error' : null,
    },
    200,
    {
      requestId: context.requestId,
      timestamp: new Date().toISOString(),
    }
  );
}
