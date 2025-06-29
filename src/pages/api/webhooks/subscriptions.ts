import { NextApiRequest, NextApiResponse } from 'next';
import { withErrorHandler } from '@/lib/errors/errorHandler';
import { withAPIRateLimit } from '@/lib/rate-limiter';
import { WebhookManager } from '../../../../lib/webhooks/webhookManager';
import { AuthorizationError, ValidationError } from '@/lib/errors/errorHandler';

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  // Check authentication
  const userId = (req as any).userId;
  if (!userId) {
    throw new AuthorizationError('Authentication required');
  }
  
  switch (req.method) {
    case 'GET':
      return handleGet(req, res);
    
    case 'POST':
      return handlePost(req, res, userId);
    
    case 'PUT':
      return handlePut(req, res, userId);
    
    case 'DELETE':
      return handleDelete(req, res, userId);
    
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { event, client_id } = req.query;
  
  if (event && typeof event === 'string') {
    // Get subscriptions for a specific event
    const webhookManager = WebhookManager.getInstance();
    const subscriptions = await webhookManager.getSubscriptionsForEvent(
      event,
      client_id as string
    );

    return res.status(200).json({ subscriptions });
  }
  
  // TODO: Implement list all subscriptions
  return res.status(501).json({ error: 'Not implemented' });
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, userId: string): Promise<void> {
  const { url, events, client_id, metadata } = req.body;
  
  // Validate input
  if (!url || !events || !Array.isArray(events) || events.length === 0) {
    throw new ValidationError('URL and events array are required');
  }
  
  // Create subscription
  const webhookManager = WebhookManager.getInstance();
  const subscription = await webhookManager.createSubscription(
    url,
    events,
    client_id,
    {
      ...metadata,
      created_by: userId}
  );
  
  res.status(201).json({ subscription });
}

async function handlePut(req: NextApiRequest, res: NextApiResponse, userId: string): Promise<void> {
  const { id } = req.query;
  const { url, events, active, metadata } = req.body;
  
  if (!id || typeof id !== 'string') {
    throw new ValidationError('Subscription ID is required');
  }
  
  // Update subscription
  const webhookManager = WebhookManager.getInstance();
  const subscription = await webhookManager.updateSubscription(id, {
    url,
    events,
    active,
    metadata: {
        ...metadata,
      updated_by: userId,
      updated_at: new Date().toISOString()
      }});
  
  res.status(200).json({ subscription });
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse, _userId: string): Promise<void> {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    throw new ValidationError('Subscription ID is required');
  }
  
  // Delete subscription
  const webhookManager = WebhookManager.getInstance();
  await webhookManager.deleteSubscription(id);
  
  res.status(204).end();
}

export default withErrorHandler(withAPIRateLimit(handler));
