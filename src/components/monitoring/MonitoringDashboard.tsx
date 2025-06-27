/**
 * Monitoring Dashboard Component
 * Real-time performance monitoring and alerting dashboard
 * Displays system health, metrics, and alerts
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Alert,
  AlertTitle,
  CircularProgress,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tabs,
  Tab,
  Paper,
  useTheme} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Notifications as NotificationsIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon} from '@mui/icons-material';
// import { Line, Bar, Doughnut } from 'react-chartjs-2';
/*
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  ArcElement
);
*/

// Types
interface DashboardMetric {
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  change: number;
  timestamp: Date;
  status: 'good' | 'warning' | 'critical';
}

interface Alert {
  id: string;
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  state: 'firing' | 'resolved' | 'acknowledged' | 'silenced';
  firstSeen: string;
  lastSeen: string;
  value: number;
  threshold: number;
}

interface DashboardData {
  overview: {
    health: 'healthy' | 'degraded' | 'critical';
    uptime: number;
    activeAlerts: number;
    lastUpdated: string;
  };
  sections: Array<{
    id: string;
    title: string;
    metrics: DashboardMetric[];
    charts: Array<{
      id: string;
      title: string;
      type: 'line' | 'bar' | 'pie' | 'gauge';
      data: Array<{ timestamp: Date; value: number; label?: string }>;
      config: any;
    }>;
    alerts: number;
  }>;
}

