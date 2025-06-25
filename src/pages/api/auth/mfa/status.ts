import type { NextApiResponse } from 'next';
import { getErrorMessage } from '@/utils/errorUtils';
import { supabase } from '@/lib/supabase';
import { withAuth } from '@/middleware/withAuth';
import type { AuthenticatedRequest } from '@/middleware/withAuth';

interface MFAStatusResponse {
  success: boolean;
  data?: {
    isConfigured: boolean;
    isEnabled: boolean;
    isRequired: boolean;
    backupCodesCount: number;
    lastUsedAt?: string;
  };
  error?: string;
}

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<MFAStatusResponse>
): Promise<void> {
  if (req.method !== 'GET') {
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

    // Get comprehensive MFA status using the database function
    const { data, error } = await supabase.rpc('get_mfa_status', { p_user_id: user.id });

    if (error) {
      console.error('Error fetching MFA status:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch MFA status',
      });
    }

    const status = data?.[0];

    return res.status(200).json({
      success: true,
      data: {
        isConfigured: status?.is_configured || false,
        isEnabled: status?.is_enabled || false,
        isRequired: status?.is_required || false,
        backupCodesCount: status?.backup_codes_count || 0,
        lastUsedAt: status?.last_used_at || undefined,
      },
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('MFA status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get MFA status. Please try again.',
    });
  }
}

export default withAuth(handler);
