import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';

const ExecuteRequestSchema = z.object({
  combinations: z.array(z.string()).optional(), // Specific combination IDs to execute
  platforms: z.array(z.string()).optional(),    // Specific platforms to target
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  schedule_type: z.enum(['immediate', 'scheduled', 'batch']).default('immediate'),
  scheduled_for: z.string().optional(),          // ISO timestamp for scheduled execution
  batch_size: z.number().min(1).max(50).default(5), // For batch processing
  execution_settings: z.object({
    quality: z.enum(['draft', 'standard', 'high']).default('standard'),
    formats: z.array(z.string()).default(['mp4', 'jpg']),
    resolutions: z.array(z.string()).default(['1920x1080']),
    include_previews: z.boolean().default(true),
    notify_on_completion: z.boolean().default(true)}).optional()});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const { id } = req.query;
  const user = (req as any).user;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Matrix ID is required' });
  }

  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return handleExecute(req, res, user, id);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Matrix Execute API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? message : undefined
    });
  }
}

async function handleExecute(req: NextApiRequest, res: NextApiResponse, user: any, matrixId: string): Promise<void> {
  const validationResult = ExecuteRequestSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: validationResult.error.issues
    });
  }

  const executeData = validationResult.data;

  // First verify user has access to this matrix
  const { data: matrix, error } = await supabase
    .from('matrices')
    .select(`
      *,
      campaigns(
        id, name, status, client_id,
        clients(name, slug)
      ),
      templates(
        id, name, platform, dimensions, dynamic_fields,
        is_creatomate, creatomate_id
      )
    `)
    .eq('id', matrixId)
    .single();

  if (error || !matrix) {
    return res.status(404).json({ error: 'Matrix not found' });
  }

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', matrix.campaigns.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this matrix' });
  }

  // Check matrix status
  if (matrix.status !== 'approved') {
    return res.status(400).json({ 
      error: 'Matrix must be approved before execution',
      current_status: matrix.status
    });
  }

  // Check campaign status
  if (matrix.campaigns.status !== 'active') {
    return res.status(400).json({ 
      error: 'Campaign must be active for matrix execution',
      campaign_status: matrix.campaigns.status
    });
  }

  // Validate combinations
  const combinationsToExecute = (executeData.combinations?.length ?? 0) > 0
    ? matrix.combinations.filter((combo: any) => executeData.combinations?.includes(combo.id))
    : matrix.combinations.filter((combo: any) => combo.isSelected);

  if (combinationsToExecute.length === 0) {
    return res.status(400).json({
      error: 'No valid combinations found for execution',
      details: 'Select combinations or ensure matrix has active combinations'
    });
  }

  // Validate platforms
  const platformsToExecute: string[] = (executeData.platforms?.length ?? 0) > 0
    ? executeData.platforms || []
    : [matrix.templates.platform];

  // Check execution limits
  const executionLimit = await checkExecutionLimits(matrix.campaigns.client_id, user.id);
  if (!executionLimit.allowed) {
    return res.status(429).json({ 
      error: 'Execution limit exceeded',
      details: executionLimit.details
    });
  }

  // Create execution plan
  const executionPlan = await createExecutionPlan(
    matrix,
    combinationsToExecute,
    platformsToExecute,
    executeData,
    user.id
  );

  // Execute based on schedule type
  let executionResult;
  switch (executeData.schedule_type) {
    case 'immediate':
      executionResult = await executeImmediate(executionPlan);
      break;
    case 'scheduled':
      executionResult = await scheduleExecution(executionPlan, executeData.scheduled_for);
      break;
    case 'batch':
      executionResult = await executeBatch(executionPlan, executeData.batch_size);
      break;
    default:
      executionResult = await executeImmediate(executionPlan);
  }

  // Update matrix status
  await supabase
    .from('matrices')
    .update({
      status: 'active',
      last_executed_at: new Date().toISOString(),
      last_executed_by: user.id})
    .eq('id', matrixId);

  return res.json({
    message: 'Matrix execution initiated successfully',
    data: {},
  execution_plan: executionPlan,
      execution_result: executionResult,
      estimated_completion: calculateEstimatedCompletion(executionPlan)}
  });
}

// Helper functions
async function checkExecutionLimits(clientId: string, userId: string): Promise<{ allowed: boolean; details?: string }> {
  try {
    // Check daily execution limit
    const today = new Date().toISOString().split('T')[0];
    
    const { count: todayExecutions } = await supabase
      .from('executions')
      .select('id', { count: 'exact' })
      .eq('client_id', clientId)
      .gte('created_at', `${today}T00:00:00Z`)
      .lte('created_at', `${today}T23:59:59Z`);

    const dailyLimit = 100; // Configurable limit
    if (todayExecutions && todayExecutions >= dailyLimit) {
      return {
        allowed: false,
        details: `Daily execution limit (${dailyLimit}) exceeded. Current: ${todayExecutions}`
      };
    }

    // Check concurrent execution limit
    const { count: activeExecutions } = await supabase
      .from('executions')
      .select('id', { count: 'exact' })
      .eq('client_id', clientId)
      .in('status', ['pending', 'processing']);

    const concurrentLimit = 10; // Configurable limit
    if (activeExecutions && activeExecutions >= concurrentLimit) {
      return {
        allowed: false,
        details: `Concurrent execution limit (${concurrentLimit}) exceeded. Wait for current executions to complete.`
      };
    }

    return { allowed: true };
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error checking execution limits:', error);
    return { 
      allowed: false, 
      details: 'Error checking execution limits' 
    };
  }
}

