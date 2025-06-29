import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { withErrorHandler } from '@/lib/errors/errorHandler';
import { withAPIRateLimit } from '@/lib/rate-limiter';
import { deleteUserData } from '@/lib/gdpr/dataExport';
import { AuthorizationError, ValidationError } from '@/lib/errors/errorHandler';
import { sendEmail } from '@/lib/email/resend';

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get authenticated user
  const userId = (req as any).userId;
  const userEmail = (req as any).userEmail;

  if (!userId) {
    throw new AuthorizationError('Authentication required');
  }

  const { confirmation } = req.body;

  // Require explicit confirmation
  if (confirmation !== 'DELETE MY ACCOUNT') {
    throw new ValidationError(
      'Please confirm by typing "DELETE MY ACCOUNT" in the confirmation field'
    );
  }

  try {
    // Delete all user data
    await deleteUserData(userId);

    // Send confirmation email
    if (userEmail) {
      await sendEmail({
        to: userEmail,
        subject: 'Your AIrFLOW account has been deleted',
        html: `
          <h1>Account Deletion Confirmation</h1>
          <p>Your AIrFLOW account and all associated data have been permanently deleted.</p>
          <p>Deletion completed at: ${new Date().toISOString()}</p>
          <p>If you have any questions, please contact our support team.</p>
        `,
      });
    }

    // Log the user out by clearing their session
    // This would be handled by your auth system

    res.status(200).json({
      success: true,
      message: 'Your account and all associated data have been permanently deleted.' });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Account deletion failed:', message, error);
    throw error;
  }
}

export default withErrorHandler(withAPIRateLimit(handler));
