import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Avatar,
  Stack,
  Paper,
  LinearProgress,
  Grid,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  People as PeopleIcon,
  Notifications as NotificationsIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import ActivityFeed from './ActivityFeed';
import LiveCollaboration from './LiveCollaboration';
import { useRealtime } from '@/hooks/useRealtime';
import { useClient } from '@/contexts/ClientContext';

interface RealTimeMetric {
  label: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color: string;
}

const RealTimeDashboard: React.FC = () => {
  const { activeClient: _activeClient } = useClient();
  const { events, notifications, unreadNotifications, connectionStatus } = useRealtime({
    enableNotifications: true,
    pollInterval: 5000 });

  // Calculate real-time metrics
  const recentEvents = events.filter(
    (e: any) => new Date(e.timestamp).getTime() > Date.now() - 60 * 60 * 1000 // Last hour
  );

  const executionEvents = recentEvents.filter((e: any) => e.type === 'execution_status_change');
  const completedExecutions = executionEvents.filter((e: any) => e.data.status === 'completed');
  const failedExecutions = executionEvents.filter((e: any) => e.data.status === 'failed');

  const realTimeMetrics: RealTimeMetric[] = [
    {
      label: 'Live Activity',
      value: recentEvents.length,
      change: 5.2,
      icon: <TimelineIcon />,
      color: '#2196f3' },
    {
      label: 'Active Executions',
      value: executionEvents.length,
      change: completedExecutions.length > failedExecutions.length ? 12.5 : -3.1,
      icon: <SpeedIcon />,
      color: '#4caf50' },
    {
      label: 'Team Online',
      value: 4, // This would come from actual presence data
      change: 0,
      icon: <PeopleIcon />,
      color: '#ff9800' },
    {
      label: 'Unread Alerts',
      value: unreadNotifications.length,
      change: -15.3,
      icon: <NotificationsIcon />,
      color: '#f44336' },
  ];

  const connectionHealthScore = connectionStatus === 'connected' ? 100 : 0;

  return (
    <Box>
      {/* Real-time Status Bar */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: 'background.default' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={`Real-time ${connectionStatus}`}
              color={connectionStatus === 'connected' ? 'success' : 'error'}
              size="small"
              variant="filled"
            />
            <Typography variant="body2" color="text.secondary">
              Last update: {new Date().toLocaleTimeString()}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Connection Health:
            </Typography>
            <Box sx={{ width: 100 }}>
              <LinearProgress
                variant="determinate"
                value={connectionHealthScore}
                color={connectionHealthScore === 100 ? 'success' : 'error'}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {connectionHealthScore}%
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Real-time Metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {realTimeMetrics.map((metric, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
            <Card>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start' }}
                >
                  <Box>
                    <Typography color="text.secondary" variant="body2" gutterBottom>
                      {metric.label}
                    </Typography>
                    <Typography variant="h4" sx={{ mb: 1 }}>
                      {metric.value}
                    </Typography>
                    {metric.change !== undefined && metric.change !== 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TrendingUpIcon
                          color={metric.change > 0 ? 'success' : 'error'}
                          fontSize="small"
                          sx={{ transform: metric.change < 0 ? 'scaleY(-1)' : 'none' }}
                        />
                        <Typography
                          variant="body2"
                          color={metric.change > 0 ? 'success.main' : 'error.main'}
                        >
                          {Math.abs(metric.change)}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          vs last hour
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Avatar sx={{ bgcolor: metric.color }}>{metric.icon}</Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Real-time Components Grid */}
      <Grid container spacing={3}>
        {/* Activity Feed */}
        <Grid size={{ xs: 12, md: 8 }}>
          <ActivityFeed title="Live Activity Feed" showControls={true} maxHeight={600} />
        </Grid>

        {/* Collaboration Sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <LiveCollaboration context="global" showDetails={true} />

            {/* Quick Stats */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Today's Highlights
                </Typography>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Executions Completed</Typography>
                    <Chip label={completedExecutions.length} size="small" color="success" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Executions Failed</Typography>
                    <Chip label={failedExecutions.length} size="small" color="error" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Active Notifications</Typography>
                    <Chip label={notifications.length} size="small" color="info" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Team Collaboration</Typography>
                    <Chip label="4 online" size="small" color="primary" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Recent Alerts Summary */}
            {unreadNotifications.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Recent Alerts
                  </Typography>
                  <Stack spacing={1}>
                    {unreadNotifications.slice(0, 3).map((notification: any) => (
                      <Box
                        key={notification.id}
                        sx={{
                          p: 1,
                          backgroundColor: 'action.hover',
                          borderRadius: 1,
                          borderLeft: `3px solid ${
                            notification.priority === 'urgent'
                              ? 'error.main'
                              : notification.priority === 'high'
                                ? 'warning.main'
                                : 'info.main'
                          }`,
                        }}
                      >
                        <Typography variant="body2" fontWeight="bold">
                          {notification.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {notification.category} • {notification.priority}
                        </Typography>
                      </Box>
                    ))}
                    {unreadNotifications.length > 3 && (
                      <Typography variant="caption" color="text.secondary" textAlign="center">
                        +{unreadNotifications.length - 3} more alerts
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default RealTimeDashboard;
