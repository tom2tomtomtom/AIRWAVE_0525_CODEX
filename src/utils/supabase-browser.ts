// Re-export from the consolidated module
export {
  createSupabaseBrowserClient,
  getSupabaseBrowserClient,
  resetSupabaseBrowserClient} from '@/lib/supabase/client';

// Default export for backward compatibility
export { getSupabaseBrowserClient as default } from '@/lib/supabase/client';
