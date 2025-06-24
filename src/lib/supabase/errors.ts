import { loggers } from '@/lib/logger';

// Supabase error types
export enum SupabaseErrorCode {
  // Auth errors
  INVALID_CREDENTIALS = 'invalid_credentials',
  USER_NOT_FOUND = 'user_not_found',
  EMAIL_NOT_CONFIRMED = 'email_not_confirmed',
  INVALID_TOKEN = 'invalid_token',
  SESSION_NOT_FOUND = 'session_not_found',
  
  // Database errors
  UNIQUE_VIOLATION = '23505',
  FOREIGN_KEY_VIOLATION = '23503',
  NOT_NULL_VIOLATION = '23502',
  CHECK_VIOLATION = '23514',
  ROW_NOT_FOUND = 'PGRST116',
  
  // Network errors
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  
  // Rate limiting
  RATE_LIMITED = 'rate_limited',
  
  // Generic
  UNKNOWN = 'unknown_error'
}

export interface SupabaseError extends Error {
  code?: string;
  details?: string;
  hint?: string;
  statusCode?: number;
}

// Error classification functions
export function isAuthError(error: any): boolean {
  if (!error) return false;
  
  const authErrorCodes = [
    SupabaseErrorCode.INVALID_CREDENTIALS,
    SupabaseErrorCode.USER_NOT_FOUND,
    SupabaseErrorCode.EMAIL_NOT_CONFIRMED,
    SupabaseErrorCode.INVALID_TOKEN,
    SupabaseErrorCode.SESSION_NOT_FOUND,
  ];
  
  return authErrorCodes.includes(error.code) || 
         error.message?.toLowerCase().includes('auth') ||
         error.message?.toLowerCase().includes('jwt');
}

export function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  return error.code === SupabaseErrorCode.NETWORK_ERROR ||
         error.code === SupabaseErrorCode.TIMEOUT ||
         error.message?.toLowerCase().includes('network') ||
         error.message?.toLowerCase().includes('fetch');
}

export function isRateLimitError(error: any): boolean {
  if (!error) return false;
  
  return error.code === SupabaseErrorCode.RATE_LIMITED ||
         error.status === 429 ||
         error.message?.toLowerCase().includes('rate limit');
}

export function isDuplicateError(error: any): boolean {
  if (!error) return false;
  
  return error.code === SupabaseErrorCode.UNIQUE_VIOLATION ||
         error.message?.toLowerCase().includes('duplicate') ||
         error.message?.toLowerCase().includes('already exists');
}

// Convert Supabase errors to user-friendly messages
export function getErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred';
  
  // Handle PostgrestError
  if (error.code && error.message) {
    switch (error.code) {
      case SupabaseErrorCode.ROW_NOT_FOUND:
        return 'The requested resource was not found';
      case SupabaseErrorCode.UNIQUE_VIOLATION:
        return 'This item already exists';
      case SupabaseErrorCode.FOREIGN_KEY_VIOLATION:
        return 'This operation would break data relationships';
      case SupabaseErrorCode.NOT_NULL_VIOLATION:
        return 'Required fields are missing';
      case SupabaseErrorCode.CHECK_VIOLATION:
        return 'The provided data is invalid';
      default:
        break;
    }
  }
  
  // Handle auth errors
  if (isAuthError(error)) {
    if (error.message?.includes('Invalid login credentials')) {
      return 'Invalid email or password';
    }
    if (error.message?.includes('Email not confirmed')) {
      return 'Please verify your email before logging in';
    }
    if (error.message?.includes('JWT')) {
      return 'Your session has expired. Please log in again';
    }
  }
  
  // Handle network errors
  if (isNetworkError(error)) {
    return 'Network error. Please check your connection and try again';
  }
  
  // Handle rate limit errors
  if (isRateLimitError(error)) {
    return 'Too many requests. Please wait a moment and try again';
  }
  
  // Default to error message or generic message
  return error.message || 'An unexpected error occurred';
}

// Enhanced error handler for Supabase operations
export async function handleSupabaseError(
  error: any,
  context: {},
    operation: string;
    table?: string;
    userId?: string;
    metadata?: Record<string, any>;
  },
): Promise<never> {
  const enhancedError: SupabaseError = new Error(getErrorMessage(error));
  enhancedError.name = 'SupabaseError';
  enhancedError.code = error.code || SupabaseErrorCode.UNKNOWN;
  enhancedError.details = error.details;
  enhancedError.hint = error.hint;
  enhancedError.statusCode = error.status;
  
  // Log the error with context
  loggers.supabase.error('Supabase operation failed', {
    ...context,
    error: {},
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      status: error.status }});
  
  // Add specific handling for common scenarios
  if (isDuplicateError(error) && context.table) {
    enhancedError.message = `A ${context.table} with these details already exists`;
  }
  
  if (isAuthError(error) && context.operation === 'signIn') {
    enhancedError.message = 'Invalid email or password';
  }
  
  throw enhancedError;
}

// Retry configuration for transient errors
export interface RetryConfig {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryableErrors?: string[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryableErrors: [
    SupabaseErrorCode.NETWORK_ERROR,
    SupabaseErrorCode.TIMEOUT,
    'ECONNRESET',
    'ETIMEDOUT',
  ]};

// Check if an error is retryable
export function isRetryableError(error: any, config: RetryConfig = DEFAULT_RETRY_CONFIG): boolean {
  if (!error) return false;
  
  // Always retry network errors
  if (isNetworkError(error)) return true;
  
  // Check against configured retryable errors
  const errorCode = error.code || error.message;
  return config.retryableErrors?.some(code => 
    errorCode?.includes(code)
  ) || false;
}