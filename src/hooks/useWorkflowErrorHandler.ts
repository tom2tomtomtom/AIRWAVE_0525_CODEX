import { useCallback, useState } from 'react';
import { useWorkflow } from '@/components/workflow/WorkflowProvider';
import { loggers } from '@/lib/logger';

export interface WorkflowError {
  id: string;
  type: 'validation' | 'network' | 'ai_cost' | 'processing' | 'unknown';
  message: string;
  details?: string;
  recoverable: boolean;
  retryable: boolean;
  context?: string;
  timestamp: string;
}

export interface ErrorRecoveryOptions {
  retry?: () => Promise<void>;
  fallback?: () => void;
  skipStep?: () => void;
  resetWorkflow?: () => void;
}

export function useWorkflowErrorHandler() {
  const { actions } = useWorkflow();
  const [isRecovering, setIsRecovering] = useState(false);

  // Categorize errors based on their characteristics
  const categorizeError = useCallback((error: any, context?: string): WorkflowError => {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Network errors
    if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
      return {
        id: errorId,
        type: 'network',
        message: 'Network connection failed. Please check your internet connection.',
        details: error.message,
        recoverable: true,
        retryable: true,
        context: context || 'unknown',
        timestamp,
      };
    }

    // AI cost/budget errors
    if (
      error.message?.includes('budget') ||
      error.message?.includes('cost') ||
      error.status === 402
    ) {
      return {
        id: errorId,
        type: 'ai_cost',
        message: 'AI operation blocked due to budget limits.',
        details: error.message,
        recoverable: true,
        retryable: false,
        context: context || 'unknown',
        timestamp,
      };
    }

    // Validation errors
    if (error.name === 'ValidationError' || error.status === 400) {
      return {
        id: errorId,
        type: 'validation',
        message: 'Invalid input data. Please check your entries and try again.',
        details: error.message,
        recoverable: true,
        retryable: false,
        context: context || 'unknown',
        timestamp,
      };
    }

    // Processing errors
    if (error.message?.includes('processing') || error.message?.includes('generation')) {
      return {
        id: errorId,
        type: 'processing',
        message: 'Processing failed. This might be a temporary issue.',
        details: error.message,
        recoverable: true,
        retryable: true,
        context: context || 'unknown',
        timestamp,
      };
    }

    // Unknown errors
    return {
      id: errorId,
      type: 'unknown',
      message: 'An unexpected error occurred. Please try again.',
      details: error.message || error.toString(),
      recoverable: true,
      retryable: true,
      context: context || 'unknown',
      timestamp,
    };
  }, []);

  // Handle errors with automatic recovery strategies
  const handleError = useCallback(
    async (
      error: any,
      context?: string,
      recoveryOptions?: ErrorRecoveryOptions
    ): Promise<WorkflowError> => {
      const workflowError = categorizeError(error, context);

      // Log error for monitoring
      console.error(`[Workflow Error] ${workflowError.type}:`, workflowError);

      // Set error in workflow state
      actions.setError(workflowError.message);

      // Attempt automatic recovery based on error type
      if (workflowError.recoverable && !isRecovering) {
        setIsRecovering(true);

        try {
          switch (workflowError.type) {
            case 'network':
              await handleNetworkError(workflowError, recoveryOptions);
              break;

            case 'ai_cost':
              await handleAICostError(workflowError, recoveryOptions);
              break;

            case 'validation':
              await handleValidationError(workflowError, recoveryOptions);
              break;

            case 'processing':
              await handleProcessingError(workflowError, recoveryOptions);
              break;

            default:
              await handleUnknownError(workflowError, recoveryOptions);
              break;
          }
        } catch (recoveryError: any) {
          console.error('Error recovery failed:', recoveryError);
          actions.setError('Recovery failed. Please try manually or contact support.');
        } finally {
          setIsRecovering(false);
        }
      }

      return workflowError;
    },
    [categorizeError, actions, isRecovering]
  );

  // Network error recovery
  const handleNetworkError = useCallback(
    async (error: WorkflowError, options?: ErrorRecoveryOptions) => {
      // Wait a bit and retry if retry function is provided
      if (options?.retry && error.retryable) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          await options.retry();
          actions.clearError();
        } catch (retryError: any) {
          actions.setError('Retry failed. Please check your connection and try again.');
        }
      }
    },
    [actions]
  );

  // AI cost error recovery
  const handleAICostError = useCallback(
    async (_error: WorkflowError, options?: ErrorRecoveryOptions) => {
      // Suggest fallback or skip step
      if (options?.fallback) {
        options.fallback();
        actions.setError('Using fallback due to budget limits. Some AI features may be limited.');
      } else if (options?.skipStep) {
        options.skipStep();
        actions.setError('Step skipped due to budget limits. You can continue with manual input.');
      }
    },
    [actions]
  );

  // Validation error recovery
  const handleValidationError = useCallback(
    async (error: WorkflowError, _options?: ErrorRecoveryOptions) => {
      // For validation errors, we typically need user intervention
      // Just keep the error message visible for user to fix
      loggers.general.error('Validation error requires user intervention:', error.details);
    },
    []
  );

  // Processing error recovery
  const handleProcessingError = useCallback(
    async (error: WorkflowError, options?: ErrorRecoveryOptions) => {
      // Try retry with exponential backoff
      if (options?.retry && error.retryable) {
        const delays = [1000, 3000, 5000]; // 1s, 3s, 5s

        for (const delay of delays) {
          await new Promise(resolve => setTimeout(resolve, delay));
          try {
            await options.retry();
            actions.clearError();
            return;
          } catch (retryError: any) {
            loggers.general.error(`Retry failed, waiting ${delay}ms before next attempt`);
          }
        }

        actions.setError('Processing failed after multiple attempts. Please try again later.');
      }
    },
    [actions]
  );

  // Unknown error recovery
  const handleUnknownError = useCallback(
    async (error: WorkflowError, options?: ErrorRecoveryOptions) => {
      // For unknown errors, try a simple retry once
      if (options?.retry && error.retryable) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          await options.retry();
          actions.clearError();
        } catch (retryError: any) {
          actions.setError(
            'Operation failed. Please try again or contact support if the problem persists.'
          );
        }
      }
    },
    [actions]
  );

  // Wrapper for async operations with error handling
  const withErrorHandling = useCallback(
    <T>(operation: () => Promise<T>, context?: string, recoveryOptions?: ErrorRecoveryOptions) => {
      return async (): Promise<T | null> => {
        try {
          const result = await operation();
          actions.clearError(); // Clear any previous errors on success
          return result;
        } catch (error: any) {
          await handleError(error, context, recoveryOptions);
          return null;
        }
      };
    },
    [handleError, actions]
  );

  // Wrapper for sync operations with error handling
  const withSyncErrorHandling = useCallback(
    <T>(operation: () => T, context?: string) => {
      return (): T | null => {
        try {
          const result = operation();
          actions.clearError();
          return result;
        } catch (error: any) {
          handleError(error, context);
          return null;
        }
      };
    },
    [handleError, actions]
  );

  // Manual error reporting
  const reportError = useCallback(
    (message: string, details?: string, context?: string) => {
      const error = new Error(message);
      if (details) {
        (error as any).details = details;
      }
      return handleError(error, context);
    },
    [handleError]
  );

  // Clear errors
  const clearError = useCallback(() => {
    actions.clearError();
  }, [actions]);

  return {
    handleError,
    withErrorHandling,
    withSyncErrorHandling,
    reportError,
    clearError,
    isRecovering,
    categorizeError,
  };
}
