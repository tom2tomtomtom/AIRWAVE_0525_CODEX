import { z } from 'zod';
import { loggers } from '@/lib/logger';

// Environment schema with detailed validation
const environmentSchema = z.object({
  // Core Application
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  NEXT_PUBLIC_APP_URL: z.string().url('Invalid app URL format'),
  NEXT_PUBLIC_APP_NAME: z.string().default('AIrWAVE'),
  NEXT_PUBLIC_APP_VERSION: z.string().default('1.0.0'),
  NEXT_PUBLIC_DEMO_MODE: z.boolean().default(false),
  
  // Domain & CORS
  NEXT_PUBLIC_DOMAIN: z.string().min(1, 'Domain is required'),
  ALLOWED_ORIGINS: z.string().transform(str => str.split(',').map(s => s.trim())),
  ALLOWED_HOSTS: z.string().transform(str => str.split(',').map(s => s.trim())),
  
  // Database (Required)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),
  SUPABASE_PROJECT_ID: z.string().optional(),
  
  // Database Pool (Optional)
  DB_POOL_MIN: z.number().int().positive().default(2),
  DB_POOL_MAX: z.number().int().positive().default(20),
  DB_POOL_IDLE_TIMEOUT: z.number().int().positive().default(30000),
  DB_QUERY_TIMEOUT: z.number().int().positive().default(60000),
  
  // Security & Authentication (Required)
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRY: z.string().default('7d'),
  REFRESH_TOKEN_EXPIRY: z.string().default('30d'),
  NEXTAUTH_SECRET: z.string().min(32, 'NextAuth secret must be at least 32 characters'),
  NEXTAUTH_URL: z.string().url().optional(),
  ENCRYPTION_KEY: z.string().length(32, 'Encryption key must be exactly 32 characters'),
  COOKIE_SECRET: z.string().min(32, 'Cookie secret must be at least 32 characters'),
  
  // Session Configuration
  SESSION_COOKIE_NAME: z.string().default('airwave_session'),
  SESSION_MAX_AGE: z.number().int().positive().default(604800000),
  COOKIE_SECURE: z.boolean().default(true),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('strict'),
  COOKIE_HTTP_ONLY: z.boolean().default(true),
  
  // CSRF Protection
  CSRF_SECRET: z.string().min(32, 'CSRF secret must be at least 32 characters'),
  CSRF_COOKIE_NAME: z.string().default('_csrf'),
  
  // External APIs
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  CREATOMATE_API_KEY: z.string().optional(),
  RUNWAY_API_KEY: z.string().optional(),
  UNSPLASH_ACCESS_KEY: z.string().optional(),
  PEXELS_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  
  // Social Media APIs
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  TWITTER_API_KEY: z.string().optional(),
  TWITTER_API_SECRET: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  
  // Storage & Files
  STORAGE_PROVIDER: z.enum(['supabase', 'aws', 'gcp', 'local']).default('supabase'),
  STORAGE_BUCKET: z.string().min(1, 'Storage bucket is required'),
  NEXT_PUBLIC_STORAGE_URL: z.string().url().optional(),
  MAX_FILE_SIZE: z.number().int().positive().default(52428800),
  MAX_FILES_PER_UPLOAD: z.number().int().positive().default(10),
  ALLOWED_FILE_TYPES: z.string().transform(str => str.split(',').map(s => s.trim())),
  UPLOAD_PATH: z.string().default('/uploads'),
  
  // AWS S3 (Optional)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().optional(),
  
  // CDN
  CDN_URL: z.string().url().optional(),
  ENABLE_CDN: z.boolean().default(false),
  
  // Redis & Caching
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.number().int().min(0).default(0),
  REDIS_KEY_PREFIX: z.string().default('airwave:'),
  CACHE_TTL: z.number().int().positive().default(3600),
  CACHE_MAX_SIZE: z.number().int().positive().default(100),
  ENABLE_QUERY_CACHE: z.boolean().default(true),
  ENABLE_API_CACHE: z.boolean().default(true),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.number().int().positive().default(100),
  RATE_LIMIT_WINDOW: z.number().int().positive().default(900000),
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: z.boolean().default(false),
  RATE_LIMIT_SKIP_FAILED_REQUESTS: z.boolean().default(false),
  API_RATE_LIMIT_MAX: z.number().int().positive().default(1000),
  API_RATE_LIMIT_WINDOW: z.number().int().positive().default(3600000),
  AI_RATE_LIMIT_MAX: z.number().int().positive().default(50),
  AI_RATE_LIMIT_WINDOW: z.number().int().positive().default(3600000),
  
  // Security Headers
  CSP_REPORT_URI: z.string().url().optional(),
  HSTS_MAX_AGE: z.number().int().positive().default(31536000),
  ENABLE_SECURITY_HEADERS: z.boolean().default(true),
  
  // Monitoring & Observability
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENABLE_DEBUG_LOGS: z.boolean().default(false),
  LOG_FORMAT: z.enum(['json', 'text']).default('json'),
  LOG_FILE_PATH: z.string().optional(),
  
  // Analytics
  ENABLE_ANALYTICS: z.boolean().default(true),
  GOOGLE_ANALYTICS_ID: z.string().optional(),
  MIXPANEL_TOKEN: z.string().optional(),
  HOTJAR_ID: z.string().optional(),
  NEW_RELIC_LICENSE_KEY: z.string().optional(),
  DATADOG_API_KEY: z.string().optional(),
  ENABLE_PERFORMANCE_MONITORING: z.boolean().default(true),
  
  // Feature Flags
  ENABLE_SOCIAL_PUBLISHING: z.boolean().default(true),
  ENABLE_VIDEO_GENERATION: z.boolean().default(true),
  ENABLE_AI_FEATURES: z.boolean().default(true),
  ENABLE_COLLABORATION: z.boolean().default(true),
  ENABLE_ADVANCED_ANALYTICS: z.boolean().default(true),
  ENABLE_BETA_FEATURES: z.boolean().default(false),
  ENABLE_AI_TRAINING: z.boolean().default(false),
  ENABLE_WEBHOOKS: z.boolean().default(true),
  ENABLE_API_V2: z.boolean().default(false),
  
  // Admin & Maintenance
  MAINTENANCE_MODE: z.boolean().default(false),
  ADMIN_EMAILS: z.string().transform(str => str.split(',').map(s => s.trim())),
  ENABLE_ADMIN_PANEL: z.boolean().default(true),
  
  // Payment & Integrations
  STRIPE_PUBLIC_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  ZAPIER_WEBHOOK_URL: z.string().url().optional(),
  ZAPIER_API_KEY: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  
  // Environment Specific
  DEV_BYPASS_AUTH: z.boolean().default(false),
  DEV_MOCK_APIS: z.boolean().default(false),
  DEV_ENABLE_HOT_RELOAD: z.boolean().default(true),
  TEST_EMAIL: z.string().email().optional(),
  TEST_PASSWORD: z.string().optional(),
  TEST_DATABASE_URL: z.string().url().optional(),
  ENABLE_TEST_ROUTES: z.boolean().default(false),
  PRODUCTION_READY: z.boolean().default(false),
  ENABLE_COMPRESSION: z.boolean().default(true),
  ENABLE_HTTP2: z.boolean().default(true),
  
  // Infrastructure
  PORT: z.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  WORKER_PROCESSES: z.union([z.literal('auto'), z.number().int().positive()]).default('auto'),
  HEALTH_CHECK_INTERVAL: z.number().int().positive().default(30000),
  HEALTH_CHECK_TIMEOUT: z.number().int().positive().default(5000),
  ENABLE_HEALTH_CHECKS: z.boolean().default(true),
  BACKUP_SCHEDULE: z.string().default('0 2 * * *'),
  BACKUP_RETENTION_DAYS: z.number().int().positive().default(30),
  ENABLE_AUTO_BACKUP: z.boolean().default(true),
});

