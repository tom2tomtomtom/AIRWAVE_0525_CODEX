import type { NextApiResponse } from 'next';
import { getErrorMessage } from '@/utils/errorUtils';
import { verifyAndEnableMFA } from '@/lib/mfa';
import { withAuth } from '@/middleware/withAuth';
import { z } from 'zod';
import type { AuthenticatedRequest } from '@/middleware/withAuth';

const verifyMFASchema = z.object({
  token: z
    .string()
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d+$/, 'Verification code must contain only numbers'),
});

interface MFAVerifyResponse {
  success: boolean;
  message?: string;
  error?: string;
}

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<MFAVerifyResponse>
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

    // Validate input
    let validatedData;
    try {
      validatedData = verifyMFASchema.parse(req.body);
    } catch (validationError: any) {
      const errors =
        validationError.errors?.map((err: any) => err.message).join(', ') || 'Invalid input data';
      return res.status(400).json({
        success: false,
        error: errors,
      });
    }

    const { token } = validatedData;

    // Verify the token and enable MFA
    const result = await verifyAndEnableMFA(user.id, token);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Verification failed',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'MFA has been successfully enabled for your account',
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('MFA verification error:', message);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify MFA. Please try again.',
    });
  }
}

export default withAuth(handler);
