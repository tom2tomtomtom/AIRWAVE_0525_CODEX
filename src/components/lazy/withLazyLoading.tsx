import React, { ComponentType, Suspense, Component, ReactNode } from 'react';
import { Box, Skeleton, Typography, Alert, Button } from '@mui/material';

interface LazyPageOptions {
  fallbackHeight?: number;
  errorMessage?: string;
  loadingMessage?: string;
  enableErrorBoundary?: boolean;
}

// Simple Error Boundary implementation
class SimpleErrorBoundary extends Component<
  { children: ReactNode; fallback: ComponentType<any>; onReset?: () => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Lazy loading error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback;
      return (
        <FallbackComponent 
          error={this.state.error} 
          resetErrorBoundary={() => {
            this.setState({ hasError: false });
            this.props.onReset?.();
          }} 
        />
      );
    }

    return this.props.children;
  }
}

// Error fallback component for lazy loaded pages
const LazyPageErrorFallback = ({ 
  error, 
  resetErrorBoundary, 
  errorMessage = 'Failed to load page' 
}: any) => (
  <Box sx={{ p: 3 }}>
    <Alert 
      severity="error" 
      action={
        <Button onClick={resetErrorBoundary} size="small">
          Retry
        </Button>
      }
    >
      {errorMessage}: {error?.message || 'Unknown error'}
    </Alert>
  </Box>
);

// Loading fallback component for lazy loaded pages
const LazyPageLoadingFallback = ({ 
  height = 400, 
  message = 'Loading page...' 
}: { 
  height?: number; 
  message?: string; 
}) => (
  <Box sx={{ p: 3 }}>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      {message}
    </Typography>
    <Skeleton variant="rounded" height={height} sx={{ width: '100%', borderRadius: 2 }} />
  </Box>
);

/**
 * Higher-order component for adding lazy loading capabilities to pages
 * Wraps pages with Suspense, error boundaries, and loading states
 */
export function withLazyLoading<T extends object>(
  WrappedComponent: ComponentType<T>,
  options: LazyPageOptions = {}
) {
  const {
    fallbackHeight = 400,
    errorMessage = 'Failed to load page',
    loadingMessage = 'Loading page...',
    enableErrorBoundary = true,
  } = options;

  const LazyWrappedComponent = React.forwardRef<any, T>((props, ref) => {
    const content = (
      <Suspense 
        fallback={
          <LazyPageLoadingFallback 
            height={fallbackHeight} 
            message={loadingMessage} 
          />
        }
      >
        <WrappedComponent {...props} ref={ref} />
      </Suspense>
    );

    if (enableErrorBoundary) {
      return (
        <SimpleErrorBoundary
          fallback={(errorProps) => 
            <LazyPageErrorFallback {...errorProps} errorMessage={errorMessage} />
          }
          onReset={() => window.location.reload()}
        >
          {content}
        </SimpleErrorBoundary>
      );
    }

    return content;
  });

  LazyWrappedComponent.displayName = `withLazyLoading(${WrappedComponent.displayName || WrappedComponent.name})`;

  return LazyWrappedComponent;
}

/**
 * Utility for creating lazy pages with consistent error handling
 */
export const createLazyPage = <T extends object>(
  importFunction: () => Promise<{ default: ComponentType<T> }>,
  options: LazyPageOptions = {}
) => {
  const LazyComponent = React.lazy(importFunction);
  return withLazyLoading(LazyComponent, options);
};

/**
 * Predefined lazy page configurations for common page types
 */
export const LAZY_PAGE_CONFIGS = {
  AI_FEATURE: {
    fallbackHeight: 500,
    loadingMessage: 'Loading AI features...',
    errorMessage: 'Failed to load AI features',
  },
  ANALYTICS: {
    fallbackHeight: 600,
    loadingMessage: 'Loading analytics dashboard...',
    errorMessage: 'Failed to load analytics',
  },
  WORKFLOW: {
    fallbackHeight: 400,
    loadingMessage: 'Loading workflow...',
    errorMessage: 'Failed to load workflow',
  },
  ADMIN: {
    fallbackHeight: 500,
    loadingMessage: 'Loading admin panel...',
    errorMessage: 'Failed to load admin features',
  },
  CONTENT_CREATION: {
    fallbackHeight: 450,
    loadingMessage: 'Loading content tools...',
    errorMessage: 'Failed to load content features',
  },
} as const;

/**
 * Component for lazy loading modal/dialog content
 */
export const LazyModalContent: React.FC<{
  children: React.ReactNode;
  height?: number;
}> = ({ children, height = 300 }) => (
  <Suspense 
    fallback={
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rounded" height={height} sx={{ width: '100%' }} />
      </Box>
    }
  >
    <SimpleErrorBoundary
      fallback={() => (
        <Alert severity="error" sx={{ m: 2 }}>
          Failed to load modal content
        </Alert>
      )}
    >
      {children}
    </SimpleErrorBoundary>
  </Suspense>
);