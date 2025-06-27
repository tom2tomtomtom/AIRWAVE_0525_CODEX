import { getErrorMessage } from '@/utils/errorUtils';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Alert,
  Stack,
  Avatar,
  Badge,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Refresh as RetryIcon,
  MoreVert as MoreIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as ScheduledIcon,
  Pending as PendingIcon,
  Cancel as CancelIcon,
  Analytics as AnalyticsIcon,
  Timeline as TimelineIcon} from '@mui/icons-material';
import { useNotification } from '@/contexts/NotificationContext';
import { useClient } from '@/contexts/ClientContext';
import { useExecutionEvents } from '@/hooks/useRealtime';

interface Execution {
  id: string;
  matrix_id: string;
  campaign_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'scheduled';
  platform: string;
  content_type: string;
  progress?: number;
  created_at: string;
  updated_at: string;
  render_url?: string;
  error_message?: string;
  metadata?: any;
  matrices?: {
    id: string;
    name: string;
    campaigns?: {
      id: string;
      name: string;
    };
  };
  profiles?: {
    full_name: string;
  };
}

interface ExecutionFilters {
  status?: string;
  platform?: string;
  priority?: string;
  date_from?: string;
  date_to?: string;
}

interface ExecutionMonitorProps {
  maxHeight?: number;
  showHeader?: boolean;
  realtime?: boolean;
  campaignId?: string;
  matrixId?: string;
}

