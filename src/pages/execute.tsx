import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Divider,
  Paper,
  Stack,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Schedule as ScheduleIcon,
  Download as DownloadIcon,
  CloudUpload as PublishIcon,
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  Twitter as TwitterIcon,
  LinkedIn as LinkedInIcon,
  YouTube as YouTubeIcon,
  Pinterest as PinterestIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Pending as PendingIcon,
  CalendarMonth as CalendarIcon,
  AttachMoney as BudgetIcon,
} from '@mui/icons-material';
import Head from 'next/head';
import DashboardLayout from '@/components/DashboardLayout';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import { useClient } from '@/contexts/ClientContext';
import { useNotification } from '@/contexts/NotificationContext';
import { useCampaigns, useMatrices, useAssets } from '@/hooks/useData';
import type { Campaign } from '@/types/models';

// Platform configuration
const platforms = [
  { id: 'facebook', name: 'Facebook', icon: <FacebookIcon />, color: '#1877F2' },
  { id: 'instagram', name: 'Instagram', icon: <InstagramIcon />, color: '#E1306C' },
  { id: 'twitter', name: 'Twitter', icon: <TwitterIcon />, color: '#1DA1F2' },
  { id: 'linkedin', name: 'LinkedIn', icon: <LinkedInIcon />, color: '#0A66C2' },
  { id: 'youtube', name: 'YouTube', icon: <YouTubeIcon />, color: '#FF0000' },
  { id: 'pinterest', name: 'Pinterest', icon: <PinterestIcon />, color: '#E60023' },
];

// Export formats
const exportFormats = [
  { id: 'zip', name: 'ZIP Archive', description: 'All assets in organized folders' },
  { id: 'pdf', name: 'PDF Report', description: 'Campaign overview with assets' },
  { id: 'csv', name: 'CSV Data', description: 'Campaign data and metadata' },
  { id: 'json', name: 'JSON Export', description: 'Complete campaign structure' },
];

interface ExecutionTask {
  id: string;
  campaignId: string;
  campaignName: string;
  platforms: string[];
  scheduledDate?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  assets: {
    id: string;
    name: string;
    type: string;
    platform: string;
    status: 'ready' | 'processing' | 'published' | 'failed';
  }[];
}

