import { useState, useEffect, useCallback } from 'react';

interface CSRFTokenResponse {
  success: boolean;
  token: string;
  message: string;
}

export const useCSRF = () => {
  const [csrfToken, setCSRFToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get CSRF token from the API
  const fetchCSRFToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/auth/csrf-token', {
        method: 'GET',
        credentials: 'include'});

      if (!response.ok) {
        throw new Error(`Failed to get CSRF token: ${response.status}`);
      }

      const data: CSRFTokenResponse = await response.json();
      
      if (data.success && data.token) {
        setCSRFToken(data.token);
        // Store in localStorage for easy access
        localStorage.setItem('csrf_token', data.token);
        return data.token;
      } else {
        throw new Error('Invalid CSRF token response');
      }
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch CSRF token';
      setError(errorMessage);
      console.error('CSRF token fetch error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get token from localStorage or fetch new one
  const getCSRFToken = useCallback(async () => {
    // First try to get from state
    if (csrfToken) {
      return csrfToken;
    }

    // Then try localStorage
    const storedToken = localStorage.getItem('csrf_token');
    if (storedToken) {
      setCSRFToken(storedToken);
      return storedToken;
    }

    // Finally fetch new token
    return await fetchCSRFToken();
  }, [csrfToken, fetchCSRFToken]);

  // Create headers with CSRF token
  const getCSRFHeaders = useCallback(async () => {
    const token = await getCSRFToken();
    if (!token) {
      throw new Error('Unable to get CSRF token');
    }

    return {
      'x-csrf-token': token};
  }, [getCSRFToken]);

  // Make authenticated request with CSRF protection
  const makeCSRFRequest = useCallback(async (
    url: string, 
    options: RequestInit = {}
  ) => {
    const csrfHeaders = await getCSRFHeaders();
    
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {},
        ...csrfHeaders,
        ...options.headers}});
  }, [getCSRFHeaders]);

  // Initialize token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('csrf_token');
    if (storedToken) {
      setCSRFToken(storedToken);
    } else {
      fetchCSRFToken();
    }
  }, [fetchCSRFToken]);

  return {
    csrfToken,
    loading,
    error,
    fetchCSRFToken,
    getCSRFToken,
    getCSRFHeaders,
    makeCSRFRequest};
};

// Utility function for one-off CSRF requests
export const getCSRFToken = async (): Promise<string | null> => {
  try {
    // Try localStorage first
    const storedToken = localStorage.getItem('csrf_token');
    if (storedToken) {
      return storedToken;
    }

    // Fetch new token
    const response = await fetch('/api/auth/csrf-token', {
      method: 'GET',
      credentials: 'include'});

    if (!response.ok) {
      throw new Error(`Failed to get CSRF token: ${response.status}`);
    }

    const data: CSRFTokenResponse = await response.json();
    
    if (data.success && data.token) {
      localStorage.setItem('csrf_token', data.token);
      return data.token;
    }

    return null;
  } catch (error: any) {
    console.error('Error getting CSRF token:', error);
    return null;
  }
};

// Utility function to make CSRF-protected requests
export const makeCSRFRequest = async (
  url: string, 
  options: RequestInit = {}
): Promise<Response> => {
  const token = await getCSRFToken();
  
  if (!token) {
    throw new Error('Unable to get CSRF token');
  }

  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {},
        'x-csrf-token': token,
      ...options.headers
      }});
};
