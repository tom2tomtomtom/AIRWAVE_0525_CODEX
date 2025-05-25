import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  IconButton,
  Divider,
  LinearProgress,
  Collapse,
  Button,
  Badge,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CloudUpload as UploadIcon,
  Image as ImageIcon,
  VideoFile as VideoIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Campaign as CampaignIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreIcon,
  NotificationsActive as NotificationIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useNotification } from '@/contexts/NotificationContext';

interface Activity {
  id: string;
  type: 'render' | 'upload' | 'edit' | 'delete' | 'campaign' | 'user' | 'approval';
  action: string;
  description: string;
  timestamp: Date;
  status?: 'success' | 'error' | 'warning' | 'info' | 'pending';
  progress?: number;
  metadata?: {
    campaignName?: string;
    assetName?: string;
    assetType?: string;
    userName?: string;
    clientName?: string;
    count?: number;
    [key: string]: string | number | undefined;
  };
}

interface ActivityFeedProps {
  maxItems?: number;
  showNotifications?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  maxItems = 10,
  showNotifications = true,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { showNotification } = useNotification();

  // Mock activities for demonstration
  const mockActivities: Activity[] = [
    {
      id: '1',
      type: 'render',
      action: 'Video Rendered',
      description: 'Campaign video successfully rendered',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      status: 'success',
      metadata: {
        campaignName: 'Summer Sale 2024',
        assetName: 'hero-video-v2.mp4',
        assetType: 'video',
      },
    },
    {
      id: '2',
      type: 'upload',
      action: 'Assets Uploaded',
      description: '15 new assets uploaded',
      timestamp: new Date(Date.now() - 1000 * 60 * 15),
      status: 'info',
      metadata: {
        count: 15,
        clientName: 'Acme Corp',
      },
    },
    {
      id: '3',
      type: 'approval',
      action: 'Campaign Approved',
      description: 'Client approved campaign materials',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      status: 'success',
      metadata: {
        campaignName: 'Product Launch Q2',
        clientName: 'Tech Innovations',
        userName: 'John Smith',
      },
    },
    {
      id: '4',
      type: 'render',
      action: 'Render Failed',
      description: 'Video render failed due to missing assets',
      timestamp: new Date(Date.now() - 1000 * 60 * 45),
      status: 'error',
      metadata: {
        campaignName: 'Holiday Special',
        assetName: 'promo-video.mp4',
      },
    },
    {
      id: '5',
      type: 'campaign',
      action: 'Campaign Created',
      description: 'New campaign created',
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      status: 'info',
      metadata: {
        campaignName: 'Back to School 2024',
        userName: 'Sarah Johnson',
      },
    },
    {
      id: '6',
      type: 'edit',
      action: 'Matrix Updated',
      description: 'Campaign matrix modified',
      timestamp: new Date(Date.now() - 1000 * 60 * 90),
      status: 'info',
      metadata: {
        campaignName: 'Spring Collection',
        userName: 'Mike Davis',
      },
    },
    {
      id: '7',
      type: 'approval',
      action: 'Changes Requested',
      description: 'Client requested revisions',
      timestamp: new Date(Date.now() - 1000 * 60 * 120),
      status: 'warning',
      metadata: {
        campaignName: 'Brand Refresh',
        clientName: 'Global Brands Inc',
      },
    },
    {
      id: '8',
      type: 'render',
      action: 'Batch Render Started',
      description: 'Rendering 25 video variations',
      timestamp: new Date(Date.now() - 1000 * 60 * 180),
      status: 'pending',
      progress: 65,
      metadata: {
        campaignName: 'Multi-Platform Campaign',
        count: 25,
      },
    },
  ];

