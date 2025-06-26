import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';
import { loggers } from '@/lib/logger';


const ApprovalCreateSchema = z.object({
  item_type: z.enum(['motivation', 'content_variation', 'execution', 'campaign']),
  item_id: z.string().uuid(),
  approval_type: z.enum(['content', 'legal', 'brand', 'final']).default('content'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  due_date: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.any().optional(),
});

const ApprovalFilterSchema = z.object({
  client_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'changes_requested']).optional(),
  approval_type: z.enum(['content', 'legal', 'brand', 'final']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assigned_to: z.string().uuid().optional(),
  overdue_only: z.boolean().default(false),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  sort_by: z.enum(['created_at', 'due_date', 'priority', 'status']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const user = (req as any).user;

  try {
    switch (method) {
      case 'GET':
        return handleGet(req, res, user);
      case 'POST':
        return handlePost(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Approvals API error:', error);
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

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const validationResult = ApprovalFilterSchema.safeParse(req.query);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Invalid query parameters',
      details: validationResult.error.issues,
    });
  }

  const filters = validationResult.data;

  // Get user's accessible clients
  const { data: userClients } = await supabase
    .from('user_clients')
    .select('client_id')
    .eq('user_id', user.id);

  if (!userClients || userClients.length === 0) {
    return res.json({ data: [], count: 0 });
  }

  const clientIds = userClients.map((uc: any) => uc.client_id);

  let query = supabase
    .from('approvals')
    .select(
      `
      *,
      profiles!approvals_created_by_fkey(full_name, avatar_url),
      profiles!approvals_assigned_to_fkey(full_name, avatar_url),
      clients(id, name, slug)
    `
    )
    .order(filters.sort_by, { ascending: filters.sort_order === 'asc' });

  // Filter by client access
  if (filters.client_id) {
    if (!clientIds.includes(filters.client_id)) {
      return res.status(403).json({ error: 'Access denied to this client' });
    }
    query = query.eq('client_id', filters.client_id);
  } else {
    query = query.in('client_id', clientIds);
  }

  // Apply filters
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.approval_type) {
    query = query.eq('approval_type', filters.approval_type);
  }

  if (filters.priority) {
    query = query.eq('priority', filters.priority);
  }

  if (filters.assigned_to) {
    query = query.eq('assigned_to', filters.assigned_to);
  }

  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  // Handle overdue filter
  if (filters.overdue_only) {
    const now = new Date().toISOString();
    query = query.lt('due_date', now).eq('status', 'pending');
  }

  // Pagination
  query = query.range(filters.offset, filters.offset + filters.limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching approvals:', error);
    return res.status(500).json({ error: 'Failed to fetch approvals' });
  }

  // Enrich approval data with item details
  const enrichedData = await Promise.all(
    (data || []).map(async approval => {
      const itemDetails = await getApprovalItemDetails(approval.item_type, approval.item_id);
      return {
        ...approval,
        item_details: itemDetails,
      };
    })
  );

  // Calculate approval statistics
  const statistics = calculateApprovalStatistics(data || []);

  return res.json({
    data: enrichedData,
    count: data?.length || 0,
    statistics,
    pagination: {
      limit: filters.limit,
      offset: filters.offset,
      total: count || 0,
    },
  });
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const validationResult = ApprovalCreateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  const approvalData = validationResult.data;

  // Get item details to determine client_id and validate access
  const itemDetails = await getApprovalItemDetails(approvalData.item_type, approvalData.item_id);
  if (!itemDetails || !itemDetails.client_id) {
    return res.status(404).json({ error: 'Item not found or invalid' });
  }

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', itemDetails.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this client' });
  }

  // Check for existing pending approval for this item
  const { data: existingApproval } = await supabase
    .from('approvals')
    .select('id, status')
    .eq('item_type', approvalData.item_type)
    .eq('item_id', approvalData.item_id)
    .eq('status', 'pending')
    .single();

  if (existingApproval) {
    return res.status(409).json({
      error: 'Pending approval already exists for this item',
      existing_approval_id: existingApproval.id,
    });
  }

  // Determine assignee based on approval workflow rules
  const assignedTo = await determineApprovalAssignee(
    itemDetails.client_id,
    approvalData.approval_type,
    user.id
  );

  // Create the approval
  const { data: approval, error } = await supabase
    .from('approvals')
    .insert({
      ...approvalData,
      client_id: itemDetails.client_id,
      assigned_to: assignedTo,
      created_by: user.id,
      status: 'pending',
    })
    .select(
      `
      *,
      profiles!approvals_created_by_fkey(full_name, avatar_url),
      profiles!approvals_assigned_to_fkey(full_name, avatar_url),
      clients(id, name, slug)
    `
    )
    .single();

  if (error) {
    console.error('Error creating approval:', error);
    return res.status(500).json({ error: 'Failed to create approval' });
  }

  // Trigger approval notification
  await triggerApprovalNotification(approval, 'created');

  // Update item status to reflect pending approval
  await updateItemApprovalStatus(approvalData.item_type, approvalData.item_id, 'pending_approval');

  return res.status(201).json({
    data: {
      ...approval,
      item_details: itemDetails,
    },
  });
}

