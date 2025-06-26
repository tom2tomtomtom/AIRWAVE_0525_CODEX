import { getErrorMessage } from '@/utils/errorUtils';
import { z } from 'zod';
import { loggers } from '@/lib/logger';


// Helper to check if we're in build context or client-side
const isBuildContext =
  (typeof globalThis !== 'undefined' && 'EdgeRuntime' in globalThis) ||
  typeof window !== 'undefined' || // Client-side
  process.env.NETLIFY ||
  process.env.VERCEL ||
  process.env.CI === 'true' ||
  process.env.BUILD_ID ||
  process.env.NETLIFY_BUILD_BASE ||
  process.env.NODE_PHASE === 'phase-production-build' ||
  process.env.NEXT_PHASE === 'phase-production-build';

// Define the schema for our environment variables
const envSchema = z.object({
  // Public environment variables (accessible in browser)
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url()
    .optional()
    .refine(
      val => isBuildContext || process.env.NODE_ENV === 'development' || val,
      'Supabase URL is required in production mode'
    ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .optional()
    .refine(
      val => isBuildContext || process.env.NODE_ENV === 'development' || val,
      'Supabase anon key is required in production mode'
    ),
  NEXT_PUBLIC_API_URL: z
    .string()
    .url()
    .optional()
    .default(
      process.env.NODE_ENV === 'production'
        ? 'https://api.airwave.app' // Update this to your production URL
        : 'http://localhost:3000'
    )
    .describe('API base URL'),
  NEXT_PUBLIC_DEMO_MODE: z.enum(['true', 'false']).optional().default('false'),

  // Server-only environment variables
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .optional()
    .refine(
      val => isBuildContext || process.env.NODE_ENV === 'development' || val,
      'Supabase service role key is required in production mode'
    ),
  JWT_SECRET: z
    .string()
    .optional()
    .refine(val => {
      // Allow any value during build context
      if (isBuildContext || process.env.NODE_ENV === 'development') return true;
      if (!val) return false;
      if (val.length < 32) return false;
      // Ensure it's not a default/demo value
      const demoValues = ['demo', 'secret', 'test', 'default', 'changeme'];
      const lowerVal = val.toLowerCase();
      return !demoValues.some(demo => lowerVal.includes(demo));
    }, 'JWT secret must be at least 32 characters and not contain demo/test values in production'),
  JWT_EXPIRY: z
    .string()
    .regex(/^\d+[dhms]$/, 'Invalid JWT expiry format')
    .default('7d'),
  REFRESH_TOKEN_EXPIRY: z
    .string()
    .regex(/^\d+[dhms]$/, 'Invalid refresh token expiry format')
    .default('30d'),

  // AI Services - optional
  OPENAI_API_KEY: z
    .string()
    .optional()
    .refine(val => !val || val.startsWith('sk-'), 'OpenAI API key must start with sk-'),
  ELEVENLABS_API_KEY: z.string().optional(),
  RUNWAY_API_KEY: z.string().optional(),
  CREATOMATE_API_KEY: z.string().optional(),

  // Email configuration (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().email().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),

  // Storage
  STORAGE_BUCKET: z.string().default('airwave-assets'),
  MAX_FILE_SIZE: z.string().transform(Number).default('52428800'), // 50MB default

  // Security
  ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform(val => (val ? val.split(',').map((origin: any) => origin.trim()) : [])),

  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),

  // Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Feature flags
  ENABLE_SOCIAL_PUBLISHING: z.enum(['true', 'false']).optional().default('false'),
  ENABLE_VIDEO_GENERATION: z.enum(['true', 'false']).optional().default('false'),
  ENABLE_AI_FEATURES: z.enum(['true', 'false']).optional().default('false'),
});

