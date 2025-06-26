import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { triggerWebhookEvent, WEBHOOK_EVENTS } from '../webhooks/index';
import { z } from 'zod';
import { loggers } from '@/lib/logger';


const ApprovalDecisionSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_changes']),
  comments: z.string().optional(),
  changes_requested: z
    .array(
      z.object({
        field: z.string(),
        current_value: z.string().optional(),
        requested_value: z.string().optional(),
        reason: z.string().optional(),
      })
    )
    .optional(),
  conditions: z.array(z.string()).optional(), // Approval conditions
  due_date: z.string().optional(), // For changes requested
});

const ApprovalUpdateSchema = z.object({
  assigned_to: z.string().uuid().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  due_date: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.any().optional(),
});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const { id } = req.query;
  const user = (req as any).user;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Approval ID is required' });
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
    console.error('Approval API error:', error);
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

async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  approvalId: string
): Promise<void> {
  // Get the approval with full details
  const { data: approval, error } = await supabase
    .from('approvals')
    .select(
      `
      *,
      profiles!approvals_created_by_fkey(full_name, avatar_url),
      profiles!approvals_assigned_to_fkey(full_name, avatar_url),
      clients(id, name, slug, primary_color)
    `
    )
    .eq('id', approvalId)
    .single();

  if (error || !approval) {
    return res.status(404).json({ error: 'Approval not found' });
  }

  // Verify user has access to this client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('client_id', approval.client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this approval' });
  }

  // Get item details
  const itemDetails = await getApprovalItemDetails(approval.item_type, approval.item_id);

  // Get approval history/activity
  const approvalHistory = await getApprovalHistory(approvalId);

  // Get related approvals (for the same item or client)
  const relatedApprovals = await getRelatedApprovals(
    approval.item_type,
    approval.item_id,
    approvalId
  );

  // Check user permissions for this approval
  const permissions = calculateUserPermissions(approval, user.id, clientAccess.role);

  return res.json({
    data: {
      ...approval,
      item_details: itemDetails,
      history: approvalHistory,
      related_approvals: relatedApprovals,
      permissions,
    },
  });
}

async function handlePut(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  approvalId: string
): Promise<void> {
  // Check if this is a decision or an update
  const isDecision =
    req.body.action && ['approve', 'reject', 'request_changes'].includes(req.body.action);

  if (isDecision) {
    return handleDecision(req, res, user, approvalId);
  } else {
    return handleUpdate(req, res, user, approvalId);
  }
}

async function handleDecision(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  approvalId: string
): Promise<void> {
  const validationResult = ApprovalDecisionSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  const decision = validationResult.data;

  // Get the approval
  const { data: approval, error } = await supabase
    .from('approvals')
    .select(
      `
      *,
      clients(id, name)
    `
    )
    .eq('id', approvalId)
    .single();

  if (error || !approval) {
    return res.status(404).json({ error: 'Approval not found' });
  }

  // Verify user has permission to make this decision
  const hasPermission = await verifyApprovalPermission(approval, user.id, 'decide');
  if (!hasPermission) {
    return res
      .status(403)
      .json({ error: 'Access denied - insufficient permissions for approval decision' });
  }

  // Check if approval is still pending
  if (approval.status !== 'pending') {
    return res.status(409).json({
      error: 'Approval is not in pending state',
      current_status: approval.status,
    });
  }

  // Map action to status
  const statusMapping = {
    approve: 'approved',
    reject: 'rejected',
    request_changes: 'changes_requested',
  };

  const newStatus = statusMapping[decision.action];

  // Create decision record
  const decisionData = {
    action: decision.action,
    comments: decision.comments,
    changes_requested: decision.changes_requested,
    conditions: decision.conditions,
    decided_by: user.id,
    decided_at: new Date().toISOString(),
  };

  // Update approval
  const { data: updatedApproval, error: updateError } = await supabase
    .from('approvals')
    .update({
      status: newStatus,
      decision_data: decisionData,
      updated_at: new Date().toISOString(),
      ...(decision.due_date && { due_date: decision.due_date }),
    })
    .eq('id', approvalId)
    .select(
      `
      *,
      profiles!approvals_created_by_fkey(full_name),
      profiles!approvals_assigned_to_fkey(full_name),
      clients(name)
    `
    )
    .single();

  if (updateError) {
    console.error('Error updating approval:', updateError);
    return res.status(500).json({ error: 'Failed to update approval' });
  }

  // Log the decision
  await logApprovalDecision(approvalId, decision.action, user.id, decision.comments);

  // Update the item status based on decision
  await updateItemStatusAfterDecision(approval.item_type, approval.item_id, decision.action);

  // Trigger post-decision workflows
  await triggerPostDecisionWorkflow(updatedApproval, decision);

  // Send notifications
  await triggerApprovalNotification(updatedApproval, `decision_${decision.action}`);

  // Trigger webhooks
  await triggerApprovalWebhooks(updatedApproval, decision.action, user);

  return res.json({
    data: updatedApproval,
    decision: decisionData,
  });
}

