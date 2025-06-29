import React, { useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import {
  Box,
  Container,
  Typography,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  CircularProgress,
  Alert} from '@mui/material';
import {
  ArrowBack} from '@mui/icons-material';
import { addDays } from 'date-fns';
import DashboardLayout from '../../components/DashboardLayout';
import { useNotification } from '../../contexts/NotificationContext';
import { useClient } from '../../contexts/ClientContext';
import { useBriefs } from '../../hooks/useData';

// Lazy load heavy components for better performance
const CampaignBasicInfo = dynamic(
  () => import('@/components/campaigns/CampaignBasicInfo'),
  {
    loading: () => (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    ),
    ssr: false}
);

const PlatformSelection = dynamic(
  () => import('@/components/campaigns/PlatformSelection'),
  {
    loading: () => (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    ),
    ssr: false}
);

const CampaignSchedule = dynamic(
  () => import('@/components/campaigns/CampaignSchedule'),
  {
    loading: () => (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    ),
    ssr: false}
);

const steps = [
  'Campaign Basics',
  'Platform Selection',
  'Schedule & Timeline',
];

const NewCampaign: React.FC = () => {
  const router = useRouter();
  const { showNotification } = useNotification();
  const { activeClient } = useClient();
  const { data: _briefs } = useBriefs(activeClient?.id);

  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [campaignData, setCampaignData] = useState({
    name: '',
    objective: '',
    targetAudience: '',
    budget: '',
    platforms: [],
    startDate: new Date(),
    endDate: addDays(new Date(), 30),
    frequency: 'daily',
    estimatedPosts: '',
    notes: ''});

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmit = async () => {
    if (!activeClient) {
      showNotification('Please select a client first', 'error');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Validate required fields before sending
      if (!campaignData.name?.trim()) {
        showNotification('Campaign name is required', 'error');
        setIsSubmitting(false);
        return;
      }

      // Transform frontend data to API expected format
      const apiData = {
        name: campaignData.name.trim(),
        objective: (campaignData.objective?.trim() || 'Brand Awareness'), // Ensure non-empty
        description: campaignData.notes || '',
        client_id: activeClient.id, // API expects client_id not clientId
        platforms: campaignData.platforms || [],
        budget: campaignData.budget ? parseFloat(campaignData.budget) : 0,
        start_date: campaignData.startDate?.toISOString(),
        end_date: campaignData.endDate?.toISOString(),
        targeting: {
          audience: campaignData.targetAudience || '',
          frequency: campaignData.frequency || 'daily',
          estimatedPosts: campaignData.estimatedPosts || ''
        },
        campaign_type: 'awareness', // Default type
        priority: 'medium', // Default priority
        kpis: [], // Empty for now
        tags: [], // Empty for now
        creative_requirements: {}
      };

            const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiData)});

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Campaign creation failed:', errorData);
        
        if (response.status === 400 && errorData.details) {
          // Show validation errors
          const validationErrors = errorData.details.map((issue: any) => issue.message).join(', ');
          throw new Error(`Validation failed: ${validationErrors}`);
        }
        
        throw new Error(errorData.error || 'Failed to create campaign');
      }

      const result = await response.json();
      
      showNotification('Campaign created successfully!', 'success');
      // API returns { data: campaign } not { campaign }
      router.push(`/campaigns/${result.data.id}`);
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      showNotification('Failed to create campaign. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <CampaignBasicInfo
            campaignData={campaignData}
            setCampaignData={setCampaignData}
            onNext={handleNext}
          />
        );
      case 1:
        return (
          <PlatformSelection
            campaignData={campaignData}
            setCampaignData={setCampaignData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 2:
        return (
          <CampaignSchedule
            campaignData={campaignData}
            setCampaignData={setCampaignData}
            onNext={handleSubmit}
            onBack={handleBack}
          />
        );
      default:
        return null;
    }
  };

  if (!activeClient) {
    return (
      <DashboardLayout title="Create Campaign">
        <Container maxWidth="md">
          <Alert severity="warning" sx={{ mt: 4 }}>
            Please select a client to create a campaign.
          </Alert>
        </Container>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Create Campaign">
      <Container maxWidth="md">
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <ArrowBack 
              sx={{ mr: 2, cursor: 'pointer' }} 
              onClick={() => router.push('/campaigns')}
            />
            <Typography variant="h4" component="h1" fontWeight={600}>
              Create New Campaign
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            Set up a new marketing campaign for {activeClient.name}
          </Typography>
        </Box>

        <Paper sx={{ p: 4 }}>
          <Stepper activeStep={activeStep} orientation="vertical">
            {steps.map((label, index) => (
              <Step key={label}>
                <StepLabel
                  optional={
                    index === 2 ? (
                      <Typography variant="caption">Last step</Typography>
                    ) : null
                  }
                >
                  {label}
                </StepLabel>
                <StepContent>
                  {renderStepContent(index)}
                </StepContent>
              </Step>
            ))}
          </Stepper>

          {activeStep === steps.length && (
            <Paper square elevation={0} sx={{ p: 3 }}>
              <Typography>All steps completed - campaign ready to create!</Typography>
            </Paper>
          )}
        </Paper>

        {isSubmitting && (
          <Box sx={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            bgcolor: 'rgba(0,0,0,0.3)',
            zIndex: 9999 
          }}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              bgcolor: 'white',
              p: 4,
              borderRadius: 2,
              boxShadow: 24
            }}>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography>Creating campaign...</Typography>
            </Box>
          </Box>
        )}
      </Container>
    </DashboardLayout>
  );
};

export default NewCampaign;