const ExecutionMonitor: React.FC<ExecutionMonitorProps> = ({
  maxHeight = 400,
  showHeader = true,
  realtime = true,
  campaignId,
  matrixId}) => {
  const { activeClient } = useClient();
  const { showNotification } = useNotification();
  const { executionEvents: _executionEvents, connectionStatus } = useExecutionEvents();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, _setFilters] = useState<ExecutionFilters>({});
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [retryDialogOpen, setRetryDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [retryOptions, setRetryOptions] = useState({
    force: false,
    priority: 'normal',
    reset_attempts: false,
    delay_seconds: 0,
    retry_reason: ''});

  // Fetch executions
  const fetchExecutions = async () => {
    if (!activeClient) return;

    try {
      const params = new URLSearchParams({
        limit: '50',
        include_analytics: 'true',
        sort_by: 'created_at',
        sort_order: 'desc',
        ...filters,
        ...(campaignId && { campaign_id: campaignId }),
        ...(matrixId && { matrix_id: matrixId })});

      const response = await fetch(`/api/executions?${params}`, {
        headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')
      }`}});

      if (response.ok) {
        const data = await response.json();
        setExecutions(data.data || []);
      }
    } catch (error: any) {
      const message = getErrorMessage(error);
      console.error('Error fetching executions:', message);
    } finally {
      setLoading(false);
    }
  };

  // Retry execution
  const handleRetryExecution = async () => {
    if (!selectedExecution) return;

    try {
      const response = await fetch(`/api/executions/${selectedExecution.id}/retry`, {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')
      }`},
        body: JSON.stringify(retryOptions)});

      if (response.ok) {
        // const data = await response.json(); // Response not needed for success notification
        showNotification('Execution retry initiated successfully', 'success');
        setRetryDialogOpen(false);
        fetchExecutions();
      } else {
        const error = await response.json();
        showNotification(error.error || 'Failed to retry execution', 'error');
      }
    } catch (error: any) {
      const message = getErrorMessage(error);
      showNotification(`Error retrying execution: ${message}`, 'error');
    }
  };

  // Cancel execution
  const handleCancelExecution = async () => {
    if (!selectedExecution) return;

    try {
      const response = await fetch(`/api/executions/${selectedExecution.id}/cancel`, {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')
      }`},
        body: JSON.stringify({
          reason: 'User requested cancellation',
          cleanup_resources: true})});

      if (response.ok) {
        showNotification('Execution cancelled successfully', 'success');
        setCancelDialogOpen(false);
        fetchExecutions();
      } else {
        const error = await response.json();
        showNotification(error.error || 'Failed to cancel execution', 'error');
      }
    } catch (error: any) {
      const message = getErrorMessage(error);
      showNotification(`Error cancelling execution: ${message}`, 'error');
    }
  };

  // Get execution status color and icon
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'completed':
        return { color: 'success', icon: <SuccessIcon />, label: 'Completed' };
      case 'processing':
        return { color: 'info', icon: <PlayIcon />, label: 'Processing' };
      case 'failed':
        return { color: 'error', icon: <ErrorIcon />, label: 'Failed' };
      case 'cancelled':
        return { color: 'warning', icon: <CancelIcon />, label: 'Cancelled' };
      case 'scheduled':
        return { color: 'info', icon: <ScheduledIcon />, label: 'Scheduled' };
      default:
        return { color: 'default', icon: <PendingIcon />, label: 'Pending' };
    }
  };

  // Get platform icon/color
  const getPlatformDisplay = (platform: string) => {
    const displays = {
      facebook: { color: '#1877F2', name: 'Facebook'  },
  instagram: { color: '#E1306C', name: 'Instagram'  },
  twitter: { color: '#1DA1F2', name: 'Twitter'  },
  linkedin: { color: '#0A66C2', name: 'LinkedIn'  },
  youtube: { color: '#FF0000', name: 'YouTube'  },
  tiktok: { color: '#000000', name: 'TikTok' }};
    return displays[platform as keyof typeof displays] || { color: '#666', name: platform };
  };

  // Calculate execution time
  const getExecutionTime = (execution: Execution) => {
    const start = new Date(execution.created_at);
    const end = execution.status === 'completed' ? new Date(execution.updated_at) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 1) return '< 1 min';
    if (diffMins < 60) return `${diffMins} min`;
    return `${Math.round(diffMins / 60)} hr`;
  };

  // Menu handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, execution: Execution) => {
    setMenuAnchor(event.currentTarget);
    setSelectedExecution(execution);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedExecution(null);
  };

  const handleRetryClick = () => {
    setRetryDialogOpen(true);
    handleMenuClose();
  };

  const handleCancelClick = () => {
    setCancelDialogOpen(true);
    handleMenuClose();
  };

  // Effects
  useEffect(() => {
    fetchExecutions();
  }, [activeClient, filters, campaignId, matrixId]);

  useEffect(() => {
    if (realtime) {
      const interval = setInterval(fetchExecutions, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
    return undefined;
  }, [realtime, fetchExecutions]);

  if (!activeClient) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary" align="center">
            Select a client to view executions
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {showHeader && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Execution Monitor
            {realtime && (
              <Chip 
                size="small" 
                color={connectionStatus === 'connected' ? 'success' : 'warning'} 
                label={connectionStatus === 'connected' ? 'Live' : 'Offline'} 
                sx={{ ml: 1 }}
              />
            )}
          </Typography>
          <Button
            startIcon={<TimelineIcon />}
            onClick={fetchExecutions}
            disabled={loading}
            size="small"
          >
            Refresh
          </Button>
        </Box>
      )}

      {/* Quick Stats */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { label: 'Total', count: executions.length, color: 'default' },
          { label: 'Processing', count: executions.filter((e: any) => e.status === 'processing').length, color: 'info' },
          { label: 'Completed', count: executions.filter((e: any) => e.status === 'completed').length, color: 'success' },
          { label: 'Failed', count: executions.filter((e: any) => e.status === 'failed').length, color: 'error' }
        ].map((stat: any) => (
          <Grid size={{ xs: 3 }} key={stat.label}>
            <Card variant="outlined" sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="h6" color={`${stat.color}.main`}>
                {stat.count}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stat.label}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Executions List */}
      <Card>
        <Box sx={{ maxHeight, overflow: 'auto' }}>
          {loading ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <LinearProgress />
              <Typography variant="body2" sx={{ mt: 1 }}>
                Loading executions...
              </Typography>
            </Box>
          ) : executions.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <AnalyticsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No executions found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {campaignId || matrixId ? 'No executions for this item' : 'Start executing campaigns to see them here'}
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {executions.map((execution, index) => {
                const statusDisplay = getStatusDisplay(execution.status);
                const platformDisplay = getPlatformDisplay(execution.platform);
                
                return (
                  <React.Fragment key={execution.id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      secondaryAction={
                        <IconButton
                          size="small"
                          onClick={(e: React.MouseEvent<HTMLElement>) => handleMenuOpen(e, execution)}
                          aria-label="Icon button"
                        >
                          <MoreIcon />
                        </IconButton>
                      }
                    >
                      <ListItemIcon>
                        <Badge
                          color={statusDisplay.color as any}
                          variant="dot"
                          invisible={execution.status === 'pending'}
                        >
                          <Avatar sx={{ bgcolor: platformDisplay.color, width: 32, height: 32 }}>
                            <Typography variant="caption" sx={{ color: 'white' }}>
                              {execution.platform.charAt(0).toUpperCase()}
                            </Typography>
                          </Avatar>
                        </Badge>
                      </ListItemIcon>
                      
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="subtitle2">
                              {execution.matrices?.campaigns?.name || 'Unknown Campaign'}
                            </Typography>
                            <Chip
                              size="small"
                              label={statusDisplay.label}
                              color={statusDisplay.color as any}
                              variant="outlined"
                            />
                            <Chip
                              size="small"
                              label={execution.content_type}
                              variant="outlined"
                            />
                          </Stack>
                        }
                        secondary={
                          <Box sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {platformDisplay.name} • {getExecutionTime(execution)} • 
                              {execution.profiles?.full_name || 'Unknown User'}
                            </Typography>
                            {execution.status === 'processing' && execution.progress && (
                              <Box sx={{ mt: 0.5 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={execution.progress}
                                  sx={{ height: 6 }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  {execution.progress}% complete
                                </Typography>
                              </Box>
                            )}
                            {execution.error_message && (
                              <Alert severity="error" sx={{ mt: 0.5, py: 0 }}>
                                <Typography variant="caption">
                                  {execution.error_message}
                                </Typography>
                              </Alert>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </Box>
      </Card>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={handleRetryClick}
          disabled={!selectedExecution || !['failed', 'cancelled'].includes(selectedExecution.status)}
        >
          <ListItemIcon>
            <RetryIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Retry</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={handleCancelClick}
          disabled={!selectedExecution || !['pending', 'processing'].includes(selectedExecution.status)}
        >
          <ListItemIcon>
            <StopIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Cancel</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <AnalyticsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
      </Menu>

      {/* Retry Dialog */}
      <Dialog open={retryDialogOpen} onClose={() => setRetryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Retry Execution</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Retry execution for: {selectedExecution?.matrices?.campaigns?.name}
          </Typography>
          
          <TextField
            fullWidth
            label="Retry Reason"
            value={retryOptions.retry_reason}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRetryOptions({ ...retryOptions, retry_reason: e.target.value })}
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={retryOptions.force}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRetryOptions({ ...retryOptions, force: e.target.checked })}
              />
            }
            label="Force retry (override status check)"
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={retryOptions.reset_attempts}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRetryOptions({ ...retryOptions, reset_attempts: e.target.checked })}
              />
            }
            label="Reset retry attempt counter"
          />
          
          <TextField
            fullWidth
            type="number"
            label="Delay (seconds)"
            value={retryOptions.delay_seconds}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRetryOptions({ ...retryOptions, delay_seconds: parseInt(e.target.value) || 0 })}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRetryDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRetryExecution}>
            Retry Execution
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle>Cancel Execution</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to cancel this execution? This action cannot be undone.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {selectedExecution?.matrices?.campaigns?.name} • {selectedExecution?.platform}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>Keep Running</Button>
          <Button variant="contained" color="error" onClick={handleCancelExecution}>
            Cancel Execution
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExecutionMonitor;