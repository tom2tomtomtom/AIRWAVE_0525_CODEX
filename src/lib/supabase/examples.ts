// import { getErrorMessage } from '@/utils/errorUtils'; // Using getErrorMessage from supabase/errors instead
/**
 * Example usage patterns for the new Supabase integration
 * These examples demonstrate best practices for different scenarios
 */

import {
  getSupabaseBrowserClient,
  createServerSupabaseClient,
  getAdminSupabaseClient,
} from '@/lib/supabase';
import { handleSupabaseError, getErrorMessage, isAuthError } from '@/lib/supabase/errors';
import { loggers } from '@/lib/logger';
import {
  withRetry,
  queryWithCache,
  paginatedQuery,
  upsertWithConflict,
} from '@/lib/supabase/helpers';

// ============================================
// Client Component Example
// ============================================
export async function ClientComponentExample() {
  const supabase = getSupabaseBrowserClient();

  try {
    // Simple query with error handling
    const { data, error } = await supabase.from('clients').select('*').eq('is_active', true);

    if (error) throw error;
    return data;
  } catch (error: any) {
    // User-friendly error message
    const message = getErrorMessage(error);
    console.error('Failed to fetch clients:', message);
    throw new Error(message);
  }
}

// ============================================
// Server Component Example
// ============================================
export async function ServerComponentExample() {
  const supabase = createServerSupabaseClient();

  // Using retry for resilience
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('campaigns')
      .select(
        `
        *,
        client:clients(name, logo_url),
        executions(count)
      `
      )
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  });
}

// ============================================
// API Route Example (with admin access)
// ============================================
export async function APIRouteExample(userId: string) {
  const supabase = getAdminSupabaseClient();

  try {
    // Admin operations bypass RLS
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      await handleSupabaseError(profileError, {
        operation: 'fetchProfile',
        table: 'profiles',
        userId,
      });
    }

    // Batch operation with conflict handling
    const updates = await upsertWithConflict(
      supabase,
      'profiles',
      [
        { id: userId, first_name: 'Test', last_name: 'User' }
      ],
      {
        onConflict: 'user_id,key',
        ignoreDuplicates: false
      }
    );

    return { profile, settings: updates };
  } catch (error: any) {
    // Error is already logged by handleSupabaseError
    throw error;
  }
}

// ============================================
// Cached Query Example
// ============================================
export async function CachedQueryExample(clientId: string) {
  return queryWithCache(
    `client:${clientId}:assets`,
    async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    { ttl: 600 } // Cache for 10 minutes
  );
}

// ============================================
// Paginated Query Example
// ============================================
export async function PaginatedQueryExample(page: number = 1) {
  const supabase = getSupabaseBrowserClient();

  return paginatedQuery(supabase, 'briefs', {
    page,
    pageSize: 20,
    orderBy: 'created_at',
    ascending: false });
}

// ============================================
// Authentication Flow Example
// ============================================
export async function AuthenticationExample(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();

  try {
    // Sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (isAuthError(error)) {
        // Special handling for auth errors
        if (error.message.includes('Email not confirmed')) {
          return {
            success: false,
            needsVerification: true,
            message: 'Please verify your email before signing in'
          };
        }
      }
      throw error;
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return {
      success: true,
      user: data.user,
      profile,
      session: data.session
    };
  } catch (error: any) {
    await handleSupabaseError(error, {
      operation: 'signIn',
      metadata: { email }
    });
    return {
      success: false,
      message: 'Sign in failed'
    };
  }
}

// ============================================
// File Upload Example
// ============================================
export async function FileUploadExample(file: File, bucket: string) {
  const supabase = getSupabaseBrowserClient();

  try {
    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    // Upload file
    const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

    return {
      url: data.publicUrl,
      path: filePath
    };
  } catch (error: any) {
    await handleSupabaseError(error, {
      operation: 'fileUpload',
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        bucket,
      },
    });
    throw error;
  }
}

// ============================================
// Realtime Subscription Example
// ============================================
export function RealtimeSubscriptionExample(campaignId: string, onUpdate: (payload: any) => void) {
  const supabase = getSupabaseBrowserClient();

  // Subscribe to changes
  const channel = supabase
    .channel(`campaign:${campaignId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'executions',
        filter: `campaign_id=eq.${campaignId}`
      },
      (payload: any) => {
        loggers.general.error('Execution update:', payload);
        onUpdate(payload);
      }
    )
    .subscribe();

  // Return cleanup function
  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================
// Complex Transaction Example (when available)
// ============================================
export async function ComplexOperationExample(clientId: string, campaignData: any) {
  const supabase = createServerSupabaseClient();

  try {
    // Note: Supabase doesn't support transactions in JS client yet
    // This is how it would work when available:
    /*
    return withTransaction(supabase, async (tx) => {
      // Create campaign
      const { data: campaign } = await tx
        .from('campaigns')
        .insert({ ...campaignData, client_id: clientId })
        .select()
        .single();
        
      // Create initial execution
      await tx
        .from('executions')
        .insert({
          campaign_id: campaign.id,
          status: 'draft'
        });
        
      return campaign;
    });
    */

    // For now, use manual error handling
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({ ...campaignData, client_id: clientId })
      .select()
      .single();

    if (campaignError) throw campaignError;

    const { error: executionError } = await supabase.from('executions').insert({
      campaign_id: campaign.id,
      status: 'draft'
    });

    if (executionError) {
      // Rollback by deleting the campaign
      await supabase.from('campaigns').delete().eq('id', campaign.id);
      throw executionError;
    }

    return campaign;
  } catch (error: any) {
    await handleSupabaseError(error, {
      operation: 'createCampaign',
      table: 'campaigns',
      metadata: { clientId }
    });
  }
}
