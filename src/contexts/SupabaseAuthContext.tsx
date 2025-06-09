import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { User, Session } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/utils/supabase-browser';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
}

interface SupabaseAuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string; user?: User }>;
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

// Create the Supabase client once, outside of the component
const supabaseClient = createSupabaseBrowserClient();

export const SupabaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    isAuthenticated: false,
  });
  const router = useRouter();

  useEffect(() => {
    // Check active session
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
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
      } catch (error) {
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
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        process.env.NODE_ENV === 'development' && console.log('Auth state changed:', event);
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
          process.env.NODE_ENV === 'development' && console.log('Token refreshed');
        } else if (event === 'USER_UPDATED') {
          process.env.NODE_ENV === 'development' && console.log('User updated');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        // Force a session refresh to ensure cookies are properly set
        await supabaseClient.auth.refreshSession();
        
        // The onAuthStateChange listener will update the state
        // Just return success here
        return { success: true };
      }

      throw new Error('No session returned from login');
    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  const signup = async (email: string, password: string, name: string) => {
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

      return { success: true, user: data.user };
    } catch (error: any) {
      console.error('Signup error:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      
      // The onAuthStateChange listener will handle the state update and redirect
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refreshSession = async () => {
    try {
      const { data: { session }, error } = await supabaseClient.auth.refreshSession();
      
      if (error) throw error;
      
      if (session) {
        return { success: true };
      }
      
      return { success: false };
    } catch (error: any) {
      console.error('Session refresh error:', error);
      return { success: false, error: error.message };
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