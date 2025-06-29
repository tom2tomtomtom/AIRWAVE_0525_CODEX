import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { z } from 'zod';

const NotificationCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.enum(['info', 'success', 'warning', 'error']).default('info'),
  category: z.enum(['execution', 'approval', 'campaign', 'system', 'user']).default('system'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  client_id: z.string().uuid('Invalid client ID'),
  target_user_ids: z.array(z.string().uuid()).optional(),
  action_url: z.string().optional(),
  action_label: z.string().optional(),
  expires_at: z.string().optional(),
  metadata: z.any().optional(),
});

const NotificationFilterSchema = z.object({
  client_id: z.string().uuid().optional(),
  category: z.enum(['execution', 'approval', 'campaign', 'system', 'user']).optional(),
  type: z.enum(['info', 'success', 'warning', 'error']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  read: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  sort_by: z.enum(['created_at', 'priority', 'expires_at']).default('created_at'),
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
      case 'PUT':
        return handleBulkUpdate(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Notifications API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const validationResult = NotificationFilterSchema.safeParse(req.query);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Invalid query parameters',
      details: validationResult.error.issues,
    });
  }

  const filters = validationResult.data;

  try {
    // Get user's accessible clients
    const { data: userClients } = await supabase
      .from('user_clients')
      .select('client_id')
      .eq('user_id', user.id);

    if (!userClients || userClients.length === 0) {
      return res.json({ data: [], count: 0, statistics: getEmptyStatistics() });
    }

    const clientIds = userClients.map((uc: any) => uc.client_id);

    let query = supabase
      .from('notifications')
      .select(
        `
        *,
        clients(id, name, slug),
        profiles!notifications_created_by_fkey(full_name, avatar_url)
      `
      )
      .eq('user_id', user.id)
      .order(filters.sort_by, { ascending: filters.sort_order === 'asc' });

    // Apply filters
    if (filters.client_id && clientIds.includes(filters.client_id)) {
      query = query.eq('client_id', filters.client_id);
    } else {
      query = query.in('client_id', clientIds);
    }

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.type) {
      query = query.eq('type', filters.type);
    }

    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }

    if (typeof filters.read === 'boolean') {
      query = query.eq('read', filters.read);
    }

    // Filter out expired notifications
    const now = new Date().toISOString();
    query = query.or(`expires_at.is.null,expires_at.gt.${now}`);

    // Pagination
    query = query.range(filters.offset, filters.offset + filters.limit - 1);

    const { data: notifications, error, count } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return res.status(500).json({ error: 'Failed to fetch notifications' });
    }

    // Calculate statistics
    const statistics = await calculateNotificationStatistics(user.id, clientIds);

    return res.json({
      data: notifications || [],
      count: notifications?.length || 0,
      statistics,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: count || 0,
      },
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error in handleGet:', message, error);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const validationResult = NotificationCreateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  const notificationData = validationResult.data;

  try {
    // Verify user has access to the client
    const { data: clientAccess } = await supabase
      .from('user_clients')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', notificationData.client_id)
      .single();

    if (!clientAccess) {
      return res.status(403).json({ error: 'Access denied to this client' });
    }

    // Determine target users
    let targetUsers = notificationData.target_user_ids || [];

    if (targetUsers.length === 0) {
      // Send to all users with access to this client
      const { data: clientUsers } = await supabase
        .from('user_clients')
        .select('user_id')
        .eq('client_id', notificationData.client_id);

      targetUsers = clientUsers?.map((u: any) => u.user_id) || [];
    }

    // Create notifications for each target user
    const notificationPromises = targetUsers.map(async (targetUserId: string) => {
      const notification = {
        ...notificationData,
        user_id: targetUserId,
        created_by: user.id,
        read: false,
        read_at: null,
      };

      delete notification.target_user_ids; // Remove this field from the insert

      return supabase
        .from('notifications')
        .insert(notification)
        .select(
          `
          *,
          clients(id, name, slug),
          profiles!notifications_created_by_fkey(full_name, avatar_url)
        `
        )
        .single();
    });

    const results = await Promise.all(notificationPromises);
    const successfulNotifications = results.filter((r: any) => !r.error).map((r: any) => r.data);
    const errors = results.filter((r: any) => r.error);

    if (errors.length > 0) {
      console.error('Some notifications failed to create:', errors);
    }

    // Trigger real-time events for each notification
    for (const notification of successfulNotifications) {
      await triggerNotificationEvent(notification);
    }

    return res.status(201).json({
      message: 'Notifications created successfully',
      data: successfulNotifications,
      created_count: successfulNotifications.length,
      failed_count: errors.length,
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error creating notification:', message, error);
    return res.status(500).json({ error: 'Failed to create notification' });
  }
}

async function handleBulkUpdate(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any
): Promise<void> {
  const { action, notification_ids, client_id } = req.body;

  if (!action || !['mark_read', 'mark_unread', 'delete'].includes(action)) {
    return res
      .status(400)
      .json({ error: 'Invalid action. Must be mark_read, mark_unread, or delete' });
  }

  try {
    // Build filter conditions - baseQuery is for reference only
    // Each operation will build its own query with proper filters

    if (notification_ids && Array.isArray(notification_ids) && notification_ids.length > 0) {
      // Will apply .in('id', notification_ids) to each operation
    } else if (client_id) {
      // Verify user has access to client
      const { data: clientAccess } = await supabase
        .from('user_clients')
        .select('id')
        .eq('user_id', user.id)
        .eq('client_id', client_id)
        .single();

      if (!clientAccess) {
        return res.status(403).json({ error: 'Access denied to this client' });
      }
      // Will apply .eq('client_id', client_id) to each operation
    } else {
      return res.status(400).json({ error: 'Must provide notification_ids or client_id' });
    }

    let result;

    switch (action) {
      case 'mark_read':
        let updateReadQuery = supabase
          .from('notifications')
          .update({
            read: true,
            read_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (notification_ids && Array.isArray(notification_ids) && notification_ids.length > 0) {
          updateReadQuery = updateReadQuery.in('id', notification_ids);
        } else if (client_id) {
          updateReadQuery = updateReadQuery.eq('client_id', client_id);
        }

        result = await updateReadQuery.select();
        break;

      case 'mark_unread':
        let updateUnreadQuery = supabase
          .from('notifications')
          .update({
            read: false,
            read_at: null,
          })
          .eq('user_id', user.id);

        if (notification_ids && Array.isArray(notification_ids) && notification_ids.length > 0) {
          updateUnreadQuery = updateUnreadQuery.in('id', notification_ids);
        } else if (client_id) {
          updateUnreadQuery = updateUnreadQuery.eq('client_id', client_id);
        }

        result = await updateUnreadQuery.select();
        break;

      case 'delete':
        let deleteQuery = supabase.from('notifications').delete().eq('user_id', user.id);

        if (notification_ids && Array.isArray(notification_ids) && notification_ids.length > 0) {
          deleteQuery = deleteQuery.in('id', notification_ids);
        } else if (client_id) {
          deleteQuery = deleteQuery.eq('client_id', client_id);
        }

        result = await deleteQuery.select();
        break;
    }

    if (result?.error) {
      console.error(`Error performing bulk ${action}:`, result.error);
      return res.status(500).json({ error: `Failed to ${action} notifications` });
    }

    return res.json({
      message: `Notifications ${action} successfully`,
      updated_count: result?.data?.length || 0,
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error(`Error in bulk ${action}:`, message, error);
    return res.status(500).json({ error: `Failed to ${action} notifications` });
  }
}

// Helper function to calculate notification statistics
async function calculateNotificationStatistics(userId: string, clientIds: string[]): Promise<any> {
  try {
    const { data: notifications } = await supabase
      .from('notifications')
      .select('read, type, category, priority, created_at')
      .eq('user_id', userId)
      .in('client_id', clientIds);

    if (!notifications) return getEmptyStatistics();

    const total = notifications.length;
    const unread = notifications.filter((n: any) => !n.read).length;
    const byType = notifications.reduce(
      (acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byCategory = notifications.reduce(
      (acc, n) => {
        acc[n.category] = (acc[n.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byPriority = notifications.reduce(
      (acc, n) => {
        acc[n.priority] = (acc[n.priority] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Calculate notifications from last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent = notifications.filter((n: any) => n.created_at > last24Hours).length;

    return {
      total,
      unread,
      read: total - unread,
      recent_24h: recent,
      by_type: byType,
      by_category: byCategory,
      by_priority: byPriority,
    };
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error calculating notification statistics:', message, error);
    return getEmptyStatistics();
  }
}

function getEmptyStatistics() {
  return {
    total: 0,
    unread: 0,
    read: 0,
    recent_24h: 0,
    by_type: {},
    by_category: {},
    by_priority: {},
  };
}

// Helper function to trigger real-time event for notification
async function triggerNotificationEvent(notification: any): Promise<void> {
  try {
    // Import the broadcastEvent function
    const { broadcastEvent } = await import('../realtime/websocket');

    await broadcastEvent(
      'notification',
      {
        notification_id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        category: notification.category,
        priority: notification.priority,
        action_url: notification.action_url,
        action_label: notification.action_label,
      },
      notification.client_id,
      notification.created_by // Don't send to the creator unless they're the target
    );
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error triggering notification event:', message, error);
  }
}

// Helper functions for common notification types
export async function createExecutionNotification(
  executionId: string,
  status: string,
  clientId: string,
  _createdBy: string
): Promise<void> {
  try {
    const { data: execution } = await supabase
      .from('executions')
      .select(
        `
        id, platform, content_type,
        matrices(name, campaigns(name))
      `
      )
      .eq('id', executionId)
      .single();

    if (!execution) return;

    const campaignName = (execution as any).matrices?.campaigns?.name || 'Unknown Campaign';
    const statusMessages = {
      completed: { title: 'Execution Completed', type: 'success' },
      failed: { title: 'Execution Failed', type: 'error' },
      cancelled: { title: 'Execution Cancelled', type: 'warning' },
    };

    const statusInfo = statusMessages[status as keyof typeof statusMessages];
    if (!statusInfo) return;

    // Create notification
    await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: statusInfo.title,
        message: `${campaignName} execution for ${execution.platform} has ${status}`,
        type: statusInfo.type,
        category: 'execution',
        priority: status === 'failed' ? 'high' : 'normal',
        client_id: clientId,
        action_url: `/execute?execution=${executionId}`,
        action_label: 'View Details',
        metadata: { execution_id: executionId, status },
      }),
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error creating execution notification:', message, error);
  }
}

export async function createApprovalNotification(
  approvalId: string,
  action: string,
  clientId: string,
  _createdBy: string
): Promise<void> {
  try {
    const { data: approval } = await supabase
      .from('approvals')
      .select(
        `
        id, approval_type, item_type,
        clients(name)
      `
      )
      .eq('id', approvalId)
      .single();

    if (!approval) return;

    const actionMessages = {
      created: { title: 'New Approval Request', type: 'info' },
      approved: { title: 'Approval Granted', type: 'success' },
      rejected: { title: 'Approval Rejected', type: 'error' },
      changes_requested: { title: 'Changes Requested', type: 'warning' },
    };

    const actionInfo = actionMessages[action as keyof typeof actionMessages];
    if (!actionInfo) return;

    await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: actionInfo.title,
        message: `${approval.approval_type} approval for ${approval.item_type} has been ${action}`,
        type: actionInfo.type,
        category: 'approval',
        priority: action === 'rejected' ? 'high' : 'normal',
        client_id: clientId,
        action_url: `/approvals?approval=${approvalId}`,
        action_label: 'View Details',
        metadata: { approval_id: approvalId, action },
      }),
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error creating approval notification:', message, error);
  }
}

export default withAuth(withSecurityHeaders(handler));