async function handleUpdate(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  approvalId: string
): Promise<void> {
  const validationResult = ApprovalUpdateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  const updateData = validationResult.data;

  // Get the approval
  const { data: approval } = await supabase
    .from('approvals')
    .select('client_id, created_by, assigned_to')
    .eq('id', approvalId)
    .single();

  if (!approval) {
    return res.status(404).json({ error: 'Approval not found' });
  }

  // Verify user has permission to update this approval
  const hasPermission = await verifyApprovalPermission(approval, user.id, 'update');
  if (!hasPermission) {
    return res.status(403).json({ error: 'Access denied - insufficient permissions' });
  }

  // Update the approval
  const { data: updatedApproval, error } = await supabase
    .from('approvals')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', approvalId)
    .select(
      `
      *,
      profiles!approvals_created_by_fkey(full_name),
      profiles!approvals_assigned_to_fkey(full_name),
      clients(name)
    `
    )
    .single();

  if (error) {
    console.error('Error updating approval:', error);
    return res.status(500).json({ error: 'Failed to update approval' });
  }

  // Log the update
  await logApprovalUpdate(approvalId, updateData, user.id);

  // Notify if assignee changed
  if (updateData.assigned_to && updateData.assigned_to !== approval.assigned_to) {
    await triggerApprovalNotification(updatedApproval, 'reassigned');
  }

  return res.json({ data: updatedApproval });
}

