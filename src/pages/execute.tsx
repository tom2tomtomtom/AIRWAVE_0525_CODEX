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
  Paper,
  Alert,
  CircularProgress,
  Chip,
  Avatar,
  ListItemIcon,
  Divider,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  LinearProgress,
  Tabs,
  Tab,
  Menu,
  MenuList,
  MenuItem as MenuItemComponent} from '@mui/material';
import {
  PlayArrow as ExecuteIcon,
  Schedule as ScheduleIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  Assessment as AnalyticsIcon,
  MoreVert as MoreIcon,
  Launch as LaunchIcon,
  Visibility as ViewIcon,
  Speed as SpeedIcon,
  TrendingUp as TrendingUpIcon,
  Campaign as CampaignIcon} from '@mui/icons-material';
import DashboardLayout from '@/components/DashboardLayout';
import ExecutionMonitor from '@/components/ExecutionMonitor';
import { useClient } from '@/contexts/ClientContext';
import { useNotification } from '@/contexts/NotificationContext';

interface ExecutionQueue {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  progress: number;
  total_items: number;
  completed_items: number;
  failed_items: number;
  estimated_completion: string;
  created_at: string;
  campaign: {
    id: string;
    name: string;
  };
  matrix: {
    id: string;
    name: string;
  };
}

interface ExecutionStats {
  total_executions: number;
  pending_executions: number;
  processing_executions: number;
  completed_executions: number;
  failed_executions: number;
  success_rate: number;
  average_completion_time: number;
  total_processing_time: number;
}

