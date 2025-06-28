import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  Button,
  Stack,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  FormControl,
  InputLabel,
  MenuItem,
  Switch,
  FormControlLabel,
  Grid,
  CardContent,
  CircularProgress,
  LinearProgress,
  IconButton,
  Tooltip,
  TextField,
  Select,
} from '@mui/material';
import {
  Videocam as VideocamIcon,
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Delete as DeleteIcon,
  RocketLaunch as RocketLaunchIcon,
} from '@mui/icons-material';
import { useNotification } from '@/contexts/NotificationContext';
import { getErrorMessage } from '@/utils/errorUtils';

interface VideoExecutionPanelProps {
  matrixId: string;
  combinations: any[];
  onExecutionComplete?: (results: any) => void;
}

interface VideoExecution {
  id: string;
  combination_id: string;
  combination_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  video_url?: string;
  error_message?: string;
  created_at: string;
  metadata?: any;
}

const VideoExecutionPanel: React.FC<VideoExecutionPanelProps> = ({
  matrixId,
  combinations,
  onExecutionComplete,
}) => {
  const { showNotification } = useNotification();

  // State
  const [executions, setExecutions] = useState<VideoExecution[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedCombinations, setSelectedCombinations] = useState<string[]>([]);
  const [executionSettings, setExecutionSettings] = useState({
    quality: 'standard',
    auto_generate_variations: true,
    variations_per_combination: 2,
    platform_optimization: true,
    save_to_assets: true,
    include_captions: false,
  });

  // Auto-refresh active executions
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const activeExecutions = executions.filter((exec: any) =>
      ['pending', 'processing'].includes(exec.status)
    );

    if (activeExecutions.length > 0) {
      interval = setInterval(() => {
        checkExecutionStatus();
      }, 3000); // Check every 3 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [executions]);

  // Load existing executions
  useEffect(() => {
    loadExecutions();
  }, [matrixId]);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/executions?matrix_id=${matrixId}&content_type=video`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setExecutions(data.data || []);
      }
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading executions:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const checkExecutionStatus = async () => {
    try {
      const activeExecutions = executions.filter((exec: any) =>
        ['pending', 'processing'].includes(exec.status)
      );

      if (activeExecutions.length === 0) return;

      const statusPromises = activeExecutions.map((exec: any) =>
        fetch(`/api/executions/${exec.id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }).then(res => (res.ok ? res.json() : null))
      );

      const statusResults = await Promise.all(statusPromises);

      // Update executions with new status
      setExecutions(prev =>
        prev.map((exec: any) => {
          const updatedExec = statusResults.find((result: any) => result?.data?.id === exec.id);

          if (updatedExec) {
            return {
              ...exec,
              status: updatedExec.data.status,
              progress: updatedExec.data.progress?.percentage || exec.progress,
              video_url: updatedExec.data.render_url || exec.video_url,
              error_message: updatedExec.data.metadata?.error || exec.error_message,
            };
          }
          return exec;
        })
      );

      // Check for completions
      statusResults.forEach((result: any) => {
        if (result?.data?.status === 'completed') {
          showNotification('Video execution completed!', 'success');
        } else if (result?.data?.status === 'failed') {
          showNotification('Video execution failed', 'error');
        }
      });
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error checking execution status:', error);
      }
    }
  };

  const handleExecuteVideos = async () => {
    if (selectedCombinations.length === 0) {
      showNotification('Please select combinations to execute', 'warning');
      return;
    }

    try {
      setIsExecuting(true);

      const executeData = {
        combinations: selectedCombinations,
        platforms: ['youtube', 'instagram', 'tiktok'], // Multi-platform execution
        priority: 'normal',
        schedule_type: 'immediate',
        execution_settings: {
          quality: executionSettings.quality,
          formats: ['mp4'],
          resolutions: ['1920x1080', '1080x1920'], // Horizontal and vertical
          include_previews: true,
          notify_on_completion: true,
          video_specific: {
            auto_generate_variations: executionSettings.auto_generate_variations,
            variations_per_combination: executionSettings.variations_per_combination,
            platform_optimization: executionSettings.platform_optimization,
            save_to_assets: executionSettings.save_to_assets,
            include_captions: executionSettings.include_captions,
          },
        },
      };

      const response = await fetch(`/api/matrices/${matrixId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(executeData),
      });

      if (response.ok) {
        const data = await response.json();
        showNotification(
          `Started video execution for ${selectedCombinations.length} combinations`,
          'success'
        );

        // Clear selection and reload executions
        setSelectedCombinations([]);
        loadExecutions();

        if (onExecutionComplete) {
          onExecutionComplete(data);
        }
      } else {
        const error = await response.json();
        showNotification(error.error || 'Failed to start video execution', 'error');
      }
    } catch (error: any) {
      getErrorMessage(error); // Error handled by notification
      showNotification('Error starting video execution', 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRetryExecution = async (executionId: string) => {
    try {
      const response = await fetch(`/api/executions/${executionId}/retry`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        showNotification('Execution retry started', 'success');
        loadExecutions();
      } else {
        const error = await response.json();
        showNotification(error.error || 'Failed to retry execution', 'error');
      }
    } catch (error: any) {
      getErrorMessage(error); // Error handled by notification
      showNotification('Error retrying execution', 'error');
    }
  };

  const handleDeleteExecution = async (executionId: string) => {
    try {
      const response = await fetch(`/api/executions/${executionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        showNotification('Execution deleted', 'success');
        loadExecutions();
      } else {
        const error = await response.json();
        showNotification(error.error || 'Failed to delete execution', 'error');
      }
    } catch (error: any) {
      getErrorMessage(error); // Error handled by notification
      showNotification('Error deleting execution', 'error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'processing':
        return 'primary';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckIcon />;
      case 'failed':
        return <ErrorIcon />;
      case 'processing':
        return <CircularProgress size={16} />;
      case 'pending':
        return <ScheduleIcon />;
      default:
        return <ScheduleIcon />;
    }
  };

  const activeExecutions = executions.filter((exec: any) =>
    ['pending', 'processing'].includes(exec.status)
  );
  const completedExecutions = executions.filter((exec: any) => exec.status === 'completed');
  const failedExecutions = executions.filter((exec: any) => exec.status === 'failed');

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" fontWeight={600}>
          Video Execution Center
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<SettingsIcon />} onClick={() => setShowSettings(true)} size="small">
            Settings
          </Button>
          <Button
            startIcon={<RefreshIcon />}
            onClick={loadExecutions}
            disabled={loading}
            size="small"
          >
            Refresh
          </Button>
        </Stack>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="primary.main">
                {activeExecutions.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="success.main">
                {completedExecutions.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="error.main">
                {failedExecutions.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Failed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="text.primary">
                {executions.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Combination Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom fontWeight={600}>
            Combinations for Video Execution
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Choose which combinations to generate videos for. Each combination will create multiple
            video variations.
          </Typography>

          <Grid container spacing={2}>
            {combinations.map((combination: any) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={combination.id}>
                <Card
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    border: selectedCombinations.includes(combination.id)
                      ? '2px solid'
                      : '1px solid',
                    borderColor: selectedCombinations.includes(combination.id)
                      ? 'primary.main'
                      : 'divider',
                  }}
                  onClick={() => {
                    setSelectedCombinations(prev =>
                      prev.includes(combination.id)
                        ? prev.filter((id: any) => id !== combination.id)
                        : [...prev, combination.id]
                    );
                  }}
                >
                  <CardContent sx={{ py: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {combination.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Quality Score: {combination.qualityScore || 'N/A'}
                    </Typography>
                    {selectedCombinations.includes(combination.id) && (
                      <CheckIcon
                        color="primary"
                        sx={{ position: 'absolute', top: 8, right: 8, fontSize: 20 }}
                      />
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {selectedCombinations.length > 0 && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="body2" gutterBottom>
                <strong>{selectedCombinations.length}</strong> combinations selected
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Estimated videos:{' '}
                {selectedCombinations.length * executionSettings.variations_per_combination * 3} (3
                platforms × {executionSettings.variations_per_combination} variations each)
              </Typography>
              <Button
                variant="contained"
                startIcon={isExecuting ? <CircularProgress size={20} /> : <RocketLaunchIcon />}
                onClick={handleExecuteVideos}
                disabled={isExecuting}
                sx={{ mt: 1 }}
              >
                {isExecuting ? 'Executing...' : 'Execute Video Generation'}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Active Executions */}
      {activeExecutions.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              Active Executions
            </Typography>
            <List>
              {activeExecutions.map((execution: any) => (
                <ListItem key={execution.id} divider>
                  <ListItemIcon>{getStatusIcon(execution.status)}</ListItemIcon>
                  <ListItemText
                    primary={execution.combination_name}
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          Status: {execution.status} • Progress: {execution.progress}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={execution.progress}
                          sx={{ mt: 1 }}
                        />
                      </Box>
                    }
                  />
                  <Chip
                    size="small"
                    label={`${execution.progress}%`}
                    color={getStatusColor(execution.status) as any}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Completed Executions */}
      {executions.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              Execution History
            </Typography>
            <List>
              {executions.map((execution: any) => (
                <ListItem key={execution.id} divider>
                  <ListItemIcon>{getStatusIcon(execution.status)}</ListItemIcon>
                  <ListItemText
                    primary={execution.combination_name}
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          Status: {execution.status} • Created:{' '}
                          {new Date(execution.created_at).toLocaleString()}
                        </Typography>
                        {execution.error_message && (
                          <Alert severity="error" sx={{ mt: 1 }}>
                            {execution.error_message}
                          </Alert>
                        )}
                      </Box>
                    }
                  />
                  <Stack direction="row" spacing={1}>
                    {execution.video_url && (
                      <Tooltip title="View Video">
                        <IconButton size="small" href={execution.video_url} target="_blank">
                          <PlayArrowIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {execution.status === 'failed' && (
                      <Tooltip title="Retry">
                        <IconButton size="small" onClick={() => handleRetryExecution(execution.id)}>
                          <RefreshIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteExecution(execution.id)}
                        disabled={['pending', 'processing'].includes(execution.status)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </ListItem>
              ))}
            </List>
            {executions.length === 0 && !loading && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <VideocamIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No video executions yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Select combinations above to start generating videos
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Video Execution Settings</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Quality</InputLabel>
              <Select
                value={executionSettings.quality}
                label="Quality"
                onChange={e => setExecutionSettings(prev => ({ ...prev, quality: e.target.value }))}
              >
                <MenuItem value="draft">Draft (Fast)</MenuItem>
                <MenuItem value="standard">Standard</MenuItem>
                <MenuItem value="high">High (Slow)</MenuItem>
              </Select>
            </FormControl>

            <Box>
              <Typography variant="body2" gutterBottom>
                Variations per Combination: {executionSettings.variations_per_combination}
              </Typography>
              <TextField
                type="number"
                fullWidth
                value={executionSettings.variations_per_combination}
                onChange={e =>
                  setExecutionSettings(prev => ({
                    ...prev,
                    variations_per_combination: Math.max(
                      1,
                      Math.min(5, parseInt(e.target.value) || 1)
                    ),
                  }))
                }
                inputProps={{ min: 1, max: 5 }}
              />
            </Box>

            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={executionSettings.auto_generate_variations}
                    onChange={e =>
                      setExecutionSettings(prev => ({
                        ...prev,
                        auto_generate_variations: e.target.checked,
                      }))
                    }
                  />
                }
                label="Auto-generate variations"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={executionSettings.platform_optimization}
                    onChange={e =>
                      setExecutionSettings(prev => ({
                        ...prev,
                        platform_optimization: e.target.checked,
                      }))
                    }
                  />
                }
                label="Platform optimization"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={executionSettings.save_to_assets}
                    onChange={e =>
                      setExecutionSettings(prev => ({
                        ...prev,
                        save_to_assets: e.target.checked,
                      }))
                    }
                  />
                }
                label="Save to assets"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={executionSettings.include_captions}
                    onChange={e =>
                      setExecutionSettings(prev => ({
                        ...prev,
                        include_captions: e.target.checked,
                      }))
                    }
                  />
                }
                label="Include captions"
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VideoExecutionPanel;
