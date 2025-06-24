import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextApiRequest, NextApiResponse } from 'next';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';
import { validateSupabaseConfig } from './config';
import { loggers } from '@/lib/logger';

// Create a Supabase client for server-side usage with anon key (Pages Router compatible)
export function createServerSupabaseClient(
  req?: NextApiRequest,
  res?: NextApiResponse
): SupabaseClient<Database> {
  const config = validateSupabaseConfig();

  try {
    const client = createServerClient<Database>(
      config.url,
      config.anonKey,
      {
        cookies: {},
          get(name: string) {
            return req?.cookies[name];
          },
          set(name: string, value: string, options: CookieOptions) {
            if (res) {
              try {
                // Use Next.js API response to set cookies
                const cookieValue = `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax`;
                res.setHeader('Set-Cookie', cookieValue);
              } catch (error: any) {
                loggers.supabase.debug('Cookie set from API handler', { name, error });
              }
            }
          },
          remove(name: string, options: CookieOptions) {
            if (res) {
              try {
                // Use Next.js API response to remove cookies
                const cookieValue = `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
                res.setHeader('Set-Cookie', cookieValue);
              } catch (error: any) {
                loggers.supabase.debug('Cookie remove from API handler', { name, error });
              }
            }
          }}}
    );

    return client;
  } catch (error: any) {
    loggers.supabase.error('Failed to create server Supabase client', error);
    throw new Error('Failed to initialize server Supabase client');
  }
}

// Legacy alias for backwards compatibility
export const createClient = createServerSupabaseClient;