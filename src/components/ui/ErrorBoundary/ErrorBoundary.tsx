import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Paper, Button, Collapse, Alert, AlertTitle } from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon} from '@mui/icons-material';
import { loggers } from '@/lib/logger';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  showDetails: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  level?: 'page' | 'section' | 'component';
}

interface ErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo;
  errorId: string;
  resetError: () => void;
  showDetails: boolean;
  toggleDetails: () => void;
  level: 'page' | 'section' | 'component';
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Generate a unique error ID for tracking
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      hasError: true,
      error,
      errorId};
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props;
    const { errorId } = this.state;

    this.setState({ errorInfo });

    // Log error details
    loggers.general.error('React Error Boundary caught an error', error, {
      errorId,
      componentStack: errorInfo.componentStack,
      errorBoundary: this.constructor.name });

    // Call custom error handler
    onError?.(error, errorInfo, errorId);

    // Report to error tracking service
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.withScope((scope: any) => {
        scope.setTag('errorBoundary', true);
        scope.setContext('errorInfo', {
          componentStack: errorInfo.componentStack,
          errorId});
        (window as any).Sentry.captureException(error);
      });
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Reset error boundary when resetKeys change
    if (hasError && resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => prevProps.resetKeys?.[index] !== key
      );

      if (hasResetKeyChanged) {
        this.resetError();
      }
    }

    // Reset on any prop change if enabled
    if (hasError && resetOnPropsChange && prevProps !== this.props) {
      this.resetError();
    }
  }

  resetError = () => {
    // Clear any pending timeout
    if (this.resetTimeoutId) {
      window.clearTimeout(this.resetTimeoutId);
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      showDetails: false });
  };

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails }));
  };

  render() {
    const { children, fallback: Fallback, level = 'component', isolate } = this.props;
    const { hasError, error, errorInfo, errorId, showDetails } = this.state;

    if (hasError && error) {
      if (Fallback) {
        return (
          <Fallback
            error={error}
            errorInfo={errorInfo!}
            errorId={errorId}
            resetError={this.resetError}
            showDetails={showDetails}
            toggleDetails={this.toggleDetails}
            level={level}
          />
        );
      }

      return (
        <DefaultErrorFallback
          error={error}
          errorInfo={errorInfo!}
          errorId={errorId}
          resetError={this.resetError}
          showDetails={showDetails}
          toggleDetails={this.toggleDetails}
          level={level}
        />
      );
    }

    // Wrap children in error isolation if enabled
    if (isolate) {
      return <Box sx={{ isolation: 'isolate' }}>{children}</Box>;
    }

    return children;
  }
}

const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  errorId,
  resetError,
  showDetails,
  toggleDetails,
  level}) => {
  const isPageLevel = level === 'page';
  const isSectionLevel = level === 'section';

  const containerSx = {
    ...(isPageLevel && {
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center' }),
    ...(isSectionLevel && {
      minHeight: '200px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center' }),
    p: isPageLevel ? 4 : 2 };

  const contentSx = {
    textAlign: 'center' as const,
    maxWidth: isPageLevel ? '600px' : '400px',
    width: '100%' };

  return (
    <Box sx={containerSx}>
      <Paper
        elevation={isPageLevel ? 2 : 1}
        sx={{
          ...contentSx,
          p: isPageLevel ? 4 : 3,
          borderRadius: 3 }}
      >
        <Box sx={{ mb: 3 }}>
          <ErrorIcon
            sx={{
              fontSize: isPageLevel ? 64 : 48,
              color: 'error.main',
              mb: 2 }}
          />

          <Typography variant={isPageLevel ? 'h4' : 'h6'} sx={{ fontWeight: 600, mb: 1 }}>
            {isPageLevel ? 'Something went wrong' : 'Error occurred'}
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {isPageLevel
              ? "We're sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists."
              : 'This section encountered an error and could not be displayed properly.'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={resetError}
            size={isPageLevel ? 'large' : 'medium'}
          >
            Try Again
          </Button>

          {isPageLevel && (
            <Button variant="outlined" onClick={() => (window.location.href = '/')} size="large">
              Go Home
            </Button>
          )}
        </Box>

        {/* Error Details */}
        <Box sx={{ mt: 3 }}>
          <Button
            variant="text"
            size="small"
            onClick={toggleDetails}
            startIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ color: 'text.secondary' }}
          >
            {showDetails ? 'Hide' : 'Show'} Technical Details
          </Button>

          <Collapse in={showDetails}>
            <Alert
              severity="error"
              variant="outlined"
              sx={{
                mt: 2,
                textAlign: 'left',
                '& .MuiAlert-message': {
                  width: '100%' }}}
            >
              <AlertTitle>Error Details</AlertTitle>

              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Error ID:</strong> {errorId}
              </Typography>

              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Message:</strong> {error.message}
              </Typography>

              {error.stack && (
                <Box
                  component="pre"
                  sx={{
                    fontSize: '0.75rem',
                    backgroundColor: 'background.default',
                    p: 2,
                    borderRadius: 1,
                    overflow: 'auto',
                    maxHeight: '200px',
                    border: '1px solid',
                    borderColor: 'divider',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word' }}
                >
                  {error.stack}
                </Box>
              )}

              {errorInfo.componentStack && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Component Stack:</strong>
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      fontSize: '0.75rem',
                      backgroundColor: 'background.default',
                      p: 2,
                      borderRadius: 1,
                      overflow: 'auto',
                      maxHeight: '150px',
                      border: '1px solid',
                      borderColor: 'divider',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word' }}
                  >
                    {errorInfo.componentStack}
                  </Box>
                </Box>
              )}
            </Alert>
          </Collapse>
        </Box>

        {/* Error Reporting */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Error ID: {errorId}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

// Higher-order component for easy wrapping
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

// Hook for manual error handling
export const useErrorHandler = () => {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    throw error;
  };
};

export default ErrorBoundary;
