// This file provides a unified interface for Supabase clients
// It replaces the previous implementation with better error handling and validation

import { getSupabaseBrowserClient } from './supabase/client';
import { createServerSupabaseClient } from './supabase/server';
import { getAdminSupabaseClient } from './supabase/admin';
import { Database } from '@/types/database';
import { handleSupabaseError } from './supabase/errors';
import { withRetry, queryWithCache } from './supabase/helpers';
import { loggers } from './logger';

// Export the primary client getter based on environment
export const supabase = typeof window !== 'undefined' ? getSupabaseBrowserClient() : null; // Server components should use createServerSupabaseClient

// Re-export essential functions from the new module structure
export {
  getSupabaseBrowserClient,
} from './supabase/client';
export {
  createServerSupabaseClient,
} from './supabase/server';
export {
  getAdminSupabaseClient,
} from './supabase/admin';
export {
  validateSupabaseConfig,
  hasServiceRoleAccess,
} from './supabase/config';

// Legacy function - Get service role client (server-side only)
export const getServiceSupabase = () => {
  loggers.supabase.warn('getServiceSupabase is deprecated. Use getAdminSupabaseClient instead.');
  return getAdminSupabaseClient();
};

// Helper function to get user from token with better error handling
export async function getUserFromToken(
  token: string
): Promise<Database['public']['Tables']['profiles']['Row']> {
  if (!token) {
    throw new Error('Token is required');
  }

  try {
    // Use server client for token validation
    const client =
      typeof window === 'undefined'
        ? await createServerSupabaseClient()
        : getSupabaseBrowserClient();

    const { data, error } = await client.auth.getUser(token);

    if (error) {
      loggers.auth.error('Supabase auth error', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }

    if (!data.user) {
      throw new Error('No user found for provided token');
    }

    return data.user as any; // Type assertion for compatibility
  } catch (error: any) {
    await handleSupabaseError(error, {
      operation: 'getUserFromToken',
      metadata: { hasToken: !!token  }
    });
    throw error;
  }
}

// Helper function to get user profile with better error handling
export async function getUserProfile(
  userId: string
): Promise<Database['public']['Tables']['profiles']['Row'] | null> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  return withRetry(async () => {
    const client =
      typeof window === 'undefined'
        ? await createServerSupabaseClient()
        : getSupabaseBrowserClient();

    const { data, error } = await client.from('profiles').select('*').eq('id', userId).single();

    if (error) {
      // Handle case where profile doesn't exist
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  });
}

// Helper function to get user's client access with better error handling
export async function getUserClients(userId: string): Promise<string[]> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  return queryWithCache(
    `user-clients:${userId}`,
    async () => {
      const client =
        typeof window === 'undefined'
          ? await createServerSupabaseClient()
          : getSupabaseBrowserClient();

      const { data, error } = await client
        .from('user_clients')
        .select('client_id')
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      return data?.map((uc: { client_id: string }) => uc.client_id) || [];
    },
    { ttl: 300 } // Cache for 5 minutes
  );
}

// Helper to check if user has access to a specific client
export async function userHasClientAccess(userId: string, clientId: string): Promise<boolean> {
  try {
    const userClients = await getUserClients(userId);
    return userClients.includes(clientId);
  } catch (error: any) {
    loggers.db.error('Error checking client access', error, { userId, clientId });
    return false;
  }
}

// Re-export types from database.ts
export type { Database } from '@/types/database';
export type {
  Analytics,
  ApprovalComment,
  ApprovalWorkflow,
  Approval,
  Asset,
  Brief,
  CampaignAnalytics,
  Client,
  ClientContact,
  ContentVariation,
  CopyAsset,
  CopyText,
  Execution,
  GeneratedContent,
  Matrix,
  Motivation,
  PlatformIntegration,
  Profile,
  SelectedMotivation,
  Strategy,
  StrategyMotivation,
  Template,
  UserClient,
  Tables,
  Inserts,
  Updates,
} from '@/types/database';