async function createExecutionPlan(
  matrix: any,
  combinations: any[],
  platforms: string[],
  executeData: any,
  userId: string
): Promise<any> {
  const executions: any[] = [];

  for (const combination of combinations) {
    for (const platform of platforms) {
      // Generate execution for each combination-platform pair
      const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const execution = {
        id: executionId,
        matrix_id: matrix.id,
        campaign_id: matrix.campaigns.id,
        combination_id: combination.id,
        combination_name: combination.name,
        platform,
        content_type: determineContentType(matrix.templates, platform),
        priority: executeData.priority,
        settings: executeData.execution_settings || { },
  variations: combination.variationIds.map((varId: string) => 
          matrix.variations.find((v: any) => v.id === varId)
        ).filter(Boolean),
        field_data: extractFieldDataForCombination(matrix, combination),
        template_data: {},
  id: matrix.templates.id,
          name: matrix.templates.name,
          is_creatomate: matrix.templates.is_creatomate,
          creatomate_id: matrix.templates.creatomate_id },
  estimated_duration: calculateExecutionDuration(matrix.templates, platform),
        created_by: userId};

      executions.push(execution);
    }
  }

  return {
    matrix_id: matrix.id,
    campaign_id: matrix.campaigns.id,
    total_executions: executions.length,
    executions,
    schedule_type: executeData.schedule_type,
    batch_size: executeData.batch_size,
    created_at: new Date().toISOString(),
    created_by: userId};
}

async function executeImmediate(executionPlan: any): Promise<any> {
  const results = [];

  for (const execution of executionPlan.executions) {
    try {
      // Create execution record
      const { data: executionRecord, error } = await supabase
        .from('executions')
        .insert({
          id: execution.id,
          matrix_id: execution.matrix_id,
          campaign_id: execution.campaign_id,
          combination_id: execution.combination_id,
          content_type: execution.content_type,
          platform: execution.platform,
          status: 'pending',
          metadata: {},
        combination_name: execution.combination_name,
            template_data: execution.template_data,
            field_data: execution.field_data,
            settings: execution.settings,
            priority: execution.priority },
  created_by: execution.created_by})
        .select()
        .single();

      if (error) {
        console.error('Error creating execution record:', error);
        results.push({
          execution_id: execution.id,
          status: 'failed',
          error: error.message});
        continue;
      }

      // Trigger render job (depending on template type)
      const renderResult = await triggerRenderJob(execution);
      
      // Update execution with render info
      await supabase
        .from('executions')
        .update({
          status: renderResult.success ? 'processing' : 'failed',
          render_url: renderResult.render_url,
          metadata: {},
        ...executionRecord.metadata,
            render_job_id: renderResult.job_id,
            render_started_at: new Date().toISOString()
      }
        })
        .eq('id', execution.id);

      results.push({
        execution_id: execution.id,
        status: renderResult.success ? 'processing' : 'failed',
        render_job_id: renderResult.job_id,
        estimated_completion: renderResult.estimated_completion});

    } catch (error: any) {
      const message = getErrorMessage(error);
      console.error('Error executing:', error);
      results.push({
        execution_id: execution.id,
        status: 'failed',
        error: message});
    }
  }

  return {
    type: 'immediate',
    total_executions: executionPlan.executions.length,
    successful: results.filter((r: any) => r.status === 'processing').length,
    failed: results.filter((r: any) => r.status === 'failed').length,
    results};
}

async function scheduleExecution(executionPlan: any, scheduledFor?: string): Promise<any> {
  const scheduledTime = scheduledFor ? new Date(scheduledFor) : new Date(Date.now() + 5 * 60 * 1000); // Default 5 min delay

  // Create scheduled executions
  const scheduledExecutions = executionPlan.executions.map((execution: any) => ({
    ...execution,
    status: 'scheduled',
    scheduled_for: scheduledTime.toISOString()}));

  // Save to database with scheduled status
  const { data: executionRecords, error } = await supabase
    .from('executions')
    .insert(scheduledExecutions.map((exec: any) => ({
      id: exec.id,
      matrix_id: exec.matrix_id,
      campaign_id: exec.campaign_id,
      combination_id: exec.combination_id,
      content_type: exec.content_type,
      platform: exec.platform,
      status: 'scheduled',
      metadata: {},
        combination_name: exec.combination_name,
        template_data: exec.template_data,
        field_data: exec.field_data,
        settings: exec.settings,
        scheduled_for: scheduledTime.toISOString() },
  created_by: exec.created_by})))
    .select();

  if (error) {
    console.error('Error creating scheduled executions:', error);
    throw new Error('Failed to schedule executions');
  }

  return {
    type: 'scheduled',
    scheduled_for: scheduledTime.toISOString(),
    total_executions: executionPlan.executions.length,
    execution_ids: executionRecords?.map((r: any) => r.id) || []};
}

async function executeBatch(executionPlan: any, batchSize: number): Promise<any> {
  const batches = [];
  const executions = executionPlan.executions;

  // Split executions into batches
  for (let i = 0; i < executions.length; i += batchSize) {
    const batch = executions.slice(i, i + batchSize);
    batches.push(batch);
  }

  const batchResults = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const delay = i * 30 * 1000; // 30 second delay between batches
    
    // Schedule each batch
    const batchScheduleTime = new Date(Date.now() + delay);
    
    const batchExecutionPlan = {
      ...executionPlan,
      executions: batch};

    const batchResult = await scheduleExecution(batchExecutionPlan, batchScheduleTime.toISOString());
    
    batchResults.push({
      batch_number: i + 1,
      execution_count: batch.length,
      scheduled_for: batchScheduleTime.toISOString(),
      execution_ids: batchResult.execution_ids});
  }

  return {
    type: 'batch',
    total_batches: batches.length,
    batch_size: batchSize,
    total_executions: executions.length,
    batches: batchResults};
}

async function triggerRenderJob(execution: any): Promise<any> {
  try {
    // Determine render type based on template
    if (execution.template_data.is_creatomate) {
      return await triggerCreatomateRender(execution);
    } else {
      return await triggerCustomRender(execution);
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error triggering render job:', error);
    return {
      success: false,
      error: message};
  }
}

async function triggerCreatomateRender(execution: any): Promise<any> {
  // Integration with Creatomate API
  // This would call the actual Creatomate service
  
  const renderJob = {
    template_id: execution.template_data.creatomate_id,
    modifications: convertFieldDataToCreatomateFormat(execution.field_data),
    output_format: execution.settings.formats || ['mp4'],
    quality: execution.settings.quality || 'standard'};

  // Simulate API call
  const jobId = `creatomate-${Date.now()}`;
  
  return {
    success: true,
    job_id: jobId,
    render_url: null, // Will be updated when render completes
    estimated_completion: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2 minutes
  };
}

async function triggerCustomRender(execution: any): Promise<any> {
  // Custom render pipeline
  const jobId = `custom-${Date.now()}`;
  
  return {
    success: true,
    job_id: jobId,
    render_url: null,
    estimated_completion: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
  };
}

// Utility functions
function determineContentType(template: any, platform: string): string {
  if (template.name.toLowerCase().includes('video') || platform === 'youtube') {
    return 'video';
  } else if (template.name.toLowerCase().includes('story')) {
    return 'story';
  } else {
    return 'post';
  }
}

function extractFieldDataForCombination(matrix: any, combination: any): any {
  const fieldData: any = {};
  
  // Extract field assignments for the variations in this combination
  if (matrix.field_assignments && combination.variationIds) {
    Object.entries(matrix.field_assignments).forEach(([fieldId, fieldInfo]: [string, any]) => {
      // Find content for the first variation in the combination
      const variationId = combination.variationIds[0];
      const content = fieldInfo.content?.find((c: any) => c.variationId === variationId);
      const asset = fieldInfo.assets?.find((a: any) => a.variationId === variationId);
      
      fieldData[fieldId] = {
        content: content?.content || '',
        asset_id: asset?.assetId};
    });
  }
  
  return fieldData;
}

function calculateExecutionDuration(template: any, platform: string): number {
  // Estimate execution duration in seconds
  let baseDuration = 60; // 1 minute base
  
  if (template.is_creatomate) {
    baseDuration = 120; // 2 minutes for Creatomate
  }
  
  if (platform === 'youtube') {
    baseDuration += 60; // Additional time for video processing
  }
  
  return baseDuration;
}

function calculateEstimatedCompletion(executionPlan: any): string {
  const avgDuration = executionPlan.executions.reduce((sum: number, exec: any) => 
    sum + exec.estimated_duration, 0) / executionPlan.executions.length;
  
  return new Date(Date.now() + avgDuration * 1000).toISOString();
}

function convertFieldDataToCreatomateFormat(fieldData: any): any {
  // Convert internal field data format to Creatomate API format
  const modifications: any = {};
  
  Object.entries(fieldData).forEach(([fieldId, data]: [string, any]) => {
    if (data.content) {
      modifications[fieldId] = data.content;
    }
    if (data.asset_id) {
      modifications[`${fieldId}_image`] = data.asset_id; // Assuming asset mapping
    }
  });
  
  return modifications;
}

export default withAuth(withSecurityHeaders(handler));