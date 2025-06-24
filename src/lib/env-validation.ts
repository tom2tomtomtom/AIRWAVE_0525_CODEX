// Secure environment variable validation
import { loggers } from './logger';
import { AppError, ErrorCode } from '@/types/errors';

// Environment variable definitions with validation rules
interface EnvVarDefinition {
  key: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'url' | 'jwt';
  defaultValue?: string | number | boolean;
  validation?: (value: string) => boolean;
  description: string;
}

// Define all environment variables used in the application
const ENV_DEFINITIONS: EnvVarDefinition[] = [
  // Core application
  {
    key: 'NODE_ENV',
    required: true,
    type: 'string',
    defaultValue: 'development',
    validation: value => ['development', 'production', 'test'].includes(value),
    description: 'Application environment' },
  {
    key: 'NEXT_PUBLIC_APP_URL',
    required: true,
    type: 'url',
    description: 'Public application URL' },

  // Database (Supabase)
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    type: 'url',
    description: 'Supabase project URL' },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    type: 'jwt',
    description: 'Supabase anonymous key (public)' },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    required: false, // Only required for server-side operations
    type: 'jwt',
    description: 'Supabase service role key (server-side only)' },

  // OpenAI
  {
    key: 'OPENAI_API_KEY',
    required: true,
    type: 'string',
    validation: value => value.startsWith('sk-'),
    description: 'OpenAI API key' },

  // Email service
  {
    key: 'SMTP_HOST',
    required: false,
    type: 'string',
    description: 'SMTP server host' },
  {
    key: 'SMTP_PORT',
    required: false,
    type: 'number',
    defaultValue: 587,
    description: 'SMTP server port' },
  {
    key: 'SMTP_USER',
    required: false,
    type: 'string',
    description: 'SMTP username' },
  {
    key: 'SMTP_PASSWORD',
    required: false,
    type: 'string',
    description: 'SMTP password' },

  // Security
  {
    key: 'JWT_SECRET',
    required: true,
    type: 'string',
    validation: value => value.length >= 32,
    description: 'JWT signing secret (minimum 32 characters)' },
  {
    key: 'ENCRYPTION_KEY',
    required: true,
    type: 'string',
    validation: value => value.length === 64, // 32 bytes in hex
    description: 'Encryption key for sensitive data (64 character hex string)' },

  // External services
  {
    key: 'AWS_ACCESS_KEY_ID',
    required: false,
    type: 'string',
    description: 'AWS access key for S3 storage' },
  {
    key: 'AWS_SECRET_ACCESS_KEY',
    required: false,
    type: 'string',
    description: 'AWS secret key for S3 storage' },
  {
    key: 'AWS_REGION',
    required: false,
    type: 'string',
    defaultValue: 'us-east-1',
    description: 'AWS region' },
  {
    key: 'S3_BUCKET_NAME',
    required: false,
    type: 'string',
    description: 'S3 bucket name for file storage' },

  // Logging and monitoring
  {
    key: 'LOG_LEVEL',
    required: false,
    type: 'string',
    defaultValue: 'info',
    validation: value => ['debug', 'info', 'warn', 'error'].includes(value),
    description: 'Application log level' },
  {
    key: 'SENTRY_DSN',
    required: false,
    type: 'url',
    description: 'Sentry DSN for error tracking' },

  // Rate limiting
  {
    key: 'REDIS_URL',
    required: false,
    type: 'url',
    description: 'Redis URL for rate limiting and caching' },

  // Feature flags
  {
    key: 'ENABLE_AI_CONTENT_GENERATION',
    required: false,
    type: 'boolean',
    defaultValue: true,
    description: 'Enable AI content generation features' },
  {
    key: 'ENABLE_FILE_UPLOADS',
    required: false,
    type: 'boolean',
    defaultValue: true,
    description: 'Enable file upload functionality' },
];

// Validation functions for different types
const validators = {
  string: (value: string): boolean => typeof value === 'string' && value.length > 0,
  number: (value: string): boolean => !isNaN(Number(value)),
  boolean: (value: string): boolean => ['true', 'false', '1', '0'].includes(value.toLowerCase()),
  url: (value: string): boolean => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
  jwt: (value: string): boolean => {
    const jwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
    return jwtPattern.test(value) && value.length > 50;
  }
};

// Convert string values to appropriate types
const convertValue = (value: string, type: EnvVarDefinition['type']): string | number | boolean => {
  switch (type) {
    case 'number':
      return Number(value);
    case 'boolean':
      return ['true', '1'].includes(value.toLowerCase());
    default:
      return value;
  }
};

