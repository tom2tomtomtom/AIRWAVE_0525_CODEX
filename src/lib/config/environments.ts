import { AppConfig } from './index';

// Environment-specific configuration overrides
export const environmentConfigs = {
  development: {
    // Development-specific settings
    COOKIE_SECURE: false, // Allow HTTP in development
    ENABLE_DEBUG_LOGS: true,
    LOG_LEVEL: 'debug' as const,
    RATE_LIMIT_MAX: 1000, // Higher limits for development
    DEV_BYPASS_AUTH: false, // Can be overridden per developer
    DEV_MOCK_APIS: false,
    ENABLE_SECURITY_HEADERS: false, // Relaxed for development
    SENTRY_ENVIRONMENT: 'development',
  },
  
  test: {
    // Test environment settings
    NODE_ENV: 'test' as const,
    LOG_LEVEL: 'error' as const, // Minimal logging in tests
    ENABLE_DEBUG_LOGS: false,
    RATE_LIMIT_MAX: 10000, // Very high limits for tests
    ENABLE_ANALYTICS: false,
    ENABLE_PERFORMANCE_MONITORING: false,
    COOKIE_SECURE: false,
    ENABLE_SECURITY_HEADERS: false,
    ENABLE_TEST_ROUTES: true,
    SENTRY_ENVIRONMENT: 'test',
    // Use in-memory cache for tests
    CACHE_TTL: 60, // Short TTL for tests
  },
  
  staging: {
    // Staging environment (production-like but with relaxed monitoring)
    NODE_ENV: 'production' as const,
    LOG_LEVEL: 'debug' as const, // More verbose logging for debugging
    ENABLE_DEBUG_LOGS: true,
    COOKIE_SECURE: true,
    ENABLE_SECURITY_HEADERS: true,
    PRODUCTION_READY: false, // Not quite production
    SENTRY_ENVIRONMENT: 'staging',
    // Relaxed rate limits for testing
    RATE_LIMIT_MAX: 500,
    API_RATE_LIMIT_MAX: 5000,
  },
  
  production: {
    // Production environment settings
    NODE_ENV: 'production' as const,
    LOG_LEVEL: 'info' as const,
    ENABLE_DEBUG_LOGS: false,
    COOKIE_SECURE: true,
    ENABLE_SECURITY_HEADERS: true,
    PRODUCTION_READY: true,
    SENTRY_ENVIRONMENT: 'production',
    // Strict rate limits
    RATE_LIMIT_MAX: 100,
    API_RATE_LIMIT_MAX: 1000,
    AI_RATE_LIMIT_MAX: 50,
    // Enable all monitoring
    ENABLE_ANALYTICS: true,
    ENABLE_PERFORMANCE_MONITORING: true,
    // Security settings
    HSTS_MAX_AGE: 31536000, // 1 year
    COOKIE_SAME_SITE: 'strict' as const,
  }
};

export type Environment = keyof typeof environmentConfigs;

// Get environment-specific configuration
export const getEnvironmentConfig = (env: Environment): Partial<AppConfig> => {
  return environmentConfigs[env] || {};
};

// Environment validation rules
export const environmentValidationRules = {
  development: {
    // Development can be more lenient
    requiredSecrets: ['JWT_SECRET', 'NEXTAUTH_SECRET'],
    optionalSecrets: ['OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
    warnings: [
      'Development environment detected - some security features are disabled'
    ]
  },
  
  test: {
    // Test environment minimal requirements
    requiredSecrets: ['JWT_SECRET'],
    optionalSecrets: ['TEST_DATABASE_URL'],
    warnings: [
      'Test environment - analytics and monitoring disabled'
    ]
  },
  
  staging: {
    // Staging should be close to production
    requiredSecrets: [
      'JWT_SECRET',
      'NEXTAUTH_SECRET',
      'ENCRYPTION_KEY',
      'COOKIE_SECRET',
      'CSRF_SECRET',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ],
    optionalSecrets: ['SENTRY_DSN', 'OPENAI_API_KEY'],
    warnings: [
      'Staging environment - ensure all production secrets are tested'
    ]
  },
  
  production: {
    // Production requires all security measures
    requiredSecrets: [
      'JWT_SECRET',
      'NEXTAUTH_SECRET', 
      'ENCRYPTION_KEY',
      'COOKIE_SECRET',
      'CSRF_SECRET',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'REDIS_URL'
    ],
    recommendedSecrets: [
      'SENTRY_DSN',
      'OPENAI_API_KEY',
      'RESEND_API_KEY',
      'REDIS_PASSWORD'
    ],
    errors: [
      // Will throw errors if these conditions aren't met
    ]
  }
};

// Validate environment-specific requirements
export const validateEnvironmentRequirements = (env: Environment, config: Partial<AppConfig>) => {
  const rules = environmentValidationRules[env];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check required secrets
  rules.requiredSecrets.forEach(secret => {
    if (!config[secret as keyof AppConfig]) {
      errors.push(`Missing required secret for ${env}: ${secret}`);
    }
  });
  
  // Check recommended secrets for production
  if (env === 'production' && rules.recommendedSecrets) {
    rules.recommendedSecrets.forEach(secret => {
      if (!config[secret as keyof AppConfig]) {
        warnings.push(`Missing recommended secret for production: ${secret}`);
      }
    });
  }
  
  // Add environment-specific warnings
  warnings.push(...(rules.warnings || []));
  
  // Production-specific validations
  if (env === 'production') {
    if (!config.PRODUCTION_READY) {
      errors.push('PRODUCTION_READY must be set to true for production deployment');
    }
    
    if (config.ENABLE_DEBUG_LOGS) {
      warnings.push('Debug logging is enabled in production - consider disabling for security');
    }
    
    if (!config.ENABLE_SECURITY_HEADERS) {
      errors.push('Security headers must be enabled in production');
    }
    
    if (!config.COOKIE_SECURE) {
      errors.push('Secure cookies must be enabled in production');
    }
    
    if (config.COOKIE_SAME_SITE !== 'strict') {
      warnings.push('Consider using strict SameSite cookie policy in production');
    }
  }
  
  return { errors, warnings };
};

// Environment detection helper
export const detectEnvironment = (): Environment => {
  const nodeEnv = process.env.NODE_ENV;
  const isVercel = process.env.VERCEL;
  const isNetlify = process.env.NETLIFY;
  const deploymentEnv = process.env.DEPLOYMENT_ENV;
  
  // Explicit environment override
  if (deploymentEnv && deploymentEnv in environmentConfigs) {
    return deploymentEnv as Environment;
  }
  
  // Platform-specific detection
  if (isVercel && process.env.VERCEL_ENV === 'production') {
    return 'production';
  }
  
  if (isVercel && process.env.VERCEL_ENV === 'preview') {
    return 'staging';
  }
  
  if (isNetlify && process.env.CONTEXT === 'production') {
    return 'production';
  }
  
  if (isNetlify && process.env.CONTEXT === 'deploy-preview') {
    return 'staging';
  }
  
  // Default to NODE_ENV
  switch (nodeEnv) {
    case 'production':
      return 'production';
    case 'test':
      return 'test';
    case 'development':
    default:
      return 'development';
  }
};

// Environment configuration merger
export const mergeEnvironmentConfig = (baseConfig: Partial<AppConfig>, env: Environment): Partial<AppConfig> => {
  const envConfig = getEnvironmentConfig(env);
  return { ...baseConfig, ...envConfig };
};