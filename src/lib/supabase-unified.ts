import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database';

// Singleton instance to prevent multiple GoTrueClient warnings
let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

// Create unified Supabase client with validated environment variables (singleton pattern)
export const getSupabaseClient = () => {
  if (typeof window === 'undefined') {
    throw new Error('Supabase client should only be used on the client side');
  }

  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables');
      throw new Error('Supabase configuration is missing');
    }

    supabaseInstance = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'airwave-auth-token', // Use specific storage key to avoid conflicts
      },
      global: {
        headers: {
          'x-application-name': 'airwave',
        },
      },
      cookies: {
        get(name: string) {
          return getCookie(name);
        },
        set(name: string, value: string, options: any) {
          setCookie(name, value, options);
        },
        remove(name: string, options: any) {
          removeCookie(name, options);
        },
      },
    });
  }
  return supabaseInstance;
};

// Default export for convenience - use function to avoid SSR issues
export const supabase = () => getSupabaseClient();

// Cookie helpers for browser environment
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift();
  }
  return undefined;
}

function setCookie(name: string, value: string, options: any = {}) {
  if (typeof document === 'undefined') return;

  let cookieString = `${name}=${value}`;

  if (options.maxAge) {
    cookieString += `; Max-Age=${options.maxAge}`;
  }

  if (options.path) {
    cookieString += `; Path=${options.path}`;
  } else {
    cookieString += `; Path=/`;
  }

  if (options.domain) {
    cookieString += `; Domain=${options.domain}`;
  }

  if (options.secure) {
    cookieString += `; Secure`;
  }

  if (options.httpOnly) {
    cookieString += `; HttpOnly`;
  }

  if (options.sameSite) {
    cookieString += `; SameSite=${options.sameSite}`;
  }

  document.cookie = cookieString;
}

function removeCookie(name: string, options: any = {}) {
  setCookie(name, '', { ...options, maxAge: 0 });
}

// Helper function to get user from token with better error handling
export async function getUserFromToken(token: string): Promise<any> {
  if (!token) {
    throw new Error('Token is required');
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getUser(token);

    if (error) {
      console.error('Supabase auth error:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }

    if (!data.user) {
      throw new Error('No user found for provided token');
    }

    return data.user;
  } catch (error: any) {
    console.error('Error getting user from token:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to validate user token');
  }
}

// Helper function to get user profile with better error handling
export async function getUserProfile(userId: string): Promise<any> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('profiles').select('*').eq('id', userId).single();

    if (error) {
      // Handle case where profile doesn't exist
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get user profile: ${error.message}`);
    }

    return data;
  } catch (error: any) {
    console.error('Error getting user profile:', error);
    throw error;
  }
}

// Helper function to get user's client access with better error handling
export async function getUserClients(userId: string): Promise<string[]> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('user_clients')
      .select('client_id')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to get user clients: ${error.message}`);
    }

    return data?.map((uc: { client_id: string }) => uc.client_id) || [];
  } catch (error: any) {
    console.error('Error getting user clients:', error);
    throw error;
  }
}

// Helper to check if user has access to a specific client
export async function userHasClientAccess(userId: string, clientId: string): Promise<boolean> {
  try {
    const userClients = await getUserClients(userId);
    return userClients.includes(clientId);
  } catch (error: any) {
    console.error('Error checking client access:', error);
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
