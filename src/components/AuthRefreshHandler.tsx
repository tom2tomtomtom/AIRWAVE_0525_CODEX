import { useEffect, useRef } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { loggers } from '@/lib/logger';


/**
 * Component to handle automatic token refresh
 * Should be included in _app.tsx to run on all pages
 */
export function AuthRefreshHandler(): null {
  const { session, refreshSession } = useSupabaseAuth();
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!session) {
      // Clear any existing refresh timer
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      return undefined;
    }

    // Calculate when to refresh (5 minutes before expiry)
    const expiresAt = session.expires_at;
    if (!expiresAt) return undefined;

    const expiryTime = expiresAt * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const timeUntilExpiry = expiryTime - currentTime;
    const refreshTime = timeUntilExpiry - 5 * 60 * 1000; // 5 minutes before expiry

    // If token expires in less than 5 minutes, refresh immediately
    if (refreshTime <= 0) {
      process.env.NODE_ENV === 'development' && refreshSession();
      return undefined;
    }

    // Schedule refresh
    process.env.NODE_ENV === 'development' &&
      loggers.general.error(`Scheduling token refresh in ${Math.round(refreshTime / 1000 / 60)} minutes`);

    refreshTimerRef.current = setTimeout(async () => {
      process.env.NODE_ENV === 'development' && loggers.general.error('Refreshing session...');
      const result = await refreshSession();

      if (result.success) {
        process.env.NODE_ENV === 'development' && loggers.general.error('Session refreshed successfully');
      } else {
        console.error('Failed to refresh token:', result.error);
      }
    }, refreshTime);

    // Cleanup on unmount or session change
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [session, refreshSession]);

  // Also listen for visibility changes to refresh when tab becomes active
  useEffect(() => {
    const handleVisibilityChange = async (): Promise<void> => {
      if (document.visibilityState === 'visible' && session) {
        // Check if token needs refresh
        const expiresAt = session.expires_at;
        if (!expiresAt) return;

        const expiryTime = expiresAt * 1000;
        const currentTime = Date.now();
        const timeUntilExpiry = expiryTime - currentTime;

        // Refresh if less than 10 minutes until expiry
        if (timeUntilExpiry < 10 * 60 * 1000) {
          process.env.NODE_ENV === 'development' && (await refreshSession());
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session, refreshSession]);

  // No UI needed
  return null;
}
