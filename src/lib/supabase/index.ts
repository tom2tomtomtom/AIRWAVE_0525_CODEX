// Central export point for all Supabase clients and utilities
export { getSupabaseBrowserClient, resetSupabaseBrowserClient } from './client';
export { createServerSupabaseClient, createClient } from './server';
export { getAdminSupabaseClient, supabaseAdmin } from './admin';
export { validateSupabaseConfig, hasServiceRoleAccess, STORAGE_BUCKETS } from './config';
export { createMiddlewareSupabaseClient } from './middleware';
export {
  handleSupabaseError,
  isAuthError,
  isNetworkError,
  isRateLimitError,
  getErrorMessage} from './errors';
export { withRetry, withTransaction, withRLS, queryWithCache } from './helpers';

// Re-export database types
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
  Updates} from '@/types/database';
