import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { withErrorHandler } from '@/lib/errors/errorHandler';
import { withRateLimitedRoute } from '@/middleware/rateLimiter';
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
        subject: 'Your AIrWAVE account has been deleted',
        template: 'account-deleted' as any,
        data: {
          deletedAt: new Date().toISOString(),
        },
      });
    }
    
    // Log the user out by clearing their session
    // This would be handled by your auth system
    
    res.status(200).json({
      success: true,
      message: 'Your account and all associated data have been permanently deleted.',
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('Account deletion failed:', error);
    throw error;
  }
}

export default withRateLimitedRoute(
  withErrorHandler(handler),
  'api',
  { 
    customIdentifier: (req) => `gdpr_delete_${(req as any).userId}`,
    costFunction: () => 10, // High cost to prevent abuse
  }
);
