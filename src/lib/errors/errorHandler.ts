/**
 * Centralized error handling for the application
 */

import { getErrorMessage } from '@/utils/errorUtils';

export interface ErrorContext {
  userId?: string;
  action?: string;
  resource?: string;
  metadata?: Record<string, any>;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly context?: ErrorContext;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    context?: ErrorContext
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.context = context;
  }
}

export const ErrorCodes = {
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // External service errors
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Internal errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

/**
 * Global error handler for the application
 */
export function handleError(error: unknown, context?: ErrorContext): AppError {
  // If it's already an AppError, return it
  if (error instanceof AppError) {
    return error;
  }

  // Extract error message
  const message = getErrorMessage(error);

  // Log the error
  console.error('Error occurred:', {
    message,
    context,
    stack: error instanceof Error ? error.stack : undefined,
  });

  // Return a standardized error
  return new AppError(
    message,
    500,
    ErrorCodes.INTERNAL_ERROR,
    context
  );
}

/**
 * Create specific error types
 */
export const createUnauthorizedError = (message = 'Unauthorized') =>
  new AppError(message, 401, ErrorCodes.UNAUTHORIZED);

export const createForbiddenError = (message = 'Forbidden') =>
  new AppError(message, 403, ErrorCodes.FORBIDDEN);

export const createNotFoundError = (message = 'Resource not found') =>
  new AppError(message, 404, ErrorCodes.NOT_FOUND);

export const createValidationError = (message: string) =>
  new AppError(message, 400, ErrorCodes.VALIDATION_ERROR);

export const createRateLimitError = (message = 'Rate limit exceeded') =>
  new AppError(message, 429, ErrorCodes.RATE_LIMIT_EXCEEDED);