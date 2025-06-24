import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { z } from 'zod';
import crypto from 'crypto';

const WebhookCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Valid URL is required'),
  events: z.array(z.string()).min(1, 'At least one event type is required'),
  client_id: z.string().uuid('Invalid client ID'),
  description: z.string().optional(),
  secret: z.string().optional(),
  active: z.boolean().default(true),
  retry_policy: z.object({
    max_attempts: z.number().min(1).max(10).default(3),
    backoff_strategy: z.enum(['linear', 'exponential']).default('exponential'),
    initial_delay_ms: z.number().min(1000).default(1000)}).default({
    max_attempts: 3,
    backoff_strategy: 'exponential',
    initial_delay_ms: 1000}),
  headers: z.record(z.string()).optional(),
  timeout_ms: z.number().min(1000).max(30000).default(10000)});

const WebhookUpdateSchema = WebhookCreateSchema.partial().omit(['client_id'] as any);

const WebhookFilterSchema = z.object({
  client_id: z.string().uuid().optional(),
  active: z.boolean().optional(),
  event_types: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0)});

// Available webhook event types
const WEBHOOK_EVENTS = {
  EXECUTION_STARTED: 'execution.started',
  EXECUTION_COMPLETED: 'execution.completed',
  EXECUTION_FAILED: 'execution.failed',
  EXECUTION_CANCELLED: 'execution.cancelled',
  APPROVAL_REQUESTED: 'approval.requested',
  APPROVAL_APPROVED: 'approval.approved',
  APPROVAL_REJECTED: 'approval.rejected',
  APPROVAL_CHANGES_REQUESTED: 'approval.changes_requested',
  CAMPAIGN_CREATED: 'campaign.created',
  CAMPAIGN_UPDATED: 'campaign.updated',
  CAMPAIGN_ACTIVATED: 'campaign.activated',
  CAMPAIGN_COMPLETED: 'campaign.completed',
  RENDER_COMPLETED: 'render.completed',
  RENDER_FAILED: 'render.failed',
  USER_INVITED: 'user.invited',
  USER_JOINED: 'user.joined'} as const;

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
    console.error('Webhook API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? message : undefined
    });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const validationResult = WebhookFilterSchema.safeParse(req.query);
  
  if (!validationResult.success) {
    return res.status(400).json({ 
      error: 'Invalid query parameters',
      details: validationResult.error.issues
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
      return res.json({ 
        data: [], 
        count: 0, 
        events: Object.values(WEBHOOK_EVENTS)
      });
    }

    const clientIds = userClients.map((uc: any) => uc.client_id);

    let query = supabase
      .from('webhooks')
      .select(`
        *,
        clients(id, name, slug),
        profiles!webhooks_created_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    // Filter by client access
    if (filters.client_id && clientIds.includes(filters.client_id)) {
      query = query.eq('client_id', filters.client_id);
    } else {
      query = query.in('client_id', clientIds);
    }

    // Apply filters
    if (typeof filters.active === 'boolean') {
      query = query.eq('active', filters.active);
    }

    if (filters.event_types && filters.event_types.length > 0) {
      query = query.contains('events', filters.event_types);
    }

    // Pagination
    query = query.range(filters.offset, filters.offset + filters.limit - 1);

    const { data: webhooks, error, count } = await query;

    if (error) {
      console.error('Error fetching webhooks:', error);
      return res.status(500).json({ error: 'Failed to fetch webhooks' });
    }

    // Get webhook statistics
    const statistics = await calculateWebhookStatistics(clientIds);

    return res.json({ 
      data: webhooks || [],
      count: webhooks?.length || 0,
      statistics,
      events: Object.values(WEBHOOK_EVENTS),
      pagination: {},
  limit: filters.limit,
        offset: filters.offset,
        total: count || 0
      }
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error in handleGet:', error);
    return res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const validationResult = WebhookCreateSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: validationResult.error.issues
    });
  }

  const webhookData = validationResult.data;

  try {
    // Verify user has access to the client
    const { data: clientAccess } = await supabase
      .from('user_clients')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('client_id', webhookData.client_id)
      .single();

    if (!clientAccess) {
      return res.status(403).json({ error: 'Access denied to this client' });
    }

    // Check permissions (only managers and above can create webhooks)
    if (!['manager', 'director', 'admin'].includes(clientAccess.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to create webhooks' });
    }

    // Validate event types
    const validEvents = Object.values(WEBHOOK_EVENTS);
    const invalidEvents = webhookData.events.filter((event: any) => !validEvents.includes(event as any));
    if (invalidEvents.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid event types',
        invalid_events: invalidEvents,
        valid_events: validEvents
      });
    }

    // Generate webhook secret if not provided
    const secret = webhookData.secret || generateWebhookSecret();

    // Test webhook URL before creating
    const testResult = await testWebhookUrl(webhookData.url, webhookData.timeout_ms);
    if (!testResult.success) {
      return res.status(400).json({ 
        error: 'Webhook URL test failed',
        details: testResult.error
      });
    }

    // Create webhook
    const { data: webhook, error } = await supabase
      .from('webhooks')
      .insert({
        ...webhookData,
        secret,
        created_by: user.id,
        last_triggered_at: null,
        total_deliveries: 0,
        successful_deliveries: 0,
        failed_deliveries: 0})
      .select(`
        *,
        clients(id, name, slug),
        profiles!webhooks_created_by_fkey(full_name)
      `)
      .single();

    if (error) {
      console.error('Error creating webhook:', error);
      return res.status(500).json({ error: 'Failed to create webhook' });
    }

    // Log webhook creation
    await logWebhookEvent(webhook.id, 'created', user.id, {
      events: webhookData.events,
      url: webhookData.url});

    // Send test webhook
    await triggerTestWebhook(webhook);

    return res.status(201).json({ 
      data: { }
        ...webhook,
        secret: `${secret.substring(0, 8)}...` // Don't expose full secret
      }
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error creating webhook:', error);
    return res.status(500).json({ error: 'Failed to create webhook' });
  }
}

// Helper function to generate secure webhook secret
function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Helper function to test webhook URL
async function testWebhookUrl(url: string, timeoutMs: number = 10000): Promise<{ success: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'POST',
      headers: {},
        'Content-Type': 'application/json',
        'User-Agent': 'AIrFLOW-Webhook-Test/1.0',
        'X-AIrFLOW-Test': 'true'
      },
      body: JSON.stringify({
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        data: { message: 'This is a webhook test from AIrFLOW' }
      }),
      signal: controller.signal});

    clearTimeout(timeoutId);

    if (response.status >= 200 && response.status < 300) {
      return { success: true };
    } else {
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${response.statusText}` 
      };
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    if ((error as any).name === 'AbortError') {
      return { success: false, error: 'Request timeout' };
    }
    return {
      success: false,
      error: message
    };
  }
}

