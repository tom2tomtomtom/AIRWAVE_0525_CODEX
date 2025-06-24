import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';

export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    id: string;,
    email: string;
    role?: string;
  };
}

export function withAuth(
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    try {
      // Get token from cookies
      const token = req.cookies.airwave_token;

      if (!token) {
        return res.status(401).json({ error: 'No authentication token provided' });
      }

      // Verify the token with Supabase
      const {
        data: { user  }
        error} = await supabase.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        return res.status(401).json({ error: 'User profile not found' });
      }

      // Add user info to request
      req.user = {
        id: user.id,
        email: user.email || '',
        role: profile?.role || 'user' };

      // Call the original handler
      return await handler(req, res);
    } catch (error: unknown) {
      console.error('Authentication middleware error:', error);
      return res.status(401).json({ error: 'Authentication failed' });
    }
  };
}
