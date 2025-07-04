import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';

interface Platform {
  id: string;
  name: string;
  displayName: string;
  isConnected: boolean;
  accountName?: string;
  permissions?: string[];
  lastSync?: string;
  status: 'active' | 'expired' | 'error';
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const userId = req.headers['x-user-id'] as string;

  try {
    if (req.method === 'GET') {
      // Get social media connections for the user
      const { data: connections, error } = await supabase
        .from('social_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      // Define supported platforms
      const supportedPlatforms = [
        { id: 'facebook', name: 'facebook', displayName: 'Facebook' },
        { id: 'instagram', name: 'instagram', displayName: 'Instagram' },
        { id: 'twitter', name: 'twitter', displayName: 'Twitter/X' },
        { id: 'linkedin', name: 'linkedin', displayName: 'LinkedIn' },
        { id: 'tiktok', name: 'tiktok', displayName: 'TikTok' },
      ];

      const platforms: Platform[] = supportedPlatforms.map((platform: any) => {
        const connection = connections?.find((c: any) => c.platform === platform.name);

        // Check if token is expired
        const isExpired =
          connection?.token_expires_at && new Date(connection.token_expires_at) < new Date();

        return {
          ...platform,
          isConnected: !!connection,
          accountName: connection?.platform_username || undefined,
          permissions: connection?.scope?.split(',') || [],
          lastSync: connection?.connected_at || undefined,
          status: isExpired ? 'expired' : connection ? 'active' : 'active',
        };
      });

      return res.status(200).json({
        success: true,
        platforms,
      });
    }

    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Platforms API error:', error, 'Message:', message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

export default withAuth(handler);
