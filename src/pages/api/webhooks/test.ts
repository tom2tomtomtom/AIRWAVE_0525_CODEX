import { NextApiRequest, NextApiResponse } from 'next';
import { withErrorHandler } from '@/lib/errors/errorHandler';
import { withAPIRateLimit } from '@/lib/rate-limiter';
import { WebhookManager } from '../../../../lib/webhooks/webhookManager';
import { ValidationError } from '@/lib/errors/errorHandler';

/**
 * Test endpoint for triggering webhook events
 * Only available in development mode
 */
async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { event, data, client_id } = req.body;
  
  if (!event) {
    throw new ValidationError('Event type is required');
  }
  
  // Validate event type
  const validEvents = Object.values(WebhookManager.EVENTS);
  if (!validEvents.includes(event)) {
    throw new ValidationError(`Invalid event type. Valid events: ${validEvents.join(', ')}`);
  }
  
  try {
    // Trigger the webhook event
    const webhookManager = WebhookManager.getInstance();
    await webhookManager.triggerEvent(
      {
        type: event,
        data: data || {
          test: true,
          timestamp: new Date().toISOString() },
  metadata: {
        source: 'test_endpoint',
          triggered_at: new Date().toISOString()
      }},
      client_id
    );
    
    res.status(200).json({
      success: true,
      message: `Webhook event '${event}' triggered successfully`});
  } catch (error: any) {
    console.error('Failed to trigger test webhook:', error);
    throw error;
  }
}

export default withErrorHandler(withAPIRateLimit(handler));
