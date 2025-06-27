import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { AppError } from '../errors/errorHandler';
import { getErrorMessage } from '@/utils/errorUtils';

// Conditionally import bullQueue only on server side
let addWebhookJob: any = null;
if (typeof window === 'undefined') {
  try {
    addWebhookJob = require('@/lib/queue/bullQueue').addWebhookJob;
  } catch (error) {
    console.warn('BullQueue not available:', error);
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface WebhookEvent {
  type: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  clientId?: string;
  metadata?: Record<string, any>;
}

export class WebhookManager {
  private static instance: WebhookManager;

  private constructor() {}

  static getInstance(): WebhookManager {
    if (!WebhookManager.instance) {
      WebhookManager.instance = new WebhookManager();
    }
    return WebhookManager.instance;
  }

  /**
   * Generate a webhook secret
   */
  generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate webhook signature
   */
  generateSignature(payload: any, secret: string): string {
    const timestamp = Date.now();
    const message = `${timestamp}.${JSON.stringify(payload)}`;
    const signature = crypto.createHmac('sha256', secret).update(message).digest('hex');

    return `t=${timestamp},v1=${signature}`;
  }

  /**
   * Verify webhook signature
   */
  verifySignature(
    signature: string,
    payload: any,
    secret: string,
    tolerance: number = 300000
  ): boolean {
    try {
      const parts = signature.split(',');
      const timestamp = parseInt(parts.find(p => p.startsWith('t='))?.split('=')[1] || '0');
      const receivedSignature = parts.find(p => p.startsWith('v1='))?.split('=')[1] || '';

      // Check timestamp tolerance (default 5 minutes)
      if (Date.now() - timestamp > tolerance) {
        return false;
      }

      // Generate expected signature
      const message = `${timestamp}.${JSON.stringify(payload)}`;
      const expectedSignature = crypto.createHmac('sha256', secret).update(message).digest('hex');

      // Constant time comparison
      return crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature));
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a webhook subscription
   */
  async createSubscription(
    url: string,
    events: string[],
    clientId?: string,
    metadata?: Record<string, any>
  ): Promise<WebhookSubscription> {
    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      const message = getErrorMessage(error);
      throw new AppError(`Invalid webhook URL: ${message}`, 'INVALID_URL', 400, true);
    }

    // Generate secret
    const secret = this.generateSecret();

    // Store in database
    const { data, error } = await supabase
      .from('webhook_subscriptions')
      .insert({
        url,
        events,
        secret,
        active: true,
        client_id: clientId,
        metadata,
      })
      .select()
      .single();

    if (error) {
      throw new AppError(
        'Failed to create webhook subscription',
        'SUBSCRIPTION_CREATE_FAILED',
        500,
        true,
        { originalError: error }
      );
    }

    return {
      id: data.id,
      url: data.url,
      events: data.events,
      secret: data.secret,
      active: data.active,
      clientId: data.client_id,
      metadata: data.metadata,
    };
  }

  /**
   * Update a webhook subscription
   */
  async updateSubscription(
    id: string,
    updates: Partial<Omit<WebhookSubscription, 'id' | 'secret'>>
  ): Promise<WebhookSubscription> {
    const { data, error } = await supabase
      .from('webhook_subscriptions')
      .update({
        url: updates.url,
        events: updates.events,
        active: updates.active,
        metadata: updates.metadata,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new AppError(
        'Failed to update webhook subscription',
        'SUBSCRIPTION_UPDATE_FAILED',
        500,
        true,
        { originalError: error }
      );
    }

    return {
      id: data.id,
      url: data.url,
      events: data.events,
      secret: data.secret,
      active: data.active,
      clientId: data.client_id,
      metadata: data.metadata,
    };
  }

  /**
   * Delete a webhook subscription
   */
  async deleteSubscription(id: string): Promise<void> {
    const { error } = await supabase.from('webhook_subscriptions').delete().eq('id', id);

    if (error) {
      throw new AppError(
        'Failed to delete webhook subscription',
        'SUBSCRIPTION_DELETE_FAILED',
        500,
        true,
        { originalError: error }
      );
    }
  }

  /**
   * Get subscriptions for an event
   */
  async getSubscriptionsForEvent(
    eventType: string,
    clientId?: string
  ): Promise<WebhookSubscription[]> {
    let query = supabase
      .from('webhook_subscriptions')
      .select('*')
      .eq('active', true)
      .contains('events', [eventType]);

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;

    if (error) {
      throw new AppError(
        'Failed to fetch webhook subscriptions',
        'SUBSCRIPTION_FETCH_FAILED',
        500,
        true,
        { originalError: error }
      );
    }

    return data.map(sub => ({
      id: sub.id,
      url: sub.url,
      events: sub.events,
      secret: sub.secret,
      active: sub.active,
      clientId: sub.client_id,
      metadata: sub.metadata,
    }));
  }

  /**
   * Trigger a webhook event
   */
  async triggerEvent(event: WebhookEvent, clientId?: string): Promise<void> {
    try {
      // Get active subscriptions for this event
      const subscriptions = await this.getSubscriptionsForEvent(event.type, clientId);

      if (subscriptions.length === 0) {
        console.log(`No webhook subscriptions found for event: ${event.type}`);
        return;
      }

      console.log(`Triggering ${subscriptions.length} webhooks for event: ${event.type}`);

      // Queue webhook jobs for each subscription
      const jobs = subscriptions.map(subscription => {
        if (addWebhookJob) {
          return addWebhookJob({
            url: subscription.url,
            event: event.type,
            data: {
              ...event.data,
              metadata: event.metadata,
            },
            secret: subscription.secret,
          });
        } else {
          console.warn('BullQueue not available, webhook job not queued');
          return Promise.resolve();
        }
      });

      await Promise.all(jobs);

      console.log(`Queued ${jobs.length} webhook jobs for event: ${event.type}`);
    } catch (error) {
      const message = getErrorMessage(error);
      console.error('Failed to trigger webhook event:', message);
      throw error;
    }
  }

  /**
   * Common webhook events
   */
  static EVENTS = {
    // Render events
    RENDER_STARTED: 'render.started',
    RENDER_PROGRESS: 'render.progress',
    RENDER_COMPLETED: 'render.completed',
    RENDER_FAILED: 'render.failed',

    // Approval events
    APPROVAL_REQUESTED: 'approval.requested',
    APPROVAL_RECEIVED: 'approval.received',
    APPROVAL_REJECTED: 'approval.rejected',

    // Export events
    EXPORT_STARTED: 'export.started',
    EXPORT_COMPLETED: 'export.completed',
    EXPORT_FAILED: 'export.failed',

    // Campaign events
    CAMPAIGN_CREATED: 'campaign.created',
    CAMPAIGN_UPDATED: 'campaign.updated',
    CAMPAIGN_COMPLETED: 'campaign.completed',

    // Asset events
    ASSET_UPLOADED: 'asset.uploaded',
    ASSET_DELETED: 'asset.deleted',

    // Client events
    CLIENT_CREATED: 'client.created',
    CLIENT_UPDATED: 'client.updated',
  } as const;
}

// Export singleton instance
export const webhookManager = WebhookManager.getInstance();
