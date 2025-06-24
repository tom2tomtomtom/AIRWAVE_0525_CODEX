import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Box,
  Button,
  Typography,
  Grid,
  Tabs,
  Tab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Card,
  CardContent} from '@mui/material';
import { Upload, AutoAwesome, Add as AddIcon } from '@mui/icons-material';
import DashboardLayout from '@/components/DashboardLayout';
import AssetUploadModal from '@/components/AssetUploadModal';
import { useAuth } from '@/contexts/AuthContext';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const AssetsPage = () => {
  const [tabValue, setTabValue] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  // Show loading or redirect if not authenticated
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const speedDialActions = [
    {
      icon: <Upload />,
      name: 'Upload Files',
      action: () => setShowUploadModal(true) },
    {
      icon: <AutoAwesome />,
      name: 'AI Generate',
      action: () => console.log('AI Generate clicked') },
  ];

  // Mock assets data for testing
  const mockAssets = [
    { id: 1, name: 'Sample Image 1', type: 'image', url: '/api/placeholder/300/200' },
    { id: 2, name: 'Sample Image 2', type: 'image', url: '/api/placeholder/300/200' },
    { id: 3, name: 'Sample Video 1', type: 'video', url: '/api/placeholder/300/200' }
  ];

  const handleUploadComplete = () => {
    console.log('Upload completed');
    // In a real app, this would refresh the assets list
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Assets | AIrWAVE</title>
      </Head>

      <Box sx={{ width: '100%' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" gutterBottom>
            Asset Library
          </Typography>
        </Box>

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="All Assets" />
            <Tab label="Images" />
            <Tab label="Videos" />
            <Tab label="Audio" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {mockAssets.map((asset: any) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={asset.id}>
                <Card sx={{ height: '100%' }} data-testid="asset-card">
                  <Box
                    sx={{
                      height: 200,
                      bgcolor: 'grey.200',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative' }}
                  >
                    <Typography variant="h6" color="text.secondary">
                      {asset.type.toUpperCase()}
                    </Typography>
                  </Box>
                  <CardContent>
                    <Typography variant="subtitle1" noWrap>
                      {asset.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {asset.type}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}

            {/* Empty state with upload button */}
            {mockAssets.length === 0 && (
              <Grid size={{ xs: 12 }}>
                <Box textAlign="center" py={5}>
                  <Upload sx={{ fontSize: 60, color: 'grey.400', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No assets yet
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Upload />}
                    onClick={() => setShowUploadModal(true)}
                    data-testid="upload-button"
                    sx={{ mt: 2 }}
                  >
                    Upload Files
                  </Button>
                </Box>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography>Images view</Typography>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography>Videos view</Typography>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography>Audio view</Typography>
        </TabPanel>

        <SpeedDial
          ariaLabel="Add asset"
          data-testid="speed-dial"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          icon={<SpeedDialIcon openIcon={<AddIcon />} />}
        >
          {speedDialActions.map((action: any) => (
            <SpeedDialAction
              key={action.name}
              icon={action.icon}
              tooltipTitle={action.name}
              onClick={action.action}
              data-testid={`speed-dial-${action.name.toLowerCase().replace(/\s+/g, '-')}`}
            />
          ))}
        </SpeedDial>

        <AssetUploadModal
          open={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUploadComplete={handleUploadComplete}
        />
      </Box>
    </DashboardLayout>
  );
};

export default AssetsPage;
