import React from 'react';
import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import Head from 'next/head';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CacheProvider, EmotionCache } from '@emotion/react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { SupabaseAuthProvider } from '@/contexts/SupabaseAuthContext';
import { AuthRefreshHandler } from '@/components/AuthRefreshHandler';
import { ClientProvider } from '@/contexts/ClientContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import createEmotionCache from '@/lib/createEmotionCache';
import { getThemeConfig } from '@/styles/theme';
import { ThemeModeProvider, useThemeMode } from '@/contexts/ThemeContext';
import { LoadingProvider } from '@/contexts/LoadingContext';

// Import CSS files in the correct order
import '@/styles/globals.css';

// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();

export interface MyAppProps extends AppProps {
  emotionCache?: EmotionCache;
}

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        return failureCount < 3;
      }
    }
  }
});

// Component that provides all the context providers
function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
       <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <ErrorBoundary>
          <AuthProvider>
            <SupabaseAuthProvider>
              <ClientProvider>
                <NotificationProvider>
                  <AuthRefreshHandler />
                  {children}
                  {/* Temporarily disable React Query DevTools to fix chunk loading errors */}
                  {/* {process.env.NODE_ENV === 'development' && (
                    <ReactQueryDevtools initialIsOpen={false} />
                  )} */}
                </NotificationProvider>
              </ClientProvider>
            </SupabaseAuthProvider>
          </AuthProvider>
        </ErrorBoundary>
      </LocalizationProvider>
    </>
  );
}

// Inner component that uses the theme mode (now safely inside ThemeModeProvider)
function ThemedApp(props: MyAppProps) {
  const { Component, pageProps } = props;
  const { mode } = useThemeMode();
  const theme = getThemeConfig(mode);

  return (
    <ThemeProvider theme={theme}>
      <AppProviders>
        <Component {...pageProps} />
      </AppProviders>
    </ThemeProvider>
  );
}

function MyApp(props: MyAppProps) {
  const { emotionCache = clientSideEmotionCache } = props;

  useEffect(() => {
    // Remove the server-side injected CSS
    const jssStyles = document.querySelector('#jss-server-side');
    if (jssStyles) {
      jssStyles.parentElement?.removeChild(jssStyles);
    }
    
    // Performance optimization: Warm up the browser's DNS cache
    if (typeof window !== 'undefined') {
      const warmupUrls = [
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com'
      ];
      
      warmupUrls.forEach((url: any) => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        document.head.appendChild(link);
      });
    }
  }, []);

  useEffect(() => {
    // App initialization
    if (process.env.NODE_ENV === 'development') {
      // Development-specific initialization
    }
  }, []);

  // Global error handler
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
      // TODO: Send to error tracking service
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      // TODO: Send to error tracking service
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <CacheProvider value={emotionCache}>
      <Head>
        <title>AIrFLOW - AI-Powered Campaign Management</title>
        <meta name="description" content="AI-powered campaign management platform for creating and managing digital marketing assets" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <QueryClientProvider client={queryClient}>
        <ThemeModeProvider>
          <LoadingProvider>
            <ThemedApp {...props} />
          </LoadingProvider>
        </ThemeModeProvider>
      </QueryClientProvider>
    </CacheProvider>
  );
}

export default MyApp;