// Transform string values from process.env to appropriate types
const transformEnvValues = (env: Record<string, string | undefined>) => {
  const transformed: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    
    // Boolean transformation
    if (value === 'true') transformed[key] = true;
    else if (value === 'false') transformed[key] = false;
    // Number transformation for known numeric fields
    else if (['PORT', 'DB_POOL_MIN', 'DB_POOL_MAX', 'DB_POOL_IDLE_TIMEOUT', 'DB_QUERY_TIMEOUT',
              'SESSION_MAX_AGE', 'MAX_FILE_SIZE', 'MAX_FILES_PER_UPLOAD', 'REDIS_DB',
              'CACHE_TTL', 'CACHE_MAX_SIZE', 'RATE_LIMIT_MAX', 'RATE_LIMIT_WINDOW',
              'API_RATE_LIMIT_MAX', 'API_RATE_LIMIT_WINDOW', 'AI_RATE_LIMIT_MAX', 'AI_RATE_LIMIT_WINDOW',
              'HSTS_MAX_AGE', 'HEALTH_CHECK_INTERVAL', 'HEALTH_CHECK_TIMEOUT', 'BACKUP_RETENTION_DAYS'].includes(key)) {
      const num = parseInt(value, 10);
      transformed[key] = isNaN(num) ? value : num;
    }
    else {
      transformed[key] = value;
    }
  }
  
  return transformed;
};

