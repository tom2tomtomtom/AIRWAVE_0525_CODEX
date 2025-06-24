import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

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
      error: 'Email, password, and name are required'});
  }

  // Check for demo mode
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('demo.supabase.co')
  ) {
    return res.status(200).json({
      success: false,
      error: 'Demo mode: Please configure real Supabase credentials in Netlify environment variables to enable account creation.' });
  }

  try {
    // Create Supabase client directly
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Use Supabase authentication
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {},
        data: {},
          name: name }}});

    if (authError) {
      console.error('Supabase signup error:', authError);

      // Provide user-friendly error messages
      let errorMessage = authError.message;

      if (authError.message.includes('not enabled')) {
        errorMessage = 'Signups are currently disabled. Please contact the administrator.';
      } else if (authError.message.includes('already registered')) {
        errorMessage = 'This email is already registered. Please try logging in instead.';
      }

      return res.status(400).json({
        success: false,
        error: errorMessage });
    }

    if (!authData.user) {
      return res.status(400).json({
        success: false,
        error: 'Failed to create user account. Please try again.' });
    }

    // Check if email confirmation is required
    if (!authData.session) {
      return res.status(200).json({
        success: true,
        message: 'Please check your email for a confirmation link before logging in.' });
    }

    return res.status(200).json({
      success: true,
      user: {},
        id: authData.user.id,
        email: authData.user.email || email,
        name: name,
        role: 'user',
        token: authData.session?.access_token || '' }});
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again later.' });
  }
}
