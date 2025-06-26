import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';
import { loggers } from '@/lib/logger';


const BulkApprovalDecisionSchema = z.object({
  approval_ids: z.array(z.string().uuid()).min(1).max(50),
  action: z.enum(['approve', 'reject', 'request_changes']),
  comments: z.string().optional(),
  changes_requested: z
    .array(
      z.object({
        field: z.string(),
        reason: z.string(),
      })
    )
    .optional(),
  conditions: z.array(z.string()).optional(),
});

const BulkApprovalCreateSchema = z.object({
  items: z
    .array(
      z.object({
        item_type: z.enum(['motivation', 'content_variation', 'execution', 'campaign']),
        item_id: z.string().uuid(),
        approval_type: z.enum(['content', 'legal', 'brand', 'final']).default('content'),
        priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
        due_date: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .min(1)
    .max(20),
  client_id: z.string().uuid(),
});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const user = (req as any).user;

  try {
    switch (method) {
      case 'POST':
        return handlePost(req, res, user);
      case 'PUT':
        return handlePut(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Bulk Approvals API error:', error);
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

async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  // Handle bulk approval creation
  const validationResult = BulkApprovalCreateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  const { items, client_id } = validationResult.data;

  // Verify user has access to the client
  const { data: clientAccess } = await supabase
    .from('user_clients')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('client_id', client_id)
    .single();

  if (!clientAccess) {
    return res.status(403).json({ error: 'Access denied to this client' });
  }

  // Validate all items exist and belong to the client
  const validationResults = await validateBulkItems(items, client_id);
  const invalidItems = validationResults.filter((result: any) => !result.valid);

  if (invalidItems.length > 0) {
    return res.status(400).json({
      error: 'Invalid items found',
      invalid_items: invalidItems,
    });
  }

  // Check for existing pending approvals
  const existingApprovals = await checkExistingApprovals(items);
  if (existingApprovals.length > 0) {
    return res.status(409).json({
      error: 'Some items already have pending approvals',
      existing_approvals: existingApprovals,
    });
  }

  // Create all approvals
  const approvalData = await Promise.all(
    items.map(async item => {
      const assignedTo = await determineApprovalAssignee(client_id, item.approval_type, user.id);

      return {
        ...item,
        client_id,
        assigned_to: assignedTo,
        created_by: user.id,
        status: 'pending',
      };
    })
  );

  const { data: createdApprovals, error } = await supabase.from('approvals').insert(approvalData)
    .select(`
      *,
      profiles!approvals_created_by_fkey(full_name),
      profiles!approvals_assigned_to_fkey(full_name),
      clients(name)
    `);

  if (error) {
    console.error('Error creating bulk approvals:', error);
    return res.status(500).json({ error: 'Failed to create bulk approvals' });
  }

  // Update item statuses
  await updateItemsApprovalStatus(items, 'pending_approval');

  // Trigger notifications for each unique assignee
  const assigneeNotifications: Record<string, any[]> = {};
  createdApprovals.forEach((approval: any) => {
    if (!assigneeNotifications[approval.assigned_to]) {
      assigneeNotifications[approval.assigned_to] = [];
    }
    assigneeNotifications[approval.assigned_to].push(approval);
  });

  await Promise.all(
    Object.entries(assigneeNotifications).map(([assigneeId, approvals]) =>
      triggerBulkNotification(assigneeId, approvals as any[], 'created')
    )
  );

  return res.status(201).json({
    data: createdApprovals,
    summary: {
      total_created: createdApprovals.length,
      assignees: Object.keys(assigneeNotifications).length,
    },
  });
}

async function handlePut(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  // Handle bulk approval decisions
  const validationResult = BulkApprovalDecisionSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  const { approval_ids, action, comments, changes_requested, conditions } = validationResult.data;

  // Get all approvals and verify permissions
  const { data: approvals, error } = await supabase
    .from('approvals')
    .select(
      `
      *,
      clients(id, name)
    `
    )
    .in('id', approval_ids);

  if (error || !approvals) {
    return res.status(404).json({ error: 'Approvals not found' });
  }

  if (approvals.length !== approval_ids.length) {
    return res.status(404).json({ error: 'Some approvals not found' });
  }

  // Verify user has permission for all approvals
  const permissionChecks = await Promise.all(
    approvals.map((approval: any) => verifyApprovalPermission(approval, user.id, 'decide'))
  );

  const unauthorizedApprovals = permissionChecks
    .map((hasPermission, index) => ({ hasPermission, approval: approvals[index] }))
    .filter((item: any) => !item.hasPermission)
    .map((item: any) => item.approval.id);

  if (unauthorizedApprovals.length > 0) {
    return res.status(403).json({
      error: 'Insufficient permissions for some approvals',
      unauthorized_approval_ids: unauthorizedApprovals,
    });
  }

  // Check all approvals are in pending state
  const nonPendingApprovals = approvals.filter((approval: any) => approval.status !== 'pending');
  if (nonPendingApprovals.length > 0) {
    return res.status(409).json({
      error: 'Some approvals are not in pending state',
      non_pending_approvals: nonPendingApprovals.map((a: any) => ({ id: a.id, status: a.status })),
    });
  }

  // Map action to status
  const statusMapping = {
    approve: 'approved',
    reject: 'rejected',
    request_changes: 'changes_requested',
  };

  const newStatus = statusMapping[action];

  // Create decision data
  const decisionData = {
    action,
    comments,
    changes_requested,
    conditions,
    decided_by: user.id,
    decided_at: new Date().toISOString(),
  };

  // Update all approvals
  const { data: updatedApprovals, error: updateError } = await supabase
    .from('approvals')
    .update({
      status: newStatus,
      decision_data: decisionData,
      updated_at: new Date().toISOString(),
    })
    .in('id', approval_ids).select(`
      *,
      profiles!approvals_created_by_fkey(full_name),
      clients(name)
    `);

  if (updateError) {
    console.error('Error updating bulk approvals:', updateError);
    return res.status(500).json({ error: 'Failed to update bulk approvals' });
  }

  // Log bulk decision
  await logBulkApprovalDecision(approval_ids, action, user.id, comments);

  // Update item statuses
  const itemUpdates = approvals.map((approval: any) => ({
    item_type: approval.item_type,
    item_id: approval.item_id,
  }));
  await updateItemsStatusAfterDecision(itemUpdates, action);

  // Trigger post-decision workflows
  await Promise.all(
    updatedApprovals.map((approval: any) =>
      triggerPostDecisionWorkflow(approval, { action, comments })
    )
  );

  // Group notifications by affected users
  const notificationGroups: Record<string, any[]> = {};
  updatedApprovals.forEach((approval: any) => {
    const key = approval.created_by; // Notify creators
    if (!notificationGroups[key]) {
      notificationGroups[key] = [];
    }
    notificationGroups[key].push(approval);
  });

  // Send bulk notifications
  await Promise.all(
    Object.entries(notificationGroups).map(([userId, approvals]) =>
      triggerBulkNotification(userId, approvals as any[], `bulk_${action}`)
    )
  );

  return res.json({
    data: updatedApprovals,
    summary: {
      total_processed: updatedApprovals.length,
      action: action,
      decided_by: user.id,
      decided_at: decisionData.decided_at,
    },
  });
}

// Helper functions
async function validateBulkItems(items: any[], clientId: string): Promise<any[]> {
  const results = await Promise.all(
    items.map(async item => {
      try {
        let query;

        switch (item.item_type) {
          case 'motivation':
            query = supabase
              .from('motivations')
              .select('briefs(client_id)')
              .eq('id', item.item_id)
              .single();
            break;

          case 'content_variation':
            query = supabase
              .from('content_variations')
              .select('briefs(client_id)')
              .eq('id', item.item_id)
              .single();
            break;

          case 'execution':
            query = supabase
              .from('executions')
              .select('matrices(campaigns(client_id))')
              .eq('id', item.item_id)
              .single();
            break;

          case 'campaign':
            query = supabase.from('campaigns').select('client_id').eq('id', item.item_id).single();
            break;

          default:
            return { valid: false, item_id: item.item_id, reason: 'Invalid item type' };
        }

        const { data, error } = await query;

        if (error || !data) {
          return { valid: false, item_id: item.item_id, reason: 'Item not found' };
        }

        // Check if item belongs to the correct client
        let itemClientId;
        switch (item.item_type) {
          case 'motivation':
          case 'content_variation':
            itemClientId = (data as any).briefs?.client_id;
            break;
          case 'execution':
            itemClientId = (data as any).matrices?.campaigns?.client_id;
            break;
          case 'campaign':
            itemClientId = (data as any).client_id;
            break;
        }

        if (itemClientId !== clientId) {
          return {
            valid: false,
            item_id: item.item_id,
            reason: 'Item does not belong to specified client',
          };
        }

        return { valid: true, item_id: item.item_id };
      } catch (error: any) {
        const message = getErrorMessage(error);
        return { valid: false, item_id: item.item_id, reason: 'Validation error' };
      }
    })
  );

  return results;
}

async function checkExistingApprovals(items: any[]): Promise<any[]> {
  const { data: existingApprovals } = await supabase
    .from('approvals')
    .select('id, item_type, item_id, status')
    .eq('status', 'pending');

  if (!existingApprovals) return [];

  return items
    .filter((item: any) =>
      existingApprovals.some(
        existing => existing.item_type === item.item_type && existing.item_id === item.item_id
      )
    )
    .map((item: any) => ({
      item_type: item.item_type,
      item_id: item.item_id,
      existing_approval_id: existingApprovals.find(
        (existing: any) =>
          existing.item_type === item.item_type && existing.item_id === item.item_id
      )?.id,
    }));
}

async function determineApprovalAssignee(
  clientId: string,
  approvalType: string,
  requesterId: string
): Promise<string | null> {
  // Reuse the function from index.ts
  try {
    const { data: client } = await supabase
      .from('clients')
      .select('approval_workflow_settings')
      .eq('id', clientId)
      .single();

    const workflowSettings = client?.approval_workflow_settings || {};

    if (workflowSettings[approvalType]?.assigned_to) {
      return workflowSettings[approvalType].assigned_to;
    }

    const roleMapping: Record<string, string[]> = {
      content: ['content_reviewer', 'manager'],
      legal: ['legal_reviewer', 'manager'],
      brand: ['brand_manager', 'manager'],
      final: ['manager', 'director'],
    };

    const roles = roleMapping[approvalType] || ['manager'];

    const { data: approvers } = await supabase
      .from('user_clients')
      .select('user_id')
      .eq('client_id', clientId)
      .in('role', roles)
      .neq('user_id', requesterId)
      .limit(1);

    return approvers && approvers.length > 0 ? approvers[0].user_id : null;
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error determining approval assignee:', error);
    return null;
  }
}

async function updateItemsApprovalStatus(items: any[], status: string): Promise<void> {
  await Promise.all(
    items.map(async item => {
      try {
        const table =
          item.item_type === 'content_variation' ? 'content_variations' : `${item.item_type}s`;

        await supabase
          .from(table)
          .update({
            approval_status: status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.item_id);
      } catch (error: any) {
        const message = getErrorMessage(error);
        console.error(`Error updating item ${item.item_id} status:`, error);
      }
    })
  );
}

async function updateItemsStatusAfterDecision(items: any[], decision: string): Promise<void> {
  const statusMapping: Record<string, string> = {
    approve: 'approved',
    reject: 'rejected',
    request_changes: 'changes_requested',
  };

  const newStatus = statusMapping[decision];

  await Promise.all(
    items.map(async item => {
      try {
        const table =
          item.item_type === 'content_variation' ? 'content_variations' : `${item.item_type}s`;

        await supabase
          .from(table)
          .update({
            approval_status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.item_id);
      } catch (error: any) {
        const message = getErrorMessage(error);
        console.error(`Error updating item ${item.item_id} status after decision:`, error);
      }
    })
  );
}

async function verifyApprovalPermission(
  approval: any,
  userId: string,
  action: string
): Promise<boolean> {
  try {
    const { data: userClient } = await supabase
      .from('user_clients')
      .select('role')
      .eq('user_id', userId)
      .eq('client_id', approval.client_id)
      .single();

    if (!userClient) return false;

    const permissions: Record<string, boolean> = {
      decide: approval.assigned_to === userId || ['manager', 'director'].includes(userClient.role),
    };

    return permissions[action] || false;
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error verifying approval permission:', error);
    return false;
  }
}

async function triggerPostDecisionWorkflow(approval: any, decision: any): Promise<void> {
  try {
    if (decision.action === 'approve') {
      if (approval.item_type === 'execution') {
        process.env.NODE_ENV === 'development' &&
          loggers.general.error('Triggering execution pipeline for bulk approval:', approval.item_id);
      }

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

async function logBulkApprovalDecision(
  approvalIds: string[],
  action: string,
  userId: string,
  comments?: string
): Promise<void> {
  try {
    // Empty try block
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error logging bulk approval decision:', error);
  }
}

async function triggerBulkNotification(
  userId: string,
  approvals: any[],
  action: string
): Promise<void> {
  try {
    process.env.NODE_ENV === 'development' &&
      console.log(
        'Triggering bulk notification for',
        approvals.length,
        'approvals with action:',
        action
      );
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error triggering bulk notification:', error);
  }
}

export default withAuth(withSecurityHeaders(handler));