  useEffect(() => {
    // Simulate loading activities
    const loadActivities = () => {
      setLoading(true);
      setTimeout(() => {
        setActivities(mockActivities.slice(0, maxItems));
        setLoading(false);
      }, 1000);
    };

    loadActivities();

    // Auto refresh
    if (autoRefresh) {
      const interval = setInterval(loadActivities, refreshInterval);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxItems, autoRefresh, refreshInterval]);

  const getActivityIcon = (activity: Activity) => {
    switch (activity.type) {
      case 'render':
        return <VideoIcon />;
      case 'upload':
        return <UploadIcon />;
      case 'edit':
        return <EditIcon />;
      case 'delete':
        return <DeleteIcon />;
      case 'campaign':
        return <CampaignIcon />;
      case 'user':
        return <PersonIcon />;
      case 'approval':
        return activity.status === 'success' ? <ApprovedIcon /> : <RejectedIcon />;
      default:
        return <NotificationIcon />;
    }
  };

  const getStatusColor = (status?: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      case 'pending':
        return 'primary';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'success':
        return <CheckIcon fontSize="small" />;
      case 'error':
        return <ErrorIcon fontSize="small" />;
      case 'warning':
        return <WarningIcon fontSize="small" />;
      case 'pending':
        return <PlayIcon fontSize="small" />;
      default:
        return null;
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      // Add a new activity at the beginning to simulate real-time updates
      const newActivity: Activity = {
        id: `new-${Date.now()}`,
        type: 'render',
        action: 'New Render Started',
        description: 'Just started rendering a new video',
        timestamp: new Date(),
        status: 'pending',
        progress: 10,
        metadata: {
          campaignName: 'Latest Campaign',
          assetName: 'new-video.mp4',
        },
      };
      setActivities([newActivity, ...mockActivities].slice(0, maxItems));
      setLoading(false);
      
      if (showNotifications) {
        showNotification('Activity feed refreshed', 'info');
      }
    }, 1000);
  };

  if (loading && activities.length === 0) {
    return (
      <Card>
        <CardContent>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            Loading activities...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2">
            Recent Activity
          </Typography>
          <Box>
            {showNotifications && (
              <IconButton size="small" sx={{ mr: 1 }}>
                <Badge badgeContent={3} color="error">
                  <NotificationIcon />
                </Badge>
              </IconButton>
            )}
            <IconButton size="small" onClick={handleRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        <List sx={{ width: '100%' }}>
          {activities.map((activity, index) => (
            <React.Fragment key={activity.id}>
              {index > 0 && <Divider variant="inset" component="li" />}
              <ListItem
                alignItems="flex-start"
                secondaryAction={
                  <IconButton edge="end" size="small">
                    <MoreIcon />
                  </IconButton>
                }
              >
                <ListItemAvatar>
                  <Avatar
                    sx={{
                      bgcolor: `${getStatusColor(activity.status)}.light`,
                      color: `${getStatusColor(activity.status)}.main`,
                    }}
                  >
                    {getActivityIcon(activity)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2">
                        {activity.action}
                      </Typography>
                      {activity.status && (
                        <Chip
                          size="small"
                          label={activity.status}
                          color={getStatusColor(activity.status)}
                          icon={getStatusIcon(activity.status)}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.primary"
                      >
                        {activity.description}
                      </Typography>
                      {activity.metadata && (
                        <Box sx={{ mt: 0.5 }}>
                          {activity.metadata.campaignName && (
                            <Chip
                              label={activity.metadata.campaignName}
                              size="small"
                              sx={{ mr: 0.5, mb: 0.5 }}
                            />
                          )}
                          {activity.metadata.clientName && (
                            <Chip
                              label={activity.metadata.clientName}
                              size="small"
                              variant="outlined"
                              sx={{ mr: 0.5, mb: 0.5 }}
                            />
                          )}
                        </Box>
                      )}
                      {activity.progress !== undefined && (
                        <Box sx={{ mt: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={activity.progress}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {activity.progress}% complete
                          </Typography>
                        </Box>
                      )}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
              <Collapse in={expandedItems.has(activity.id)} timeout="auto" unmountOnExit>
                <Box sx={{ pl: 9, pr: 2, pb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Additional details about this activity would appear here...
                  </Typography>
                  <Button size="small" sx={{ mt: 1 }}>View Details</Button>
                </Box>
              </Collapse>
            </React.Fragment>
          ))}
        </List>

        {activities.length === 0 && !loading && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No recent activities
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityFeed;