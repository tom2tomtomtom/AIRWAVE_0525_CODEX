// Performance monitoring dashboard component
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import { 
  TrendingUp, 
  TrendingDown, 
  TrendingFlat,
  Speed,
  Timeline,
  Warning,
  CheckCircle,
  Error as ErrorIcon 
} from '@mui/icons-material';

// Note: Performance hooks are not used in this simplified version

interface DashboardData {
  overview: {
    totalSessions: number;
    totalMetrics: number;
    timeRange: string;
    lastUpdated: string;
  };
  coreWebVitals: {
    lcp: MetricSummary;
    fid: MetricSummary;
    cls: MetricSummary;
  };
  loadingMetrics: {
    fcp: MetricSummary;
    ttfb: MetricSummary;
  };
  trends: {
    hourly: Array<{ hour: string; good: number; poor: number; total: number }>;
    daily: Array<{ date: string; averageScore: number; totalMetrics: number }>;
  };
  topIssues: Array<{
    url: string;
    metric: string;
    averageValue: number;
    occurrences: number;
    rating: string;
  }>;
}

interface MetricSummary {
  average: number;
  p75: number;
  p90: number;
  good: number;
  needsImprovement: number;
  poor: number;
  totalSamples: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating?: 'good' | 'needs-improvement' | 'poor';
}

const PerformanceDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState('24h');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/performance/dashboard?timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      const data = await response.json();
      setDashboardData(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getRatingColor = (rating: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (rating) {
      case 'good': return 'success';
      case 'needs-improvement': return 'warning';
      case 'poor': return 'error';
      default: return 'default';
    }
  };

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'good': return <CheckCircle color="success" />;
      case 'needs-improvement': return <Warning color="warning" />;
      case 'poor': return <ErrorIcon color="error" />;
      default: return <CheckCircle />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp color="success" />;
      case 'degrading': return <TrendingDown color="error" />;
      case 'stable': return <TrendingFlat color="action" />;
      default: return <TrendingFlat />;
    }
  };

  const formatMetricValue = (metric: string, value: number) => {
    if (metric === 'CLS') return value.toFixed(3);
    return `${Math.round(value)}ms`;
  };

  if (loading && !dashboardData) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Error loading performance data: {error}
      </Alert>
    );
  }

  if (!dashboardData) return null;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Performance Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time Core Web Vitals and performance monitoring
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={timeRange}
            label="Time Range"
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <MenuItem value="1h">Last Hour</MenuItem>
            <MenuItem value="24h">Last 24 Hours</MenuItem>
            <MenuItem value="7d">Last 7 Days</MenuItem>
            <MenuItem value="30d">Last 30 Days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Overview Cards */}
      <Box display="flex" flexWrap="wrap" gap={2} mb={3}>
        <Card sx={{ flex: '1 1 250px' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Active Sessions
            </Typography>
            <Typography variant="h3" color="primary">
              {dashboardData.overview.totalSessions}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              In {dashboardData.overview.timeRange}
            </Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ flex: '1 1 250px' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Total Metrics
            </Typography>
            <Typography variant="h3" color="primary">
              {dashboardData.overview.totalMetrics}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Data points collected
            </Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ flex: '1 1 250px' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Last Updated
            </Typography>
            <Typography variant="body1">
              {new Date(dashboardData.overview.lastUpdated).toLocaleTimeString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Auto-refresh: 30s
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Core Web Vitals */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
            <Speed /> Core Web Vitals
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={2}>
            {Object.entries(dashboardData.coreWebVitals).map(([metric, data]) => (
              <Box key={metric} sx={{ flex: '1 1 300px', border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">{metric.toUpperCase()}</Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    {getTrendIcon(data.trend)}
                    {data.rating && getRatingIcon(data.rating)}
                  </Box>
                </Box>
                
                <Typography variant="h4" gutterBottom>
                  {formatMetricValue(metric.toUpperCase(), data.average)}
                </Typography>
                
                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary">
                    P75: {formatMetricValue(metric.toUpperCase(), data.p75)} | 
                    P90: {formatMetricValue(metric.toUpperCase(), data.p90)}
                  </Typography>
                </Box>

                <Box mb={1}>
                  <Box display="flex" justifyContent="space-between" mb={0.5}>
                    <Typography variant="body2">Good</Typography>
                    <Typography variant="body2">{data.good}</Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={(data.good / data.totalSamples) * 100}
                    color="success"
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>

                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {data.totalSamples} samples • Trend: {data.trend}
                </Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Loading Metrics */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
            <Timeline /> Loading Performance
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={2}>
            {Object.entries(dashboardData.loadingMetrics).map(([metric, data]) => (
              <Box key={metric} sx={{ flex: '1 1 300px', border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {metric.toUpperCase()}
                </Typography>
                <Typography variant="h4" gutterBottom>
                  {formatMetricValue(metric.toUpperCase(), data.average)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  P75: {formatMetricValue(metric.toUpperCase(), data.p75)} | 
                  {data.totalSamples} samples
                </Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Top Performance Issues */}
      {dashboardData.topIssues.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Top Performance Issues
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>URL</TableCell>
                    <TableCell>Metric</TableCell>
                    <TableCell align="right">Avg Value</TableCell>
                    <TableCell align="right">Occurrences</TableCell>
                    <TableCell>Rating</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dashboardData.topIssues.map((issue, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 200 }} noWrap>
                          {issue.url}
                        </Typography>
                      </TableCell>
                      <TableCell>{issue.metric}</TableCell>
                      <TableCell align="right">
                        {formatMetricValue(issue.metric, issue.averageValue)}
                      </TableCell>
                      <TableCell align="right">{issue.occurrences}</TableCell>
                      <TableCell>
                        <Chip 
                          label={issue.rating}
                          color={getRatingColor(issue.rating)}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default PerformanceDashboard;