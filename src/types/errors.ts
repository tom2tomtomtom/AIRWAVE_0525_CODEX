// Comprehensive error types for the application

export enum ErrorCode {
  // Authentication errors
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',
  AUTH_EMAIL_NOT_VERIFIED = 'AUTH_EMAIL_NOT_VERIFIED',
  AUTH_PASSWORD_TOO_WEAK = 'AUTH_PASSWORD_TOO_WEAK',

  // Database errors
  DB_CONNECTION_ERROR = 'DB_CONNECTION_ERROR',
  DB_RECORD_NOT_FOUND = 'DB_RECORD_NOT_FOUND',
  DB_DUPLICATE_RECORD = 'DB_DUPLICATE_RECORD',
  DB_CONSTRAINT_VIOLATION = 'DB_CONSTRAINT_VIOLATION',
  DB_TRANSACTION_FAILED = 'DB_TRANSACTION_FAILED',

  // API errors
  API_RATE_LIMIT_EXCEEDED = 'API_RATE_LIMIT_EXCEEDED',
  API_INVALID_REQUEST = 'API_INVALID_REQUEST',
  API_SERVICE_UNAVAILABLE = 'API_SERVICE_UNAVAILABLE',
  API_TIMEOUT = 'API_TIMEOUT',

  // AI service errors
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  AI_QUOTA_EXCEEDED = 'AI_QUOTA_EXCEEDED',
  AI_INVALID_PROMPT = 'AI_INVALID_PROMPT',
  AI_CONTENT_FILTERED = 'AI_CONTENT_FILTERED',

  // File/Storage errors
  STORAGE_UPLOAD_FAILED = 'STORAGE_UPLOAD_FAILED',
  STORAGE_FILE_TOO_LARGE = 'STORAGE_FILE_TOO_LARGE',
  STORAGE_INVALID_FILE_TYPE = 'STORAGE_INVALID_FILE_TYPE',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',

  // Validation errors
  VALIDATION_REQUIRED_FIELD = 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_INVALID_FORMAT = 'VALIDATION_INVALID_FORMAT',
  VALIDATION_OUT_OF_RANGE = 'VALIDATION_OUT_OF_RANGE',

  // Business logic errors
  CAMPAIGN_ALREADY_PUBLISHED = 'CAMPAIGN_ALREADY_PUBLISHED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  FEATURE_NOT_AVAILABLE = 'FEATURE_NOT_AVAILABLE',

  // System errors
  SYSTEM_CONFIGURATION_ERROR = 'SYSTEM_CONFIGURATION_ERROR',
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
  SYSTEM_UNKNOWN_ERROR = 'SYSTEM_UNKNOWN_ERROR',
}

export interface ErrorContext {
  userId?: string;
  clientId?: string;
  campaignId?: string;
  requestId?: string;
  timestamp?: Date;
  userAgent?: string;
  ip?: string;
  [key: string]: unknown;
}

export interface ErrorDetails {
  field?: string;
  value?: unknown;
  constraint?: string;
  allowedValues?: unknown[];
  min?: number;
  max?: number;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly context?: ErrorContext;
  public readonly details?: ErrorDetails;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode = 500,
    context?: ErrorContext,
    details?: ErrorDetails,
    isOperational = true
  ) {
    super(message);

    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    if (context !== undefined) {
      this.context = context;
    }
    if (details !== undefined) {
      this.details = details;
    }
    this.isOperational = isOperational;
    this.timestamp = new Date();

    // Ensure the stack trace points to where the error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

// Authentication specific errors
export class AuthError extends AppError {
  constructor(message: string, code: ErrorCode, context?: ErrorContext, details?: ErrorDetails) {
    super(message, code, 401, context, details);
    this.name = 'AuthError';
  }
}

// Database specific errors
export class DatabaseError extends AppError {
  constructor(message: string, code: ErrorCode, context?: ErrorContext, details?: ErrorDetails) {
    super(message, code, 500, context, details);
    this.name = 'DatabaseError';
  }
}

// Validation specific errors
export class ValidationError extends AppError {
  constructor(message: string, field: string, value?: unknown, allowedValues?: unknown[]) {
    const details: ErrorDetails = { 
      field, 
      value, 
      ...(allowedValues !== undefined && { allowedValues }) 
    };
    super(message, ErrorCode.VALIDATION_INVALID_FORMAT, 400, undefined, details);
    this.name = 'ValidationError';
  }
}

// API specific errors
export class ApiError extends AppError {
  constructor(message: string, code: ErrorCode, statusCode = 500, context?: ErrorContext) {
    super(message, code, statusCode, context);
    this.name = 'ApiError';
  }
}

// Storage specific errors
export class StorageError extends AppError {
  constructor(message: string, code: ErrorCode, context?: ErrorContext, details?: ErrorDetails) {
    super(message, code, 500, context, details);
    this.name = 'StorageError';
  }
}

// AI service specific errors
export class AIError extends AppError {
  constructor(message: string, code: ErrorCode, context?: ErrorContext, details?: ErrorDetails) {
    super(message, code, 500, context, details);
    this.name = 'AIError';
  }
}

// Error factory functions for common scenarios
export const createAuthError = (message: string, context?: ErrorContext): AuthError => {
  return new AuthError(message, ErrorCode.AUTH_UNAUTHORIZED, context);
};

export const createValidationError = (
  field: string,
  value: unknown,
  message?: string
): ValidationError => {
  return new ValidationError(message || `Invalid value for field: ${field}`, field, value);
};

export const createDatabaseError = (message: string, context?: ErrorContext): DatabaseError => {
  return new DatabaseError(message, ErrorCode.DB_CONNECTION_ERROR, context);
};

export const createRateLimitError = (context?: ErrorContext): ApiError => {
  return new ApiError(
    'Rate limit exceeded. Please try again later.',
    ErrorCode.API_RATE_LIMIT_EXCEEDED,
    429,
    context
  );
};

// Type guards
export const isAppError = (error: unknown): error is AppError => {
  return error instanceof AppError;
};

export const isAuthError = (error: unknown): error is AuthError => {
  return error instanceof AuthError;
};

export const isValidationError = (error: unknown): error is ValidationError => {
  return error instanceof ValidationError;
};

export const isDatabaseError = (error: unknown): error is DatabaseError => {
  return error instanceof DatabaseError;
};

// Error response formatter for API responses
export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetails;
    timestamp: Date;
    requestId?: string;
  };
}

export const formatErrorResponse = (error: AppError, requestId?: string): ErrorResponse => {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined && { details: error.details }),
      timestamp: error.timestamp,
      ...(requestId !== undefined && { requestId }),
    },
  };
};

// Helper to convert unknown errors to AppError
export const normalizeError = (
  error: unknown,
  defaultMessage = 'An unexpected error occurred'
): AppError => {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      error.message || defaultMessage,
      ErrorCode.SYSTEM_UNKNOWN_ERROR,
      500,
      undefined,
      undefined,
      false // Non-operational since it's unexpected
    );
  }

  return new AppError(
    defaultMessage,
    ErrorCode.SYSTEM_UNKNOWN_ERROR,
    500,
    undefined,
    undefined,
    false
  );
};
