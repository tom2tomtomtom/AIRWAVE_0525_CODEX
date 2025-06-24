import { loggers } from '@/lib/logger';

// Supabase configuration types
export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

// Environment variable names
const ENV_VARS = {
  URL: 'NEXT_PUBLIC_SUPABASE_URL',
  ANON_KEY: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  SERVICE_ROLE_KEY: 'SUPABASE_SERVICE_ROLE_KEY'} as const;

// Validate and clean Supabase configuration
export function validateSupabaseConfig(): SupabaseConfig {
  const url = process.env[ENV_VARS.URL];
  const anonKey = process.env[ENV_VARS.ANON_KEY];
  const serviceRoleKey = process.env[ENV_VARS.SERVICE_ROLE_KEY];

  // Validate required fields
  if (!url) {
    throw new Error(`Missing required environment variable: ${ENV_VARS.URL}`);
  }

  if (!anonKey) {
    throw new Error(`Missing required environment variable: ${ENV_VARS.ANON_KEY}`);
  }

  // Validate URL format
  try {
    const urlObj = new URL(url);
    if (!urlObj.protocol.startsWith('https')) {
      throw new Error('Supabase URL must use HTTPS protocol');
    }
  } catch (error: any) {
    throw new Error(`Invalid Supabase URL format: ${url}`);
  }

  // Clean and validate the anon key
  const cleanedAnonKey = anonKey
    .replace(/\s+/g, '')
    .replace(/[\r\n\t]/g, '')
    .trim();

  // Validate JWT format (should have 3 parts separated by dots)
  const jwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
  if (!jwtPattern.test(cleanedAnonKey)) {
    throw new Error('Invalid Supabase anon key format (must be a valid JWT)');
  }

  // Validate service role key if provided
  let cleanedServiceRoleKey: string | undefined;
  if (serviceRoleKey) {
    cleanedServiceRoleKey = serviceRoleKey
      .replace(/\s+/g, '')
      .replace(/[\r\n\t]/g, '')
      .trim();

    if (!jwtPattern.test(cleanedServiceRoleKey)) {
      throw new Error('Invalid Supabase service role key format (must be a valid JWT)');
    }

    // Warn if service role key is used in client-side context
    if (typeof window !== 'undefined') {
      loggers.supabase.error('SECURITY WARNING: Service role key detected in browser context!');
      throw new Error('Service role key must not be used in client-side code');
    }
  }

  return {
    url: url.trim(),
    anonKey: cleanedAnonKey,
    serviceRoleKey: cleanedServiceRoleKey};
}

// Get Supabase URL for public access
export function getSupabaseUrl(): string {
  const config = validateSupabaseConfig();
  return config.url;
}

// Check if we're in a server environment with service role access
export function hasServiceRoleAccess(): boolean {
  return typeof window === 'undefined' && !!process.env[ENV_VARS.SERVICE_ROLE_KEY];
}

// Storage bucket names
export const STORAGE_BUCKETS = {
  ASSETS: 'assets',
  TEMPLATES: 'templates',
  RENDERS: 'renders',
  AVATARS: 'avatars',
  CAMPAIGNS: 'campaigns',
  CAMPAIGN_ASSETS: 'campaign-assets',
  ASSET_THUMBNAILS: 'asset-thumbnails'} as const;

// Default Supabase client options
export const DEFAULT_CLIENT_OPTIONS = {
  auth: {},
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'airwave-auth-token' },
  global: {},
    headers: {},
        'x-application-name': 'airwave'
      }},
  db: {},
    schema: 'public' },
  realtime: {},
    enabled: false }} as const;