const ExecutePage: React.FC = () => {
  const { activeClient } = useClient();
  const { showNotification } = useNotification();
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns(activeClient?.id);
  const { data: matrices, isLoading: matricesLoading } = useMatrices(activeClient?.id);
  const { isLoading: assetsLoading } = useAssets(activeClient?.id);
  
  const [activeStep, setActiveStep] = useState(0);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [scheduleType, setScheduleType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledDate, setScheduledDate] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState('zip');
  const [executionTasks, setExecutionTasks] = useState<ExecutionTask[]>([]);
  const [executingTask, setExecutingTask] = useState<string | null>(null);

  const isLoading = campaignsLoading || matricesLoading || assetsLoading;

  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  const handleExecuteCampaign = () => {
    if (!selectedCampaign || selectedPlatforms.length === 0) {
      showNotification('Please select a campaign and at least one platform', 'error');
      return;
    }

    const newTask: ExecutionTask = {
      id: `task-${Date.now()}`,
      campaignId: selectedCampaign.id,
      campaignName: selectedCampaign.name,
      platforms: selectedPlatforms,
      scheduledDate: scheduleType === 'scheduled' ? scheduledDate : undefined,
      status: 'pending',
      progress: 0,
      assets: selectedPlatforms.map(platform => ({
        id: `asset-${Date.now()}-${platform}`,
        name: `${selectedCampaign.name} - ${platform}`,
        type: 'image',
        platform,
        status: 'ready',
      })),
    };

    setExecutionTasks([...executionTasks, newTask]);
    showNotification('Campaign execution task created successfully!', 'success');
    
    // Reset form
    setActiveStep(0);
    setSelectedCampaign(null);
    setSelectedPlatforms([]);
    setScheduleType('immediate');
    setScheduledDate('');
    
    // Start execution if immediate
    if (scheduleType === 'immediate') {
      simulateExecution(newTask.id);
    }
  };

  const simulateExecution = (taskId: string) => {
    setExecutingTask(taskId);
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setExecutionTasks(prev =>
        prev.map(task =>
          task.id === taskId
            ? {
                ...task,
                status: progress < 100 ? 'in_progress' : 'completed',
                progress,
                assets: task.assets.map((asset, index) => ({
                  ...asset,
                  status: progress > (index + 1) * (100 / task.assets.length)
                    ? 'published'
                    : progress > index * (100 / task.assets.length)
                    ? 'processing'
                    : 'ready',
                })),
              }
            : task
        )
      );

      if (progress >= 100) {
        clearInterval(interval);
        setExecutingTask(null);
        showNotification('Campaign executed successfully!', 'success');
      }
    }, 500);
  };

  const handleExport = () => {
    showNotification(`Exporting campaign in ${selectedExportFormat.toUpperCase()} format...`, 'info');
    setTimeout(() => {
      showNotification('Export completed successfully!', 'success');
      setExportDialogOpen(false);
    }, 2000);
  };

  const readyCampaigns = campaigns?.filter(c => 
    matrices?.some(m => m.clientId === c.clientId && m.status === 'approved')
  ) || [];

  if (!activeClient) {
    return (
      <DashboardLayout title="Execute">
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Select a client to execute campaigns
          </Typography>
        </Box>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout title="Execute">
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map(i => (
            <Grid item xs={12} md={6} key={i}>
              <LoadingSkeleton variant="card" />
            </Grid>
          ))}
        </Grid>
      </DashboardLayout>
    );
  }

  return (
    <>
      <Head>
        <title>Execute | AIrWAVE</title>
      </Head>
      <DashboardLayout title="Execute">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
            Execute Campaigns
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Publish campaigns across platforms and export assets
          </Typography>
        </Box>

        {/* Quick Stats */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Ready to Execute
                    </Typography>
                    <Typography variant="h4">
                      {readyCampaigns.length}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'success.light' }}>
                    <CheckIcon color="success" />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Active Tasks
                    </Typography>
                    <Typography variant="h4">
                      {executionTasks.filter(t => t.status === 'in_progress').length}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'info.light' }}>
                    <PlayIcon color="info" />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Scheduled
                    </Typography>
                    <Typography variant="h4">
                      {executionTasks.filter(t => t.scheduledDate && t.status === 'pending').length}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'warning.light' }}>
                    <ScheduleIcon color="warning" />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Completed
                    </Typography>
                    <Typography variant="h4">
                      {executionTasks.filter(t => t.status === 'completed').length}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'success.light' }}>
                    <CheckIcon color="success" />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          {/* Campaign Selection & Execution */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Execute New Campaign
              </Typography>
              <Stepper activeStep={activeStep} orientation="vertical">
                <Step>
                  <StepLabel>Select Campaign</StepLabel>
                  <StepContent>
                    <Grid container spacing={2}>
                      {readyCampaigns.map(campaign => (
                        <Grid item xs={12} md={6} key={campaign.id}>
                          <Card
                            sx={{
                              cursor: 'pointer',
                              border: selectedCampaign?.id === campaign.id ? 2 : 0,
                              borderColor: 'primary.main',
                            }}
                            onClick={() => setSelectedCampaign(campaign)}
                          >
                            <CardContent>
                              <Typography variant="h6" gutterBottom>
                                {campaign.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" paragraph>
                                {campaign.description}
                              </Typography>
                              <Stack direction="row" spacing={1}>
                                <Chip
                                  size="small"
                                  icon={<CalendarIcon />}
                                  label={`Ends ${new Date(campaign.schedule?.endDate || '').toLocaleDateString()}`}
                                />
                                <Chip
                                  size="small"
                                  icon={<BudgetIcon />}
                                  label={`$${campaign.budget?.total || 0}`}
                                />
                              </Stack>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                    <Box sx={{ mt: 2 }}>
                      <Button
                        variant="contained"
                        onClick={() => setActiveStep(1)}
                        disabled={!selectedCampaign}
                      >
                        Continue
                      </Button>
                    </Box>
                  </StepContent>
                </Step>

                <Step>
                  <StepLabel>Select Platforms</StepLabel>
                  <StepContent>
                    <FormGroup>
                      <Grid container spacing={2}>
                        {platforms.map(platform => (
                          <Grid item xs={6} md={4} key={platform.id}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={selectedPlatforms.includes(platform.id)}
                                  onChange={() => handlePlatformToggle(platform.id)}
                                  sx={{ color: platform.color }}
                                />
                              }
                              label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {platform.icon}
                                  {platform.name}
                                </Box>
                              }
                            />
                          </Grid>
                        ))}
                      </Grid>
                    </FormGroup>
                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      <Button onClick={() => setActiveStep(0)}>
                        Back
                      </Button>
                      <Button
                        variant="contained"
                        onClick={() => setActiveStep(2)}
                        disabled={selectedPlatforms.length === 0}
                      >
                        Continue
                      </Button>
                    </Box>
                  </StepContent>
                </Step>

                <Step>
                  <StepLabel>Schedule Publication</StepLabel>
                  <StepContent>
                    <FormControl component="fieldset" sx={{ mb: 2 }}>
                      <FormGroup>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={scheduleType === 'immediate'}
                              onChange={() => setScheduleType('immediate')}
                            />
                          }
                          label="Publish Immediately"
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={scheduleType === 'scheduled'}
                              onChange={() => setScheduleType('scheduled')}
                            />
                          }
                          label="Schedule for Later"
                        />
                      </FormGroup>
                    </FormControl>
                    
                    {scheduleType === 'scheduled' && (
                      <TextField
                        type="datetime-local"
                        fullWidth
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        sx={{ mb: 2 }}
                      />
                    )}
                    
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button onClick={() => setActiveStep(1)}>
                        Back
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<PublishIcon />}
                        onClick={handleExecuteCampaign}
                      >
                        {scheduleType === 'immediate' ? 'Execute Now' : 'Schedule Execution'}
                      </Button>
                    </Box>
                  </StepContent>
                </Step>
              </Stepper>
            </Paper>
          </Grid>

          {/* Execution Status */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Execution Queue
                </Typography>
                <Button
                  startIcon={<DownloadIcon />}
                  onClick={() => setExportDialogOpen(true)}
                  disabled={executionTasks.length === 0}
                >
                  Export
                </Button>
              </Box>
              
              {executionTasks.length === 0 ? (
                <Alert severity="info">
                  No execution tasks yet. Select a campaign to get started.
                </Alert>
              ) : (
                <List>
                  {executionTasks.map((task, index) => (
                    <React.Fragment key={task.id}>
                      {index > 0 && <Divider />}
                      <ListItem>
                        <ListItemIcon>
                          {task.status === 'completed' ? (
                            <CheckIcon color="success" />
                          ) : task.status === 'in_progress' ? (
                            <Badge badgeContent={`${task.progress}%`} color="primary">
                              <PlayIcon color="primary" />
                            </Badge>
                          ) : task.status === 'failed' ? (
                            <CancelIcon color="error" />
                          ) : (
                            <PendingIcon />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={task.campaignName}
                          secondary={
                            <Box>
                              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                                {task.platforms.map(p => {
                                  const platform = platforms.find(pl => pl.id === p);
                                  return platform ? (
                                    <Tooltip key={p} title={platform.name}>
                                      <Box sx={{ color: platform.color }}>
                                        {platform.icon}
                                      </Box>
                                    </Tooltip>
                                  ) : null;
                                })}
                              </Stack>
                              {task.status === 'in_progress' && (
                                <LinearProgress
                                  variant="determinate"
                                  value={task.progress}
                                  sx={{ mt: 1 }}
                                />
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Export Dialog */}
        <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Export Campaign Assets</DialogTitle>
          <DialogContent>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Export Format</InputLabel>
              <Select
                value={selectedExportFormat}
                label="Export Format"
                onChange={(e) => setSelectedExportFormat(e.target.value)}
              >
                {exportFormats.map(format => (
                  <MenuItem key={format.id} value={format.id}>
                    <Box>
                      <Typography>{format.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Alert severity="info" sx={{ mt: 2 }}>
              This will export all assets from completed execution tasks.
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleExport}>
              Export
            </Button>
          </DialogActions>
        </Dialog>
      </DashboardLayout>
    </>
  );
};

export default ExecutePage;