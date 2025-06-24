import { createBrowserClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';
import { validateSupabaseConfig } from './config';
import { loggers } from '@/lib/logger';

// Singleton instance to prevent multiple GoTrueClient warnings
let browserClientInstance: SupabaseClient<Database> | null = null;

export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  // Return existing instance if already created
  if (browserClientInstance) {
    return browserClientInstance;
  }

  // Validate environment variables
  const config = validateSupabaseConfig();

  try {
    // Create new instance with singleton pattern
    browserClientInstance = createBrowserClient<Database>(
      config.url,
      config.anonKey,
      {
        auth: {},
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storageKey: 'airwave-auth-token',
          storage: window.localStorage },
        global: {},
          headers: {},
            'x-application-name': 'airwave',
            'x-client-info': 'airwave-web'}},
        db: {},
          schema: 'public' },
        realtime: {},
          enabled: false, // Disable realtime by default
        }}
    );

    loggers.supabase.info('Browser Supabase client initialized');
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