// Helper functions
async function getApprovalItemDetails(itemType: string, itemId: string): Promise<any> {
  try {
    let query;
    let table;

    switch (itemType) {
      case 'motivation':
        table = 'motivations';
        query = supabase
          .from(table)
          .select(
            `
            id, title, description, category,
            briefs(client_id, name)
          `
          )
          .eq('id', itemId)
          .single();
        break;

      case 'content_variation':
        table = 'content_variations';
        query = supabase
          .from(table)
          .select(
            `
            id, title, content, platform, content_type,
            briefs(client_id, name)
          `
          )
          .eq('id', itemId)
          .single();
        break;

      case 'execution':
        table = 'executions';
        query = supabase
          .from(table)
          .select(
            `
            id, status, platform, content_type, render_url,
            matrices(campaigns(client_id, name))
          `
          )
          .eq('id', itemId)
          .single();
        break;

      case 'campaign':
        table = 'campaigns';
        query = supabase
          .from(table)
          .select(
            `
            id, name, description, status,
            client_id, clients(name)
          `
          )
          .eq('id', itemId)
          .single();
        break;

      default:
        return null;
    }

    const { data, error } = await query;

    if (error || !data) {
      return null;
    }

    // Extract client_id based on item type
    let clientId;
    switch (itemType) {
      case 'motivation':
      case 'content_variation':
        clientId = (data as any).briefs?.client_id;
        break;
      case 'execution':
        clientId = (data as any).matrices?.campaigns?.client_id;
        break;
      case 'campaign':
        clientId = (data as any).client_id;
        break;
    }

    return {
      ...data,
      client_id: clientId,
      item_type: itemType,
    };
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error getting approval item details:', error);
    return null;
  }
}

async function determineApprovalAssignee(
  clientId: string,
  approvalType: string,
  requesterId: string
): Promise<string | null> {
  try {
    // Get client approval workflow settings
    const { data: client } = await supabase
      .from('clients')
      .select('approval_workflow_settings')
      .eq('id', clientId)
      .single();

    const workflowSettings = client?.approval_workflow_settings || {};

    // Check if there's a specific assignee for this approval type
    const assigneeConfig = workflowSettings[approvalType];
    if (assigneeConfig?.assigned_to) {
      return assigneeConfig.assigned_to;
    }

    // Get users with appropriate roles for this client
    const roleMapping: Record<string, string[]> = {
      content: ['content_reviewer', 'manager'],
      legal: ['legal_reviewer', 'manager'],
      brand: ['brand_manager', 'manager'],
      final: ['manager', 'director'],
    };

    const roles = roleMapping[approvalType] || ['manager'];

    const { data: approvers } = await supabase
      .from('user_clients')
      .select(
        `
        user_id,
        profiles(full_name, avatar_url)
      `
      )
      .eq('client_id', clientId)
      .in('role', roles)
      .neq('user_id', requesterId) // Don't assign to the requester
      .limit(1);

    if (approvers && approvers.length > 0) {
      return approvers[0].user_id;
    }

    // Fallback: get any manager for this client
    const { data: managers } = await supabase
      .from('user_clients')
      .select('user_id')
      .eq('client_id', clientId)
      .eq('role', 'manager')
      .limit(1);

    return managers && managers.length > 0 ? managers[0].user_id : null;
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error determining approval assignee:', error);
    return null;
  }
}

async function updateItemApprovalStatus(
  itemType: string,
  itemId: string,
  status: string
): Promise<void> {
  try {
    const table = itemType === 'content_variation' ? 'content_variations' : `${itemType}s`;

    await supabase
      .from(table)
      .update({
        approval_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error updating item approval status:', error);
  }
}

async function triggerApprovalNotification(approval: any, action: string): Promise<void> {
  try {
    // In a full implementation, this would trigger real-time notifications
    // via WebSocket, email, or push notifications
    process.env.NODE_ENV === 'development' &&
      loggers.general.error(`Triggering approval notification for action: ${action}`);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error triggering approval notification:', error);
  }
}

function calculateApprovalStatistics(approvals: any[]): any {
  const statusCount = approvals.reduce(
    (acc, approval) => {
      acc[approval.status] = (acc[approval.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const typeCount = approvals.reduce(
    (acc, approval) => {
      acc[approval.approval_type] = (acc[approval.approval_type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const priorityCount = approvals.reduce(
    (acc, approval) => {
      acc[approval.priority] = (acc[approval.priority] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Calculate overdue approvals
  const now = new Date();
  const overdueCount = approvals.filter(
    (approval: any) =>
      approval.status === 'pending' && approval.due_date && new Date(approval.due_date) < now
  ).length;

  // Calculate average approval time for completed approvals
  const completedApprovals = approvals.filter((a: any) =>
    ['approved', 'rejected'].includes(a.status)
  );
  const avgApprovalTime =
    completedApprovals.length > 0
      ? completedApprovals.reduce((sum, approval) => {
          const start = new Date(approval.created_at).getTime();
          const end = new Date(approval.updated_at).getTime();
          return sum + (end - start);
        }, 0) /
        completedApprovals.length /
        1000 /
        60 /
        60 // Convert to hours
      : 0;

  return {
    total_approvals: approvals.length,
    status_distribution: statusCount,
    type_distribution: typeCount,
    priority_distribution: priorityCount,
    overdue_count: overdueCount,
    pending_count: statusCount.pending || 0,
    average_approval_time_hours: Math.round(avgApprovalTime * 100) / 100,
  };
}

export default withAuth(withSecurityHeaders(handler));
