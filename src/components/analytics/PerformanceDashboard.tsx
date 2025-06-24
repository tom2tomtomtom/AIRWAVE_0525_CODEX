import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Alert,
  Paper,
  Select,
  CircularProgress,
  Grid} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon} from '@mui/icons-material';

import { useClient } from '@/contexts/ClientContext';
import { useNotification } from '@/contexts/NotificationContext';
import { getErrorMessage } from '@/utils/errorUtils';

interface PerformanceDashboardProps {
  clientId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
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

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ clientId, dateRange }) => {
  const { activeClient } = useClient();
  const { showNotification } = useNotification();

  // State
  const [activeTab, setActiveTab] = useState(0);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    granularity: 'day',
    metrics: ['impressions', 'clicks', 'conversions', 'spend'],
    platform: '',
    campaignId: '' });

  const targetClientId = clientId || activeClient?.id;

  // Load data
  useEffect(() => {
    if (targetClientId) {
      loadPerformanceData();
      loadInsights();
    }
  }, [targetClientId, filters, dateRange]);

  // Auto-refresh data
  useEffect(() => {
    const interval = setInterval(() => {
      if (targetClientId) {
        loadPerformanceData();
        loadInsights();
      }
    }, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [targetClientId]);

  const loadPerformanceData = async () => {
    if (!targetClientId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        client_id: targetClientId,
        granularity: filters.granularity,
        metrics: filters.metrics.join(',')});
      if (dateRange?.start) params.append('date_from', dateRange.start);
      if (dateRange?.end) params.append('date_to', dateRange.end);
      if (filters.platform) params.append('platform', filters.platform);
      if (filters.campaignId) params.append('campaign_id', filters.campaignId);

      const response = await fetch(`/api/analytics/performance?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

      if (response.ok) {
        const data = await response.json();
        setPerformanceData(data.data);
      } else {
        throw new Error('Failed to load performance data');
      }
    } catch (error: any) {
      const message = getErrorMessage(error);
      console.error('Error loading performance data:', error);
      showNotification('Failed to load performance data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async () => {
    if (!targetClientId) return;
    try {
      const params = new URLSearchParams({
        client_id: targetClientId,
        insight_types: 'performance,optimization,trends,anomalies,predictions'});
      if (dateRange?.start) params.append('date_from', dateRange.start);
      if (dateRange?.end) params.append('date_to', dateRange.end);

      const response = await fetch(`/api/analytics/insights?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

      if (response.ok) {
        const data = await response.json();
        setInsights(data.data);
      }
    } catch (error: any) {
      console.error('Error loading insights:', error);
    }
  };

  const handleRefresh = () => {
    loadPerformanceData();
    loadInsights();
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'success';
    if (change < 0) return 'error';
    return 'default';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUpIcon fontSize="small" />;
    if (change < 0) return <TrendingDownIcon fontSize="small" />;
    return null;
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon color="success" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'info':
        return <InfoIcon color="info" />;
      default:
        return <InfoIcon />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  if (!targetClientId) {
    return <Alert severity="info">Please select a client to view performance dashboard</Alert>;
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" fontWeight={600}>
          Performance Dashboard
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
            size="small"
          >
            Refresh
          </Button>
          <Button startIcon={<DownloadIcon />} size="small">
            Export
          </Button>
        </Stack>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Granularity</InputLabel>
              <Select
                value={filters.granularity}
                label="Granularity"
                onChange={e => setFilters({ ...filters, granularity: e.target.value })}
              >
                <MenuItem value="hour">Hourly</MenuItem>
                <MenuItem value="day">Daily</MenuItem>
                <MenuItem value="week">Weekly</MenuItem>
                <MenuItem value="month">Monthly</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Platform</InputLabel>
              <Select
                value={filters.platform}
                label="Platform"
                onChange={e => setFilters({ ...filters, platform: e.target.value })}
              >
                <MenuItem value="">All Platforms</MenuItem>
                <MenuItem value="facebook">Facebook</MenuItem>
                <MenuItem value="instagram">Instagram</MenuItem>
                <MenuItem value="youtube">YouTube</MenuItem>
                <MenuItem value="tiktok">TikTok</MenuItem>
                <MenuItem value="linkedin">LinkedIn</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {['impressions', 'clicks', 'conversions', 'spend'].map((metric: any) => (
                <Chip
                  key={metric}
                  label={metric}
                  onClick={() => {
                    const newMetrics = filters.metrics.includes(metric)
                      ? filters.metrics.filter((m: any) => m !== metric)
                      : [...filters.metrics, metric];
                    setFilters({ ...filters, metrics: newMetrics });
                  }}
                  color={filters.metrics.includes(metric) ? 'primary' : 'default'}
                  variant={filters.metrics.includes(metric) ? 'filled' : 'outlined'}
                  sx={{ textTransform: 'capitalize' }}
                />
              ))}
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box>
          <Typography variant="h6" gutterBottom>
            Performance data would be displayed here
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This component is ready for integration with real performance data.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default PerformanceDashboard;
