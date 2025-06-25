import type { NextApiResponse } from 'next';
import { getErrorMessage } from '@/utils/errorUtils';
import { setupMFA } from '@/lib/mfa';
import { withAuth } from '@/middleware/withAuth';
import type { AuthenticatedRequest } from '@/middleware/withAuth';

interface MFASetupResponse {
  success: boolean;
  data?: {
    qrCodeUrl: string;
    backupCodes: string[];
    secret?: string; // Only for development
  };
  error?: string;
}

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<MFASetupResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { user } = req;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Set up MFA for the user
    const mfaResult = await setupMFA(user.id, user.email);

    return res.status(200).json({
      success: true,
      data: {
        qrCodeUrl: mfaResult.qrCodeUrl,
        backupCodes: mfaResult.backupCodes,
        // Only include secret in development for testing
        ...(process.env.NODE_ENV === 'development' && { secret: mfaResult.secret }),
      },
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('MFA setup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to setup MFA. Please try again.',
    });
  }
}

export default withAuth(handler);