// Validated environment configuration
export class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private config: Map<string, string | number | boolean> = new Map();
  private validated = false;

  private constructor() {
    this.validateEnvironment();
  }

  public static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  private validateEnvironment(): void {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const envDef of ENV_DEFINITIONS) {
      const value = process.env[envDef.key];

      // Check if required variable is missing
      if (envDef.required && !value) {
        errors.push(
          `Required environment variable ${envDef.key} is missing: ${envDef.description}`
        );
        continue;
      }

      // Use default value if not provided
      if (!value && envDef.defaultValue !== undefined) {
        this.config.set(envDef.key, envDef.defaultValue);
        loggers.general.info(`Using default value for ${envDef.key}`, {
          key: envDef.key,
          defaultValue: envDef.defaultValue });
        continue;
      }

      // Skip validation for optional missing variables
      if (!value && !envDef.required) {
        continue;
      }

      // Validate type
      if (value && !validators[envDef.type](value)) {
        errors.push(`Environment variable ${envDef.key} has invalid ${envDef.type} format`);
        continue;
      }

      // Run custom validation if provided
      if (value && envDef.validation && !envDef.validation(value)) {
        errors.push(
          `Environment variable ${envDef.key} failed custom validation: ${envDef.description}`
        );
        continue;
      }

      // Store validated value
      if (value) {
        this.config.set(envDef.key, convertValue(value, envDef.type));
      }
    }

    // Report warnings for recommended but optional variables
    this.checkRecommendedVariables(warnings);

    // Log warnings
    if (warnings.length > 0) {
      warnings.forEach((warning: any) => loggers.general.warn(warning));
    }

    // Throw error if any required validation failed
    if (errors.length > 0) {
      const errorMessage = `Environment validation failed:\n${errors.join('\n')}`;
      loggers.general.error('Environment validation failed', undefined, { errors });
      throw new AppError(errorMessage, ErrorCode.SYSTEM_CONFIGURATION_ERROR, 500, {
        errors,
        warnings});
    }

    this.validated = true;
    loggers.general.info('Environment validation completed successfully', {
      validatedVars: this.config.size,
      warnings: warnings.length });
  }

  private checkRecommendedVariables(warnings: string[]): void {
    const isProduction = this.get('NODE_ENV') === 'production';

    if (isProduction) {
      // Production-specific required variables
      if (!this.has('SENTRY_DSN')) {
        warnings.push('SENTRY_DSN not configured - error tracking disabled in production');
      }
      if (!this.has('REDIS_URL')) {
        warnings.push(
          'REDIS_URL not configured - using in-memory rate limiting (not recommended for production)'
        );
      }
      if (!this.has('AWS_ACCESS_KEY_ID') || !this.has('AWS_SECRET_ACCESS_KEY')) {
        warnings.push('AWS credentials not configured - file uploads may be limited');
      }
    }

    // Email service check
    const hasSmtpHost = this.has('SMTP_HOST');
    const hasSmtpUser = this.has('SMTP_USER');
    if (hasSmtpHost !== hasSmtpUser) {
      warnings.push(
        'Partial SMTP configuration detected - email functionality may not work correctly'
      );
    }
  }

  public get<T = string>(key: string): T {
    if (!this.validated) {
      throw new AppError('Environment not validated', ErrorCode.SYSTEM_CONFIGURATION_ERROR);
    }

    const value = this.config.get(key);
    if (value === undefined) {
      // Check if it's an optional variable that wasn't set
      const definition = ENV_DEFINITIONS.find((def: any) => def.key === key);
      if (definition && !definition.required) {
        return undefined as T;
      }

      throw new AppError(
        `Environment variable ${key} not found`,
        ErrorCode.SYSTEM_CONFIGURATION_ERROR
      );
    }

    return value as T;
  }

  public has(key: string): boolean {
    return this.config.has(key);
  }

  public getAll(): Record<string, string | number | boolean> {
    return Object.fromEntries(this.config);
  }

  public isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  public isDevelopment(): boolean {
    return this.get('NODE_ENV') === 'development';
  }

  public isTest(): boolean {
    return this.get('NODE_ENV') === 'test';
  }
}

// Export singleton instance
export const env = EnvironmentConfig.getInstance();

// Helper functions for common environment checks
export const requireEnvVar = (key: string, description?: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new AppError(
      `Required environment variable ${key} is missing${description ? `: ${description}` : ''}`,
      ErrorCode.SYSTEM_CONFIGURATION_ERROR
    );
  }
  return value;
};

export const getEnvVar = (key: string, defaultValue?: string): string | undefined => {
  return process.env[key] || defaultValue;
};

export const getEnvBool = (key: string, defaultValue = false): boolean => {
  const value = process.env[key];
  if (!value) return defaultValue;
  return ['true', '1', 'yes'].includes(value.toLowerCase());
};

export const getEnvNumber = (key: string, defaultValue?: number): number | undefined => {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = Number(value);
  if (isNaN(parsed)) {
    throw new AppError(
      `Environment variable ${key} must be a valid number`,
      ErrorCode.SYSTEM_CONFIGURATION_ERROR
    );
  }
  return parsed;
};

// Environment variable documentation generator
export const generateEnvDocumentation = (): string => {
  let doc = '# Environment Variables\n\n';
  doc += 'This document describes all environment variables used by the application.\n\n';

  const categories = {
    'Core Application': ['NODE_ENV', 'NEXT_PUBLIC_APP_URL'],
    Database: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
    'AI Services': ['OPENAI_API_KEY'],
    Email: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'],
    Security: ['JWT_SECRET', 'ENCRYPTION_KEY'],
    Storage: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'S3_BUCKET_NAME'],
    Monitoring: ['LOG_LEVEL', 'SENTRY_DSN'],
    Infrastructure: ['REDIS_URL'],
    'Feature Flags': ['ENABLE_AI_CONTENT_GENERATION', 'ENABLE_FILE_UPLOADS']};

  for (const [category, keys] of Object.entries(categories)) {
    doc += `## ${category}\n\n`;

    for (const key of keys) {
      const def = ENV_DEFINITIONS.find((d: any) => d.key === key);
      if (def) {
        doc += `### ${def.key}\n`;
        doc += `- **Required**: ${def.required ? 'Yes' : 'No'}\n`;
        doc += `- **Type**: ${def.type}\n`;
        doc += `- **Description**: ${def.description}\n`;
        if (def.defaultValue !== undefined) {
          doc += `- **Default**: ${def.defaultValue}\n`;
        }
        doc += '\n';
      }
    }
  }

  return doc;
};

// Export for testing and development
export const __testing__ = {
  ENV_DEFINITIONS,
  validators,
  convertValue};
