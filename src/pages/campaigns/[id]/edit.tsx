import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import { ArrowBack, Save, Delete, RestartAlt, Warning } from '@mui/icons-material';
import DashboardLayout from '../../../components/DashboardLayout';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ErrorMessage from '../../../components/ErrorMessage';
import { useNotification } from '../../../contexts/NotificationContext';
import { useCampaigns } from '../../../hooks/useData';
import { loggers } from '@/lib/logger';


// Lazy load heavy components for better performance
const CampaignBasicInfo = dynamic(() => import('@/components/campaigns/CampaignBasicInfo'), {
  loading: () => (
    <Box display="flex" justifyContent="center" py={4}>
      <CircularProgress />
    </Box>
  ),
  ssr: false });

const PlatformSelection = dynamic(() => import('@/components/campaigns/PlatformSelection'), {
  loading: () => (
    <Box display="flex" justifyContent="center" py={4}>
      <CircularProgress />
    </Box>
  ),
  ssr: false });

const CampaignSchedule = dynamic(() => import('@/components/campaigns/CampaignSchedule'), {
  loading: () => (
    <Box display="flex" justifyContent="center" py={4}>
      <CircularProgress />
    </Box>
  ),
  ssr: false });

const EditCampaign: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const { showNotification } = useNotification();
  const { data: campaigns, isLoading: loading, error } = useCampaigns();

  // Mock functions for now - these would need to be implemented
  const updateCampaign = async (id: string, updates: any) => {
    // TODO: Implement campaign update API call
    loggers.general.error('Update campaign:', id, updates);
  };

  const deleteCampaign = async (id: string) => {
    // TODO: Implement campaign delete API call
    loggers.general.error('Delete campaign:', id);
  };

  const [campaign, setCampaign] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (campaigns && id) {
      const foundCampaign = campaigns.find((c: any) => c.id === id);
      if (foundCampaign) {
        setCampaign({
          name: foundCampaign.name || '',
          objective: foundCampaign.objective || '',
          targetAudience: foundCampaign.target_audience || '',
          budget: foundCampaign.budget || '',
          platforms: foundCampaign.platforms || [],
          startDate: foundCampaign.start_date ? new Date(foundCampaign.start_date) : new Date(),
          endDate: foundCampaign.end_date ? new Date(foundCampaign.end_date) : new Date(),
          frequency: foundCampaign.frequency || 'daily',
          estimatedPosts: foundCampaign.estimated_posts || '',
          notes: foundCampaign.notes || '' });
      }
    }
  }, [campaigns, id]);

  const handleSave = async () => {
    if (!campaign || !id) return;

    setIsSaving(true);
    try {
      await updateCampaign(id as string, {
        name: campaign.name,
        objective: campaign.objective,
        target_audience: campaign.targetAudience,
        budget: campaign.budget,
        platforms: campaign.platforms,
        start_date: campaign.startDate,
        end_date: campaign.endDate,
        frequency: campaign.frequency,
        estimated_posts: campaign.estimatedPosts,
        notes: campaign.notes });

      showNotification('Campaign updated successfully!', 'success');
    } catch (error: any) {
      console.error('Error updating campaign:', error);
      showNotification('Failed to update campaign. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    setIsDeleting(true);
    try {
      await deleteCampaign(id as string);
      showNotification('Campaign deleted successfully!', 'success');
      router.push('/campaigns');
    } catch (error: any) {
      console.error('Error deleting campaign:', error);
      showNotification('Failed to delete campaign. Please try again.', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  if (loading) {
    return (
      <DashboardLayout title="Edit Campaign">
        <LoadingSpinner />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="Edit Campaign">
        <ErrorMessage message="Failed to load campaign data" />
      </DashboardLayout>
    );
  }

  if (!campaign) {
    return (
      <DashboardLayout title="Edit Campaign">
        <Container maxWidth="md">
          <Alert severity="error" sx={{ mt: 4 }}>
            Campaign not found.
          </Alert>
        </Container>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Edit Campaign">
      <Container maxWidth="md">
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <ArrowBack
              sx={{ mr: 2, cursor: 'pointer' }}
              onClick={() => router.push('/campaigns')}
            />
            <Typography variant="h4" component="h1" fontWeight={600}>
              Edit Campaign
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            Modify campaign settings and configurations
          </Typography>
        </Box>

        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Basic Info" />
            <Tab label="Platforms" />
            <Tab label="Schedule" />
          </Tabs>

          <Box sx={{ p: 4 }}>
            {activeTab === 0 && (
              <CampaignBasicInfo
                campaignData={campaign}
                setCampaignData={setCampaign}
                onNext={() => setActiveTab(1)}
              />
            )}

            {activeTab === 1 && (
              <PlatformSelection
                campaignData={campaign}
                setCampaignData={setCampaign}
                onNext={() => setActiveTab(2)}
                onBack={() => setActiveTab(0)}
              />
            )}

            {activeTab === 2 && (
              <CampaignSchedule
                campaignData={campaign}
                setCampaignData={setCampaign}
                onNext={handleSave}
                onBack={() => setActiveTab(1)}
              />
            )}
          </Box>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<Delete />}
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete Campaign
          </Button>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RestartAlt />}
              onClick={() => window.location.reload()}
            >
              Reset Changes
            </Button>
            <Button
              variant="contained"
              startIcon={isSaving ? <CircularProgress size={20} /> : <Save />}
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Box>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-description"
        >
          <DialogTitle id="delete-dialog-title">
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Warning sx={{ mr: 1, color: 'error.main' }} />
              Delete Campaign
            </Box>
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="delete-dialog-description">
              Are you sure you want to delete this campaign? This action cannot be undone. All
              associated data will be permanently removed.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              color="error"
              variant="contained"
              disabled={isDeleting}
              startIcon={isDeleting ? <CircularProgress size={20} /> : <Delete />}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </DashboardLayout>
  );
};

export default EditCampaign;
