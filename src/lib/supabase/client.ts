import { createBrowserClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';
import { validateSupabaseConfig } from './config';
import { loggers } from '@/lib/logger';
import { isDemoMode, getMockSupabaseClient } from '@/lib/demo-mode';

// Singleton instance to prevent multiple GoTrueClient warnings
let browserClientInstance: SupabaseClient<Database> | null = null;

export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  // Check if running on client side
  if (typeof window === 'undefined') {
    throw new Error('Supabase browser client can only be used on the client side');
  }

  // Return existing instance if already created
  if (browserClientInstance) {
    return browserClientInstance;
  }

  // Validate environment variables
  const config = validateSupabaseConfig();

  try {
    // Create new instance with singleton pattern
    browserClientInstance = createBrowserClient<Database>(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'airwave-auth-token',
        storage: window.localStorage,
      },
      global: {
        headers: {
          'x-application-name': 'airwave',
          'x-client-info': 'airwave-web',
        },
      },
      db: {
        schema: 'public',
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });

    loggers.supabase.info('Browser Supabase client initialized');

    if (!browserClientInstance) {
      throw new Error('Failed to create Supabase client instance');
    }

    return browserClientInstance;
  } catch (error: any) {
    loggers.supabase.error('Failed to create browser Supabase client', error);
    throw new Error('Failed to initialize Supabase client. Please check your configuration.');
  }
}

// Get or create the browser client
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (typeof window === 'undefined') {
    throw new Error('Browser Supabase client can only be used in browser environment');
  }

  // Return mock client in demo mode
  if (isDemoMode()) {
    return getMockSupabaseClient() as SupabaseClient<Database>;
  }

  return createSupabaseBrowserClient();
}

// Helper to reset the client instance (useful for testing or logout)
export function resetSupabaseBrowserClient(): void {
  if (browserClientInstance) {
    // Clean up any subscriptions
    browserClientInstance.removeAllChannels();
    browserClientInstance = null;
    loggers.supabase.info('Browser Supabase client reset');
  }
}

// Re-export the main client getter as default
export default getSupabaseBrowserClient;

// Export createClient for consistency with server-side usage
// This is primarily for browser environments
export const createClient = createSupabaseBrowserClient;
