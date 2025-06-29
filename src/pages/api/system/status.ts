import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { isDemo } from '@/lib/env';

// This endpoint helps verify the deployment configuration
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check environment variables (without exposing sensitive values)
  const envStatus = {
    // Core configuration
    NODE_ENV: process.env.NODE_ENV || 'not set',

    // Supabase configuration
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? '✅ Set'
      : '❌ Missing',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing',

    // Authentication
    JWT_SECRET: process.env.JWT_SECRET ? '✅ Set' : '❌ Missing',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Missing',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'not set',

    // API Keys
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing',
    CREATOMATE_API_KEY: process.env.CREATOMATE_API_KEY ? '✅ Set' : '❌ Missing',
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ? '✅ Set' : '❌ Missing',
    RUNWAY_API_KEY: process.env.RUNWAY_API_KEY ? '✅ Set' : '❌ Missing',
  };

  // Test Supabase connection if configured
  let supabaseStatus = 'Not configured';
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        },
      });
      supabaseStatus = response.ok ? '✅ Connected' : `❌ Error: ${response.status}`;
    } catch (error: any) {
      const message = getErrorMessage(error);
      console.error('Supabase connection error:', error, 'Message:', message);
      supabaseStatus = '❌ Connection failed';
    }
  }

  // Determine overall status
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
  ];

  const missingRequired = requiredEnvVars.filter((key: any) => !process.env[key]);
  const isConfigured = missingRequired.length === 0;

  res.status(200).json({
    status: isConfigured ? 'ready' : 'incomplete',
    timestamp: new Date().toISOString(),
    environment: envStatus,
    supabase: {
      status: supabaseStatus,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? process.env.NEXT_PUBLIC_SUPABASE_URL.replace(
            /https:\/\/(.+?)\.supabase\.co.*/,
            'https://***.supabase.co'
          )
        : 'not set',
    },
    configuration: {
      isDemoMode: isDemo,
      isConfigured,
      missingRequired: missingRequired.length > 0 ? missingRequired : null,
    },
    deployment: {
      platform: process.env.VERCEL ? 'Vercel' : process.env.NETLIFY ? 'Netlify' : 'Unknown',
      region: process.env.VERCEL_REGION || process.env.AWS_REGION || 'Unknown',
    },
    recommendations: isConfigured
      ? null
      : {
          message: 'Some required environment variables are missing',
          steps: [
            'Set all required environment variables in your deployment platform',
            'Ensure JWT_SECRET is at least 32 characters long',
            'Verify Supabase project is active and credentials are correct',
            'Restart/redeploy after setting environment variables',
          ],
        },
  });
}
