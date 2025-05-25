import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Card, CardContent, Alert } from '@mui/material';
import { Refresh as RefreshIcon, Error as ErrorIcon } from '@mui/icons-material';
import Head from 'next/head';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // You can also log the error to an error reporting service here
    // logErrorToService(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <>
          <Head>
            <title>Error | AIrWAVE</title>
          </Head>
          <Box
            sx={{
              minHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'background.default',
              p: 3,
            }}
          >
            <Card sx={{ maxWidth: 600, width: '100%' }}>
              <CardContent>
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <ErrorIcon 
                    sx={{ 
                      fontSize: 64, 
                      color: 'error.main',
                      mb: 2,
                    }} 
                  />
                  <Typography variant="h4" component="h1" gutterBottom>
                    Oops! Something went wrong
                  </Typography>
                  <Typography 
                    variant="body1" 
                    color="text.secondary" 
                    paragraph
                  >
                    We&apos;re sorry, but something unexpected happened. 
                    The error has been logged and we&apos;ll look into it.
                  </Typography>

                  {process.env.NODE_ENV === 'development' && this.state.error && (
                    <Alert 
                      severity="error" 
                      sx={{ 
                        mt: 2, 
                        mb: 3, 
                        textAlign: 'left',
                        '& pre': {
                          fontSize: '0.875rem',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        },
                      }}
                    >
                      <Typography variant="subtitle2" gutterBottom>
                        Error Details:
                      </Typography>
                      <pre>{this.state.error.toString()}</pre>
                      {this.state.errorInfo && (
                        <>
                          <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>
                            Component Stack:
                          </Typography>
                          <pre>{this.state.errorInfo.componentStack}</pre>
                        </>
                      )}
                    </Alert>
                  )}

                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                    <Button
                      variant="contained"
                      startIcon={<RefreshIcon />}
                      onClick={this.handleReset}
                    >
                      Reload Page
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => window.history.back()}
                    >
                      Go Back
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for functional components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;
  
  return WrappedComponent;
}

export default ErrorBoundary;