import React from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Chip,
  Alert,
  Grid} from '@mui/material';
import {
  Image as ImageIcon,
  Description as DescriptionIcon,
  Campaign as CampaignIcon,
  AutoAwesome as AIIcon,
  ArrowForward,
  Add,
  Business as BusinessIcon} from '@mui/icons-material';
import DashboardLayout from '@/components/DashboardLayout';
import { AnimatedActionButton } from '@/components/AnimatedComponents';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useClient } from '@/contexts/ClientContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface QuickAction {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  href: string;
}

const DashboardPage = () => {
  const router = useRouter();
  const { user } = useSupabaseAuth();
  const { activeClient } = useClient();

  // Quick actions for easy navigation
  const quickActions: QuickAction[] = [
    {
      title: 'Generate AI Content',
      description: 'Create images, copy, and videos with AI',
      icon: <AIIcon />,
      color: '#9c27b0',
      href: '/generate-enhanced' },
    {
      title: 'Browse Templates',
      description: 'Start from pre-built templates',
      icon: <DescriptionIcon />,
      color: '#2196f3',
      href: '/templates' },
    {
      title: 'Content Matrix',
      description: 'Plan your content strategy',
      icon: <CampaignIcon />,
      color: '#4caf50',
      href: '/matrix' },
    {
      title: 'Asset Library',
      description: 'Manage your digital assets',
      icon: <ImageIcon />,
      color: '#ff9800',
      href: '/assets' },
  ];

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <Head>
          <title>Dashboard | AIrFLOW</title>
        </Head>
        <Container maxWidth="lg">
          {/* Welcome Section */}
          <Box mb={4}>
            <Typography variant="h4" gutterBottom>
              Welcome back, {user?.user_metadata?.name || user?.email || 'User'}!
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {activeClient ? (
                <>
      Working on: <Chip label={activeClient.name} size="small" />
                </>
              ) : (
                'Select a client to get started'
              )}
            </Typography>
          </Box>

          {/* No Client Selected */}
          {!activeClient && (
            <Alert severity="info" sx={{ mb: 4 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography>
                  Please select a client to access the full dashboard features
                </Typography>
                <AnimatedActionButton onClick={() => router.push('/clients')}>
                  <BusinessIcon sx={{ mr: 1 }} />
                  View Clients
                </AnimatedActionButton>
              </Box>
            </Alert>
          )}

          {/* Quick Actions */}
          <Typography variant="h5" gutterBottom mb={2}>
            Quick Actions
          </Typography>
          <Grid container spacing={3} mb={4}>
            {quickActions.map((action, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 3 }}}
                  onClick={() => router.push(action.href)}
                >
                  <CardContent>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        backgroundColor: action.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2 }}
                    >
                      {React.cloneElement(action.icon as React.ReactElement, {
                        sx: { color: 'white'  }
                      })}
                    </Box>
                    <Typography variant="h6" gutterBottom>
                      {action.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {action.description}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <IconButton size="small" color="primary" aria-label="Navigate to action">
                      <ArrowForward />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Getting Started Section */}
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Getting Started with AIrFLOW
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      New to AIrFLOW? Here's your simple workflow:
                    </Typography>
                    <Box component="ol" sx={{ pl: 2 }}>
                      <Box component="li" sx={{ mb: 1 }}>
                        <Typography variant="body2">
                          <strong>Create/Select Client:</strong> Start by setting up your client
                        </Typography>
                      </Box>
                      <Box component="li" sx={{ mb: 1 }}>
                        <Typography variant="body2">
                          <strong>Generate Content:</strong> Use AI to create images, copy, and
                          videos
                        </Typography>
                      </Box>
                      <Box component="li" sx={{ mb: 1 }}>
                        <Typography variant="body2">
                          <strong>Organize Assets:</strong> Build your content library
                        </Typography>
                      </Box>
                      <Box component="li" sx={{ mb: 1 }}>
                        <Typography variant="body2">
                          <strong>Plan Campaigns:</strong> Create content matrices and campaigns
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Quick Tips
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                      <Chip label="Press Cmd+K for quick search" size="small" variant="outlined" />
                      <Chip
                        label="Start with templates for faster creation"
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label="Use AI generation for unique content"
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={<Add />}
                      onClick={() => router.push(activeClient ? '/generate-enhanced' : '/clients')}
                    >
                      {activeClient ? 'Start Creating Content' : 'Create Your First Client'}
                    </Button>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </DashboardLayout>
    </ProtectedRoute>
  );
};

export default DashboardPage;
