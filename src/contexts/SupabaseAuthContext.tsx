import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { User, Session } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { loggers } from '@/lib/logger';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
}

interface SupabaseAuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (
    email: string,
    password: string,
    name: string
  ) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<{ success: boolean; error?: string }>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAuthenticated: false,
  login: async () => ({ success: false }),
  signup: async () => ({ success: false }),
  logout: async () => {},
  refreshSession: async () => ({ success: false }),
});
export const useSupabaseAuth = () => {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
};

export const SupabaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    isAuthenticated: false,
  });
  const [supabaseClient, setSupabaseClient] = useState<ReturnType<
    typeof createSupabaseBrowserClient
  > | null>(null);
  const router = useRouter();

  // Initialize Supabase client only on the client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const client = createSupabaseBrowserClient();
        setSupabaseClient(client);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to initialize Supabase client:', error);
        setAuthState(prev => ({ ...prev, loading: false }));
      }
    }
  }, []);

  useEffect(() => {
    // Check active session only after client is initialized
    if (!supabaseClient) return;

    const checkSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabaseClient.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          setAuthState({
            user: null,
            session: null,
            loading: false,
            isAuthenticated: false,
          });
          return;
        }

        if (session) {
          setAuthState({
            user: session.user,
            session,
            loading: false,
            isAuthenticated: true,
          });

          // Store user data in localStorage for compatibility with other parts of the app
          if (typeof window !== 'undefined' && session.user) {
            const userData = {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
              token: session.access_token,
              role: session.user.user_metadata?.role || 'user',
            };
            localStorage.setItem('airwave_user', JSON.stringify(userData));
          }
        } else {
          setAuthState({
            user: null,
            session: null,
            loading: false,
            isAuthenticated: false,
          });

          // Clear localStorage when logged out
          if (typeof window !== 'undefined') {
            localStorage.removeItem('airwave_user');
          }
        }
      } catch (error: unknown) {
        console.error('Session check error:', error);
        setAuthState({
          user: null,
          session: null,
          loading: false,
          isAuthenticated: false,
        });
      }
    };

    checkSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
      process.env.NODE_ENV === 'development' && loggers.general.error('Auth state changed:', event);
      if (session) {
        setAuthState({
          user: session.user,
          session,
          loading: false,
          isAuthenticated: true,
        });

        // Store user data in localStorage for compatibility with other parts of the app
        if (typeof window !== 'undefined' && session.user) {
          const userData = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            token: session.access_token,
            role: session.user.user_metadata?.role || 'user',
          };
          localStorage.setItem('airwave_user', JSON.stringify(userData));
        }
      } else {
        setAuthState({
          user: null,
          session: null,
          loading: false,
          isAuthenticated: false,
        });

        // Clear localStorage when logged out
        if (typeof window !== 'undefined') {
          localStorage.removeItem('airwave_user');
        }
      }

      // Handle auth events
      if (event === 'SIGNED_OUT') {
        router.push('/login');
      } else if (event === 'TOKEN_REFRESHED') {
        process.env.NODE_ENV === 'development' && loggers.general.error('Token refreshed');
      } else if (event === 'USER_UPDATED') {
        process.env.NODE_ENV === 'development' && loggers.general.error('User updated');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabaseClient]);

  const login = async (email: string, password: string) => {
    if (!supabaseClient) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      // Validate inputs before making the call
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      if (!email.includes('@')) {
        throw new Error('Invalid email format');
      }

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });
      if (error) {
        console.error('Supabase auth error:', error);
        throw error;
      }

      if (data.session) {
        // Don't force refresh - let the auth state change handler manage it
        return { success: true };
      }

      throw new Error('No session returned from login');
    } catch (error: unknown) {
      console.error('Login error:', error);
      return {
        success: false,
        error:
          (error instanceof Error ? error.message : 'Login failed') ||
          'Login failed. Please try again.',
      };
    }
  };

  const signup = async (
    email: string,
    password: string,
    name: string
  ): Promise<{ success: boolean; error?: string; user?: User }> => {
    if (!supabaseClient) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role: 'authenticated',
          },
        },
      });
      if (error) throw error;

      return {
        success: true,
        ...(data.user && { user: data.user }),
      };
    } catch (error: unknown) {
      console.error('Signup error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Signup failed' };
    }
  };

  const logout = async () => {
    if (!supabaseClient) {
      return;
    }

    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;

      // The onAuthStateChange listener will handle the state update and redirect
    } catch (error: unknown) {
      console.error('Logout error:', error);
    }
  };

  const refreshSession = async () => {
    if (!supabaseClient) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const {
        data: { session },
        error,
      } = await supabaseClient.auth.refreshSession();

      if (error) throw error;

      if (session) {
        return { success: true };
      }

      return { success: false };
    } catch (error: unknown) {
      console.error('Session refresh error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Session refresh failed',
      };
    }
  };

  return (
    <SupabaseAuthContext.Provider
      value={{
        ...authState,
        login,
        signup,
        logout,
        refreshSession,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
};
