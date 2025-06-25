import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '@/utils/errorUtils';
import { supabase } from '@/lib/supabase';

interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

interface SignupResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    token: string;
    role?: string;
  };
  error?: string;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SignupResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Simple validation
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({
      success: false,
      error: 'Email, password, and name are required',
    });
  }

  // Basic email validation
  if (!email.includes('@')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email format',
    });
  }

  // Basic password validation
  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 8 characters',
    });
  }

  try {
    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('Starting signup process for email:', email);
    }

    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Supabase environment variables not configured');
      return res.status(500).json({
        success: false,
        error: 'Authentication service not configured. Please contact support.',
      });
    }

    // Check for demo/test environment
    if (process.env.NEXT_PUBLIC_SUPABASE_URL.includes('demo.supabase.co')) {
      return res.status(200).json({
        success: false,
        error:
          'Demo mode: Please configure real Supabase credentials in Netlify environment variables to enable account creation.',
      });
    }

    // Use Supabase authentication
    if (process.env.NODE_ENV === 'development') {
      console.log('Creating user with Supabase auth...');
    }
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
        },
      },
    });

    if (authError) {
      console.error('Supabase signup error:', authError);

      // Provide user-friendly error messages
      let errorMessage = authError.message;

      if (authError.message.includes('not enabled')) {
        errorMessage = 'Signups are currently disabled. Please contact the administrator.';
      } else if (authError.message.includes('already registered')) {
        errorMessage = 'This email is already registered. Please try logging in instead.';
      } else if (authError.message.includes('Invalid API key')) {
        errorMessage = 'Authentication service configuration error. Please try again later.';
      } else if (authError.message.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }

      return res.status(400).json({
        success: false,
        error: errorMessage,
      });
    }

    if (!authData.user) {
      return res.status(400).json({
        success: false,
        error: 'Failed to create user account. Please try again.',
      });
    }

    // Check if email confirmation is required
    process.env.NODE_ENV === 'development' &&
      console.log('User created, checking confirmation requirement...');
    if (!authData.session) {
      process.env.NODE_ENV === 'development' && console.log('Email confirmation required');
      return res.status(200).json({
        success: true,
        message: 'Please check your email for a confirmation link before logging in.',
      });
    }

    // If no email confirmation required, create user profile
    process.env.NODE_ENV === 'development' &&
      console.log('No email confirmation required, creating profile...');
    // First check if profiles table exists by attempting to query it
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authData.user.id)
      .single();

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      console.error('Error checking profile:', profileCheckError);
      // Continue anyway - the user is created in auth
    }

    if (!existingProfile) {
      // Try to create profile
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        first_name: name.split(' ')[0] || name,
        last_name: name.split(' ').slice(1).join(' ') || '',
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        // Continue anyway - the auth user is created
      }
    }

    return res.status(200).json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email || email,
        name: name,
        role: 'user',
        token: authData.session?.access_token || '',
      },
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
    });
  }
}
