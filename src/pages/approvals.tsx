import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Paper,
  Tabs,
  Tab,
  Stack,
  Alert,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  TextField,
  InputAdornment,
  Badge,
  Menu,
  MenuItem,
  Divider,
  CircularProgress,
  useTheme,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Group as GroupIcon,
  Speed as SpeedIcon,
  Notifications as NotificationIcon,
  Assignment as AssignmentIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  Download as ExportIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import DashboardLayout from '@/components/DashboardLayout';
import ApprovalWorkflow from '@/components/ApprovalWorkflow';
import { useClient } from '@/contexts/ClientContext';
import { useNotification } from '@/contexts/NotificationContext';
import { getErrorMessage } from '@/utils/errorUtils';

interface ApprovalStats {
  total_approvals: number;
  status_distribution: Record<string, number>;
  type_distribution: Record<string, number>;
  priority_distribution: Record<string, number>;
  overdue_count: number;
  pending_count: number;
  average_approval_time_hours: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const ApprovalsPage: React.FC = () => {
  const theme = useTheme();
  const { activeClient } = useClient();
  const { showNotification } = useNotification();

  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  const [filters, setFilters] = useState({
    search: '',
    priority: '',
    approval_type: '',
    status: '',
  });

  // Tab mapping for status filtering
  const tabStatusMapping = ['pending', 'approved', 'changes_requested', 'rejected', ''];

  // Fetch approval statistics
  useEffect(() => {
    const fetchStats = async () => {
      if (!activeClient) {
        setStats(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/approvals?client_id=${activeClient.id}&limit=100`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setStats(data.statistics || {
            total_approvals: 0,
            status_distribution: {},
            type_distribution: {},
            priority_distribution: {},
            overdue_count: 0,
            pending_count: 0,
            average_approval_time_hours: 0,
          });
        } else {
          throw new Error('Failed to fetch approval statistics');
        }
      } catch (error) {
        const message = getErrorMessage(error);
        console.error('Error fetching approval stats:', error);
        showNotification('Failed to load approval statistics', 'error');
        // Set empty stats on error
        setStats({
          total_approvals: 0,
          status_distribution: {},
          type_distribution: {},
          priority_distribution: {},
          overdue_count: 0,
          pending_count: 0,
          average_approval_time_hours: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [activeClient, showNotification]);

  const handleExportApprovals = async () => {
    if (!activeClient) return;

    try {
      showNotification('Export feature coming soon!', 'info');
    } catch (error) {
      const message = getErrorMessage(error);
      showNotification('Failed to export approvals', 'error');
    }
  };

  const handleRefresh = () => {
    if (activeClient) {
      setLoading(true);
      // Trigger refresh by clearing and refetching stats
      setStats(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'changes_requested': return 'warning';
      case 'pending': return 'info';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'normal': return 'info';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const StatCard = ({ title, value, subtitle, icon, color, trend }: any) => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography color="text.secondary" variant="body2" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ mb: 1 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
            {trend && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                <TrendingUpIcon fontSize="small" color="success" />
                <Typography variant="caption" color="success.main">
                  {trend}
                </Typography>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              backgroundColor: `${color}.light`,
              borderRadius: 2,
              p: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {React.cloneElement(icon, { sx: { color: `${color}.main` } })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  if (!activeClient) {
    return (
      <DashboardLayout title="Approvals">
        <Box textAlign="center" py={8}>
          <AssignmentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Select a client to view approvals
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Approval workflows help streamline content review and publishing
          </Typography>
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <>
      <Head>
        <title>Approvals | AIrWAVE</title>
      </Head>
      <DashboardLayout title="Approvals">
        <Container maxWidth="xl">
          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
              Approval Workflow
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage and track approval requests for {activeClient.name}
            </Typography>
          </Box>

          {/* Action Bar */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search approvals..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={filters.priority}
                    label="Priority"
                    onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                  >
                    <MenuItem value="">All Priorities</MenuItem>
                    <MenuItem value="urgent">Urgent</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={filters.approval_type}
                    label="Type"
                    onChange={(e) => setFilters({ ...filters, approval_type: e.target.value })}
                  >
                    <MenuItem value="">All Types</MenuItem>
                    <MenuItem value="content">Content</MenuItem>
                    <MenuItem value="legal">Legal</MenuItem>
                    <MenuItem value="brand">Brand</MenuItem>
                    <MenuItem value="final">Final</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={5} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button
                  startIcon={<FilterIcon />}
                  onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
                >
                  Filters
                </Button>
                <Button startIcon={<ExportIcon />} onClick={handleExportApprovals}>
                  Export
                </Button>
                <Button 
                  variant="contained" 
                  startIcon={<RefreshIcon />}
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  Refresh
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Statistics Cards */}
          {loading ? (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {[1, 2, 3, 4].map((i) => (
                <Grid item xs={12} sm={6} md={3} key={i}>
                  <Card>
                    <CardContent>
                      <Box display="flex" justifyContent="center" alignItems="center" minHeight={120}>
                        <CircularProgress size={24} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : stats ? (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Total Approvals"
                  value={stats.total_approvals}
                  subtitle="All time"
                  icon={<AssignmentIcon />}
                  color="primary"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Pending"
                  value={stats.pending_count}
                  subtitle={stats.overdue_count > 0 ? `${stats.overdue_count} overdue` : 'On track'}
                  icon={<ScheduleIcon />}
                  color="warning"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Overdue"
                  value={stats.overdue_count}
                  subtitle="Needs attention"
                  icon={<WarningIcon />}
                  color="error"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Avg. Time"
                  value={`${stats.average_approval_time_hours.toFixed(1)}h`}
                  subtitle="Processing time"
                  icon={<SpeedIcon />}
                  color="info"
                />
              </Grid>
            </Grid>
          ) : null}

          {/* Distribution Charts */}
          {stats && stats.total_approvals > 0 && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Status Distribution
                    </Typography>
                    <Stack spacing={2}>
                      {Object.entries(stats.status_distribution).map(([status, count]) => (
                        <Box key={status}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                              {status.replace('_', ' ')}
                            </Typography>
                            <Typography variant="body2" fontWeight="bold">
                              {count}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={(count / stats.total_approvals) * 100}
                            color={getStatusColor(status) as any}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Type Distribution
                    </Typography>
                    <Stack spacing={2}>
                      {Object.entries(stats.type_distribution).map(([type, count]) => (
                        <Box key={type}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                              {type}
                            </Typography>
                            <Typography variant="body2" fontWeight="bold">
                              {count}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={(count / stats.total_approvals) * 100}
                            color="primary"
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Priority Distribution
                    </Typography>
                    <Stack spacing={2}>
                      {Object.entries(stats.priority_distribution).map(([priority, count]) => (
                        <Box key={priority}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                              {priority}
                            </Typography>
                            <Typography variant="body2" fontWeight="bold">
                              {count}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={(count / stats.total_approvals) * 100}
                            color={getPriorityColor(priority) as any}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Alert for overdue items */}
          {stats && stats.overdue_count > 0 && (
            <Alert severity="error" sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography>
                  You have {stats.overdue_count} overdue approval{stats.overdue_count > 1 ? 's' : ''} that need immediate attention.
                </Typography>
                <Button
                  color="error"
                  variant="outlined"
                  size="small"
                  onClick={() => setActiveTab(0)} // Switch to pending tab
                >
                  View Overdue
                </Button>
              </Box>
            </Alert>
          )}

          {/* Quick Actions */}
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={4}>
              <Card sx={{ textAlign: 'center', py: 2 }}>
                <CardContent>
                  <SpeedIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="h6" gutterBottom>
                    Quick Approve
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Bulk approve multiple items at once
                  </Typography>
                  <Button variant="outlined" startIcon={<ApproveIcon />}>
                    Bulk Approve
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ textAlign: 'center', py: 2 }}>
                <CardContent>
                  <GroupIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                  <Typography variant="h6" gutterBottom>
                    Team Review
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Assign approvals to team members
                  </Typography>
                  <Button variant="outlined" startIcon={<GroupIcon />}>
                    Assign Reviews
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ textAlign: 'center', py: 2 }}>
                <CardContent>
                  <NotificationIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                  <Typography variant="h6" gutterBottom>
                    Notifications
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Configure approval notifications
                  </Typography>
                  <Button variant="outlined" startIcon={<NotificationIcon />}>
                    Setup Alerts
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Main Content */}
          <Paper sx={{ mb: 4 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                <Tab 
                  label={
                    <Badge badgeContent={stats?.pending_count || 0} color="error">
                      Pending
                    </Badge>
                  } 
                />
                <Tab label="Approved" />
                <Tab label="Changes Requested" />
                <Tab label="Rejected" />
                <Tab label="All" />
              </Tabs>
            </Box>

            <Box sx={{ p: 3 }}>
              <TabPanel value={activeTab} index={0}>
                <ApprovalWorkflow
                  maxHeight={600}
                  showHeader={false}
                  clientId={activeClient.id}
                  showActions={true}
                />
              </TabPanel>

              <TabPanel value={activeTab} index={1}>
                <ApprovalWorkflow
                  maxHeight={600}
                  showHeader={false}
                  clientId={activeClient.id}
                  showActions={false}
                />
              </TabPanel>

              <TabPanel value={activeTab} index={2}>
                <ApprovalWorkflow
                  maxHeight={600}
                  showHeader={false}
                  clientId={activeClient.id}
                  showActions={true}
                />
              </TabPanel>

              <TabPanel value={activeTab} index={3}>
                <ApprovalWorkflow
                  maxHeight={600}
                  showHeader={false}
                  clientId={activeClient.id}
                  showActions={false}
                />
              </TabPanel>

              <TabPanel value={activeTab} index={4}>
                <ApprovalWorkflow
                  maxHeight={600}
                  showHeader={false}
                  clientId={activeClient.id}
                  showActions={true}
                />
              </TabPanel>
            </Box>
          </Paper>

          {/* Filter Menu */}
          <Menu
            anchorEl={filterMenuAnchor}
            open={Boolean(filterMenuAnchor)}
            onClose={() => setFilterMenuAnchor(null)}
          >
            <MenuItem onClick={() => setFilters({ ...filters, status: 'pending' })}>
              Show Overdue Only
            </MenuItem>
            <MenuItem onClick={() => setFilters({ ...filters, priority: 'urgent' })}>
              Show Urgent Priority
            </MenuItem>
            <MenuItem onClick={() => setFilters({ ...filters, approval_type: 'final' })}>
              Show Final Approvals
            </MenuItem>
            <Divider />
            <MenuItem 
              onClick={() => setFilters({ search: '', priority: '', approval_type: '', status: '' })}
            >
              Clear All Filters
            </MenuItem>
          </Menu>
        </Container>
      </DashboardLayout>
    </>
  );
};

export default ApprovalsPage;