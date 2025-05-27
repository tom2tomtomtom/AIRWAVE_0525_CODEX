// utils/errorUtils.ts
import { NextApiResponse } from 'next';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unknown error occurred';
}

export function handleApiError(error: unknown, res: NextApiResponse): void {
  console.error('API Error:', error);

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code
    });
    return;
  }

  const message = getErrorMessage(error);
  const statusCode = getStatusCode(error);

  res.status(statusCode).json({
    success: false,
    error: message,
    code: 'INTERNAL_ERROR'
  });
}

function getStatusCode(error: unknown): number {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const statusCode = (error as any).statusCode;
    if (typeof statusCode === 'number') {
      return statusCode;
    }
  }
  return 500;
}

// Supabase error handling
export function isSupabaseError(error: unknown): boolean {
  return error !== null && 
    typeof error === 'object' && 
    'message' in error &&
    ('details' in error || 'hint' in error || 'code' in error);
}

export function handleSupabaseError(error: unknown): AppError {
  if (isSupabaseError(error)) {
    const supabaseError = error as any;
    const message = supabaseError.message || 'Database error';
    const code = supabaseError.code || 'SUPABASE_ERROR';
    
    // Map common Supabase errors to appropriate status codes
    let statusCode = 500;
    if (code === '23505') statusCode = 409; // Unique constraint violation
    if (code === '23503') statusCode = 400; // Foreign key violation
    if (code === '42P01') statusCode = 404; // Table not found
    
    return new AppError(message, statusCode, code);
  }
  
  return new AppError('Unknown database error', 500, 'DATABASE_ERROR');
}

// Try-catch wrapper for async handlers
export function asyncHandler<T = any>(
  fn: (...args: any[]) => Promise<T>
): (...args: any[]) => Promise<T | void> {
  return async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error('Async handler error:', error);
      throw error;
    }
  };
}

// Type guard for error with code
export function hasErrorCode(error: unknown): error is { code: string } {
  return error !== null && 
    typeof error === 'object' && 
    'code' in error &&
    typeof (error as any).code === 'string';
}

// Common error messages
export const ErrorMessages = {
  UNAUTHORIZED: 'You are not authorized to perform this action',
  NOT_FOUND: 'The requested resource was not found',
  VALIDATION_ERROR: 'Invalid input data',
  RATE_LIMIT: 'Too many requests, please try again later',
  SERVER_ERROR: 'An internal server error occurred',
  SESSION_EXPIRED: 'Your session has expired, please log in again',
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_EXISTS: 'An account with this email already exists',
  CLIENT_NOT_FOUND: 'Client not found',
  ASSET_NOT_FOUND: 'Asset not found',
  CAMPAIGN_NOT_FOUND: 'Campaign not found',
  RENDER_FAILED: 'Video rendering failed',
  UPLOAD_FAILED: 'File upload failed',
  PERMISSION_DENIED: 'You do not have permission to access this resource'
} as const;