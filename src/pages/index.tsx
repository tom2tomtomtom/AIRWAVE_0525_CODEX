import React from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { Box, Button, Typography, Container } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import DemoNotice from '@/components/DemoNotice';

const HomePage = () => {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    // Redirect authenticated users to dashboard
    if (!loading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [router, isAuthenticated, loading]);

  // Show loading while checking auth
  if (loading) {
    return (
      <Box
        className="loading-container"
        display="flex"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        sx={{
          backgroundColor: 'var(--carbon-bg-primary)',
          color: 'var(--carbon-text-primary)',
        }}
      >
        <Typography sx={{ color: 'var(--carbon-text-primary)' }}>Loading...</Typography>
      </Box>
    );
  }

  // Show landing page if not authenticated
  if (!isAuthenticated) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: 'var(--carbon-bg-primary)' }}>
        {/* Navigation Header */}
        <Box
          component="nav"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 4,
            py: 2,
            borderBottom: 1,
            borderColor: 'divider',
            backgroundColor: 'background.paper',
          }}
        >
          <Typography
            variant="h5"
            component="div"
            sx={{ fontWeight: 'bold', color: 'var(--carbon-amber-main)', cursor: 'pointer' }}
            onClick={() => router.push('/')}
          >
            AIrFLOW
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" onClick={() => router.push('/login')}>
              Sign In
            </Button>
            <Button variant="contained" onClick={() => router.push('/login')}>
              Get Started
            </Button>
          </Box>
        </Box>

        {/* Hero Section */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'calc(100vh - 80px)',
            px: 4,
          }}
        >
          <Container maxWidth="md">
            <DemoNotice />
            <Box sx={{ textAlign: 'center' }}>
              <Typography
                variant="h2"
                component="h1"
                gutterBottom
                sx={{
                  fontWeight: 'bold',
                  color: 'var(--carbon-amber-main)',
                  mb: 3,
                  fontSize: { xs: '2.5rem', md: '3.5rem' },
                }}
              >
                Scale Creative, Unleash Impact
              </Typography>
              <Typography variant="h5" color="textSecondary" sx={{ mb: 4, fontWeight: 400 }}>
                AI-Powered Campaign Management Platform
              </Typography>
              <Typography
                variant="body1"
                color="textSecondary"
                sx={{ mb: 6, fontSize: '1.2rem', maxWidth: '600px', mx: 'auto' }}
              >
                Create high-performing, scalable ad executions tailored to customer motivations at
                lightning speed. Transform your creative workflow with AIrWAVE 2.0.
              </Typography>

              {/* Feature Highlights */}
              <Box
                sx={{ display: 'flex', justifyContent: 'center', gap: 4, mb: 6, flexWrap: 'wrap' }}
              >
                <Box sx={{ textAlign: 'center' }}>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 600, color: 'var(--carbon-amber-main)' }}
                  >
                    AI-Powered
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Intelligent content generation
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 600, color: 'var(--carbon-amber-main)' }}
                  >
                    Scalable
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Create hundreds of variations
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 600, color: 'var(--carbon-amber-main)' }}
                  >
                    Fast
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Lightning-speed execution
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => router.push('/login')}
                  sx={{ px: 6, py: 1.5, fontSize: '1.1rem' }}
                >
                  Start Creating Now
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => router.push('/login')}
                  sx={{ px: 6, py: 1.5, fontSize: '1.1rem' }}
                >
                  Learn More
                </Button>
              </Box>
            </Box>
          </Container>
        </Box>
      </Box>
    );
  }

  // Redirecting if authenticated
  return (
    <Box
      className="loading-container"
      display="flex"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      sx={{
        backgroundColor: 'var(--carbon-bg-primary)',
        color: 'var(--carbon-text-primary)',
      }}
    >
      <Typography sx={{ color: 'var(--carbon-text-primary)' }}>
        Redirecting to dashboard...
      </Typography>
    </Box>
  );
};

export default HomePage;
