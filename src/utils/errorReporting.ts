// Global error reporting utilities

export interface ErrorContext {
  userId?: string;
  action?: string;
  component?: string;
  metadata?: Record<string, unknown>;
}

export class ErrorReporter {
  private static instance: ErrorReporter;
  private userId?: string;
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    // In browser environment, setup global error handlers
    if (typeof window !== 'undefined') {
      this.setupGlobalErrorHandlers();
    }
  }

  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter();
    }
    return ErrorReporter.instance;
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupGlobalErrorHandlers() {

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError(new Error(`Unhandled Promise Rejection: ${event.reason}`), {
        action: 'unhandled_promise_rejection',
        metadata: {
          reason: event.reason,
          promise: event.promise },
      });
    });

    // Handle global JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportError(new Error(event.message), {
        action: 'global_error',
        metadata: {
        filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          source: (event as any).source
      }});
    });
  }

  async reportError(error: Error, context: ErrorContext = {}) {
    try {
      const errorReport = {
        message: error.message,
        stack: error.stack || 'No stack trace available',
        errorId: this.generateErrorId(),
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
        userId: this.userId,
        sessionId: this.sessionId,
        context};

      // Send to error reporting API
      const response = await fetch('/api/errors', {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json'
      },
        body: JSON.stringify(errorReport)});
      
      if (!response.ok) {
        throw new Error(`Error reporting failed: ${response.status}`);
      }

    } catch (reportingError: unknown) {
      // Fallback: log to console if reporting fails
      console.error('Failed to report error:', reportingError);
      console.error('Original error:', error);
    }
  }

  private generateErrorId(): string {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Helper methods for specific error types
  async reportAPIError(error: Error, endpoint: string, method: string = 'GET') {
    return this.reportError(error, {
      action: 'api_error',
      metadata: {
        endpoint,
        method,
        timestamp: new Date().toISOString()
      }});
  }

  async reportUIError(error: Error, component: string, action: string) {
    return this.reportError(error, {
      action: 'ui_error',
      component,
      metadata: {
        userAction: action,
        timestamp: new Date().toISOString()
      }});
  }

  async reportValidationError(error: Error, form: string, field?: string) {
    return this.reportError(error, {
      action: 'validation_error',
      component: form,
      metadata: {
        field,
        timestamp: new Date().toISOString()
      }});
  }
}

// Singleton instance
export const errorReporter = ErrorReporter.getInstance();

// Convenience functions
export const reportError = (error: Error, context?: ErrorContext) => 
  errorReporter.reportError(error, context);

export const reportAPIError = (error: Error, endpoint: string, method?: string) => 
  errorReporter.reportAPIError(error, endpoint, method);

export const reportUIError = (error: Error, component: string, action: string) => 
  errorReporter.reportUIError(error, component, action);

export const reportValidationError = (error: Error, form: string, field?: string) => 
  errorReporter.reportValidationError(error, form, field);

// Hook for React components
export function useErrorReporting() {
  return {
    reportError: errorReporter.reportError.bind(errorReporter),
    reportAPIError: errorReporter.reportAPIError.bind(errorReporter),
    reportUIError: errorReporter.reportUIError.bind(errorReporter),
    reportValidationError: errorReporter.reportValidationError.bind(errorReporter)};
}

// Higher-order function to wrap async functions with error reporting
export function withErrorReporting<T extends (...args: unknown[]) => Promise<any>>(
  fn: T,
  context: ErrorContext = {}
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error: unknown) {
      if (error instanceof Error) {
        await errorReporter.reportError(error, context);
      }
      throw error; // Re-throw to maintain normal error flow
    }
  }) as T;
}