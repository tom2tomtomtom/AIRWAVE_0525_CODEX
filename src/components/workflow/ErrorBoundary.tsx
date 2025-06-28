import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  AlertTitle,
  Paper,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  BugReport as BugReportIcon,
  ExpandMore as ExpandMoreIcon,
  Home as HomeIcon,
} from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

export class WorkflowErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to monitoring service
    console.error('Workflow Error Boundary caught an error:', error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send error to monitoring service (Sentry, etc.)
    this.reportError(error, errorInfo);
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    try {
      // Sanitize error information for production
      const sanitizedError = this.sanitizeErrorForProduction(error);

      const errorReport = {
        errorId: this.state.errorId,
        message: sanitizedError.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        componentStack:
          process.env.NODE_ENV === 'development' ? errorInfo.componentStack : undefined,
        context: this.props.context,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        environment: process.env.NODE_ENV };

      // In development, log full details
      if (process.env.NODE_ENV === 'development') {
        console.error('Error Report:', errorReport);
      } else {
        // In production, only log sanitized information
        console.error('Production Error:', {
          errorId: errorReport.errorId,
          message: errorReport.message,
          context: errorReport.context,
          timestamp: errorReport.timestamp });
      }

      // TODO: Send to actual error tracking service (Sentry, etc.)
      // await this.sendToErrorService(errorReport);
    } catch (reportingError: any) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private sanitizeErrorForProduction(error: Error): { message: string } {
    // In production, sanitize error messages to prevent information disclosure
    if (process.env.NODE_ENV === 'production') {
      // Check for sensitive patterns and replace with generic messages
      const sensitivePatterns = [
        /password/i,
        /token/i,
        /key/i,
        /secret/i,
        /api[_-]?key/i,
        /database/i,
        /connection/i,
        /internal/i,
        /server/i,
        /file.*not.*found/i,
        /permission.*denied/i,
        /access.*denied/i,
      ];

      const isSensitive = sensitivePatterns.some(pattern => pattern.test(error.message));

      if (isSensitive) {
        return { message: 'An unexpected error occurred. Please try again or contact support.' };
      }

      // For non-sensitive errors, still provide a user-friendly message
      const userFriendlyMessages: Record<string, string> = {
        'Network Error': 'Connection error. Please check your internet connection and try again.',
        ChunkLoadError: 'Loading error. Please refresh the page and try again.',
        TypeError: 'An unexpected error occurred. Please refresh the page and try again.',
        ReferenceError: 'An unexpected error occurred. Please refresh the page and try again.' };

      for (const [pattern, message] of Object.entries(userFriendlyMessages)) {
        if (error.message.includes(pattern)) {
          return { message };
        }
      }

      // Default sanitized message
      return { message: 'An unexpected error occurred. Please try again.' };
    }

    // In development, return original message
    return { message: error.message };
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '' });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleReportBug = () => {
    const subject = encodeURIComponent(
      `Bug Report: ${this.state.error?.message || 'Workflow Error'}`
    );
    const body = encodeURIComponent(`
Error ID: ${this.state.errorId},
  Context: ${this.props.context || 'Unknown'},
  Message: ${this.state.error?.message || 'Unknown error'},
  Timestamp: ${new Date().toISOString()}

Please describe what you were doing when this error occurred:
[Your description here]
    `);

    window.open(`mailto:support@airwave.app?subject=${subject}&body=${body}`);
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />

            <Typography variant="h4" gutterBottom color="error">
              Oops! Something went wrong
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              We encountered an unexpected error in the workflow. Don't worry, your progress has
              been saved.
            </Typography>

            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
              <AlertTitle>Error Details</AlertTitle>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Error ID:</strong> {this.state.errorId}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Context:</strong> {this.props.context || 'Workflow'}
              </Typography>
              <Typography variant="body2">
                <strong>Message:</strong>{' '}
                {this.state.error
                  ? this.sanitizeErrorForProduction(this.state.error).message
                  : 'Unknown error occurred'}
              </Typography>
            </Alert>

            <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 3 }}>
              <Button variant="contained" onClick={this.handleRetry} startIcon={<RefreshIcon />}>
                Try Again
              </Button>

              <Button variant="outlined" onClick={this.handleGoHome} startIcon={<HomeIcon />}>
                Go to Dashboard
              </Button>

              <Button
                variant="outlined"
                color="secondary"
                onClick={this.handleReportBug}
                startIcon={<BugReportIcon />}
              >
                Report Bug
              </Button>
            </Stack>

            {this.props.showDetails && this.state.error && (
              <Accordion sx={{ textAlign: 'left' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">Technical Details</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Error Stack:
                      </Typography>
                      <Paper sx={{ p: 2, bgcolor: 'grey.100', overflow: 'auto' }}>
                        <Typography variant="body2" component="pre" sx={{ fontSize: '0.75rem' }}>
                          {this.state.error.stack}
                        </Typography>
                      </Paper>
                    </Box>

                    {this.state.errorInfo && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Component Stack:
                        </Typography>
                        <Paper sx={{ p: 2, bgcolor: 'grey.100', overflow: 'auto' }}>
                          <Typography variant="body2" component="pre" sx={{ fontSize: '0.75rem' }}>
                            {this.state.errorInfo.componentStack}
                          </Typography>
                        </Paper>
                      </Box>
                    )}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}

            <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                If this problem persists, please contact our support team with the Error ID above.
              </Typography>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping workflow steps
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  context?: string
) {
  return function WrappedComponent(props: P) {
    return (
      <WorkflowErrorBoundary {...(context && { context })} showDetails={process.env.NODE_ENV === 'development'}>
        <Component {...props} />
      </WorkflowErrorBoundary>
    );
  };
}

// Hook for error reporting in functional components
export function useErrorHandler() {
  const reportError = React.useCallback((error: Error, context?: string) => {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.error('Manual error report:', error);

    // TODO: Send to error tracking service
    const errorReport = {
      errorId,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href };

    console.error('Error Report:', errorReport);

    return errorId;
  }, []);

  return { reportError };
}
