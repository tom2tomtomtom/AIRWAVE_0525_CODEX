import React from 'react';
import { Box, Typography, Button, Alert, AlertTitle } from '@mui/material';
import { Error as ErrorIcon, Refresh as RefreshIcon } from '@mui/icons-material';

interface ErrorMessageProps {
  title?: string;
  message?: string;
  error?: Error | string;
  onRetry?: () => void;
  variant?: 'inline' | 'fullPage';
  showDetails?: boolean;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = 'Something went wrong',
  message,
  error,
  onRetry,
  variant = 'inline',
  showDetails = false}) => {
  // Handle different error types including Supabase errors
  const getErrorMessage = (err: any): string => {
    if (message) return message;

    // Handle Supabase-style errors (objects with code, message, details, hint)
    if (err && typeof err === 'object' && !Array.isArray(err) && !(err instanceof Error)) {
      if (err.message) return err.message;
      if (err.error_description) return err.error_description;
      if (err.code) return `Error ${err.code}: ${err.details || 'An error occurred'}`;
      // If it's an object without clear message properties, stringify it safely
      return JSON.stringify(err);
    }

    // Handle Error instances
    if (err instanceof Error) return err.message;

    // Handle string errors
    if (typeof err === 'string') return err;

    return 'An unexpected error occurred';
  };

  const errorMessage = getErrorMessage(error);

  if (variant === 'inline') {
    return (
      <Alert
        severity="error"
        action={
          onRetry && (
            <Button color="inherit" size="small" onClick={onRetry} startIcon={<RefreshIcon />}>
              Retry
            </Button>
          )
        }
      >
        <AlertTitle>{title}</AlertTitle>
        {errorMessage}
        {showDetails && error instanceof Error && error.stack && (
          <Box mt={1}>
            <Typography
              variant="caption"
              component="pre"
              sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
            >
              {error.stack}
            </Typography>
          </Box>
        )}
      </Alert>
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="60vh"
      p={4}
      textAlign="center"
    >
      <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
      <Typography variant="h5" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        {errorMessage}
      </Typography>
      {onRetry && (
        <Button variant="contained" onClick={onRetry} startIcon={<RefreshIcon />} sx={{ mt: 2 }}>
          Try Again
        </Button>
      )}
      {showDetails && error instanceof Error && error.stack && (
        <Box mt={3} p={2} bgcolor="grey.100" borderRadius={1} maxWidth={600} width="100%">
          <Typography
            variant="caption"
            component="pre"
            sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', textAlign: 'left' }}
          >
            {error.stack}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default ErrorMessage;

// Utility function to get user-friendly error messages
export const getUserFriendlyErrorMessage = (error: any): string => {
  // Handle HTTP response errors
  if (error?.response?.status === 401) {
    return 'You need to be logged in to perform this action';
  }
  if (error?.response?.status === 403) {
    return "You don't have permission to perform this action";
  }
  if (error?.response?.status === 404) {
    return 'The requested resource was not found';
  }
  if (error?.response?.status === 429) {
    return 'Too many requests. Please try again later';
  }
  if (error?.response?.status >= 500) {
    return 'Server error. Please try again later';
  }

  // Handle Supabase errors
  if (error?.code === 'PGRST116') {
    return 'The table or column does not exist. Please check your database schema';
  }
  if (error?.code?.startsWith('PGRST')) {
    return `Database error: ${error.details || error.message || 'An error occurred'}`;
  }

  // Handle network errors
  if (error?.code === 'NETWORK_ERROR' || !navigator.onLine) {
    return 'Network error. Please check your internet connection';
  }

  // Handle API key errors
  if (error?.message?.includes('API key')) {
    return 'API configuration error. Please contact support';
  }

  // Handle Supabase-style errors (objects with code, message, details, hint)
  if (error && typeof error === 'object' && !Array.isArray(error) && !(error instanceof Error)) {
    if (error.message) return error.message;
    if (error.error_description) return error.error_description;
    if (error.code) return `Error ${error.code}: ${error.details || 'An error occurred'}`;
  }

  // Handle Error instances
  if (error instanceof Error) return error.message;

  // Handle string errors
  if (typeof error === 'string') return error;

  return 'An unexpected error occurred';
};
