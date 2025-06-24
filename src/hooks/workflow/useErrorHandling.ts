import { useCallback } from 'react';
import { useNotification } from '@/contexts/NotificationContext';

interface UseErrorHandlingProps {
  dispatch: (action: any) => void;
}

export const useErrorHandling = ({ dispatch }: UseErrorHandlingProps) => {
  const { showNotification } = useNotification();

  // Enhanced error handling wrapper
  const withErrorHandling = useCallback(
    <T>(operation: () => Promise<T>, context: string, fallback?: () => void) => {
      return async (): Promise<T | null> => {
        try {
          dispatch({ type: 'SET_ERROR', error: null }); // Clear previous errors
          const result = await operation();
          return result;
        } catch (error: any) {
          console.error(`[Workflow Error] ${context}:`, error);

          // Categorize and handle error
          let errorMessage = 'An unexpected error occurred';
          let recoverable = true;

          if (error instanceof Error) {
            if (error.message.includes('budget') || error.message.includes('cost')) {
              errorMessage =
                'AI operation blocked due to budget limits. Please try with a smaller request or upgrade your plan.';
              recoverable = false;
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
              errorMessage = 'Network error. Please check your connection and try again.';
              recoverable = true;
            } else if (error.message.includes('validation') || error.message.includes('invalid')) {
              errorMessage = 'Invalid input data. Please check your entries and try again.';
              recoverable = false;
            } else {
              errorMessage = error.message;
            }
          }

          dispatch({ type: 'SET_ERROR', error: errorMessage });
          showNotification(errorMessage, 'error');

          // Execute fallback if provided and error is not recoverable
          if (!recoverable && fallback) {
            fallback();
          }

          return null;
        }
      };
    },
    [showNotification, dispatch]
  );

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', error: null });
  }, [dispatch]);

  const setError = useCallback(
    (error: string) => {
      dispatch({ type: 'SET_ERROR', error });
    },
    [dispatch]
  );

  return {
    withErrorHandling,
    clearError,
    setError};
};
