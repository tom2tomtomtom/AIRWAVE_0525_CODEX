/**
 * Demo Mode Configuration for AIRWAVE Platform
 * Handles graceful degradation when external services are unavailable
 */

export const isDemoMode = () => {
  return (
    process.env.DEMO_MODE === 'true' ||
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('your-project')
  );
};

export const isAuthDisabled = () => {
  return (
    process.env.DISABLE_AUTH === 'true' ||
    process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true' ||
    isDemoMode()
  );
};

export const getDemoUser = () => ({
  id: 'demo-user-123',
  email: 'demo@airwave.com',
  name: 'Demo User',
  role: 'user',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const getDemoClient = () => ({
  id: 'demo-client-123',
  name: 'Demo Corporation',
  email: 'contact@demo.com',
  website: 'https://demo.com',
  industry: 'Technology',
  status: 'active',
  primaryColor: '#3B82F6',
  secondaryColor: '#10B981',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const getMockSupabaseClient = () => ({
  auth: {
    signInWithPassword: async () => ({
      data: { user: getDemoUser(), session: { access_token: 'demo-token' } },
      error: null,
    }),
    signUp: async () => ({
      data: { user: getDemoUser(), session: { access_token: 'demo-token' } },
      error: null,
    }),
    signOut: async () => ({ error: null }),
    getSession: async () => ({
      data: { session: { access_token: 'demo-token' } },
      error: null,
    }),
    getUser: async () => ({
      data: { user: getDemoUser() },
      error: null,
    }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: getDemoClient(),
          error: null,
        }),
        maybeSingle: async () => ({
          data: getDemoClient(),
          error: null,
        }),
      }),
    }),
    insert: async () => ({
      data: [getDemoClient()],
      error: null,
    }),
    update: async () => ({
      data: [getDemoClient()],
      error: null,
    }),
    delete: async () => ({
      data: [],
      error: null,
    }),
  }),
});

export const demoConfig = {
  showDemoNotice: true,
  disableExternalAPIs: true,
  mockData: true,
  features: {
    auth: false,
    ai: false,
    video: false,
    social: false,
    payments: false,
  },
};
