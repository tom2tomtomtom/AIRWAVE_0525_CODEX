import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();

// Since Next.js doesn't natively support WebSockets in API routes,
// we'll create a polling-based real-time system that can be upgraded to WebSockets later

interface RealtimeEvent {
  id: string;
  type: 'execution_status_change' | 'approval_decision' | 'campaign_update' | 'notification';
  data: any;
  user_id: string;
  client_id: string;
  timestamp: string;
  read: boolean;
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const user = (req as any).user;

  try {
    switch (method) {
      case 'GET':
        return handleGetEvents(req, res, user);
      case 'POST':
        return handleCreateEvent(req, res, user);
      case 'PUT':
        return handleMarkRead(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('WebSocket API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? message : undefined
    });
  }
}

async function handleGetEvents(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const { 
    client_id, 
    since, 
    limit = 50, 
    unread_only = false 
  } = req.query;

  try {
    // Get user's accessible clients
    const { data: userClients } = await supabase
      .from('user_clients')
      .select('client_id')
      .eq('user_id', user.id);
    
    if (!userClients || userClients.length === 0) {
      return res.json({ events: [], count: 0 });
    }

    const clientIds = userClients.map((uc: any) => uc.client_id);

    let query = supabase
      .from('realtime_events')
      .select('*')
      .in('client_id', clientIds)
      .order('timestamp', { ascending: false })
      .limit(parseInt(limit as string));

    // Filter by specific client if provided
    if (client_id && clientIds.includes(client_id as string)) {
      query = query.eq('client_id', client_id);
    }

    // Filter by timestamp if provided
    if (since) {
      query = query.gt('timestamp', since);
    }

    // Filter unread events only
    if (unread_only === 'true') {
      query = query.eq('read', false);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Error fetching realtime events:', error);
      return res.status(500).json({ error: 'Failed to fetch events' });
    }

    // Get additional context for events
    const enrichedEvents = await Promise.all(
      (events || []).map(async (event) => {
        const enrichedEvent = { ...event };
        
        // Add context based on event type
        switch (event.type) {
          case 'execution_status_change':
            if (event.data?.execution_id) {
              const { data: execution } = await supabase
                .from('executions')
                .select(`
                  id, status, platform, content_type,
                  matrices(id, name, campaigns(id, name))
                `)
                .eq('id', event.data.execution_id)
                .single();
              
              enrichedEvent.context = { execution };
            }
            break;
          
          case 'approval_decision':
            if (event.data?.approval_id) {
              const { data: approval } = await supabase
                .from('approvals')
                .select(`
                  id, status, approval_type, item_type,
                  clients(id, name)
                `)
                .eq('id', event.data.approval_id)
                .single();
              
              enrichedEvent.context = { approval };
            }
            break;
        }
        
        return enrichedEvent;
      })
    );

    return res.json({ 
      events: enrichedEvents,
      count: enrichedEvents.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    getErrorMessage(error);
    console.error('Error in handleGetEvents:', error);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
}

async function handleCreateEvent(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const { type, data, client_id, target_user_ids } = req.body;

  if (!type || !data || !client_id) {
    return res.status(400).json({ error: 'Missing required fields: type, data, client_id' });
  }

  try {
    // Verify user has access to the client
    const { data: clientAccess } = await supabase
      .from('user_clients')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', client_id)
      .single();

    if (!clientAccess) {
      return res.status(403).json({ error: 'Access denied to this client' });
    }

    // Determine target users
    let userIds = target_user_ids || [];
    
    if (!target_user_ids || target_user_ids.length === 0) {
      // Broadcast to all users with access to this client
      const { data: clientUsers } = await supabase
        .from('user_clients')
        .select('user_id')
        .eq('client_id', client_id);
      
      userIds = clientUsers?.map((u: any) => u.user_id) || [];
    }

    // Create events for each target user
    const eventPromises = userIds.map(async (targetUserId: string) => {
      const eventData = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        data,
        user_id: targetUserId,
        client_id,
        timestamp: new Date().toISOString(),
        read: false,
        created_by: user.id};

      return supabase
        .from('realtime_events')
        .insert(eventData)
        .select()
        .single();
    });

    const results = await Promise.all(eventPromises);
    const successfulEvents = results.filter((r: any) => !r.error).map((r: any) => r.data);

    // Also trigger any webhook notifications here
    await triggerWebhookNotifications(type, data, client_id, successfulEvents);

    return res.status(201).json({ 
      message: 'Events created successfully',
      events: successfulEvents,
      count: successfulEvents.length
    });
  } catch (error: any) {
    getErrorMessage(error);
    console.error('Error creating realtime event:', error);
    return res.status(500).json({ error: 'Failed to create event' });
  }
}

async function handleMarkRead(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const { event_ids, mark_all = false, client_id } = req.body;

  try {
    let query = supabase
      .from('realtime_events')
      .update({ 
        read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('user_id', user.id);

    if (mark_all && client_id) {
      // Mark all events for this client as read
      query = query.eq('client_id', client_id);
    } else if (event_ids && Array.isArray(event_ids)) {
      // Mark specific events as read
      query = query.in('id', event_ids);
    } else {
      return res.status(400).json({ error: 'Must provide event_ids or mark_all with client_id' });
    }

    const { data, error } = await query.select();

    if (error) {
      console.error('Error marking events as read:', error);
      return res.status(500).json({ error: 'Failed to mark events as read' });
    }

    return res.json({ 
      message: 'Events marked as read',
      updated_count: data?.length || 0
    });
  } catch (error: any) {
    getErrorMessage(error);
    console.error('Error in handleMarkRead:', error);
    return res.status(500).json({ error: 'Failed to mark events as read' });
  }
}

// Helper function to trigger webhook notifications
async function triggerWebhookNotifications(
  eventType: string, 
  eventData: any, 
  clientId: string, 
  events: RealtimeEvent[]
): Promise<void> {
  try {
    // Get client webhook configuration
    const { data: client } = await supabase
      .from('clients')
      .select('webhook_settings')
      .eq('id', clientId)
      .single();

    const webhookSettings = client?.webhook_settings;
    
    if (!webhookSettings?.enabled || !webhookSettings?.url) {
      return; // No webhooks configured
    }

    // Check if this event type should trigger a webhook
    const enabledEvents = webhookSettings.events || [];
    if (!enabledEvents.includes(eventType)) {
      return;
    }

    // Prepare webhook payload
    const webhookPayload = {
      event_type: eventType,
      timestamp: new Date().toISOString(),
      client_id: clientId,
      data: eventData,
      events: events.map((e: any) => ({
        id: e.id,
        type: e.type,
        user_id: e.user_id,
        timestamp: e.timestamp
      }))
    };

    // Send webhook (fire and forget)
    fetch(webhookSettings.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AIrFLOW-Webhook/1.0',
        ...(webhookSettings.secret && {
          'X-AIrFLOW-Signature': generateWebhookSignature(webhookPayload, webhookSettings.secret)
        
      })
      },
      body: JSON.stringify(webhookPayload)
    }).catch(error => {
      console.error('Webhook delivery failed:', error);
      // In production, you might want to queue this for retry
    });

  } catch (error: any) {
    getErrorMessage(error);
    console.error('Error triggering webhook notifications:', error);
  }
}

// Helper function to generate webhook signature
function generateWebhookSignature(payload: any, secret: string): string {
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return `sha256=${hmac.digest('hex')}`;
}

// Helper function to broadcast event to all users with client access
export async function broadcastEvent(
  type: string, 
  data: any, 
  clientId: string, 
  excludeUserId?: string
): Promise<void> {
  try {
    const { data: clientUsers } = await supabase
      .from('user_clients')
      .select('user_id')
      .eq('client_id', clientId);
    
    if (!clientUsers) return;

    const targetUsers = clientUsers
      .map((u: any) => u.user_id)
      .filter((userId: any) => userId !== excludeUserId);

    const eventPromises = targetUsers.map((userId: any) => {
      const eventData = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        data,
        user_id: userId,
        client_id: clientId,
        timestamp: new Date().toISOString(),
        read: false};

      return supabase
        .from('realtime_events')
        .insert(eventData);
    });

    await Promise.all(eventPromises);
  } catch (error: any) {
    getErrorMessage(error);
    console.error('Error broadcasting event:', error);
  }
}

export default withAuth(withSecurityHeaders(handler));