const ExecutePage: React.FC = () => {
  const router = useRouter();
  const { activeClient } = useClient();
  const { showNotification } = useNotification();

  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executionQueues, setExecutionQueues] = useState<ExecutionQueue[]>([]);
  const [executionStats, setExecutionStats] = useState<ExecutionStats | null>(null);
  const [selectedQueue, setSelectedQueue] = useState<ExecutionQueue | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  // Filters and controls
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [refreshInterval, setRefreshInterval] = useState<number>(30); // seconds

  // Load execution data
  const loadExecutionData = async () => {
    if (!activeClient) return;

    setLoading(true);
    setError(null);

    try {
      // Load execution queues
      const queuesResponse = await fetch(`/api/executions?client_id=${activeClient.id}&include_analytics=true`);
      const queuesResult = await queuesResponse.json();

      if (queuesResult.data) {
        // Group executions by matrix/campaign to create "queues"
        const groupedExecutions = groupExecutionsByQueue(queuesResult.data);
        setExecutionQueues(groupedExecutions);
      }

      // Load execution statistics
      const statsResponse = await fetch(`/api/analytics/execution-stats?client_id=${activeClient.id}`);
      const statsResult = await statsResponse.json();

      if (statsResult.data) {
        setExecutionStats(statsResult.data);
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to load execution data');
    } finally {
      setLoading(false);
    }
  };

  // Group executions by matrix/campaign to create execution queues
  const groupExecutionsByQueue = (executions: any[]): ExecutionQueue[] => {
    const grouped = executions.reduce((acc: any, execution: any) => {
      const key = `${execution.matrix_id}-${execution.campaign_id}`;

      if (!acc[key]) {
        acc[key] = {
          id: key,
          name: `${execution.matrices?.name || 'Unknown Matrix'} - ${execution.matrices?.campaigns?.name || 'Unknown Campaign'}`,
          executions: [],
          campaign: {
            id: execution.campaign_id,
            name: execution.matrices?.campaigns?.name || 'Unknown Campaign' },
          matrix: {
            id: execution.matrix_id,
            name: execution.matrices?.name || 'Unknown Matrix' },
        };
      }

      acc[key].executions.push(execution);
      return acc;
    }, {});

    return Object.values(grouped).map((group: any) => {
      const executions = group.executions;
      const totalItems = executions.length;
      const completedItems = executions.filter((e: any) => e.status === 'completed').length;
      const failedItems = executions.filter((e: any) => e.status === 'failed').length;
      const processingItems = executions.filter((e: any) => e.status === 'processing').length;

      // Determine overall queue status
      let status: ExecutionQueue['status'] = 'pending';
      if (processingItems > 0) status = 'processing';
      else if (completedItems === totalItems) status = 'completed';
      else if (failedItems > 0 && completedItems + failedItems === totalItems) status = 'failed';

      // Calculate progress
      const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

      // Determine priority (highest priority of any execution in the queue)
      const priorities = executions.map((e: any) => e.priority || 'normal');
      const priority = priorities.includes('urgent') ? 'urgent' :
                     priorities.includes('high') ? 'high' :
                     priorities.includes('normal') ? 'normal' : 'low';

      return {
        id: group.id,
        name: group.name,
        status,
        priority,
        progress,
        total_items: totalItems,
        completed_items: completedItems,
        failed_items: failedItems,
        estimated_completion: calculateEstimatedCompletion(executions),
        created_at: Math.min(...executions.map((e: any) => new Date(e.created_at).getTime())).toString(),
        campaign: group.campaign,
        matrix: group.matrix};
    });
  };

  // Calculate estimated completion time
  const calculateEstimatedCompletion = (executions: any[]): string => {
    const processingExecutions = executions.filter((e: any) => e.status === 'processing');
    if (processingExecutions.length === 0) return 'N/A';

    // Simple estimation: assume 2 minutes per execution
    const remainingExecutions = executions.filter((e: any) =>
      e.status === 'pending' || e.status === 'processing'
    ).length;

    const estimatedMinutes = remainingExecutions * 2;
    const completionTime = new Date(Date.now() + estimatedMinutes * 60 * 1000);

    return completionTime.toLocaleTimeString();
  };

  // Handle queue actions
  const handleQueueAction = async (queueId: string, action: 'pause' | 'resume' | 'stop' | 'retry') => {
    try {
      const response = await fetch(`/api/executions/queue/${queueId}/${action}`, {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json'
      }});

      if (response.ok) {
        showNotification(`Queue ${action} successful`, 'success');
        loadExecutionData();
      } else {
        throw new Error(`Failed to ${action} queue`);
      }
    } catch (err: any) {
      showNotification(`Failed to ${action} queue`, 'error');
    }
  };


  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'info';
      case 'failed':
        return 'error';
      case 'paused':
        return 'warning';
      default:
        return 'default';
    }
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'normal':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (activeClient) {
      loadExecutionData();
    }
  }, [activeClient]);

  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(loadExecutionData, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [refreshInterval, activeClient]);

  return (
    <>
       <Head>
        <title>Campaign Execution | AIRFLOW</title>
      </Head>
      <DashboardLayout title="Campaign Execution">
        <Box sx={{ mb: 4 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
            <Box display="flex" alignItems="center" gap={2}>
              <ExecuteIcon sx={{ color: 'primary.main', fontSize: 32 }} />
              <Box>
                <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
                  Campaign Execution
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Monitor and manage campaign execution queues and jobs
                </Typography>
              </Box>
            </Box>
            <Stack direction="row" spacing={2}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Auto Refresh</InputLabel>
                <Select
                  value={refreshInterval}
                  label="Auto Refresh"
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                >
                  <MenuItem value={0}>Off</MenuItem>
                  <MenuItem value={10}>10 seconds</MenuItem>
                  <MenuItem value={30}>30 seconds</MenuItem>
                  <MenuItem value={60}>1 minute</MenuItem>
                </Select>
              </FormControl>
              <Tooltip title="Refresh Now">
                <IconButton onClick={loadExecutionData} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Button
                variant="contained"
                startIcon={<LaunchIcon />}
                onClick={() => router.push('/matrix')}
              >
                New Execution
              </Button>
            </Stack>
          </Box>

          {!activeClient && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              Please select a client to view execution data.
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {loading && (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          )}

          {!loading && activeClient && (
            <Box>
              {/* Execution Statistics */}
              {executionStats && (
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card>
                      <CardContent>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box>
                            <Typography color="text.secondary" variant="body2">
                              Total Executions
                            </Typography>
                            <Typography variant="h4">
                              {executionStats.total_executions}
                            </Typography>
                          </Box>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            <TimelineIcon />
                          </Avatar>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card>
                      <CardContent>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box>
                            <Typography color="text.secondary" variant="body2">
                              Processing
                            </Typography>
                            <Typography variant="h4">
                              {executionStats.processing_executions}
                            </Typography>
                          </Box>
                          <Avatar sx={{ bgcolor: 'info.main' }}>
                            <SpeedIcon />
                          </Avatar>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card>
                      <CardContent>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box>
                            <Typography color="text.secondary" variant="body2">
                              Success Rate
                            </Typography>
                            <Typography variant="h4">
                              {(executionStats.success_rate * 100).toFixed(1)}%
                            </Typography>
                          </Box>
                          <Avatar sx={{ bgcolor: 'success.main' }}>
                            <TrendingUpIcon />
                          </Avatar>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card>
                      <CardContent>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box>
                            <Typography color="text.secondary" variant="body2">
                              Avg. Completion
                            </Typography>
                            <Typography variant="h4">
                              {Math.round(executionStats.average_completion_time)}m
                            </Typography>
                          </Box>
                          <Avatar sx={{ bgcolor: 'warning.main' }}>
                            <ScheduleIcon />
                          </Avatar>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}

              {/* Tabs for different views */}
              <Paper sx={{ mb: 3 }}>
                <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
                  <Tab label="Execution Queues" icon={<TimelineIcon />} />
                  <Tab label="Live Monitor" icon={<SpeedIcon />} />
                  <Tab label="Execution History" icon={<AnalyticsIcon />} />
                </Tabs>
              </Paper>

              {/* Tab Content */}
              {activeTab === 0 && (
                <Box>
                  {/* Filters */}
                  <Box display="flex" gap={2} mb={3}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={statusFilter}
                        label="Status"
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        <MenuItem value="all">All Status</MenuItem>
                        <MenuItem value="pending">Pending</MenuItem>
                        <MenuItem value="processing">Processing</MenuItem>
                        <MenuItem value="completed">Completed</MenuItem>
                        <MenuItem value="failed">Failed</MenuItem>
                        <MenuItem value="paused">Paused</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Priority</InputLabel>
                      <Select
                        value={priorityFilter}
                        label="Priority"
                        onChange={(e) => setPriorityFilter(e.target.value)}
                      >
                        <MenuItem value="all">All Priority</MenuItem>
                        <MenuItem value="urgent">Urgent</MenuItem>
                        <MenuItem value="high">High</MenuItem>
                        <MenuItem value="normal">Normal</MenuItem>
                        <MenuItem value="low">Low</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Execution Queues */}
                  {executionQueues.length > 0 ? (
                    <Grid container spacing={3}>
                      {executionQueues
                        .filter((queue: any) => statusFilter === 'all' || queue.status === statusFilter)
                        .filter((queue: any) => priorityFilter === 'all' || queue.priority === priorityFilter)
                        .map((queue: any) => (
                          <Grid size={{ xs: 12, md: 6, lg: 4 }} key={queue.id}>
                            <Card>
                              <CardContent>
                                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                                  <Typography variant="h6" noWrap>
                                    {queue.name}
                                  </Typography>
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      setSelectedQueue(queue);
                                      setMenuAnchor(e.currentTarget);
                                    }}
                                  >
                                    <MoreIcon />
                                  </IconButton>
                                </Box>

                                <Box display="flex" gap={1} mb={2}>
                                  <Chip
                                    label={queue.status}
                                    color={getStatusColor(queue.status) as any}
                                    size="small"
                                  />
                                  <Chip
                                    label={queue.priority}
                                    color={getPriorityColor(queue.priority) as any}
                                    size="small"
                                    variant="outlined"
                                  />
                                </Box>

                                <Box mb={2}>
                                  <Box display="flex" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2" color="text.secondary">
                                      Progress
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      {queue.completed_items}/{queue.total_items}
                                    </Typography>
                                  </Box>
                                  <LinearProgress
                                    variant="determinate"
                                    value={queue.progress}
                                    sx={{ height: 8, borderRadius: 4 }}
                                  />
                                </Box>

                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                  <Typography variant="caption" color="text.secondary">
                                    ETA: {queue.estimated_completion}
                                  </Typography>
                                  <Box display="flex" gap={1}>
                                    {queue.status === 'processing' && (
                                      <Tooltip title="Pause Queue">
                                        <IconButton
                                          size="small"
                                          onClick={() => handleQueueAction(queue.id, 'pause')}
                                        >
                                          <PauseIcon />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    {queue.status === 'paused' && (
                                      <Tooltip title="Resume Queue">
                                        <IconButton
                                          size="small"
                                          onClick={() => handleQueueAction(queue.id, 'resume')}
                                        >
                                          <ExecuteIcon />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    <Tooltip title="View Details">
                                      <IconButton
                                        size="small"
                                        onClick={() => router.push(`/matrix/${queue.matrix.id}`)}
                                      >
                                        <ViewIcon />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                </Box>
                              </CardContent>
                            </Card>
                          </Grid>
                        ))}
                    </Grid>
                  ) : (
                    <Card>
                      <CardContent>
                        <Box textAlign="center" py={4}>
                          <ExecuteIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                          <Typography variant="h6" color="text.secondary" gutterBottom>
                            No Execution Queues
                          </Typography>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            Start executing campaigns to see them here.
                          </Typography>
                          <Button
                            variant="contained"
                            startIcon={<LaunchIcon />}
                            onClick={() => router.push('/matrix')}
                          >
                            Create Execution
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  )}
                </Box>
              )}

              {activeTab === 1 && (
                <ExecutionMonitor
                  maxHeight={600}
                  showHeader={true}
                  realtime={true}
                />
              )}

              {activeTab === 2 && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Execution History
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Detailed execution history and analytics will be displayed here.
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </Box>
          )}
        </Box>

        {/* Queue Actions Menu */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuList>
            <MenuItemComponent onClick={() => {
              if (selectedQueue) {
                router.push(`/matrix/${selectedQueue.matrix.id}`);
              }
              setMenuAnchor(null);
            }}>
              <ListItemIcon>
                <ViewIcon />
              </ListItemIcon>
              View Matrix
            </MenuItemComponent>
            <MenuItemComponent onClick={() => {
              if (selectedQueue) {
                router.push(`/campaigns/${selectedQueue.campaign.id}`);
              }
              setMenuAnchor(null);
            }}>
              <ListItemIcon>
                <CampaignIcon />
              </ListItemIcon>
              View Campaign
            </MenuItemComponent>
            <Divider />
            <MenuItemComponent onClick={() => {
              if (selectedQueue && selectedQueue.status === 'failed') {
                handleQueueAction(selectedQueue.id, 'retry');
              }
              setMenuAnchor(null);
            }}>
              <ListItemIcon>
                <RefreshIcon />
              </ListItemIcon>
              Retry Failed
            </MenuItemComponent>
            <MenuItemComponent onClick={() => {
              if (selectedQueue) {
                handleQueueAction(selectedQueue.id, 'stop');
              }
              setMenuAnchor(null);
            }}>
              <ListItemIcon>
                <StopIcon />
              </ListItemIcon>
              Stop Queue
            </MenuItemComponent>
          </MenuList>
        </Menu>
      </DashboardLayout>
    </>
  );
};

export default ExecutePage;