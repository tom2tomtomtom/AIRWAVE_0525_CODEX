import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { loggers } from '@/lib/logger';


interface LoginResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name?: string;
    token: string;
    role?: string;
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Simple validation
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required' });
  }

  // Check if Supabase is configured properly
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('demo.supabase.co')
  ) {
    return res.status(401).json({
      success: false,
      error: 'Authentication service not configured. Please use demo credentials or configure real Supabase credentials.' });
  }

  try {
    // Create Supabase client directly
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Use Supabase authentication
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return res.status(401).json({
        success: false,
        error: authError?.message || 'Invalid email or password' });
    }

    // Try to get user profile from database
    let userProfile: any = null;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (!profileError && profileData) {
        userProfile = profileData;
      }
    } catch (profileErr) {
      // Profile fetch failed, continue without it
      loggers.general.error('Could not fetch user profile:', profileErr);
    }

    // Create response with user data
    const userName =
      userProfile?.full_name ||
      `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() ||
      authData.user.email?.split('@')[0] ||
      'User';

    // Set secure HTTP-only cookie with the session token
    const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
    const isHttps =
      req.headers.host?.includes('netlify.app') ||
      req.headers.host?.includes('vercel.app') ||
      req.headers['x-forwarded-proto'] === 'https';

    const cookieSettings = isHttps
      ? `HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Path=/`
      : `HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Path=/`;

    res.setHeader('Set-Cookie', [
      `airwave_token=${authData.session?.access_token || ''}; ${cookieSettings}`,
      `airwave_refresh_token=${authData.session?.refresh_token || ''}; ${cookieSettings}`,
    ]);

    return res.status(200).json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email || email,
        name: userName || 'User',
        role: userProfile?.role || 'user',
        token: authData.session?.access_token || '' },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again later.' });
  }
}
