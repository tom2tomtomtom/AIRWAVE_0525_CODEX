import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '@/utils/errorUtils';
import { supabase } from '@/lib/supabase';
import { loggers } from '@/lib/logger';
import { withEnhancedSecurity, SecurityConfigs } from '@/middleware/withEnhancedSecurity';
import { securityValidation, apiValidationSchemas } from '@/utils/validation-utils';

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
  validationErrors?: any[];
}

async function handler(req: NextApiRequest, res: NextApiResponse<SignupResponse>): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Enhanced validation using Zod schema
    const validationResult = apiValidationSchemas.signup.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        validationErrors: validationResult.error.errors,
      });
    }

    const { email, password, name } = validationResult.data;

    // Security validation on inputs
    const nameCheck = securityValidation.validateAndSanitize(name, {
      allowHTML: false,
      maxLength: 100,
      checkMalicious: true,
      throwOnMalicious: false,
    });

    if (!nameCheck.isValid) {
      loggers.general.warn('Malicious content detected in signup name', {
        name: name.substring(0, 50),
        warnings: nameCheck.warnings.join(', '),
        ip: Array.isArray(req.headers['x-forwarded-for'])
          ? req.headers['x-forwarded-for'][0]
          : req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      });

      return res.status(400).json({
        success: false,
        error: 'Name contains invalid characters',
      });
    }

    // Use sanitized name
    const sanitizedName = nameCheck.sanitized;

    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      loggers.general.info('Starting signup process for email', { email });
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
      loggers.general.info('Creating user with Supabase auth');
    }
    const { data: authData, error: authError } = await supabase!.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: sanitizedName,
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
    if (process.env.NODE_ENV === 'development') {
      loggers.general.info('User created, checking confirmation requirement');
    }
    if (!authData.session) {
      if (process.env.NODE_ENV === 'development') {
        loggers.general.info('Email confirmation required');
      }
      return res.status(200).json({
        success: true,
        message: 'Please check your email for a confirmation link before logging in.',
      });
    }

    // If no email confirmation required, create user profile
    if (process.env.NODE_ENV === 'development') {
      loggers.general.info('No email confirmation required, creating profile');
    }
    // First check if profiles table exists by attempting to query it
    const { data: existingProfile, error: profileCheckError } = await supabase!
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
      const { error: profileError } = await supabase!.from('profiles').insert({
        id: authData.user.id,
        first_name: sanitizedName.split(' ')[0] || sanitizedName,
        last_name: sanitizedName.split(' ').slice(1).join(' ') || '',
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
        name: sanitizedName,
        role: 'user',
        token: authData.session?.access_token || '',
      },
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('Signup error:', message);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
    });
  }
}

// Apply enhanced security with strict auth rate limiting
export default withEnhancedSecurity(
  {
    ...SecurityConfigs.auth,
    rateLimit: { windowMs: 15 * 60 * 1000, max: 10 }, // 10 signup attempts per 15 minutes (strict)
    analysis: {
      ...SecurityConfigs.auth.analysis,
      checkUserAgent: true,
      checkOrigin: true,
      checkReferer: true,
      detectBots: true,
      logSuspiciousActivity: true,
    },
    validation: {
      body: [
        { field: 'email', type: 'email', required: true },
        { field: 'password', type: 'string', required: true, minLength: 8, maxLength: 128 },
        { field: 'name', type: 'string', required: true, minLength: 2, maxLength: 100 },
      ],
    },
  },
  handler
);
