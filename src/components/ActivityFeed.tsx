import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Badge,
  Chip,
  Divider,
  Button,
  Menu,
  MenuItem,
  Tooltip,
  Collapse,
  Stack,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  MoreVert as MoreIcon,
  Comment as CommentIcon,
  ThumbUp as LikeIcon,
  Share as ShareIcon,
  Campaign as CampaignIcon,
  Image as AssetIcon,
  Edit as EditIcon,
  CheckCircle as ApprovalIcon,
  Group as TeamIcon,
  TrendingUp as AnalyticsIcon,
  Send as SendIcon,
  Circle as OnlineIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useClient } from '@/contexts/ClientContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import { useRealTimeUpdates } from '@/hooks/useRealTimeUpdates';

interface Activity {
  id: string;
  type: 'campaign_created' | 'asset_uploaded' | 'matrix_updated' | 'approval_requested' | 
        'comment_added' | 'team_joined' | 'analytics_milestone' | 'content_published';
  user: {
    id: string;
    name: string;
    avatar?: string;
    isOnline?: boolean;
  };
  timestamp: Date;
  data: {
    entityId?: string;
    entityName?: string;
    message?: string;
    metadata?: any;
  };
  reactions?: {
    likes: number;
    comments: number;
    hasLiked?: boolean;
  };
  isRead?: boolean;
}

