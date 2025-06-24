import { getErrorMessage } from '@/utils/errorUtils';
import { z } from 'zod';

// Environment validation schema
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']),
  NEXT_PUBLIC_API_URL: z.string().url('Invalid API URL'),

  // Authentication
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRY: z.string().default('7d'),
  REFRESH_TOKEN_EXPIRY: z.string().default('30d'),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  SUPABASE_SERVICE_KEY: z.string().min(1, 'Supabase service key is required'),

  // AI Services
  OPENAI_API_KEY: z.string().startsWith('sk-', 'OpenAI API key must start with sk-'),
  ELEVENLABS_API_KEY: z.string().min(1, 'ElevenLabs API key is required'),

  // Optional services
  CREATOMATE_API_KEY: z.string().optional(),

  // Storage
  STORAGE_BUCKET: z.string().default('airwave-assets'),
  MAX_FILE_SIZE: z
    .string()
    .transform(val => parseInt(val))
    .pipe(z.number().positive())
    .default('52428800'),

  // Email (optional for development)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z
    .string()
    .transform(val => parseInt(val))
    .pipe(z.number())
    .optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // Security & Performance (production specific)
  ALLOWED_ORIGINS: z.string().optional(),
  RATE_LIMIT_MAX: z
    .string()
    .transform(val => parseInt(val))
    .pipe(z.number().positive())
    .optional(),
  RATE_LIMIT_WINDOW: z
    .string()
    .transform(val => parseInt(val))
    .pipe(z.number().positive())
    .optional(),

  // Database
  DB_POOL_SIZE: z
    .string()
    .transform(val => parseInt(val))
    .pipe(z.number().positive())
    .optional(),
  DB_TIMEOUT: z
    .string()
    .transform(val => parseInt(val))
    .pipe(z.number().positive())
    .optional(),

  // Monitoring
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).optional(),
  ENABLE_REQUEST_LOGGING: z
    .string()
    .transform(val => val === 'true')
    .optional(),
  SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  PERFORMANCE_MONITORING: z
    .string()
    .transform(val => val === 'true')
    .optional(),

  // CDN & Assets
  CDN_URL: z.string().url().optional().or(z.literal('')),
  ASSET_OPTIMIZATION: z
    .string()
    .transform(val => val === 'true')
    .optional(),

  // Feature Flags
  ENABLE_AI_GENERATION: z
    .string()
    .transform(val => val === 'true')
    .default('true'),
  ENABLE_VIDEO_RENDERING: z
    .string()
    .transform(val => val === 'true')
    .default('true'),
  ENABLE_ANALYTICS: z
    .string()
    .transform(val => val === 'true')
    .default('true')});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables
 * @param env - Environment variables object (defaults to process.env)
 * @returns Validated and typed environment variables
 * @throws Error if validation fails
 */
export function validateEnv(env: Record<string, string | undefined> = process.env): Env {
  try {
    return envSchema.parse(env);
  } catch (error: any) {
    const message = getErrorMessage(error);
    if (error instanceof z.ZodError) {
      const errors = error.errors
        .map((err: any) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');
      throw new Error(`Environment validation failed:\n${errors}`);
    }
    throw error;
  }
}

/**
 * Gets a validated environment variable
 * @param key - Environment variable key
 * @param defaultValue - Default value if not found
 * @returns Environment variable value
 */
export function getEnvVar(key: keyof Env, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

/**
 * Checks if all required environment variables are set for production
 * @returns Object with validation status and missing variables
 */
export function checkProductionReadiness(): {
  isReady: boolean;
  missingVars: string[];
  warnings: string[];
} {
  const requiredForProduction = [
    'JWT_SECRET',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_KEY',
    'OPENAI_API_KEY',
    'ELEVENLABS_API_KEY',
  ] as const;

  const recommendedForProduction = [
    'SENTRY_DSN',
    'SMTP_HOST',
    'ALLOWED_ORIGINS',
    'CDN_URL',
  ] as const;

  const missingVars: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const key of requiredForProduction) {
    if (!process.env[key]) {
      missingVars.push(key);
    }
  }

  // Check recommended variables
  for (const key of recommendedForProduction) {
    if (!process.env[key]) {
      warnings.push(`Recommended: ${key} is not set`);
    }
  }

  // Check JWT secret strength
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    warnings.push('JWT_SECRET should be at least 32 characters for production');
  }

  // Check NODE_ENV
  if (process.env.NODE_ENV !== 'production') {
    warnings.push('NODE_ENV should be set to "production"');
  }

  return {
    isReady: missingVars.length === 0,
    missingVars,
    warnings};
}

// Export validated environment variables (only when needed)
let validatedEnv: Env | null = null;

export function getValidatedEnv(): Env {
  if (!validatedEnv) {
    validatedEnv = validateEnv();
  }
  return validatedEnv;
}

// Development helper to check environment setup
export function logEnvironmentStatus(): void {
  try {
    const env = validateEnv();
    if (process.env.NODE_ENV === 'development') {
      console.log('Environment validated successfully');
    }

    if (env.NODE_ENV === 'production') {
      const readiness = checkProductionReadiness();
      if (readiness.isReady) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Production environment ready');
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Production environment not ready');
        }
        readiness.missingVars.forEach((v: any) => {
          if (process.env.NODE_ENV === 'development') {
            console.error(`Missing required variable: ${v}`);
          }
        });
        readiness.warnings.forEach((w: any) => {
          if (process.env.NODE_ENV === 'development') {
            console.warn(w);
          }
        });
      }
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Environment validation failed:', error);
    }
    process.exit(1);
  }
}
