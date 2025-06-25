import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Create authenticated Supabase client
    const supabase = createServerSupabaseClient({ req, res });

    // Get the current session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return res.status(401).json({
        success: false,
        error: 'No active session found',
      });
    }

    // Refresh the session
    const {
      data: { session: newSession },
      error: refreshError,
    } = await supabase.auth.refreshSession();

    if (refreshError || !newSession) {
      return res.status(401).json({
        success: false,
        error: refreshError?.message || 'Failed to refresh session',
      });
    }

    // Update cookies with new tokens
    const maxAge = 7 * 24 * 60 * 60; // 7 days
    const isHttps =
      req.headers.host?.includes('netlify.app') ||
      req.headers.host?.includes('vercel.app') ||
      req.headers['x-forwarded-proto'] === 'https';

    const cookieSettings = isHttps
      ? `HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Path=/`
      : `HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Path=/`;

    res.setHeader('Set-Cookie', [
      `airwave_token=${newSession.access_token}; ${cookieSettings}`,
      `airwave_refresh_token=${newSession.refresh_token}; ${cookieSettings}`,
    ]);

    return res.status(200).json({
      success: true,
      session: {
        access_token: newSession.access_token,
        refresh_token: newSession.refresh_token,
        expires_at: newSession.expires_at,
        expires_in: newSession.expires_in,
        user: {
          id: newSession.user.id,
          email: newSession.user.email,
          role: newSession.user.user_metadata?.role || 'authenticated',
        },
      },
    });
  } catch (error: any) {
    console.error('Session refresh error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}
