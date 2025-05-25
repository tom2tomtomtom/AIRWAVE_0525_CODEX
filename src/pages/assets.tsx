import React, { useState, useEffect } from 'react';
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
  Alert,
  Chip,
} from '@mui/material';
import {
  Upload,
  AutoAwesome,
  VideoCall,
  MicNone,
  Add as AddIcon,
  Collections as CollectionsIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { AIImageGenerator } from '@/components/AIImageGenerator';
import DashboardLayout from '@/components/DashboardLayout';
import AssetCard from '@/components/AssetCard';
import { LoadingSpinner, AssetGridSkeleton } from '@/components/LoadingSpinner';
import { demoAssets } from '@/utils/demoData';
import { Asset } from '@/types/models';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function EnhancedAssetsPage() {
  const [tabValue, setTabValue] = useState(0);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // TODO: Get from client context
  const clientId = 'demo-client-id';
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  useEffect(() => {
    loadAssets();
    // Get tab from URL query
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'ai') {
      setTabValue(1);
      setShowAIGenerator(true);
    }
  }, []);

  const loadAssets = async () => {
    try {
      setLoading(true);
      setError(null);

      // In demo mode, use demo data
      if (isDemoMode) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate loading
        setAssets(demoAssets as Asset[]);
      } else {
        // TODO: Fetch real assets from API
        // const response = await assetQueries.getAssets(clientId);
        // setAssets(response);
        setAssets([]);
      }
    } catch (err) {
      console.error('Error loading assets:', err);
      setError('Failed to load assets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    if (newValue === 1) {
      setShowAIGenerator(true);
    }
  };

  const speedDialActions = [
    {
      icon: <Upload />,
      name: 'Upload Files',
      action: () => {
        console.log('Open upload modal');
        // TODO: Implement file upload
      }
    },
    {
      icon: <AutoAwesome />,
      name: 'AI Image (DALL-E 3)',
      action: () => {
        setShowAIGenerator(true);
        setTabValue(1);
      }
    },
    {
      icon: <VideoCall />,
      name: 'AI Video (Coming Soon)',
      action: () => {
        alert('Sora video generation will be available when OpenAI releases the API');
      }
    },
    {
      icon: <MicNone />,
      name: 'AI Voice (ElevenLabs)',
      action: () => {
        console.log('Open voice generator');
        // TODO: Implement voice generation
      }
    },
  ];

  const handleImageGenerated = (newAsset: Asset) => {
    setAssets([newAsset, ...assets]);
    setShowAIGenerator(false);
  };

  // Filter assets based on active tab
  const getFilteredAssets = () => {
    switch (tabValue) {
      case 0: // All Assets
        return assets;
      case 1: // AI Generated
        return assets.filter(asset => asset.ai_generated);
      case 2: // Uploaded
        return assets.filter(asset => !asset.ai_generated);
      case 3: // Templates
        return []; // TODO: Implement templates
      default:
        return assets;
    }
  };

  const filteredAssets = getFilteredAssets();

  return (
    <DashboardLayout title="Asset Library">
      <Head>
        <title>Asset Library | AIrWAVE</title>
      </Head>
      
      <Box sx={{ width: '100%' }}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4">Asset Library</Typography>
          {isDemoMode && (
            <Chip label="DEMO MODE" size="small" color="info" />
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label={`All Assets (${assets.length})`} />
            <Tab label={`AI Generated (${assets.filter(a => a.ai_generated).length})`} />
            <Tab label={`Uploaded (${assets.filter(a => !a.ai_generated).length})`} />
            <Tab label="Templates" />
          </Tabs>
        </Box>

        {/* All Assets Tab */}
        <TabPanel value={tabValue} index={0}>
          {loading ? (
            <AssetGridSkeleton count={6} />
          ) : filteredAssets.length > 0 ? (
            <Grid container spacing={3}>
              {filteredAssets.map((asset) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={asset.id}>
                  <AssetCard 
                    asset={asset}
                    onSelect={() => console.log('Selected asset:', asset)}
                    onDelete={() => console.log('Delete asset:', asset)}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box textAlign="center" py={8}>
              <CollectionsIcon sx={{ fontSize: 80, color: 'grey.300', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No assets yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Start by uploading files or generating images with AI
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => speedDialActions[0].action()}
              >
                Add Your First Asset
              </Button>
            </Box>
          )}
        </TabPanel>

        {/* AI Generated Tab */}
        <TabPanel value={tabValue} index={1}>
          {showAIGenerator && (
            <Box sx={{ mb: 4 }}>
              <AIImageGenerator
                clientId={clientId}
                onImageGenerated={handleImageGenerated}
              />
            </Box>
          )}
          
          {loading ? (
            <AssetGridSkeleton count={6} />
          ) : filteredAssets.length > 0 ? (
            <Grid container spacing={3}>
              {filteredAssets.map((asset) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={asset.id}>
                  <AssetCard 
                    asset={asset}
                    onSelect={() => console.log('Selected asset:', asset)}
                    onDelete={() => console.log('Delete asset:', asset)}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            !showAIGenerator && (
              <Box textAlign="center" py={8}>
                <AutoAwesome sx={{ fontSize: 80, color: 'grey.300', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No AI-generated assets yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Create stunning images with DALL-E 3
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AutoAwesome />}
                  onClick={() => setShowAIGenerator(true)}
                >
                  Generate with AI
                </Button>
              </Box>
            )
          )}
        </TabPanel>

        {/* Uploaded Tab */}
        <TabPanel value={tabValue} index={2}>
          {loading ? (
            <AssetGridSkeleton count={6} />
          ) : filteredAssets.length > 0 ? (
            <Grid container spacing={3}>
              {filteredAssets.map((asset) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={asset.id}>
                  <AssetCard 
                    asset={asset}
                    onSelect={() => console.log('Selected asset:', asset)}
                    onDelete={() => console.log('Delete asset:', asset)}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box textAlign="center" py={8}>
              <CloudUploadIcon sx={{ fontSize: 80, color: 'grey.300', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No uploaded assets yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Upload images, videos, and documents
              </Typography>
              <Button
                variant="contained"
                startIcon={<Upload />}
                onClick={() => speedDialActions[0].action()}
              >
                Upload Files
              </Button>
            </Box>
          )}
        </TabPanel>

        {/* Templates Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box textAlign="center" py={8}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Templates coming soon
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pre-designed templates will be available here
            </Typography>
          </Box>
        </TabPanel>

        {/* Speed Dial for quick actions */}
        <SpeedDial
          ariaLabel="Add asset"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          icon={<SpeedDialIcon openIcon={<AddIcon />} />}
        >
          {speedDialActions.map((action) => (
            <SpeedDialAction
              key={action.name}
              icon={action.icon}
              tooltipTitle={action.name}
              onClick={action.action}
            />
          ))}
        </SpeedDial>
      </Box>
    </DashboardLayout>
  );
}