// Environment validation function
export const validateEnvironment = () => {
  try {
    const transformedEnv = transformEnvValues(process.env);
    const config = environmentSchema.parse(transformedEnv);
    
    // Additional validation based on environment
    if (config.NODE_ENV === 'production') {
      const productionRequiredFields = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'JWT_SECRET',
        'NEXTAUTH_SECRET',
        'ENCRYPTION_KEY',
        'COOKIE_SECRET',
        'CSRF_SECRET'
      ];
      
      const missingFields = productionRequiredFields.filter(field => !config[field as keyof typeof config]);
      
      if (missingFields.length > 0) {
        throw new Error(`Production environment missing required fields: ${missingFields.join(', ')}`);
      }
      
      if (!config.PRODUCTION_READY) {
        loggers.general.warn('PRODUCTION_READY flag is not set to true. Please verify all configuration before deploying.');
      }
    }
    
    // Validate AI features configuration
    if (config.ENABLE_AI_FEATURES && !config.OPENAI_API_KEY && !config.ANTHROPIC_API_KEY) {
      loggers.general.warn('AI features enabled but no AI API keys configured. Some features may not work.');
    }
    
    // Validate email configuration
    if (!config.RESEND_API_KEY && !config.SENDGRID_API_KEY) {
      loggers.general.warn('No email service configured. Email notifications will not work.');
    }
    
    // Validate Redis configuration for production
    if (config.NODE_ENV === 'production' && config.REDIS_URL === 'redis://localhost:6379') {
      loggers.general.warn('Using default Redis configuration in production. Consider using a managed Redis service.');
    }
    
    loggers.general.info('Environment validation successful', {
      environment: config.NODE_ENV,
      version: config.NEXT_PUBLIC_APP_VERSION,
      features: {
        ai: config.ENABLE_AI_FEATURES,
        social: config.ENABLE_SOCIAL_PUBLISHING,
        video: config.ENABLE_VIDEO_GENERATION,
        analytics: config.ENABLE_ANALYTICS
      }
    });
    
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      );
      
      loggers.general.error('Environment validation failed', {
        errors: errorMessages,
        received: error.errors.map(err => ({
          field: err.path.join('.'),
          value: err.received,
          expected: err.expected
        }))
      });
      
      throw new Error(`Environment validation failed:\n${errorMessages.join('\n')}`);
    }
    
    loggers.general.error('Environment validation error', error);
    throw error;
  }
};

// Export validated configuration
let _config: z.infer<typeof environmentSchema> | null = null;

export const getConfig = () => {
  if (!_config) {
    _config = validateEnvironment();
  }
  return _config;
};

// Environment-specific configuration getters
export const isDevelopment = () => getConfig().NODE_ENV === 'development';
export const isProduction = () => getConfig().NODE_ENV === 'production';
export const isTest = () => getConfig().NODE_ENV === 'test';

// Feature flag helpers
export const isFeatureEnabled = (feature: keyof Pick<z.infer<typeof environmentSchema>, 
  'ENABLE_AI_FEATURES' | 'ENABLE_SOCIAL_PUBLISHING' | 'ENABLE_VIDEO_GENERATION' | 
  'ENABLE_COLLABORATION' | 'ENABLE_ADVANCED_ANALYTICS' | 'ENABLE_BETA_FEATURES' | 
  'ENABLE_AI_TRAINING' | 'ENABLE_WEBHOOKS' | 'ENABLE_API_V2' | 'ENABLE_ADMIN_PANEL'>) => {
  return getConfig()[feature];
};

// Security configuration helpers
export const getSecurityConfig = () => {
  const config = getConfig();
  return {
    jwtSecret: config.JWT_SECRET,
    jwtExpiry: config.JWT_EXPIRY,
    refreshTokenExpiry: config.REFRESH_TOKEN_EXPIRY,
    encryptionKey: config.ENCRYPTION_KEY,
    cookieSecret: config.COOKIE_SECRET,
    csrfSecret: config.CSRF_SECRET,
    cookieOptions: {
      secure: config.COOKIE_SECURE,
      sameSite: config.COOKIE_SAME_SITE,
      httpOnly: config.COOKIE_HTTP_ONLY,
      maxAge: config.SESSION_MAX_AGE
    }
  };
};

// Database configuration helper
export const getDatabaseConfig = () => {
  const config = getConfig();
  return {
    supabaseUrl: config.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceKey: config.SUPABASE_SERVICE_ROLE_KEY,
    poolConfig: {
      min: config.DB_POOL_MIN,
      max: config.DB_POOL_MAX,
      idleTimeout: config.DB_POOL_IDLE_TIMEOUT,
      queryTimeout: config.DB_QUERY_TIMEOUT
    }
  };
};

// Redis configuration helper
export const getRedisConfig = () => {
  const config = getConfig();
  return {
    url: config.REDIS_URL,
    password: config.REDIS_PASSWORD,
    db: config.REDIS_DB,
    keyPrefix: config.REDIS_KEY_PREFIX
  };
};

// Rate limiting configuration helper
export const getRateLimitConfig = () => {
  const config = getConfig();
  return {
    general: {
      max: config.RATE_LIMIT_MAX,
      window: config.RATE_LIMIT_WINDOW,
      skipSuccessfulRequests: config.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS,
      skipFailedRequests: config.RATE_LIMIT_SKIP_FAILED_REQUESTS
    },
    api: {
      max: config.API_RATE_LIMIT_MAX,
      window: config.API_RATE_LIMIT_WINDOW
    },
    ai: {
      max: config.AI_RATE_LIMIT_MAX,
      window: config.AI_RATE_LIMIT_WINDOW
    }
  };
};

export type AppConfig = z.infer<typeof environmentSchema>;