interface ActivityFeedProps {
  maxHeight?: number;
  showHeader?: boolean;
  filterTypes?: Activity['type'][];
  realtime?: boolean;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  maxHeight = 600,
  showHeader = true,
  filterTypes,
  realtime = true,
}) => {
  const { activeClient } = useClient();
  const { user: _user } = useAuth();
  const { showNotification } = useNotification();
  
  const [activities, setActivities] = useState<Activity[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Real-time connection
  const realTimeUpdates = useRealTimeUpdates({ enabled: realtime });

  // Initialize real-time activities
  useEffect(() => {
    if (!realtime || !activeClient) return undefined;

    // Set connection status based on real-time connection
    setIsConnected(realTimeUpdates.connected);

    // Initial activities
    const initialActivities: Activity[] = [
      {
        id: 'act-1',
        type: 'campaign_created',
        user: { id: 'u1', name: 'Sarah Johnson', isOnline: true },
        timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
        data: {
          entityId: 'camp-1',
          entityName: 'Summer Fitness Campaign',
          message: 'created a new campaign',
        },
        reactions: { likes: 3, comments: 1, hasLiked: false },
        isRead: false,
      },
      {
        id: 'act-2',
        type: 'asset_uploaded',
        user: { id: 'u2', name: 'Mike Chen', isOnline: true },
        timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
        data: {
          entityId: 'asset-1',
          entityName: 'Hero Banner Image',
          message: 'uploaded 5 new assets',
          metadata: { count: 5, type: 'image' },
        },
        reactions: { likes: 1, comments: 0 },
        isRead: true,
      },
      {
        id: 'act-3',
        type: 'approval_requested',
        user: { id: 'u3', name: 'Emily Davis', isOnline: false },
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        data: {
          entityId: 'matrix-1',
          entityName: 'Instagram Story Matrix',
          message: 'requested approval for',
        },
        reactions: { likes: 0, comments: 2 },
        isRead: false,
      },
      {
        id: 'act-4',
        type: 'analytics_milestone',
        user: { id: 'system', name: 'AIrWAVE System' },
        timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        data: {
          message: 'Campaign "Spring Collection" reached 100K views! 🎉',
          metadata: { milestone: '100K views', campaignId: 'camp-2' },
        },
        reactions: { likes: 8, comments: 3, hasLiked: true },
        isRead: true,
      },
    ];

    setActivities(initialActivities);
    setUnreadCount(initialActivities.filter(a => !a.isRead).length);
    setIsConnected(true);

    // Subscribe to real-time activity updates
    const unsubscribeActivity = realTimeUpdates.subscribe('activity_update', (data) => {
      const newActivity: Activity = {
        id: data.id || `act-${Date.now()}`,
        type: data.type || 'comment_added',
        user: {
          id: data.userId || _user?.id || 'unknown',
          name: data.userName || _user?.name || 'Unknown User',
          isOnline: true,
        },
        timestamp: new Date(data.timestamp || Date.now()),
        data: {
          entityId: data.entityId || '',
          entityName: data.entityName || '',
          message: data.message || data.description || '',
        },
        reactions: { likes: 0, comments: 0, hasLiked: false },
        isRead: false,
      };
      
      setActivities(prev => [newActivity, ...prev].slice(0, 50));
      setUnreadCount(prev => prev + 1);
      showNotification(data.description || 'Activity updated', 'info');
    });

    // Subscribe to render progress updates
    const unsubscribeRender = realTimeUpdates.onRenderProgress((data) => {
      const renderActivity: Activity = {
        id: `render-${data.renderId}`,
        type: 'content_published',
        user: {
          id: _user?.id || 'system',
          name: 'Video Generator',
          isOnline: true,
        },
        timestamp: new Date(data.timestamp),
        data: {
          entityId: data.renderId,
          entityName: 'Video Render',
          message: `render progress: ${data.progress}%`,
        },
        reactions: { likes: 0, comments: 0, hasLiked: false },
        isRead: false,
      };
      
      // Update existing render activity or add new one
      setActivities(prev => {
        const existingIndex = prev.findIndex(a => a.id === renderActivity.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = renderActivity;
          return updated;
        }
        return [renderActivity, ...prev].slice(0, 50);
      });
    });

    // Subscribe to render completion
    const unsubscribeComplete = realTimeUpdates.onRenderComplete((data) => {
      const completeActivity: Activity = {
        id: `complete-${data.renderId}`,
        type: 'content_published',
        user: {
          id: _user?.id || 'system',
          name: 'Video Generator',
          isOnline: true,
        },
        timestamp: new Date(data.timestamp),
        data: {
          entityId: data.assetId,
          entityName: 'Video Render Complete',
          message: 'video render completed successfully',
        },
        reactions: { likes: 0, comments: 0, hasLiked: false },
        isRead: false,
      };
      
      setActivities(prev => [completeActivity, ...prev].slice(0, 50));
      setUnreadCount(prev => prev + 1);
      showNotification('Your video is ready!', 'info');
    });

    return () => {
      unsubscribeActivity();
      unsubscribeRender();
      unsubscribeComplete();
    };
  }, [activeClient, realtime, realTimeUpdates, _user, showNotification]);

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'campaign_created': return <CampaignIcon />;
      case 'asset_uploaded': return <AssetIcon />;
      case 'matrix_updated': return <EditIcon />;
      case 'approval_requested': return <ApprovalIcon />;
      case 'comment_added': return <CommentIcon />;
      case 'team_joined': return <TeamIcon />;
      case 'analytics_milestone': return <AnalyticsIcon />;
      case 'content_published': return <SendIcon />;
      default: return <NotificationsIcon />;
    }
  };

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'campaign_created': return 'primary';
      case 'asset_uploaded': return 'secondary';
      case 'approval_requested': return 'warning';
      case 'analytics_milestone': return 'success';
      case 'content_published': return 'info';
      default: return 'default';
    }
  };

  const handleLike = (activityId: string) => {
    setActivities(prev => prev.map(activity => 
      activity.id === activityId
        ? {
            ...activity,
            reactions: {
              ...activity.reactions!,
              likes: activity.reactions!.hasLiked 
                ? activity.reactions!.likes - 1 
                : activity.reactions!.likes + 1,
              hasLiked: !activity.reactions!.hasLiked,
            }
          }
        : activity
    ));
  };

  const handleComment = (activityId: string) => {
    const comment = commentInputs[activityId];
    if (!comment?.trim()) return;

    setActivities(prev => prev.map(activity => 
      activity.id === activityId
        ? {
            ...activity,
            reactions: {
              ...activity.reactions!,
              comments: activity.reactions!.comments + 1,
            }
          }
        : activity
    ));

    setCommentInputs(prev => ({ ...prev, [activityId]: '' }));
    showNotification('Comment added', 'success');
  };

  const handleMarkAllRead = () => {
    setActivities(prev => prev.map(a => ({ ...a, isRead: true })));
    setUnreadCount(0);
  };

  const toggleExpanded = (activityId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(activityId)) {
        newSet.delete(activityId);
      } else {
        newSet.add(activityId);
      }
      return newSet;
    });
  };

  const filteredActivities = filterTypes
    ? activities.filter(a => filterTypes.includes(a.type))
    : activities;

  if (!activeClient) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Select a client to view activity
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {showHeader && (
        <>
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsIcon />
              </Badge>
              <Typography variant="h6">Activity Feed</Typography>
              {isConnected && (
                <Tooltip title="Real-time updates active">
                  <OnlineIcon sx={{ fontSize: 12, color: 'success.main' }} />
                </Tooltip>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton size="small" onClick={() => setAutoRefresh(!autoRefresh)}>
                <RefreshIcon color={autoRefresh ? 'primary' : 'inherit'} />
              </IconButton>
              <IconButton
                size="small"
                onClick={(e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)}
              >
                <MoreIcon />
              </IconButton>
            </Box>
          </Box>
          <Divider />
        </>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto', maxHeight }}>
        {filteredActivities.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No activities yet
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {filteredActivities.map((activity, index) => (
              <React.Fragment key={activity.id}>
                {index > 0 && <Divider />}
                <ListItem
                  sx={{
                    opacity: activity.isRead ? 0.8 : 1,
                    bgcolor: activity.isRead ? 'transparent' : 'action.hover',
                  }}
                >
                  <ListItemAvatar>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      badgeContent={
                        activity.user.isOnline && (
                          <OnlineIcon sx={{ fontSize: 12, color: 'success.main' }} />
                        )
                      }
                    >
                      <Avatar sx={{ bgcolor: `${getActivityColor(activity.type)}.light` }}>
                        {getActivityIcon(activity.type)}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box>
                        <Typography variant="body2">
                          <strong>{activity.user.name}</strong> {activity.data.message}{' '}
                          {activity.data.entityName && (
                            <Chip
                              label={activity.data.entityName}
                              size="small"
                              sx={{ ml: 0.5 }}
                            />
                          )}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                        </Typography>
                        
                        {activity.reactions && (
                          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                            <Button
                              size="small"
                              startIcon={<LikeIcon />}
                              onClick={() => handleLike(activity.id)}
                              color={activity.reactions.hasLiked ? 'primary' : 'inherit'}
                            >
                              {activity.reactions.likes}
                            </Button>
                            <Button
                              size="small"
                              startIcon={<CommentIcon />}
                              onClick={() => toggleExpanded(activity.id)}
                            >
                              {activity.reactions.comments}
                            </Button>
                            <Button size="small" startIcon={<ShareIcon />}>
                              Share
                            </Button>
                          </Stack>
                        )}

                        <Collapse in={expandedItems.has(activity.id)}>
                          <Box sx={{ mt: 2 }}>
                            <TextField
                              size="small"
                              fullWidth
                              placeholder="Add a comment..."
                              value={commentInputs[activity.id] || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCommentInputs(prev => ({
                                ...prev,
                                [activity.id]: e.target.value
                              }))}
                              onKeyPress={(e: React.KeyboardEvent<HTMLElement>) => {
                                if (e.key === 'Enter') {
                                  handleComment(activity.id);
                                }
                              }}
                              InputProps={{
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleComment(activity.id)}
                                    >
                                      <SendIcon />
                                    </IconButton>
                                  </InputAdornment>
                                ),
                              }}
                            />
                          </Box>
                        </Collapse>
                      </Box>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={handleMarkAllRead}>Mark all as read</MenuItem>
        <MenuItem>Filter activities</MenuItem>
        <MenuItem>Settings</MenuItem>
      </Menu>
    </Paper>
  );
};

// Notification Badge Component
export const NotificationBadge: React.FC = () => {
  const [unreadCount, _setUnreadCount] = useState(3);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <>
      <IconButton
        color="inherit"
        onClick={(e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)}
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: { width: 400, maxHeight: 500 }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Notifications
          </Typography>
          <ActivityFeed
            maxHeight={400}
            showHeader={false}
            realtime={false}
          />
        </Box>
      </Menu>
    </>
  );
};

export default ActivityFeed;
