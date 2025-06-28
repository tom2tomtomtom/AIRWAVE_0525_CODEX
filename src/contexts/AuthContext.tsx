import { getErrorMessage } from '@/utils/errorUtils';
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/router';

interface User {
  id: string;
  email: string;
  role?: string;
  name: string;
  token?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
  isAuthenticated: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check if user is authenticated on initial load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check localStorage for existing session
        if (typeof window !== 'undefined') {
          const storedUser = localStorage.getItem('airwave_user');
          if (storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              // Validate the stored user has required fields
              if (parsedUser.id && parsedUser.email && parsedUser.name) {
                setUser(parsedUser);
              } else {
                // Invalid stored user, remove it
                localStorage.removeItem('airwave_user');
              }
            } catch (parseError) {
              console.error('Error parsing stored user:', parseError);
              localStorage.removeItem('airwave_user');
            }
          }
        }
      } catch (error) {
        const _message = getErrorMessage(error);
        if (process.env.NODE_ENV === 'development') {
          console.error('Authentication error:', error);
        }
        if (typeof window !== 'undefined') {
          localStorage.removeItem('airwave_user');
        }
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Auth check timeout, setting loading to false');
      }
      setLoading(false);
    }, 5000); // 5 second timeout

    checkAuth().finally(() => {
      clearTimeout(timeoutId);
    });

    // Cleanup timeout on component unmount
    return () => clearTimeout(timeoutId);
  }, []);

  // Login function using API
  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      // Call the login API endpoint
      const response = await fetch('/api/auth/login-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Login failed');
      }

      if (data.success && data.user) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('airwave_user', JSON.stringify(data.user));
        }
        setUser(data.user);

        // Don't redirect here - let the login page handle it to avoid middleware loops
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      const _message = getErrorMessage(error);
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Signup function using API
  const signup = async (email: string, password: string, name: string) => {
    setLoading(true);
    try {
      // Call the signup API endpoint
      const response = await fetch('/api/auth/signup-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Throw the actual error from the API
        throw new Error(data.error || data.message || 'Signup failed');
      }

      // Check if email confirmation is required
      if (data.message && data?.message?.includes('check your email')) {
        // Don't log the user in, just show the message
        throw new Error(data.message);
      }

      if (data.success && data.user) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('airwave_user', JSON.stringify(data.user));
        }
        setUser(data.user);

        // Redirect to dashboard after signup
        router.push('/dashboard');
      } else if (data.success && data.message) {
        // Success but with a message (like email confirmation)
        throw new Error(data.message);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      const _message = getErrorMessage(error);
      console.error('Signup error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('airwave_user');
      localStorage.removeItem('airwave_active_client');
      localStorage.removeItem('airwave_clients');
    }
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
