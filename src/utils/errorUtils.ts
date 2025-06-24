/**
 * Utility functions for handling errors consistently across the application
 */

export interface AppError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

/**
 * Safely extracts an error message from any error type
 * @param error - The error to extract message from
 * @returns A string error message
 */
export function getErrorMessage(error: unknown): string {
  if (!error) {
    return 'An unknown error occurred';
  }

  if (typeof error === 'string') {
    return error.trim() || 'An unknown error occurred';
  }

  if (error instanceof Error) {
    return error.message.trim() || 'An unknown error occurred';
  }

  if (typeof error === 'object' && error !== null) {
    // Check for common error object patterns
    const errorObj = error as any;

    if (typeof errorObj.message === 'string') {
      return errorObj.message.trim() || 'An unknown error occurred';
    }

    if (typeof errorObj.error === 'string') {
      return errorObj.error.trim() || 'An unknown error occurred';
    }
  }

  return 'An unknown error occurred';
}

/**
 * Creates a standardized error object
 * @param message - Error message
 * @param code - Optional error code
 * @param status - Optional HTTP status code
 * @param details - Optional additional error details
 * @returns Standardized error object
 */
export function createError(
  message: string,
  code?: string,
  status?: number,
  details?: unknown
): AppError {
  return {
    message,
    code,
    status,
    details};
}

/**
 * Checks if an error is a known application error
 * @param error - The error to check
 * @returns True if it's an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as any).message === 'string'
  );
}

/**
 * Safely logs an error without exposing sensitive information
 * @param error - The error to log
 * @param context - Optional context information
 */
export function logError(error: unknown, context?: string): void {
  const message = getErrorMessage(error);
  const prefix = context ? `[${context}]` : '';

  if (process.env.NODE_ENV === 'development') {
    console.error(`${prefix} Error:`, error);
  } else {
    // In production, only log the message to avoid exposing sensitive data
    console.error(`${prefix} Error: ${message}`);
  }
}

/**
 * Formats an error for API responses
 * @param error - The error to format
 * @returns Formatted error object suitable for API responses
 */
export function formatApiError(error: unknown): { error: string; code?: string } {
  if (isAppError(error)) {
    return {
      error: error.message,
      code: error.code };
  }

  const message = getErrorMessage(error);
  return {
    error: message };
}

/**
 * Error boundary helper for React components
 * @param error - The error that occurred
 * @param errorInfo - Additional error information
 */
export function handleComponentError(error: Error, errorInfo: unknown): void {
  logError(error, 'Component Error');

  // In production, you might want to send errors to a monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to error monitoring service
    // errorMonitoringService.captureException(error, { extra: errorInfo });
  }
}

/**
 * Check if an error is related to network connectivity
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const networkKeywords = [
    'network request',
    'network error',
    'fetch',
    'connection',
    'timeout',
    'refused',
    'unreachable',
    'offline',
    'dns',
    'cors',
  ];

  return networkKeywords.some(keyword => message.includes(keyword));
}

/**
 * Check if an error is related to authentication or authorization
 */
export function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const authKeywords = [
    'auth',
    'unauthorized',
    'forbidden',
    'token',
    'login',
    'permission',
    'access denied',
    'invalid credentials',
    'session expired',
  ];

  return authKeywords.some(keyword => message.includes(keyword));
}

/**
 * Format an error message for display to end users
 * Provides user-friendly messages while hiding technical details
 */
export function formatErrorForUser(error: unknown): string {
  if (isNetworkError(error)) {
    return 'Network connection error. Please check your internet connection and try again.';
  }

  if (isAuthError(error)) {
    return 'Authentication error. Please log in again.';
  }

  const message = getErrorMessage(error).toLowerCase();

  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  if (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('required')
  ) {
    return 'Please check your input and try again.';
  }

  if (message.includes('server error') || message.includes('internal error')) {
    return 'Server error. Please try again later.';
  }

  return 'An unexpected error occurred. Please try again.';
}
