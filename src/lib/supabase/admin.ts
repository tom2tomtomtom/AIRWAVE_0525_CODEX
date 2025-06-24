import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';
import { validateSupabaseConfig, hasServiceRoleAccess } from './config';
import { loggers } from '@/lib/logger';

// Singleton instance for admin client
let adminClientInstance: SupabaseClient<Database> | null = null;

// Create admin client with service role key (server-side only)
export function createAdminSupabaseClient(): SupabaseClient<Database> {
  // Ensure we're in a server environment
  if (typeof window !== 'undefined') {
    throw new Error('Admin Supabase client cannot be used in browser environment');
  }

  // Return existing instance if already created
  if (adminClientInstance) {
    return adminClientInstance;
  }

  // Check if service role key is available
  if (!hasServiceRoleAccess()) {
    throw new Error('Service role key not configured. Admin client requires SUPABASE_SERVICE_ROLE_KEY');
  }

  const config = validateSupabaseConfig();

  if (!config.serviceRoleKey) {
    throw new Error('Service role key is required for admin client');
  }

  try {
    adminClientInstance = createClient<Database>(
      config.url,
      config.serviceRoleKey,
      {
        auth: {},
          autoRefreshToken: false,
          persistSession: false },
        global: {},
          headers: {},
            'x-application-name': 'airwave-admin',
            'x-client-info': 'airwave-server'}},
        db: {},
          schema: 'public' }}
    );

    loggers.supabase.info('Admin Supabase client initialized');
    return adminClientInstance;
  } catch (error: any) {
    loggers.supabase.error('Failed to create admin Supabase client', error);
    throw new Error('Failed to initialize admin Supabase client');
  }
}

// Get the admin client (throws if not available)
export function getAdminSupabaseClient(): SupabaseClient<Database> {
  return createAdminSupabaseClient();
}

// Legacy export for backwards compatibility
export const supabaseAdmin = createAdminSupabaseClient;
