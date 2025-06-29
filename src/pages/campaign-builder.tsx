import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert,
  CircularProgress,
  Chip,
  Avatar,
  List,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  LinearProgress,
} from '@mui/material';
import {
  Campaign as CampaignIcon,
  Add as AddIcon,
  ArrowForward as NextIcon,
  ArrowBack as BackIcon,
  Save as SaveIcon,
  ContentCopy as TemplateIcon,
} from '@mui/icons-material';
import DashboardLayout from '@/components/DashboardLayout';
import { useClient } from '@/contexts/ClientContext';
import { useNotification } from '@/contexts/NotificationContext';

interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  platforms: string[];
  estimatedDuration: string;
  complexity: 'beginner' | 'intermediate' | 'advanced';
  objectives: string[];
  preview: string;
}

interface CampaignStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  required: boolean;
  estimatedTime: string;
}

const CampaignBuilderPage: React.FC = () => {
  const router = useRouter();
  const { activeClient } = useClient();
  const { showNotification } = useNotification();

  // State management
  const [builderMode, setBuilderMode] = useState<'template' | 'custom' | 'wizard'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  // Campaign templates
  const campaignTemplates: CampaignTemplate[] = [
    {
      id: 'brand-awareness',
      name: 'Brand Awareness Campaign',
      description: 'Build brand recognition and reach new audiences across multiple platforms',
      category: 'Awareness',
      platforms: ['Facebook', 'Instagram', 'YouTube'],
      estimatedDuration: '4-6 weeks',
      complexity: 'beginner',
      objectives: ['Increase brand visibility', 'Reach new audiences', 'Build brand recognition'],
      preview: '/templates/brand-awareness.jpg' },
    {
      id: 'product-launch',
      name: 'Product Launch Campaign',
      description: 'Comprehensive campaign to introduce and promote a new product',
      category: 'Launch',
      platforms: ['Instagram', 'TikTok', 'LinkedIn', 'YouTube'],
      estimatedDuration: '6-8 weeks',
      complexity: 'intermediate',
      objectives: ['Generate product awareness', 'Drive pre-orders', 'Create buzz'],
      preview: '/templates/product-launch.jpg' },
    {
      id: 'lead-generation',
      name: 'Lead Generation Campaign',
      description: 'Capture qualified leads and build your customer database',
      category: 'Conversion',
      platforms: ['LinkedIn', 'Facebook', 'Google Ads'],
      estimatedDuration: '8-12 weeks',
      complexity: 'advanced',
      objectives: ['Generate qualified leads', 'Build email list', 'Increase conversions'],
      preview: '/templates/lead-generation.jpg' },
    {
      id: 'seasonal-promotion',
      name: 'Seasonal Promotion',
      description: 'Time-sensitive promotional campaign for holidays or special events',
      category: 'Promotion',
      platforms: ['Instagram', 'Facebook', 'TikTok'],
      estimatedDuration: '2-4 weeks',
      complexity: 'beginner',
      objectives: ['Boost seasonal sales', 'Clear inventory', 'Increase engagement'],
      preview: '/templates/seasonal-promotion.jpg' },
    {
      id: 'thought-leadership',
      name: 'Thought Leadership Campaign',
      description: 'Establish authority and expertise in your industry',
      category: 'Authority',
      platforms: ['LinkedIn', 'YouTube', 'Twitter'],
      estimatedDuration: '12-16 weeks',
      complexity: 'advanced',
      objectives: ['Build industry authority', 'Share expertise', 'Network building'],
      preview: '/templates/thought-leadership.jpg' },
    {
      id: 'customer-retention',
      name: 'Customer Retention Campaign',
      description: 'Engage existing customers and increase lifetime value',
      category: 'Retention',
      platforms: ['Email', 'Instagram', 'Facebook'],
      estimatedDuration: '6-10 weeks',
      complexity: 'intermediate',
      objectives: ['Increase customer loyalty', 'Boost repeat purchases', 'Reduce churn'],
      preview: '/templates/customer-retention.jpg' },
  ];

  // Campaign building steps
  const campaignSteps: CampaignStep[] = [
    {
      id: 'template',
      title: 'Choose Template',
      description: 'Select a campaign template or start from scratch',
      status: selectedTemplate ? 'completed' : 'pending',
      required: true,
      estimatedTime: '5 min' },
    {
      id: 'objectives',
      title: 'Set Objectives',
      description: 'Define your campaign goals and key performance indicators',
      status: 'pending',
      required: true,
      estimatedTime: '10 min' },
    {
      id: 'audience',
      title: 'Target Audience',
      description: 'Define your target audience and demographics',
      status: 'pending',
      required: true,
      estimatedTime: '15 min' },
    {
      id: 'platforms',
      title: 'Select Platforms',
      description: 'Choose which platforms to run your campaign on',
      status: 'pending',
      required: true,
      estimatedTime: '10 min' },
    {
      id: 'content',
      title: 'Content Strategy',
      description: 'Plan your content types and messaging',
      status: 'pending',
      required: true,
      estimatedTime: '20 min' },
    {
      id: 'budget',
      title: 'Budget & Schedule',
      description: 'Set your budget and campaign timeline',
      status: 'pending',
      required: true,
      estimatedTime: '10 min' },
    {
      id: 'review',
      title: 'Review & Launch',
      description: 'Review your campaign and launch or save as draft',
      status: 'pending',
      required: true,
      estimatedTime: '5 min' },
  ];

  // Load existing campaigns
  const loadCampaigns = async () => {
    if (!activeClient) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/campaigns?client_id=${activeClient.id}`);
      const result = await response.json();

      if (result.data) {
        setCampaigns(result.data);
      }
    } catch (error: any) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeClient) {
      loadCampaigns();
    }
  }, [activeClient]);

  // Handle template selection
  const handleTemplateSelect = (template: CampaignTemplate) => {
    setSelectedTemplate(template);
    setBuilderMode('wizard');
    setActiveStep(1); // Move to next step after template selection
    showNotification(`Selected ${template.name} template`, 'success');
  };

  // Handle custom campaign creation
  const handleCustomCampaign = () => {
    setBuilderMode('wizard');
    setActiveStep(1);
    showNotification('Starting custom campaign builder', 'info');
  };

  // Handle quick campaign creation (redirect to existing flow)
  const handleQuickCreate = () => {
    router.push('/campaigns/new');
  };

  // Get complexity color
  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'beginner':
        return 'success';
      case 'intermediate':
        return 'warning';
      case 'advanced':
        return 'error';
      default:
        return 'default';
    }
  };

  // Get step status color
  const getStepStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success.main';
      case 'in_progress':
        return 'warning.main';
      case 'error':
        return 'error.main';
      default:
        return 'text.secondary';
    }
  };

  return (
    <>
       <Head>
        <title>Campaign Builder | AIRFLOW</title>
      </Head>
      <DashboardLayout title="Campaign Builder">
        <Box sx={{ mb: 4 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
            <Box display="flex" alignItems="center" gap={2}>
              <CampaignIcon sx={{ color: 'primary.main', fontSize: 32 }} />
              <Box>
                <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
                  Campaign Builder
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Create powerful marketing campaigns with our visual builder
                </Typography>
              </Box>
            </Box>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<TemplateIcon />}
                onClick={() => setShowTemplateDialog(true)}
              >
                Browse Templates
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleQuickCreate}>
                Quick Create
              </Button>
            </Stack>
          </Box>

          {!activeClient && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              Please select a client to create campaigns.
            </Alert>
          )}

          {activeClient && (
            <Box>
              {builderMode === 'template' && (
                <Grid container spacing={3}>
                  {/* Campaign Templates */}
                  <Grid size={{ xs: 12, lg: 8 }}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Choose Your Campaign Type
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                          Select a pre-built template to get started quickly, or create a custom
                          campaign from scratch.
                        </Typography>

                        <Grid container spacing={2}>
                          {campaignTemplates.map((template: any) => (
                            <Grid size={{ xs: 12, md: 6 }} key={template.id}>
                              <Card
                                variant="outlined"
                                sx={{
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  '&:hover': {
                                    boxShadow: 2,
                                    transform: 'translateY(-2px)' },
                                }}
                                onClick={() => handleTemplateSelect(template)}
                              >
                                <CardContent>
                                  <Box
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="between"
                                    mb={2}
                                  >
                                    <Typography variant="h6" component="div">
                                      {template.name}
                                    </Typography>
                                    <Chip
                                      label={template.complexity}
                                      size="small"
                                      color={getComplexityColor(template.complexity) as any}
                                    />
                                  </Box>
                                  <Typography variant="body2" color="text.secondary" paragraph>
                                    {template.description}
                                  </Typography>
                                  <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
                                    {template.platforms.map((platform: any) => (
                                      <Chip
                                        key={platform}
                                        label={platform}
                                        size="small"
                                        variant="outlined"
                                      />
                                    ))}
                                  </Box>
                                  <Box display="flex" alignItems="center" justifyContent="between">
                                    <Typography variant="caption" color="text.secondary">
                                      {template.estimatedDuration}
                                    </Typography>
                                    <Chip label={template.category} size="small" />
                                  </Box>
                                </CardContent>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>

                        <Box mt={3} display="flex" gap={2}>
                          <Button
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={handleCustomCampaign}
                            size="large"
                          >
                            Start Custom Campaign
                          </Button>
                          <Button
                            variant="text"
                            startIcon={<NextIcon />}
                            onClick={handleQuickCreate}
                          >
                            Use Advanced Builder
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Recent Campaigns Sidebar */}
                  <Grid size={{ xs: 12, lg: 4 }}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Recent Campaigns
                        </Typography>
                        {loading ? (
                          <Box display="flex" justifyContent="center" p={2}>
                            <CircularProgress size={24} />
                          </Box>
                        ) : campaigns.length > 0 ? (
                          <List>
                            {campaigns.slice(0, 5).map((campaign, index) => (
                              <React.Fragment key={campaign.id}>
                                {index > 0 && <Divider />}
                                <ListItemButton
                                  onClick={() => router.push(`/campaigns/${campaign.id}`)}
                                >
                                  <ListItemIcon>
                                    <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                                      <CampaignIcon fontSize="small" />
                                    </Avatar>
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={campaign.name}
                                    secondary={
                                      <Box>
                                        <Typography variant="caption" color="text.secondary">
                                          {campaign.status} • {campaign.platforms?.length || 0}{' '}
                                          platforms
                                        </Typography>
                                      </Box>
                                    }
                                  />
                                </ListItemButton>
                              </React.Fragment>
                            ))}
                          </List>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No campaigns yet. Create your first campaign to get started!
                          </Typography>
                        )}

                        <Box mt={2}>
                          <Button
                            fullWidth
                            variant="outlined"
                            onClick={() => router.push('/campaigns')}
                          >
                            View All Campaigns
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>

                    {/* Quick Stats */}
                    <Card sx={{ mt: 2 }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Quick Stats
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 6 }}>
                            <Box textAlign="center">
                              <Typography variant="h4" color="primary">
                                {campaigns.length}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Total Campaigns
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box textAlign="center">
                              <Typography variant="h4" color="success.main">
                                {campaigns.filter((c: any) => c.status === 'active').length}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Active
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}

              {builderMode === 'wizard' && (
                <Grid container spacing={3}>
                  {/* Wizard Steps */}
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Campaign Builder
                        </Typography>
                        {selectedTemplate && (
                          <Alert severity="info" sx={{ mb: 2 }}>
                            Using template: {selectedTemplate.name}
                          </Alert>
                        )}
                        <Stepper activeStep={activeStep} orientation="vertical">
                          {campaignSteps.map((step, _index) => (
                            <Step key={step.id}>
                              <StepLabel
                                StepIconProps={{
                                  style: { color: getStepStatusColor(step.status)  }
                                }}
                              >
                                <Box>
                                  <Typography variant="subtitle2">{step.title}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {step.estimatedTime}
                                  </Typography>
                                </Box>
                              </StepLabel>
                              <StepContent>
                                <Typography variant="body2" color="text.secondary">
                                  {step.description}
                                </Typography>
                              </StepContent>
                            </Step>
                          ))}
                        </Stepper>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Wizard Content */}
                  <Grid size={{ xs: 12, md: 8 }}>
                    <Card>
                      <CardContent>
                        <Box display="flex" alignItems="center" justifyContent="between" mb={3}>
                          <Typography variant="h6">
                            {campaignSteps[activeStep]?.title || 'Campaign Builder'}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={(activeStep / (campaignSteps.length - 1)) * 100}
                            sx={{ width: 200 }}
                          />
                        </Box>

                        <Typography variant="body1" color="text.secondary" paragraph>
                          {campaignSteps[activeStep]?.description ||
                            'Configure your campaign settings.'}
                        </Typography>

                        {/* Wizard content would go here */}
                        <Alert severity="info" sx={{ mb: 3 }}>
                          This step is under development. For now, please use the{' '}
                          <Button
                            variant="text"
                            onClick={handleQuickCreate}
                            sx={{ textTransform: 'none' }}
                          >
                            Advanced Campaign Builder
                          </Button>{' '}
                          to create campaigns.
                        </Alert>

                        <Box display="flex" justifyContent="between" mt={4}>
                          <Button
                            onClick={() => setBuilderMode('template')}
                            startIcon={<BackIcon />}
                          >
                            Back to Templates
                          </Button>
                          <Stack direction="row" spacing={2}>
                            <Button variant="outlined" onClick={handleQuickCreate}>
                              Use Advanced Builder
                            </Button>
                            <Button variant="contained" startIcon={<SaveIcon />} disabled>
                              Continue
                            </Button>
                          </Stack>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
            </Box>
          )}
        </Box>

        {/* Template Browser Dialog */}
        <Dialog
          open={showTemplateDialog}
          onClose={() => setShowTemplateDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Campaign Templates</DialogTitle>
          <DialogContent>
            <Grid container spacing={2}>
              {campaignTemplates.map((template: any) => (
                <Grid size={{ xs: 12, sm: 6 }} key={template.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {template.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {template.description}
                      </Typography>
                      <Box display="flex" gap={1} mb={2}>
                        <Chip label={template.category} size="small" />
                        <Chip
                          label={template.complexity}
                          size="small"
                          color={getComplexityColor(template.complexity) as any}
                        />
                      </Box>
                      <Button
                        fullWidth
                        variant="outlined"
                        onClick={() => {
                          handleTemplateSelect(template);
                          setShowTemplateDialog(false);
                        }}
                      >
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowTemplateDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </DashboardLayout>
    </>
  );
};

export default CampaignBuilderPage;
