import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { z } from 'zod';
import { deliverWebhook, WEBHOOK_EVENTS } from './index';
import crypto from 'crypto';

const WebhookUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  url: z.string().url('Valid URL is required').optional(),
  events: z.array(z.string()).min(1, 'At least one event type is required').optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  retry_policy: z
    .object({
      max_attempts: z.number().min(1).max(10).default(3),
      backoff_strategy: z.enum(['linear', 'exponential']).default('exponential'),
      initial_delay_ms: z.number().min(1000).default(1000),
    })
    .optional(),
  headers: z.record(z.string()).optional(),
  timeout_ms: z.number().min(1000).max(30000).optional(),
});

const WebhookTestSchema = z.object({
  event_type: z.string().min(1, 'Event type is required'),
  test_data: z.record(z.any()).optional(),
});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const { id } = req.query;
  const user = (req as any).user;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Valid webhook ID is required' });
  }

  try {
    switch (method) {
      case 'GET':
        return handleGet(req, res, user, id);
      case 'PUT':
        return handleUpdate(req, res, user, id);
      case 'DELETE':
        return handleDelete(req, res, user, id);
      case 'POST':
        return handleAction(req, res, user, id);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Webhook API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    });
  }
}

async function handleGet(
  _req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  webhookId: string
): Promise<void> {
  try {
    // Get user's accessible clients
    const { data: userClients } = await supabase
      .from('user_clients')
      .select('client_id')
      .eq('user_id', user.id);

    if (!userClients || userClients.length === 0) {
      return res.status(403).json({ error: 'No client access' });
    }

    const clientIds = userClients.map((uc: any) => uc.client_id);

    // Get webhook with access validation
    const { data: webhook, error } = await supabase
      .from('webhooks')
      .select(
        `
        *,
        clients(id, name, slug),
        profiles!webhooks_created_by_fkey(full_name)
      `
      )
      .eq('id', webhookId)
      .in('client_id', clientIds)
      .single();

    if (error || !webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Get webhook delivery history
    const { data: deliveries } = await supabase
      .from('webhook_deliveries')
      .select('*')
      .eq('webhook_id', webhookId)
      .order('delivered_at', { ascending: false })
      .limit(50);

    // Get webhook logs
    const { data: logs } = await supabase
      .from('webhook_logs')
      .select(
        `
        *,
        profiles(full_name)
      `
      )
      .eq('webhook_id', webhookId)
      .order('timestamp', { ascending: false })
      .limit(20);

    // Calculate delivery statistics
    const stats = calculateDeliveryStatistics(deliveries || []);

    return res.json({
      data: {
        ...webhook,
        secret: webhook.secret ? `${webhook.secret.substring(0, 8)}...` : null, // Mask secret
      },
      deliveries: deliveries || [],
      logs: logs || [],
      statistics: stats,
      events: Object.values(WEBHOOK_EVENTS),
    });
  } catch (error: any) {
    console.error('Error in handleGet:', error);
    return res.status(500).json({ error: 'Failed to fetch webhook' });
  }
}

async function handleUpdate(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  webhookId: string
): Promise<void> {
  const validationResult = WebhookUpdateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  const updateData = validationResult.data;

  try {
    // Get webhook with access validation
    const { data: existingWebhook, error: fetchError } = await supabase
      .from('webhooks')
      .select('*, clients(id, name)')
      .eq('id', webhookId)
      .single();

    if (fetchError || !existingWebhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Verify user has access to the client
    const { data: clientAccess } = await supabase
      .from('user_clients')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('client_id', existingWebhook.client_id)
      .single();

    if (!clientAccess) {
      return res.status(403).json({ error: 'Access denied to this client' });
    }

    // Check permissions (only managers and above can update webhooks)
    if (!['manager', 'director', 'admin'].includes(clientAccess.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to update webhooks' });
    }

    // Validate event types if provided
    if (updateData.events) {
      const validEvents = Object.values(WEBHOOK_EVENTS);
      const invalidEvents = updateData.events.filter(
        (event: any) => !validEvents.includes(event as any)
      );
      if (invalidEvents.length > 0) {
        return res.status(400).json({
          error: 'Invalid event types',
          invalid_events: invalidEvents,
          valid_events: validEvents,
        });
      }
    }

    // Test webhook URL if it's being updated
    if (updateData.url && updateData.url !== existingWebhook.url) {
      const testResult = await testWebhookUrl(
        updateData.url,
        updateData.timeout_ms || existingWebhook.timeout_ms
      );
      if (!testResult.success) {
        return res.status(400).json({
          error: 'Webhook URL test failed',
          details: testResult.error,
        });
      }
    }

    // Update webhook
    const { data: webhook, error } = await supabase
      .from('webhooks')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', webhookId)
      .select(
        `
        *,
        clients(id, name, slug),
        profiles!webhooks_created_by_fkey(full_name)
      `
      )
      .single();

    if (error) {
      console.error('Error updating webhook:', error);
      return res.status(500).json({ error: 'Failed to update webhook' });
    }

    // Log webhook update
    await logWebhookEvent(webhookId, 'updated', user.id, {
      changes: updateData,
      previous_url: existingWebhook.url,
      previous_events: existingWebhook.events,
    });

    return res.json({
      data: {
        ...webhook,
        secret: webhook.secret ? `${webhook.secret.substring(0, 8)}...` : null,
      },
    });
  } catch (error: any) {
    console.error('Error updating webhook:', error);
    return res.status(500).json({ error: 'Failed to update webhook' });
  }
}

async function handleDelete(
  _req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  webhookId: string
): Promise<void> {
  try {
    // Get webhook with access validation
    const { data: webhook, error: fetchError } = await supabase
      .from('webhooks')
      .select('*, clients(id, name)')
      .eq('id', webhookId)
      .single();

    if (fetchError || !webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Verify user has access to the client
    const { data: clientAccess } = await supabase
      .from('user_clients')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('client_id', webhook.client_id)
      .single();

    if (!clientAccess) {
      return res.status(403).json({ error: 'Access denied to this client' });
    }

    // Check permissions (only managers and above can delete webhooks)
    if (!['manager', 'director', 'admin'].includes(clientAccess.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to delete webhooks' });
    }

    // Log webhook deletion before removing
    await logWebhookEvent(webhookId, 'deleted', user.id, {
      url: webhook.url,
      events: webhook.events,
      total_deliveries: webhook.total_deliveries,
    });

    // Delete webhook (cascade will handle deliveries and logs)
    const { error } = await supabase.from('webhooks').delete().eq('id', webhookId);

    if (error) {
      console.error('Error deleting webhook:', error);
      return res.status(500).json({ error: 'Failed to delete webhook' });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting webhook:', error);
    return res.status(500).json({ error: 'Failed to delete webhook' });
  }
}

async function handleAction(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  webhookId: string
): Promise<void> {
  const { action } = req.query;

  switch (action) {
    case 'test':
      return handleTestWebhook(req, res, user, webhookId);
    case 'regenerate-secret':
      return handleRegenerateSecret(req, res, user, webhookId);
    case 'toggle':
      return handleToggleWebhook(req, res, user, webhookId);
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

async function handleTestWebhook(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  webhookId: string
): Promise<void> {
  const validationResult = WebhookTestSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues,
    });
  }

  const { event_type, test_data } = validationResult.data;

  try {
    // Get webhook with access validation
    const { data: webhook, error: fetchError } = await supabase
      .from('webhooks')
      .select('*')
      .eq('id', webhookId)
      .single();

    if (fetchError || !webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Verify user has access to the client
    const { data: clientAccess } = await supabase
      .from('user_clients')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', webhook.client_id)
      .single();

    if (!clientAccess) {
      return res.status(403).json({ error: 'Access denied to this client' });
    }

    // Validate event type
    const validEvents = Object.values(WEBHOOK_EVENTS);
    if (!validEvents.includes(event_type as any)) {
      return res.status(400).json({
        error: 'Invalid event type',
        valid_events: validEvents,
      });
    }

    // Create test payload
    const payload = {
      event: event_type,
      timestamp: new Date().toISOString(),
      webhook_id: webhookId,
      test: true,
      data: test_data || {
        message: `Test webhook for event: ${event_type}`,
        user: user.email || user.id,
        client_id: webhook.client_id,
      },
    };

    // Deliver test webhook
    const result = await deliverWebhook(webhook, payload);

    // Log test webhook
    await logWebhookEvent(webhookId, 'tested', user.id, {
      event_type,
      test_data,
      result,
    });

    return res.json({
      success: result.success,
      result,
      payload,
    });
  } catch (error: any) {
    console.error('Error testing webhook:', error);
    return res.status(500).json({ error: 'Failed to test webhook' });
  }
}

async function handleRegenerateSecret(
  _req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  webhookId: string
): Promise<void> {
  try {
    // Get webhook with access validation
    const { data: webhook, error: fetchError } = await supabase
      .from('webhooks')
      .select('*, clients(id, name)')
      .eq('id', webhookId)
      .single();

    if (fetchError || !webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Verify user has access to the client
    const { data: clientAccess } = await supabase
      .from('user_clients')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('client_id', webhook.client_id)
      .single();

    if (!clientAccess) {
      return res.status(403).json({ error: 'Access denied to this client' });
    }

    // Check permissions (only managers and above can regenerate secrets)
    if (!['manager', 'director', 'admin'].includes(clientAccess.role)) {
      return res
        .status(403)
        .json({ error: 'Insufficient permissions to regenerate webhook secrets' });
    }

    // Generate new secret
    const newSecret = generateWebhookSecret();

    // Update webhook with new secret
    const { data: _updatedWebhook, error } = await supabase
      .from('webhooks')
      .update({
        secret: newSecret,
        updated_at: new Date().toISOString(),
      })
      .eq('id', webhookId)
      .select('*')
      .single();

    if (error) {
      console.error('Error regenerating webhook secret:', error);
      return res.status(500).json({ error: 'Failed to regenerate secret' });
    }

    // Log secret regeneration
    await logWebhookEvent(webhookId, 'secret_regenerated', user.id, {
      previous_secret_length: webhook.secret?.length || 0,
      new_secret_length: newSecret.length,
    });

    return res.json({
      success: true,
      secret: `${newSecret.substring(0, 8)}...`,
    });
  } catch (error: any) {
    console.error('Error regenerating webhook secret:', error);
    return res.status(500).json({ error: 'Failed to regenerate secret' });
  }
}

async function handleToggleWebhook(
  _req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  webhookId: string
): Promise<void> {
  try {
    // Get webhook with access validation
    const { data: webhook, error: fetchError } = await supabase
      .from('webhooks')
      .select('*, clients(id, name)')
      .eq('id', webhookId)
      .single();

    if (fetchError || !webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Verify user has access to the client
    const { data: clientAccess } = await supabase
      .from('user_clients')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('client_id', webhook.client_id)
      .single();

    if (!clientAccess) {
      return res.status(403).json({ error: 'Access denied to this client' });
    }

    // Check permissions (only managers and above can toggle webhooks)
    if (!['manager', 'director', 'admin'].includes(clientAccess.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to toggle webhooks' });
    }

    const newActiveState = !webhook.active;

    // Update webhook active state
    const { data: _updatedWebhook, error } = await supabase
      .from('webhooks')
      .update({
        active: newActiveState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', webhookId)
      .select('*')
      .single();

    if (error) {
      console.error('Error toggling webhook:', error);
      return res.status(500).json({ error: 'Failed to toggle webhook' });
    }

    // Log toggle action
    await logWebhookEvent(webhookId, newActiveState ? 'activated' : 'deactivated', user.id, {
      previous_state: webhook.active,
      new_state: newActiveState,
    });

    return res.json({
      success: true,
      active: newActiveState,
    });
  } catch (error: any) {
    console.error('Error toggling webhook:', error);
    return res.status(500).json({ error: 'Failed to toggle webhook' });
  }
}

// Helper functions
function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

async function testWebhookUrl(
  url: string,
  timeoutMs: number = 10000
): Promise<{ success: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AIrFLOW-Webhook-Test/1.0',
        'X-AIrFLOW-Test': 'true',
      },
      body: JSON.stringify({
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        data: { message: 'This is a webhook test from AIrFLOW' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status >= 200 && response.status < 300) {
      return { success: true };
    } else {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    if ((error as any).name === 'AbortError') {
      return { success: false, error: 'Request timeout' };
    }
    return {
      success: false,
      error: message,
    };
  }
}

async function logWebhookEvent(
  webhookId: string,
  action: string,
  userId: string,
  metadata: any
): Promise<void> {
  try {
    await supabase.from('webhook_logs').insert({
      webhook_id: webhookId,
      action,
      user_id: userId,
      metadata,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error logging webhook event:', error);
  }
}

function calculateDeliveryStatistics(deliveries: any[]): any {
  if (deliveries.length === 0) {
    return {
      total: 0,
      successful: 0,
      failed: 0,
      success_rate: 0,
      avg_response_time: 0,
      recent_failures: 0,
      last_delivery: null,
      status_distribution: {},
    };
  }

  const successful = deliveries.filter((d: any) => d.success).length;
  const failed = deliveries.filter((d: any) => !d.success).length;
  const recentFailures = deliveries.slice(0, 10).filter((d: any) => !d.success).length;

  const statusDistribution = deliveries.reduce(
    (acc, delivery) => {
      const status = delivery.response_status || 0;
      const range = getStatusRange(status);
      acc[range] = (acc[range] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    total: deliveries.length,
    successful,
    failed,
    success_rate: deliveries.length > 0 ? Math.round((successful / deliveries.length) * 100) : 0,
    recent_failures: recentFailures,
    last_delivery: deliveries[0]?.delivered_at || null,
    status_distribution: statusDistribution,
  };
}

function getStatusRange(status: number): string {
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 300 && status < 400) return '3xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500) return '5xx';
  return 'Unknown';
}

export default withAuth(withSecurityHeaders(handler));