// Helper function to calculate webhook statistics
async function calculateWebhookStatistics(clientIds: string[]): Promise<any> {
  try {
    const { data: webhooks } = await supabase
      .from('webhooks')
      .select('active, total_deliveries, successful_deliveries, failed_deliveries, events')
      .in('client_id', clientIds);

    if (!webhooks) return getEmptyWebhookStatistics();

    const total = webhooks.length;
    const active = webhooks.filter((w: any) => w.active).length;
    const totalDeliveries = webhooks.reduce((sum, w) => sum + (w.total_deliveries || 0), 0);
    const successfulDeliveries = webhooks.reduce((sum, w) => sum + (w.successful_deliveries || 0), 0);
    const failedDeliveries = webhooks.reduce((sum, w) => sum + (w.failed_deliveries || 0), 0);
    
    // Calculate event type distribution
    const eventDistribution = webhooks.reduce((acc, webhook) => {
      (webhook.events || []).forEach((event: string) => {
        acc[event] = (acc[event] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;

    return {
      total,
      active,
      inactive: total - active,
      total_deliveries: totalDeliveries,
      successful_deliveries: successfulDeliveries,
      failed_deliveries: failedDeliveries,
      success_rate: Math.round(successRate * 100) / 100,
      event_distribution: eventDistribution};
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error calculating webhook statistics:', error);
    return getEmptyWebhookStatistics();
  }
}

function getEmptyWebhookStatistics() {
  return {
    total: 0,
    active: 0,
    inactive: 0,
    total_deliveries: 0,
    successful_deliveries: 0,
    failed_deliveries: 0,
    success_rate: 0,
    event_distribution: {}
  };
}

// Helper function to log webhook events
async function logWebhookEvent(webhookId: string, action: string, userId: string, metadata: any): Promise<void> {
  try {
    await supabase
      .from('webhook_logs')
      .insert({
        webhook_id: webhookId,
        action,
        user_id: userId,
        metadata,
        timestamp: new Date().toISOString()});
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error logging webhook event:', error);
  }
}

// Helper function to send test webhook
async function triggerTestWebhook(webhook: any): Promise<void> {
  try {
    const payload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      webhook_id: webhook.id,
      data: {},
  message: 'Webhook successfully configured!',
        client_id: webhook.client_id,
        events: webhook.events}
    };

    await deliverWebhook(webhook, payload);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error sending test webhook:', error);
  }
}

// Helper function to deliver webhook
export async function deliverWebhook(webhook: any, payload: any): Promise<{ success: boolean; error?: string }> {
  try {
    const signature = generateWebhookSignature(payload, webhook.secret);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), webhook.timeout_ms || 10000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AIrFLOW-Webhook/1.0',
      'X-AIrFLOW-Signature': signature,
      'X-AIrFLOW-Event': payload.event,
      'X-AIrFLOW-Delivery': crypto.randomUUID(),
      ...webhook.headers};

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal});

    clearTimeout(timeoutId);

    // Update webhook statistics
    await supabase
      .from('webhooks')
      .update({
        total_deliveries: (webhook.total_deliveries || 0) + 1,
        successful_deliveries: response.ok 
          ? (webhook.successful_deliveries || 0) + 1 
          : webhook.successful_deliveries || 0,
        failed_deliveries: !response.ok 
          ? (webhook.failed_deliveries || 0) + 1 
          : webhook.failed_deliveries || 0,
        last_triggered_at: new Date().toISOString()})
      .eq('id', webhook.id);

    // Log delivery
    await supabase
      .from('webhook_deliveries')
      .insert({
        webhook_id: webhook.id,
        event_type: payload.event,
        payload,
        response_status: response.status,
        response_body: await response.text().catch(() => ''),
        success: response.ok,
        delivered_at: new Date().toISOString()});

    return { 
      success: response.ok,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
    };
  } catch (error: any) {
    const message = getErrorMessage(error);
    // Update failed delivery count
    await supabase
      .from('webhooks')
      .update({
        total_deliveries: (webhook.total_deliveries || 0) + 1,
        failed_deliveries: (webhook.failed_deliveries || 0) + 1})
      .eq('id', webhook.id);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log failed delivery
    await supabase
      .from('webhook_deliveries')
      .insert({
        webhook_id: webhook.id,
        event_type: payload.event,
        payload,
        response_status: 0,
        response_body: errorMessage,
        success: false,
        delivered_at: new Date().toISOString()});

    return { success: false, error: errorMessage };
  }
}

// Helper function to generate webhook signature
function generateWebhookSignature(payload: any, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return `sha256=${hmac.digest('hex')}`;
}

// Helper function to trigger webhook for specific event
export async function triggerWebhookEvent(
  eventType: string, 
  data: any, 
  clientId: string
): Promise<void> {
  try {
    // Get all active webhooks for this client and event type
    const { data: webhooks } = await supabase
      .from('webhooks')
      .select('*')
      .eq('client_id', clientId)
      .eq('active', true)
      .contains('events', [eventType]);

    if (!webhooks || webhooks.length === 0) return;

    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      client_id: clientId,
      data};

    // Deliver to all matching webhooks
    const deliveryPromises = webhooks.map((webhook: any) => 
      deliverWebhook(webhook, payload)
    );

    await Promise.allSettled(deliveryPromises);
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error triggering webhook event:', error);
  }
}

export { WEBHOOK_EVENTS };
export default withAuth(withSecurityHeaders(handler));