/**
 * React Error Boundary for AIRWAVE
 * Catches JavaScript errors anywhere in the component tree
 * Provides graceful error handling and user-friendly error messages
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Alert, Stack } from '@mui/material';
import { RefreshOutlined, BugReportOutlined, HomeOutlined } from '@mui/icons-material';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  eventId: string | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  isolate?: boolean; // If true, only catch errors within this boundary
}

export interface ErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo;
  resetError: () => void;
  eventId?: string;
}

/**
 * Default error fallback component
 */
function DefaultErrorFallback({ error, errorInfo, resetError, eventId }: ErrorFallbackProps) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  const handleReportError = () => {
    // In production, this could open a support ticket or error reporting form
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.error('Error details:', { error, errorInfo, eventId });
    } else {
      // Send to error reporting service
      window.open(`mailto:support@airwave.com?subject=Error Report&body=Error ID: ${eventId}`);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        padding: 3,
        textAlign: 'center'}}
    >
      <BugReportOutlined sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
      
      <Typography variant="h4" component="h1" gutterBottom>
        Oops! Something went wrong
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 600 }}>
        We&apos;re sorry for the inconvenience. An unexpected error occurred while loading this page.
        Our team has been notified and we&apos;re working to fix this issue.
      </Typography>

      {eventId && (
        <Alert severity="info" sx={{ mb: 3, maxWidth: 600 }}>
          <Typography variant="body2">
            Error ID: <code>{eventId}</code>
          </Typography>
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<RefreshOutlined />}
          onClick={resetError}
          color="primary"
        >
          Try Again
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<RefreshOutlined />}
          onClick={handleReload}
        >
          Reload Page
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<HomeOutlined />}
          onClick={handleGoHome}
        >
          Go Home
        </Button>
      </Stack>

      <Button
        variant="text"
        size="small"
        startIcon={<BugReportOutlined />}
        onClick={handleReportError}
        sx={{ color: 'text.secondary' }}
      >
        Report This Error
      </Button>

      {isDevelopment && (
        <Box sx={{ mt: 4, textAlign: 'left', maxWidth: 800 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Development Error Details
            </Typography>
            
            <Typography variant="body2" component="pre" sx={{ 
              whiteSpace: 'pre-wrap', 
              fontSize: '0.8rem',
              backgroundColor: 'rgba(0,0,0,0.05)',
              padding: 1,
              borderRadius: 1,
              mb: 2}}>
              {error.stack}
            </Typography>
            
            {errorInfo.componentStack && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Component Stack:
                </Typography>
                <Typography variant="body2" component="pre" sx={{ 
                  whiteSpace: 'pre-wrap', 
                  fontSize: '0.8rem',
                  backgroundColor: 'rgba(0,0,0,0.05)',
                  padding: 1,
                  borderRadius: 1}}>
                  {errorInfo.componentStack}
                </Typography>
              </Box>
            )}
          </Alert>
        </Box>
      )}
    </Box>
  );
}

/**
 * Error Boundary Component
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null};
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error};
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Generate unique error ID
    const eventId = this.generateErrorId();
    
    this.setState({
      error,
      errorInfo,
      eventId});

    // Log error locally
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report error to monitoring service
    this.reportError(error, errorInfo, eventId);
  }

  private generateErrorId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `err_${timestamp}_${random}`;
  }

  private reportError(error: Error, errorInfo: ErrorInfo, eventId: string) {
    try {
      // In production, send to error monitoring service (Sentry, LogRocket, etc.)
      if (process.env.NODE_ENV === 'production') {
        // Example: Sentry reporting
        // Sentry.captureException(error, {
        //   tags: { eventId  }
        //   contexts: { react: errorInfo  }
        // });

        // Example: Custom API reporting
        fetch('/api/errors', {
          method: 'POST',
          headers: {
        'Content-Type': 'application/json' 
      },
          body: JSON.stringify({
            eventId,
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack
            },
            errorInfo,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href})}).catch(reportingError => {
          console.error('Failed to report error:', reportingError);
        });
      }
    } catch (reportingError) {
      console.error('Error reporting failed:', reportingError);
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null});
  };

  render() {
    if (this.state.hasError && this.state.error && this.state.errorInfo) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      
      return (
        <FallbackComponent
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          resetError={this.resetError}
          eventId={this.state.eventId}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundaryComponent;
}

/**
 * Hook for handling errors in functional components
 */
export function useErrorHandler() {
  return (error: Error, _errorInfo?: ErrorInfo) => {
    // Throw error to be caught by nearest error boundary
    throw error;
  };
}

/**
 * Error boundary for specific features
 */
export function FeatureErrorBoundary({ children, feature }: { children: ReactNode; feature: string }) {
  const handleError = (error: Error, errorInfo: ErrorInfo) => {
    console.error(`Error in ${feature}:`, error, errorInfo);
    
    // Report feature-specific error
    fetch('/api/errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        feature,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        errorInfo,
        timestamp: new Date().toISOString()})}).catch(console.error);
  };

  const CustomFallback = ({ error, resetError }: ErrorFallbackProps) => (
    <Alert 
      severity="error" 
      sx={{ m: 2 }}
      action={
        <Button color="inherit" size="small" onClick={resetError}>
          Retry
        </Button>
      }
    >
      <Typography variant="subtitle2" gutterBottom>
        {feature} is temporarily unavailable
      </Typography>
      <Typography variant="body2">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </Typography>
    </Alert>
  );

  return (
    <ErrorBoundary onError={handleError} fallback={CustomFallback}>
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;