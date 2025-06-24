import React, { useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Box, Typography, Paper, Button, Alert } from '@mui/material';
import { createSupabaseBrowserClient } from '@/utils/supabase-browser';

const TestAuthPage: React.FC = () => {
  const { user, session, isAuthenticated, logout } = useSupabaseAuth();
  const [cookies, setCookies] = useState<string>('');
  const [browserCheck, setBrowserCheck] = useState<any>(null);

  useEffect(() => {
    // Check cookies
    setCookies(document.cookie);

    // Check auth state directly from browser client
    const checkAuthDirectly = async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session  }
        error} = await supabase.auth.getSession();
      setBrowserCheck({ session, error });
    };

    checkAuthDirectly();
  }, [user]);

  return (
    <div>Content</div>
  );
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Auth Debug Page
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Context State
        </Typography>
        <Typography>Is Authenticated: {isAuthenticated ? 'Yes' : 'No'}</Typography>
        <Typography>User Email: {user?.email || 'None'}</Typography>
        <Typography>User ID: {user?.id || 'None'}</Typography>
        <Typography>Session: {session ? 'Present' : 'None'}</Typography>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Browser Check
        </Typography>
        <Typography>Session: {browserCheck?.session ? 'Present' : 'None'}</Typography>
        <Typography>Error: {browserCheck?.error?.message || 'None'}</Typography>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Cookies
        </Typography>
        <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {cookies || 'No cookies found'}
        </Typography>
      </Paper>

      {isAuthenticated && (
        <Button variant="contained" color="primary" onClick={logout}>
          Logout
        </Button>
      )}

      <Alert severity="info" sx={{ mt: 3 }}>
        This page helps debug authentication issues. Check if cookies are being set properly.
      </Alert>
    </Box>
  );
};

export default TestAuthPage;
