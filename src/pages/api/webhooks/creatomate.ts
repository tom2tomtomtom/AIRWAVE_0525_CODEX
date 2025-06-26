import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { WebhookManager } from '../../../../lib/webhooks/webhookManager';
import { withErrorHandler } from '@/lib/errors/errorHandler';
import { sendRenderCompleteEmail } from '@/lib/email/resend';
import { loggers } from '@/lib/logger';


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CreatomateWebhookPayload {
  event: string;
  render_id: string;
  status: 'completed' | 'failed';
  url?: string;
  error?: string;
  metadata?: {
    execution_id?: string;
    user_id?: string;
    client_id?: string;
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify webhook signature (if Creatomate provides one)
  const signature = req.headers['x-creatomate-signature'] as string;
  if (signature && process.env.CREATOMATE_WEBHOOK_SECRET) {
    const webhookManager = WebhookManager.getInstance();
    const isValid = webhookManager.verifySignature(
      signature,
      req.body,
      process.env.CREATOMATE_WEBHOOK_SECRET
    );

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  const payload: CreatomateWebhookPayload = req.body;

  process.env.NODE_ENV === 'development' &&
    loggers.general.error('Received Creatomate webhook:', payload.event);
  try {
    // Handle different event types
    switch (payload.event) {
      case 'render.completed':
        await handleRenderCompleted(payload);
        break;

      case 'render.failed':
        await handleRenderFailed(payload);
        break;

      default:
        process.env.NODE_ENV === 'development' &&
          loggers.general.error('Unknown webhook event:', payload.event);
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error processing Creatomate webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleRenderCompleted(payload: CreatomateWebhookPayload): Promise<void> {
  const { render_id, url, metadata } = payload;

  if (!metadata?.execution_id) {
    console.error('No execution_id in webhook metadata');
    return;
  }

  // Update execution status
  const { data: execution, error: updateError } = await supabase
    .from('executions')
    .update({
      status: 'completed',
      output_url: url,
      metadata: {
        ...metadata,
        render_id,
        completed_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', metadata.execution_id)
    .select()
    .single();

  if (updateError) {
    console.error('Failed to update execution:', updateError);
    throw updateError;
  }

  // Trigger our own webhook event
  const webhookManager = WebhookManager.getInstance();
  await webhookManager.triggerEvent(
    {
      type: WebhookManager.EVENTS.RENDER_COMPLETED,
      data: {
        execution_id: metadata.execution_id,
        render_id,
        url,
        status: 'completed',
      },
    },
    metadata.client_id
  );

  // Send completion email if user_id is provided
  if (metadata.user_id) {
    const { data: user } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', metadata.user_id)
      .single();

    if (user && user.email) {
      await sendRenderCompleteEmail(user.email, {
        id: render_id,
        name: execution.name || 'Untitled Campaign',
        downloadUrl: url!,
        status: 'completed',
      });
    }
  }
}

async function handleRenderFailed(payload: CreatomateWebhookPayload): Promise<void> {
  const { render_id, error, metadata } = payload;

  if (!metadata?.execution_id) {
    console.error('No execution_id in webhook metadata');
    return;
  }

  // Update execution status
  await supabase
    .from('executions')
    .update({
      status: 'failed',
      metadata: {
        ...metadata,
        render_id,
        error,
        failed_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', metadata.execution_id);

  // Trigger our own webhook event
  const webhookManager = WebhookManager.getInstance();
  await webhookManager.triggerEvent(
    {
      type: WebhookManager.EVENTS.RENDER_FAILED,
      data: {
        execution_id: metadata.execution_id,
        render_id,
        error,
        status: 'failed',
      },
    },
    metadata.client_id
  );
}

export default withErrorHandler(handler);
