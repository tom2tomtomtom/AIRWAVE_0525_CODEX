import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { z } from 'zod';

const NotificationUpdateSchema = z.object({
  read: z.boolean().optional(),
  archived: z.boolean().optional(),
  snoozed_until: z.string().optional(),
  metadata: z.any().optional() });

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const { id } = req.query;
  const user = (req as any).user;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Notification ID is required' });
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
    console.error('Notification API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? message : undefined });
  }
}

async function handleGet(
  _req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  notificationId: string
): Promise<void> {
  try {
    const { data: notification, error } = await supabase
      .from('notifications')
      .select(
        `
        *,
        clients(id, name, slug),
        profiles!notifications_created_by_fkey(full_name, avatar_url)
      `
      )
      .eq('id', notificationId)
      .eq('user_id', user.id)
      .single();

    if (error || !notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Verify user has access to the client
    const { data: clientAccess } = await supabase
      .from('user_clients')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', notification.client_id)
      .single();

    if (!clientAccess) {
      return res.status(403).json({ error: 'Access denied to this notification' });
    }

    // Get related context based on notification category
    const enrichedNotification = { ...notification };

    if (notification.metadata) {
      switch (notification.category) {
        case 'execution':
          if (notification.metadata.execution_id) {
            const { data: execution } = await supabase
              .from('executions')
              .select(
                `
                id, status, platform, content_type, created_at, updated_at,
                matrices(id, name, campaigns(id, name))
              `
              )
              .eq('id', notification.metadata.execution_id)
              .single();

            enrichedNotification.context = { execution };
          }
          break;

        case 'approval':
          if (notification.metadata.approval_id) {
            const { data: approval } = await supabase
              .from('approvals')
              .select(
                `
                id, status, approval_type, item_type, created_at,
                item_details,
                profiles!approvals_assigned_to_fkey(full_name)
              `
              )
              .eq('id', notification.metadata.approval_id)
              .single();

            enrichedNotification.context = { approval };
          }
          break;

        case 'campaign':
          if (notification.metadata.campaign_id) {
            const { data: campaign } = await supabase
              .from('campaigns')
              .select(
                `
                id, name, status, description, created_at,
                health_score
              `
              )
              .eq('id', notification.metadata.campaign_id)
              .single();

            enrichedNotification.context = { campaign };
          }
          break;
      }
    }

    // Mark as read if not already read
    if (!notification.read) {
      await supabase
        .from('notifications')
        .update({
          read: true,
          read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      enrichedNotification.read = true;
      enrichedNotification.read_at = new Date().toISOString();
    }

    return res.json({ data: enrichedNotification });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error in handleGet:', message, error);
    return res.status(500).json({ error: 'Failed to fetch notification' });
  }
}

async function handlePut(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  notificationId: string
): Promise<void> {
  const validationResult = NotificationUpdateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues });
  }

  const updateData = validationResult.data;

  try {
    // Verify notification belongs to user
    const { data: existingNotification } = await supabase
      .from('notifications')
      .select('client_id, read')
      .eq('id', notificationId)
      .eq('user_id', user.id)
      .single();

    if (!existingNotification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Verify user has access to the client
    const { data: clientAccess } = await supabase
      .from('user_clients')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', existingNotification.client_id)
      .single();

    if (!clientAccess) {
      return res.status(403).json({ error: 'Access denied to this notification' });
    }

    // Prepare update data
    const updates: any = {
      ...updateData,
      updated_at: new Date().toISOString() };

    // Set read timestamp if marking as read
    if (updateData.read === true && !existingNotification.read) {
      updates.read_at = new Date().toISOString();
    } else if (updateData.read === false) {
      updates.read_at = null;
    }

    const { data: notification, error } = await supabase
      .from('notifications')
      .update(updates)
      .eq('id', notificationId)
      .eq('user_id', user.id)
      .select(
        `
        *,
        clients(id, name, slug),
        profiles!notifications_created_by_fkey(full_name, avatar_url)
      `
      )
      .single();

    if (error) {
      console.error('Error updating notification:', error);
      return res.status(500).json({ error: 'Failed to update notification' });
    }

    return res.json({ data: notification });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error in handlePut:', message, error);
    return res.status(500).json({ error: 'Failed to update notification' });
  }
}

async function handleDelete(
  _req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  notificationId: string
): Promise<void> {
  try {
    // Verify notification belongs to user
    const { data: existingNotification } = await supabase
      .from('notifications')
      .select('client_id')
      .eq('id', notificationId)
      .eq('user_id', user.id)
      .single();

    if (!existingNotification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Verify user has access to the client
    const { data: clientAccess } = await supabase
      .from('user_clients')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', existingNotification.client_id)
      .single();

    if (!clientAccess) {
      return res.status(403).json({ error: 'Access denied to this notification' });
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting notification:', error);
      return res.status(500).json({ error: 'Failed to delete notification' });
    }

    return res.status(200).json({ message: 'Notification deleted successfully' });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error in handleDelete:', message, error);
    return res.status(500).json({ error: 'Failed to delete notification' });
  }
}

export default withAuth(withSecurityHeaders(handler));
