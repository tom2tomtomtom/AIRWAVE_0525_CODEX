import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  Stack,
  CircularProgress,
  Button,
  Grid} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Facebook as FacebookIcon,
  Twitter as TwitterIcon,
  LinkedIn as LinkedInIcon,
  Instagram as InstagramIcon,
  YouTube as YouTubeIcon,
  Visibility as ViewsIcon,
  ThumbUp as LikesIcon,
  Share as SharesIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon} from '@mui/icons-material';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer} from 'recharts';
import { format, subDays } from 'date-fns';
import { useNotification } from '@/contexts/NotificationContext';

interface Platform {
  id: string;
  name: string;
  displayName: string;
  isConnected: boolean;
}

interface PublishingAnalyticsProps {
  clientId: string;
  platforms: Platform[];
}

interface AnalyticsData {
  overview: {},
  totalPosts: number;
    totalReach: number;
    totalEngagement: number;
    avgEngagementRate: number;
    trends: {},
  posts: number;
      reach: number;
      engagement: number;
      engagementRate: number;
    };
  };
  platformMetrics: Array<{
    platform: string;
    posts: number;
    reach: number;
    engagement: number;
    engagementRate: number;
    color: string;
  }>;
  timeSeriesData: Array<{
    date: string;
    posts: number;
    reach: number;
    engagement: number;
    facebook?: number;
    twitter?: number;
    linkedin?: number;
    instagram?: number;
    youtube?: number;
  }>;
  topPosts: Array<{
    id: string;
    content: string;
    platform: string;
    publishedAt: string;
    metrics: {},
  reach: number;
      likes: number;
      comments: number;
      shares: number;
      engagementRate: number;
    };
  }>;
  engagementBreakdown: Array<{
    platform: string;
    likes: number;
    comments: number;
    shares: number;
    color: string;
  }>;
}

