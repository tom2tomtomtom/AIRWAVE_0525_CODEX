// types/environment.d.ts
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Node environment
      NODE_ENV: 'development' | 'production' | 'test'
      
      // Supabase
      NEXT_PUBLIC_SUPABASE_URL: string
      NEXT_PUBLIC_SUPABASE_ANON_KEY: string
      SUPABASE_SERVICE_KEY: string
      SUPABASE_SERVICE_ROLE_KEY: string
      SUPABASE_URL: string
      SUPABASE_ANON_KEY: string
      
      // External APIs
      OPENAI_API_KEY: string
      CREATOMATE_API_KEY: string
      ELEVENLABS_API_KEY: string
      RUNWAY_API_KEY: string
      
      // Authentication
      JWT_SECRET: string
      NEXTAUTH_SECRET: string
      NEXTAUTH_URL: string
      
      // API Configuration
      NEXT_PUBLIC_API_URL: string
      
      // Redis (optional for development)
      REDIS_URL?: string
      
      // AWS S3 (optional for development)
      AWS_ACCESS_KEY_ID?: string
      AWS_SECRET_ACCESS_KEY?: string
      AWS_REGION?: string
      AWS_S3_BUCKET?: string
      
      // Analytics (optional)
      NEXT_PUBLIC_GA_MEASUREMENT_ID?: string
      NEXT_PUBLIC_MIXPANEL_TOKEN?: string
      
      // Email
      RESEND_API_KEY?: string
      EMAIL_FROM?: string
      
      // Sentry (optional)
      SENTRY_DSN?: string
      NEXT_PUBLIC_SENTRY_DSN?: string
      
      // Feature flags
      ENABLE_ANALYTICS?: string
      ENABLE_RATE_LIMITING?: string
      ENABLE_WORKER_QUEUE?: string
    }
  }
}

// Helper to validate required env vars
export function validateEnv(): void {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'CREATOMATE_API_KEY',
    'JWT_SECRET',
    'NEXTAUTH_SECRET'
  ] as const;

  const missing: string[] = [];
  
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.join('\n')}\n\n` +
      'Please check your .env.local file.'
    );
  }
}

export {};