// Parse and validate environment variables
const parseEnv = () => {
  // Check if we're in Edge Functions build context or Netlify build
  const isEdgeBuild =
    (typeof globalThis !== 'undefined' && 'EdgeRuntime' in globalThis) ||
    process.env.NETLIFY ||
    process.env.VERCEL ||
    process.env.CI === 'true' ||
    process.env.BUILD_ID ||
    process.env.NETLIFY_BUILD_BASE;
  const isBuildTime =
    process.env.NODE_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-production-build';
  const isClientSide = typeof window !== 'undefined';

  // During build context or client-side, skip strict validation entirely
  if (isEdgeBuild || isBuildTime || isBuildContext || isClientSide) {
    if (!isClientSide) {
      if (process.env.NODE_ENV === 'development') {
        loggers.general.error('Using fallback env config');
      }
    }
    return {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production',
      JWT_EXPIRY: '7d',
      REFRESH_TOKEN_EXPIRY: '30d',
      STORAGE_BUCKET: 'airwave-assets',
      MAX_FILE_SIZE: '52428800',
      ALLOWED_ORIGINS: [],
      ENABLE_SOCIAL_PUBLISHING: 'false',
      ENABLE_VIDEO_GENERATION: 'false',
      ENABLE_AI_FEATURES: 'false',
      // Add client-safe defaults
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' } as any;
  }

  try {
    const parsed = envSchema.parse(process.env);

    // Skip additional validation during Edge build or build time
    if (isEdgeBuild || isBuildTime) {
      return parsed;
    }

    // Additional validation for production runtime
    if (process.env.NODE_ENV === 'production') {
      // Ensure critical security variables are set
      const criticalVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'JWT_SECRET',
      ];

      const missing = criticalVars.filter((key: any) => !parsed[key as keyof typeof parsed]);
      if (missing.length > 0) {
        console.warn(`⚠️ Missing environment variables: ${missing.join(', ')}`);
        console.warn('Authentication may not work properly without these variables.');
      }
    }

    return parsed;
  } catch (error: any) {
    const message = getErrorMessage(error);
    if (error instanceof z.ZodError) {
      const errorMessage = ['❌ Invalid environment variables:'];
      error.errors.forEach(err => {
        errorMessage.push(`   ${err.path.join('.')}: ${err.message}`);
      });

      // Skip error logging during Edge build
      if (!isEdgeBuild && !isBuildTime) {
        console.error(errorMessage.join('\n'));
      }

      // In production runtime, we must fail if environment is not properly configured
      // But allow Edge builds and build time to proceed
      if (process.env.NODE_ENV === 'production' && !isEdgeBuild && !isBuildTime) {
        // Don't throw, just warn and continue with defaults
        console.warn('\n⚠️  Running with default environment configuration');
        console.warn('Some features may not work properly\n');
      }

      // Return a safe default for builds
      if (isEdgeBuild || isBuildTime) {
        return {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || 'production',
          JWT_EXPIRY: '7d',
          REFRESH_TOKEN_EXPIRY: '30d',
          STORAGE_BUCKET: 'airwave-assets',
          MAX_FILE_SIZE: '52428800',
          ALLOWED_ORIGINS: [],
          ENABLE_SOCIAL_PUBLISHING: 'false',
          ENABLE_VIDEO_GENERATION: 'false',
          ENABLE_AI_FEATURES: 'false' } as any;
      }
    }
    throw error;
  }
};

// Export validated environment variables
export const env = parseEnv();

// Type-safe environment variable access
export type Env = z.infer<typeof envSchema>;

// Helper to check if we're in production
export const isProduction = env.NODE_ENV === 'production';

// Helper to check if we're in development
export const isDevelopment = env.NODE_ENV === 'development';

// Helper to check if demo mode is enabled
export const isDemo = env.NEXT_PUBLIC_DEMO_MODE === 'true';

// Helper to check if email is configured
export const isEmailConfigured = Boolean(
  env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS
);

// Helper to check if AI features are available
export const hasOpenAI =
  Boolean(env.OPENAI_API_KEY) && env.ENABLE_AI_FEATURES?.toLowerCase() === 'true';
export const hasElevenLabs =
  Boolean(env.ELEVENLABS_API_KEY) && env.ENABLE_AI_FEATURES?.toLowerCase() === 'true';
export const hasRunway =
  Boolean(env.RUNWAY_API_KEY) && env.ENABLE_AI_FEATURES?.toLowerCase() === 'true';
export const hasCreatomate =
  Boolean(env.CREATOMATE_API_KEY) && env.ENABLE_VIDEO_GENERATION?.toLowerCase() === 'true';

// Helper to get allowed origins for CORS
export const getAllowedOrigins = (): string[] => {
  const defaults = isProduction
    ? ['https://app.airwave.com', 'https://airwave.com'] // Update with your domains
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  return [...defaults, ...(env.ALLOWED_ORIGINS || [])];
};

// Security helpers
export const getSecurityHeaders = () => ({
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  ...(isProduction && {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  }),
});