async function handleDelete(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  approvalId: string
): Promise<void> {
  // Get the approval
  const { data: approval } = await supabase
    .from('approvals')
    .select('client_id, created_by, status')
    .eq('id', approvalId)
    .single();

  if (!approval) {
    return res.status(404).json({ error: 'Approval not found' });
  }

  // Verify user has permission to delete this approval
  const hasPermission = await verifyApprovalPermission(approval, user.id, 'delete');
  if (!hasPermission) {
    return res.status(403).json({ error: 'Access denied - insufficient permissions' });
  }

  // Check if approval can be deleted
  if (!['pending', 'changes_requested'].includes(approval.status)) {
    return res.status(409).json({
      error: 'Cannot delete completed approval',
      status: approval.status,
    });
  }

  // Soft delete the approval
  const { error } = await supabase
    .from('approvals')
    .update({
      status: 'cancelled',
      cancelled_by: user.id,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', approvalId);

  if (error) {
    console.error('Error deleting approval:', error);
    return res.status(500).json({ error: 'Failed to delete approval' });
  }

  // Log the deletion
  await logApprovalUpdate(approvalId, { action: 'cancelled' }, user.id);

  return res.status(200).json({ message: 'Approval cancelled successfully' });
}

// Helper functions
async function getApprovalItemDetails(itemType: string, itemId: string): Promise<any> {
  // Reuse the function from index.ts
  try {
    let query;

    switch (itemType) {
      case 'motivation':
        query = supabase
          .from('motivations')
          .select(
            `
            id, title, description, category, relevance_score,
            briefs(id, name, client_id)
          `
          )
          .eq('id', itemId)
          .single();
        break;

      case 'content_variation':
        query = supabase
          .from('content_variations')
          .select(
            `
            id, title, content, platform, content_type,
            briefs(id, name, client_id)
          `
          )
          .eq('id', itemId)
          .single();
        break;

      case 'execution':
        query = supabase
          .from('executions')
          .select(
            `
            id, status, platform, content_type, render_url,
            matrices(id, name, campaigns(id, name, client_id))
          `
          )
          .eq('id', itemId)
          .single();
        break;

      case 'campaign':
        query = supabase
          .from('campaigns')
          .select(
            `
            id, name, description, status, client_id
          `
          )
          .eq('id', itemId)
          .single();
        break;

      default:
        return null;
    }

    const { data } = await query;
    return data;
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error getting approval item details:', error);
    return null;
  }
}

async function getApprovalHistory(approvalId: string): Promise<any[]> {
  try {
    // In a full implementation, this would get from an approval_history table
    // For now, return mock history based on approval data
    const { data: approval } = await supabase
      .from('approvals')
      .select('created_at, updated_at, status, decision_data')
      .eq('id', approvalId)
      .single();

    if (!approval) return [];

    const history: Array<{ timestamp: any; action: string; description: string; details?: any }> = [
      {
        timestamp: approval.created_at,
        action: 'created',
        description: 'Approval request created',
      },
    ];

    if (approval.decision_data) {
      history.push({
        timestamp: approval.decision_data.decided_at,
        action: approval.decision_data.action,
        description: `Approval ${approval.decision_data.action}`,
        details: {
          comments: approval.decision_data.comments,
          decided_by: approval.decision_data.decided_by,
        },
      });
    }

    return history;
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error getting approval history:', error);
    return [];
  }
}

async function getRelatedApprovals(
  itemType: string,
  itemId: string,
  excludeId: string
): Promise<any[]> {
  try {
    const { data: related } = await supabase
      .from('approvals')
      .select(
        `
        id, status, approval_type, created_at,
        profiles!approvals_assigned_to_fkey(full_name)
      `
      )
      .eq('item_type', itemType)
      .eq('item_id', itemId)
      .neq('id', excludeId)
      .order('created_at', { ascending: false })
      .limit(5);

    return related || [];
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error getting related approvals:', error);
    return [];
  }
}

function calculateUserPermissions(approval: any, userId: string, userRole: string): any {
  return {
    can_view: true, // Already verified in handleGet
    can_decide: approval.assigned_to === userId || ['manager', 'director'].includes(userRole),
    can_update:
      approval.created_by === userId ||
      approval.assigned_to === userId ||
      ['manager', 'director'].includes(userRole),
    can_delete: approval.created_by === userId || ['manager', 'director'].includes(userRole),
    can_reassign: ['manager', 'director'].includes(userRole),
  };
}

async function verifyApprovalPermission(
  approval: any,
  userId: string,
  action: string
): Promise<boolean> {
  try {
    // Get user's role for this client
    const { data: userClient } = await supabase
      .from('user_clients')
      .select('role')
      .eq('user_id', userId)
      .eq('client_id', approval.client_id)
      .single();

    if (!userClient) return false;

    const permissions: Record<string, boolean> = {
      view: true,
      decide: approval.assigned_to === userId || ['manager', 'director'].includes(userClient.role),
      update:
        approval.created_by === userId ||
        approval.assigned_to === userId ||
        ['manager', 'director'].includes(userClient.role),
      delete: approval.created_by === userId || ['manager', 'director'].includes(userClient.role),
    };

    return permissions[action] || false;
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error verifying approval permission:', error);
    return false;
  }
}

async function updateItemStatusAfterDecision(
  itemType: string,
  itemId: string,
  decision: string
): Promise<void> {
  try {
    const statusMapping: Record<string, string> = {
      approve: 'approved',
      reject: 'rejected',
      request_changes: 'changes_requested',
    };

    const newStatus = statusMapping[decision];
    const table = itemType === 'content_variation' ? 'content_variations' : `${itemType}s`;

    await supabase
      .from(table)
      .update({
        approval_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error updating item status after decision:', error);
  }
}

async function triggerPostDecisionWorkflow(approval: any, decision: any): Promise<void> {
  try {
    // Trigger next steps based on approval decision
    if (decision.action === 'approve') {
      // For executions, trigger the actual execution
      if (approval.item_type === 'execution') {
        // This would integrate with the execution pipeline
        process.env.NODE_ENV === 'development' &&
          loggers.general.error('Triggering execution pipeline for:', approval.item_id);
      }

      // For campaigns, activate them
      if (approval.item_type === 'campaign') {
        await supabase
          .from('campaigns')
          .update({
            status: 'active',
            activated_at: new Date().toISOString(),
          })
          .eq('id', approval.item_id);
      }
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error triggering post-decision workflow:', error);
  }
}

async function logApprovalDecision(
  approvalId: string,
  action: string,
  userId: string,
  comments?: string
): Promise<void> {
  try {
    // In a full implementation, this would log to an approval_events table
    process.env.NODE_ENV === 'development' &&
      loggers.general.error('Logging approval decision:', action, 'for approval:', approvalId);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error logging approval decision:', error);
  }
}

async function logApprovalUpdate(
  approvalId: string,
  updateData: any,
  userId: string
): Promise<void> {
  try {
    // In a full implementation, this would log to an approval_events table
    process.env.NODE_ENV === 'development' &&
      loggers.general.error('Logging approval update for:', approvalId);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error logging approval update:', error);
  }
}

async function triggerApprovalNotification(approval: any, action: string): Promise<void> {
  try {
    // In a full implementation, this would trigger real-time notifications
    process.env.NODE_ENV === 'development' &&
      loggers.general.error('Triggering approval notification for:', approval.id);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error triggering approval notification:', error);
  }
}

async function triggerApprovalWebhooks(approval: any, action: string, user: any): Promise<void> {
  try {
    // Map action to webhook event
    const eventMapping = {
      approve: WEBHOOK_EVENTS.APPROVAL_APPROVED,
      reject: WEBHOOK_EVENTS.APPROVAL_REJECTED,
      request_changes: WEBHOOK_EVENTS.APPROVAL_CHANGES_REQUESTED,
    };

    const eventType = eventMapping[action as keyof typeof eventMapping];
    if (!eventType) return;

    // Prepare webhook payload
    const webhookData = {
      approval_id: approval.id,
      item_type: approval.item_type,
      item_id: approval.item_id,
      type: approval.type,
      status: approval.status,
      action,
      decided_by: {
        id: user.id,
        name: user.full_name || user.email,
      },
      decision_data: approval.decision_data,
      client: {
        id: approval.client_id,
        name: approval.clients?.name,
      },
      timestamp: new Date().toISOString(),
    };

    // Trigger the webhook
    await triggerWebhookEvent(eventType, webhookData, approval.client_id);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error triggering approval webhooks:', error);
  }
}

export default withAuth(withSecurityHeaders(handler));
