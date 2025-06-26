import { loggers } from '@/lib/logger';

/**
 * Email service using Resend
 */

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

/**
 * Send email using Resend service
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; id?: string }> {
  // Placeholder implementation
  loggers.db.debug('Email would be sent:', options);

  return {
    success: true,
    id: `email_${Date.now()}`,
  };
}

/**
 * Send GDPR data export email
 */
export async function sendDataExportEmail(to: string, downloadUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Your Data Export is Ready',
    html: `
      <h1>Your Data Export is Ready</h1>
      <p>You can download your data export from the link below:</p>
      <a href="${downloadUrl}">Download Data Export</a>
      <p>This link will expire in 7 days.</p>
    `,
  });
}

/**
 * Send data deletion confirmation email
 */
export async function sendDataDeletionEmail(to: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Data Deletion Confirmation',
    html: `
      <h1>Data Deletion Completed</h1>
      <p>Your personal data has been successfully deleted from our systems.</p>
      <p>If you have any questions, please contact our support team.</p>
    `,
  });
}

/**
 * Send render completion email notification
 */
export async function sendRenderCompleteEmail(
  to: string,
  renderDetails: {
    id: string;
    name: string;
    downloadUrl?: string;
    status: string;
  }
): Promise<void> {
  await sendEmail({
    to,
    subject: `Render Complete: ${renderDetails.name}`,
    html: `
      <h1>Your Render is Complete</h1>
      <p>Your render "${renderDetails.name}" has finished processing.</p>
      <p>Status: ${renderDetails.status}</p>
      ${
        renderDetails.downloadUrl
          ? `
        <p><a href="${renderDetails.downloadUrl}">Download your render</a></p>
      `
          : ''
      }
      <p>Render ID: ${renderDetails.id}</p>
    `,
  });
}