const MonitoringDashboard: React.FC = () => {
  const theme = useTheme();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [alertDetailsOpen, setAlertDetailsOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      const [dashboardResponse, alertsResponse] = await Promise.all([
        fetch('/api/monitoring/dashboard'),
        fetch('/api/monitoring/alerts'),
      ]);

      if (dashboardResponse.ok) {
        const dashboardResult = await dashboardResponse.json();
        setDashboardData(dashboardResult.data);
      }

      if (alertsResponse.ok) {
        const alertsResult = await alertsResponse.json();
        setAlerts(alertsResult.data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    fetchDashboardData();

    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Get status color based on health/status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'good':
        return theme.palette.success.main;
      case 'degraded':
      case 'warning':
        return theme.palette.warning.main;
      case 'critical':
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  // Get trend icon
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUpIcon color="success" />;
      case 'down':
        return <TrendingDownIcon color="error" />;
      default:
        return <TrendingFlatIcon color="disabled" />;
    }
  };

  // Get severity icon
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'high':
        return <WarningIcon color="warning" />;
      case 'medium':
        return <InfoIcon color="info" />;
      default:
        return <CheckCircleIcon color="success" />;
    }
  };

  // Handle alert acknowledgment
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/monitoring/alerts?action=acknowledge', {
        method: 'PATCH',
        headers: {
        'Content-Type': 'application/json' 
      },
        body: JSON.stringify({
          alertId,
          acknowledgedBy: 'current-user', // In real app, get from auth context
        })});

      if (response.ok) {
        fetchDashboardData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  // Render metric card
  const MetricCard: React.FC<{ metric: DashboardMetric }> = ({ metric }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6" component="div" gutterBottom>
              {metric.name}
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="h4" component="div">
                {metric.value.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {metric.unit}
              </Typography>
            </Box>
            {metric.change > 0 && (
              <Box display="flex" alignItems="center" gap={0.5} mt={1}>
                {getTrendIcon(metric.trend)}
                <Typography
                  variant="body2"
                  color={metric.trend === 'up' ? 'success.main' : 'error.main'}
                >
                  {metric.change.toFixed(1)}%
                </Typography>
              </Box>
            )}
          </Box>
          <Chip
            size="small"
            label={metric.status}
            sx={{
              backgroundColor: getStatusColor(metric.status),
              color: 'white'}}
          />
        </Box>
      </CardContent>
    </Card>
  );

  // Render chart
  const renderChart = (chart: any) => {
    // TODO: Uncomment when react-chartjs-2 is installed
    // const chartData = {
    //   labels: chart.data.map((d: any) => 
    //     d.timestamp ? new Date(d.timestamp).toLocaleTimeString() : d.label || ''
    //   ),
    //   datasets: [
    //     {
    //       label: chart.title,
    //       data: chart.data.map((d: any) => d.value),
    //       borderColor: chart.config.colors?.[0] || theme.palette.primary.main,
    //       backgroundColor: `${chart.config.colors?.[0] || theme.palette.primary.main}20`,
    //       tension: 0.4 }
    //   ]};

    // const options = {
    //   responsive: true,
    //   maintainAspectRatio: false,
    //   plugins: {
    //     legend: {
    //       display: false
    //     },
    //     title: {
    //       display: false
    //     }
    //   },
    //   scales: {
    //     y: {
    //       beginAtZero: true,
    //       grid: {
    //         color: theme.palette.divider
    //       }
    //     },
    //     x: {
    //       grid: {
    //         color: theme.palette.divider
    //       }
    //     }
    //   }
    // };

    switch (chart.type) {
      case 'line':
        return <div>Chart placeholder (react-chartjs-2 not installed)</div>;
      case 'bar':
        return <div>Chart placeholder (react-chartjs-2 not installed)</div>;
      default:
        return <div>Chart placeholder (react-chartjs-2 not installed)</div>;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (!dashboardData) {
    return (
      <Alert severity="error">
        <AlertTitle>Error</AlertTitle>
        Failed to load dashboard data. Please try refreshing the page.
      </Alert>
    );
  }

  const tabLabels = ['Overview', ...dashboardData.sections.map(s => s.title), 'Alerts'];

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          System Monitoring
        </Typography>
        <Box display="flex" gap={1}>
          <Tooltip title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}>
            <IconButton
              onClick={() => setAutoRefresh(!autoRefresh)}
              color={autoRefresh ? 'primary' : 'default'}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchDashboardData}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* System Health Overview */}
      <Alert
        severity={
          dashboardData.overview.health === 'healthy' ? 'success' :
          dashboardData.overview.health === 'degraded' ? 'warning' : 'error'
        }
        sx={{ mb: 3 }}
      >
        <AlertTitle>System Health: {dashboardData.overview.health.toUpperCase()}</AlertTitle>
        Uptime: {dashboardData.overview.uptime}% | Active Alerts: {dashboardData.overview.activeAlerts} | 
        Last Updated: {new Date(dashboardData.overview.lastUpdated).toLocaleString()}
      </Alert>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={selectedTab}
          onChange={(_, newValue) => setSelectedTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabLabels.map((label, index) => (
            <Tab
              key={index}
              label={label}
              icon={
                index === tabLabels.length - 1 ? (
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <NotificationsIcon />
                    {alerts.length > 0 && (
                      <Chip
                        size="small"
                        label={alerts.length}
                        color="error"
                        sx={{ height: 16, fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                ) : undefined
              }
              iconPosition="end"
            />
          ))}
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {selectedTab === 0 && (
        /* Overview Tab */
        <Grid container spacing={3}>
          {dashboardData.sections.map((section) => (
            <Grid item xs={12} key={section.id}>
              <Typography variant="h5" gutterBottom>
                {section.title}
              </Typography>
              <Grid container spacing={2}>
                {section.metrics.slice(0, 3).map((metric, index) => (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <MetricCard metric={metric} />
                  </Grid>
                ))}
              </Grid>
            </Grid>
          ))}
        </Grid>
      )}

      {selectedTab > 0 && selectedTab < tabLabels.length - 1 && (
        /* Section-specific Tab */
        (() => {
          const section = dashboardData.sections[selectedTab - 1];
          return (
            <Box>
              <Grid container spacing={3}>
                {/* Metrics */}
                {section.metrics.map((metric, index) => (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <MetricCard metric={metric} />
                  </Grid>
                ))}

                {/* Charts */}
                {section.charts.map((chart) => (
                  <Grid item xs={12} md={6} key={chart.id}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {chart.title}
                        </Typography>
                        <Box height={300}>
                          {renderChart(chart)}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          );
        })()
      )}

      {selectedTab === tabLabels.length - 1 && (
        /* Alerts Tab */
        <Box>
          <Typography variant="h5" gutterBottom>
            Active Alerts ({alerts.length})
          </Typography>
          {alerts.length === 0 ? (
            <Alert severity="success">
              <AlertTitle>No Active Alerts</AlertTitle>
              All systems are operating normally.
            </Alert>
          ) : (
            <List>
              {alerts.map((alert) => (
                <ListItem
                  key={alert.id}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    backgroundColor: 'background.paper'}}
                >
                  <ListItemIcon>
                    {getSeverityIcon(alert.severity)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="subtitle1">{alert.name}</Typography>
                        <Chip
                          size="small"
                          label={alert.severity}
                          color={
                            alert.severity === 'critical' ? 'error' :
                            alert.severity === 'high' ? 'warning' : 'info'
                          }
                        />
                        <Chip
                          size="small"
                          label={alert.state}
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          Value: {alert.value} (Threshold: {alert.threshold})
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          First seen: {new Date(alert.firstSeen).toLocaleString()}
                        </Typography>
                      </Box>
                    }
                  />
                  <Box display="flex" gap={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setSelectedAlert(alert);
                        setAlertDetailsOpen(true);
                      }}
                    >
                      Details
                    </Button>
                    {alert.state === 'firing' && (
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      )}

      {/* Alert Details Dialog */}
      <Dialog
        open={alertDetailsOpen}
        onClose={() => setAlertDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Alert Details</DialogTitle>
        <DialogContent>
          {selectedAlert && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Name</Typography>
                  <Typography variant="body1">{selectedAlert.name}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Severity</Typography>
                  <Chip
                    label={selectedAlert.severity}
                    color={
                      selectedAlert.severity === 'critical' ? 'error' :
                      selectedAlert.severity === 'high' ? 'warning' : 'info'
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Current Value</Typography>
                  <Typography variant="body1">{selectedAlert.value}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Threshold</Typography>
                  <Typography variant="body1">{selectedAlert.threshold}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">First Seen</Typography>
                  <Typography variant="body1">
                    {new Date(selectedAlert.firstSeen).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Last Seen</Typography>
                  <Typography variant="body1">
                    {new Date(selectedAlert.lastSeen).toLocaleString()}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlertDetailsOpen(false)}>Close</Button>
          {selectedAlert?.state === 'firing' && (
            <Button
              variant="contained"
              onClick={() => {
                if (selectedAlert) {
                  handleAcknowledgeAlert(selectedAlert.id);
                  setAlertDetailsOpen(false);
                }
              }}
            >
              Acknowledge
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MonitoringDashboard;