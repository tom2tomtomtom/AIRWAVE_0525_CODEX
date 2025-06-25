import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '@/utils/errorUtils';
import { withAuthRateLimit } from '@/lib/rate-limiter';
import { supabase } from '@/lib/supabase';

interface LoginRequest {
  email: string;
  password: string;
}

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

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Simple validation without complex schemas
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required'
    });
  }

  // Check if Supabase is configured properly
  const hasValidSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL &&
                          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
                          !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('demo.supabase.co');


  // If Supabase is not properly configured, return error
  if (!hasValidSupabase) {
    return res.status(401).json({
      success: false,
      error: 'Authentication service not configured. Please use test credentials.'
    });
  }

  try {

    // Use Supabase authentication
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password});

    if (authError || !authData.user) {
      return res.status(401).json({
        success: false,
        error: authError?.message || 'Invalid email or password'
      });
    }

    // Try to get user profile from database
    // Check if profile exists - try both schema formats
    let userProfile: any = null;
    let profileError: any = null;

    // First try the current schema format (first_name, last_name)
    const { data: profileData1, error: error1 } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (!error1 && profileData1) {
      userProfile = profileData1;
    } else {
      profileError = error1;
    }

    // If profile doesn't exist, create it with the current schema
    if (profileError && profileError.code === 'PGRST116') {
      if (process.env.NODE_ENV === 'development') {
        console.log('Creating new user profile...');
      }
      
      // Determine the correct schema to use based on existing table structure
      // Try to create with the detected schema
      const userName = authData.user.user_metadata?.name || authData.user.email?.split('@')[0] || 'User';
      const nameParts = userName.split(' ');
      
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          first_name: nameParts[0] || userName,
          last_name: nameParts.slice(1).join(' ') || '',
          role: 'user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()})
        .select()
        .single();

      if (createError) {
        // Try alternative schema format if the first one fails
        if (process.env.NODE_ENV === 'development') {
          console.error('First profile creation failed, trying alternative schema...', createError);
        }
        
        const { data: altProfile, error: altError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email: authData.user.email || email,
            full_name: userName,
            role: 'user',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()})
          .select()
          .single();

        if (altError) {
          console.error('Error creating user profile with both schemas:', altError);
          return res.status(500).json({
            success: false,
            error: 'Failed to create user profile'
          });
        }
        
        userProfile = altProfile;
      } else {
        userProfile = newProfile;
      }
    } else if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch user profile'
      });
    }

    // Create response with normalized user data
    const userName = userProfile.full_name || 
                    `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() ||
                    authData.user.email?.split('@')[0] || 'User';

    // Set secure HTTP-only cookie with the session token
    const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
    const isProduction = process.env.NODE_ENV === 'production';
    const isHttps = req.headers.host?.includes('netlify.app') || req.headers.host?.includes('vercel.app') || req.headers['x-forwarded-proto'] === 'https';
    
    // For production HTTPS sites, we need Secure flag
    // Use SameSite=Lax for better compatibility with same-origin requests
    const cookieSettings = isHttps
      ? `HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Path=/`
      : `HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Path=/`;
      
    res.setHeader('Set-Cookie', [
      `airwave_token=${authData.session?.access_token || ''}; ${cookieSettings}`,
      `airwave_refresh_token=${authData.session?.refresh_token || ''}; ${cookieSettings}`
    ]);

    return res.status(200).json({
      success: true,
      user: {
        id: userProfile.id,
        email: authData.user.email || email,
        name: userName || 'User',
        role: userProfile.role || 'user',
        token: authData.session?.access_token || ''
      }
    });

  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

// Apply rate limiting to prevent brute force attacks
export default withAuthRateLimit(handler);