const PublishingAnalytics: React.FC<PublishingAnalyticsProps> = ({
  clientId,
  platforms}) => {
  const { showNotification } = useNotification();
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('engagement');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const platformColors = {
    facebook: '#1877F2',
    twitter: '#1DA1F2',
    linkedin: '#0A66C2',
    instagram: '#E4405F',
    youtube: '#FF0000'};

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return <FacebookIcon sx={{ color: platformColors.facebook }} />;
      case 'twitter':
        return <TwitterIcon sx={{ color: platformColors.twitter }} />;
      case 'linkedin':
        return <LinkedInIcon sx={{ color: platformColors.linkedin }} />;
      case 'instagram':
        return <InstagramIcon sx={{ color: platformColors.instagram }} />;
      case 'youtube':
        return <YouTubeIcon sx={{ color: platformColors.youtube }} />;
      default:
        return <Avatar sx={{ width: 24, height: 24 }}>{platform[0].toUpperCase()}</Avatar>;
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [clientId, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      // Generate mock analytics data
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const timeSeriesData = Array.from({ length: days }, (_, i) => {
        const date = format(subDays(new Date(), days - i - 1), 'MMM dd');
        const basePosts = Math.floor(Math.random() * 5) + 1;
        const baseReach = Math.floor(Math.random() * 5000) + 1000;
        const baseEngagement = Math.floor(Math.random() * 500) + 50;
        return {
          date,
          posts: basePosts,
          reach: baseReach,
          engagement: baseEngagement,
          facebook: Math.floor(baseReach * 0.4),
          twitter: Math.floor(baseReach * 0.25),
          linkedin: Math.floor(baseReach * 0.15),
          instagram: Math.floor(baseReach * 0.15),
          youtube: Math.floor(baseReach * 0.05)};
      });

      const totalPosts = timeSeriesData.reduce((sum, day) => sum + day.posts, 0);
      const totalReach = timeSeriesData.reduce((sum, day) => sum + day.reach, 0);
      const totalEngagement = timeSeriesData.reduce((sum, day) => sum + day.engagement, 0);

      const analyticsData: AnalyticsData = {
        overview: {},
  totalPosts,
          totalReach,
          totalEngagement,
          avgEngagementRate: totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0,
          trends: {},
  posts: Math.floor(Math.random() * 40) - 20, // -20% to +20%
            reach: Math.floor(Math.random() * 60) - 30, // -30% to +30%
            engagement: Math.floor(Math.random() * 50) - 25, // -25% to +25%
            engagementRate: Math.floor(Math.random() * 30) - 15, // -15% to +15%
          }},
        platformMetrics: [
          {
            platform: 'Facebook',
            posts: Math.floor(totalPosts * 0.3),
            reach: Math.floor(totalReach * 0.4),
            engagement: Math.floor(totalEngagement * 0.35),
            engagementRate: 4.2,
            color: platformColors.facebook }
          {
            platform: 'Twitter',
            posts: Math.floor(totalPosts * 0.25),
            reach: Math.floor(totalReach * 0.25),
            engagement: Math.floor(totalEngagement * 0.3),
            engagementRate: 2.8,
            color: platformColors.twitter }
          {
            platform: 'LinkedIn',
            posts: Math.floor(totalPosts * 0.2),
            reach: Math.floor(totalReach * 0.15),
            engagement: Math.floor(totalEngagement * 0.2),
            engagementRate: 5.1,
            color: platformColors.linkedin }
          {
            platform: 'Instagram',
            posts: Math.floor(totalPosts * 0.2),
            reach: Math.floor(totalReach * 0.15),
            engagement: Math.floor(totalEngagement * 0.12),
            engagementRate: 3.6,
            color: platformColors.instagram }
          {
            platform: 'YouTube',
            posts: Math.floor(totalPosts * 0.05),
            reach: Math.floor(totalReach * 0.05),
            engagement: Math.floor(totalEngagement * 0.03),
            engagementRate: 6.2,
            color: platformColors.youtube }
        ],
        timeSeriesData,
        topPosts: [
          {
            id: '1',
            content: 'Exciting news! Our new product launch is just around the corner...',
            platform: 'Facebook',
            publishedAt: '2024-01-15T10:00:00Z',
            metrics: {},
  reach: 12500,
              likes: 340,
              comments: 67,
              shares: 89,
              engagementRate: 4.8}},
          {
            id: '2',
            content: 'Behind the scenes of our creative process. Here\'s how we bring ideas to life!',
            platform: 'Instagram',
            publishedAt: '2024-01-14T14:30:00Z',
            metrics: {},
  reach: 8900,
              likes: 520,
              comments: 43,
              shares: 76,
              engagementRate: 7.2}},
          {
            id: '3',
            content: 'Weekly industry insights and trends. What are your thoughts?',
            platform: 'LinkedIn',
            publishedAt: '2024-01-13T09:15:00Z',
            metrics: {},
  reach: 5600,
              likes: 180,
              comments: 34,
              shares: 45,
              engagementRate: 4.6}},
        ],
        engagementBreakdown: [
          { platform: 'Facebook', likes: 1240, comments: 340, shares: 180, color: platformColors.facebook  }
          { platform: 'Twitter', likes: 890, comments: 120, shares: 450, color: platformColors.twitter  }
          { platform: 'LinkedIn', likes: 670, comments: 230, shares: 120, color: platformColors.linkedin  }
          { platform: 'Instagram', likes: 1560, comments: 180, shares: 90, color: platformColors.instagram  }
          { platform: 'YouTube', likes: 340, comments: 45, shares: 23, color: platformColors.youtube  }
        ]};

      setAnalyticsData(analyticsData);
    } catch (error: any) {
      console.error('Error loading analytics:', error);
      showNotification('Failed to load analytics data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const getTrendIcon = (trend: number) => {
    return trend > 0 ? <TrendingUpIcon color="success" fontSize="small" /> : <TrendingDownIcon color="error" fontSize="small" />;
  };

  if (loading || !analyticsData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Publishing Analytics
        </Typography>
        <Stack direction="row" spacing={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <MenuItem value="7d">Last 7 days</MenuItem>
              <MenuItem value="30d">Last 30 days</MenuItem>
              <MenuItem value="90d">Last 90 days</MenuItem>
            </Select>
          </FormControl>
          <Button
            startIcon={<RefreshIcon />}
            onClick={loadAnalytics}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            startIcon={<DownloadIcon />}
            variant="outlined"
          >
            Export
          </Button>
        </Stack>
      </Box>

      {/* Overview Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography color="text.secondary" variant="body2" gutterBottom>
                    Total Posts
                  </Typography>
                  <Typography variant="h4" sx={{ mb: 1 }}>
                    {analyticsData.overview.totalPosts}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {getTrendIcon(analyticsData.overview.trends.posts)}
                    <Typography
                      variant="body2"
                      color={analyticsData.overview.trends.posts > 0 ? 'success.main' : 'error.main'}
                    >
                      {Math.abs(analyticsData.overview.trends.posts)}%
                    </Typography>
                  </Box>
                </Box>
                <Avatar sx={{ bgcolor: 'primary.light' }}>
                  <ViewsIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography color="text.secondary" variant="body2" gutterBottom>
                    Total Reach
                  </Typography>
                  <Typography variant="h4" sx={{ mb: 1 }}>
                    {formatNumber(analyticsData.overview.totalReach)}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {getTrendIcon(analyticsData.overview.trends.reach)}
                    <Typography
                      variant="body2"
                      color={analyticsData.overview.trends.reach > 0 ? 'success.main' : 'error.main'}
                    >
                      {Math.abs(analyticsData.overview.trends.reach)}%
                    </Typography>
                  </Box>
                </Box>
                <Avatar sx={{ bgcolor: 'info.light' }}>
                  <ViewsIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography color="text.secondary" variant="body2" gutterBottom>
                    Total Engagement
                  </Typography>
                  <Typography variant="h4" sx={{ mb: 1 }}>
                    {formatNumber(analyticsData.overview.totalEngagement)}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {getTrendIcon(analyticsData.overview.trends.engagement)}
                    <Typography
                      variant="body2"
                      color={analyticsData.overview.trends.engagement > 0 ? 'success.main' : 'error.main'}
                    >
                      {Math.abs(analyticsData.overview.trends.engagement)}%
                    </Typography>
                  </Box>
                </Box>
                <Avatar sx={{ bgcolor: 'success.light' }}>
                  <LikesIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography color="text.secondary" variant="body2" gutterBottom>
                    Avg. Engagement Rate
                  </Typography>
                  <Typography variant="h4" sx={{ mb: 1 }}>
                    {analyticsData.overview.avgEngagementRate.toFixed(1)}%
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {getTrendIcon(analyticsData.overview.trends.engagementRate)}
                    <Typography
                      variant="body2"
                      color={analyticsData.overview.trends.engagementRate > 0 ? 'success.main' : 'error.main'}
                    >
                      {Math.abs(analyticsData.overview.trends.engagementRate)}%
                    </Typography>
                  </Box>
                </Box>
                <Avatar sx={{ bgcolor: 'warning.light' }}>
                  <SharesIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Time Series Chart */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Over Time
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData.timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="reach"
                      stackId="1"
                      stroke="#8884d8"
                      fill="#8884d8"
                      name="Reach"
                    />
                    <Area
                      type="monotone"
                      dataKey="engagement"
                      stackId="1"
                      stroke="#82ca9d"
                      fill="#82ca9d"
                      name="Engagement"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Platform Performance */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Platform Performance
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData.platformMetrics}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="engagement"
                      label={(entry) => `${entry.platform}: ${entry.engagementRate}%`}
                    >
                      {analyticsData.platformMetrics.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Platform Metrics Table */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Platform Metrics
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Platform</TableCell>
                  <TableCell align="right">Posts</TableCell>
                  <TableCell align="right">Reach</TableCell>
                  <TableCell align="right">Engagement</TableCell>
                  <TableCell align="right">Engagement Rate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {analyticsData.platformMetrics.map((platform: any) => (
                  <TableRow key={platform.platform}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getPlatformIcon(platform.platform.toLowerCase())}
                        {platform.platform}
                      </Box>
                    </TableCell>
                    <TableCell align="right">{platform.posts}</TableCell>
                    <TableCell align="right">{formatNumber(platform.reach)}</TableCell>
                    <TableCell align="right">{formatNumber(platform.engagement)}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${platform.engagementRate}%`}
                        size="small"
                        color={platform.engagementRate > 4 ? 'success' : platform.engagementRate > 2 ? 'warning' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Top Performing Posts */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Top Performing Posts
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Content</TableCell>
                  <TableCell>Platform</TableCell>
                  <TableCell align="right">Reach</TableCell>
                  <TableCell align="right">Likes</TableCell>
                  <TableCell align="right">Comments</TableCell>
                  <TableCell align="right">Shares</TableCell>
                  <TableCell align="right">Engagement Rate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {analyticsData.topPosts.map((post: any) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 200 }}>
                        {post.content.length > 50 ? `${post.content.substring(0, 50)}...` : post.content}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getPlatformIcon(post.platform.toLowerCase())}
                        {post.platform}
                      </Box>
                    </TableCell>
                    <TableCell align="right">{formatNumber(post.metrics.reach)}</TableCell>
                    <TableCell align="right">{post.metrics.likes}</TableCell>
                    <TableCell align="right">{post.metrics.comments}</TableCell>
                    <TableCell align="right">{post.metrics.shares}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${post.metrics.engagementRate}%`}
                        size="small"
                        color={post.metrics.engagementRate > 5 ? 'success' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PublishingAnalytics;