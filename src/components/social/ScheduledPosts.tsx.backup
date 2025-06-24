import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Avatar,
  Chip,
  Stack,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Tooltip,
  Menu,
  MenuItem as MenuItemComponent,
  Divider,
  Paper} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PublishIcon,
  Pause as PauseIcon,
  MoreVert as MoreIcon,
  Facebook as FacebookIcon,
  Twitter as TwitterIcon,
  LinkedIn as LinkedInIcon,
  Instagram as InstagramIcon,
  YouTube as YouTubeIcon,
  Image as ImageIcon,
  VideoLibrary as VideoIcon,
  Link as LinkIcon,
  Event as EventIcon} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, formatDistanceToNow, isToday, isTomorrow, isThisWeek } from 'date-fns';
import { useNotification } from '@/contexts/NotificationContext';

interface ScheduledPost {
  id: string;
  content: {},
  text: string;
    images?: string[];
    video?: string;
    link?: string;
  };
  platforms: string[];
  scheduledAt: string;
  status: 'scheduled' | 'publishing' | 'published' | 'failed' | 'paused';
  createdAt: string;
  updatedAt: string;
  publishResults?: Array<{
    platform: string;
    success: boolean;
    postId?: string;
    error?: string;
  }>;
}

interface ScheduledPostsProps {
  clientId: string;
  onScheduleUpdate: (count: number) => void;
}

const ScheduledPosts: React.FC<ScheduledPostsProps> = ({
  clientId,
  onScheduleUpdate}) => {
  const { showNotification } = useNotification();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const [actionMenuPost, setActionMenuPost] = useState<ScheduledPost | null>(null);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'published' | 'failed'>('all');

  // Mock data for demonstration
  useEffect(() => {
    loadScheduledPosts();
  }, [clientId, filter]);

  const loadScheduledPosts = async () => {
    try {
      setLoading(true);
      
      // Simulate API call - in real implementation, this would fetch from API
      const mockPosts: ScheduledPost[] = [
        {
          id: '1',
          content: {},
  text: 'Exciting news! Our new product launch is just around the corner. Stay tuned for more updates! 🚀 #ProductLaunch #Innovation',
            images: ['/placeholder-image1.jpg'],
            link: 'https://example.com/product-launch' },
  platforms: ['facebook', 'twitter', 'linkedin'],
          scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
          status: 'scheduled',
          createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() }
        {
          id: '2',
          content: {},
  text: 'Behind the scenes of our creative process. Here\'s how we bring ideas to life! 💡✨',
            video: '/placeholder-video.mp4' },
  platforms: ['instagram', 'youtube'],
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          status: 'scheduled',
          createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() }
        {
          id: '3',
          content: {},
  text: 'Weekly industry insights and trends. What are your thoughts on the latest developments?',
            images: ['/placeholder-chart.jpg'] },
  platforms: ['linkedin', 'twitter'],
          scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next week
          status: 'scheduled',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }
        {
          id: '4',
          content: {},
  text: 'Thank you to everyone who joined our webinar yesterday! The recording is now available.',
            link: 'https://example.com/webinar-recording' },
  platforms: ['facebook', 'linkedin'],
          scheduledAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
          status: 'published',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          publishResults: [
            { platform: 'facebook', success: true, postId: 'fb_123456'  }
            { platform: 'linkedin', success: true, postId: 'li_789012'  }
          ]},
      ];

      const filteredPosts = filter === 'all' ? mockPosts : mockPosts.filter((post: any) => post.status === filter);
      setPosts(filteredPosts);
      onScheduleUpdate(mockPosts.filter((p: any) => p.status === 'scheduled').length);
    } catch (error: any) {
      console.error('Error loading scheduled posts:', error);
      showNotification('Failed to load scheduled posts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook': return <FacebookIcon sx={{ color: '#1877F2', fontSize: 20 }} />;
      case 'twitter': return <TwitterIcon sx={{ color: '#1DA1F2', fontSize: 20 }} />;
      case 'linkedin': return <LinkedInIcon sx={{ color: '#0A66C2', fontSize: 20 }} />;
      case 'instagram': return <InstagramIcon sx={{ color: '#E4405F', fontSize: 20 }} />;
      case 'youtube': return <YouTubeIcon sx={{ color: '#FF0000', fontSize: 20 }} />;
      default: return <Avatar sx={{ width: 20, height: 20, fontSize: 12 }}>{platform[0].toUpperCase()}</Avatar>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'primary';
      case 'publishing': return 'warning';
      case 'published': return 'success';
      case 'failed': return 'error';
      case 'paused': return 'default';
      default: return 'default';
    }
  };

  const getTimeLabel = (scheduledAt: string) => {
    const date = new Date(scheduledAt);
    const now = new Date();
    
    if (date < now) {
      return `Published ${formatDistanceToNow(date, { addSuffix: true })}`;
    }
    
    if (isToday(date)) {
      return `Today at ${format(date, 'h:mm a')}`;
    }
    
    if (isTomorrow(date)) {
      return `Tomorrow at ${format(date, 'h:mm a')}`;
    }
    
    if (isThisWeek(date)) {
      return format(date, 'EEEE \'at\' h:mm a');
    }
    
    return format(date, 'MMM d \'at\' h:mm a');
  };

  const handleEditPost = (post: ScheduledPost) => {
    setSelectedPost(post);
    setShowEditDialog(true);
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled post?')) {
      return;
    }

    try {
      // Simulate API call
      setPosts(prev => prev.filter((p: any) => p.id !== postId));
      showNotification('Scheduled post deleted successfully', 'success');
      onScheduleUpdate(posts.filter((p: any) => p.status === 'scheduled').length - 1);
    } catch (error: any) {
      showNotification('Failed to delete scheduled post', 'error');
    }
  };

  const handlePublishNow = async (postId: string) => {
    try {
      // Simulate immediate publishing
      setPosts(prev => prev.map((p: any) => 
        p.id === postId 
          ? { ...p, status: 'publishing' as const }
          : p
      ));

      // Simulate publishing delay
      setTimeout(() => {
        setPosts(prev => prev.map((p: any) => 
          p.id === postId 
            ? { 
                ...p, 
                status: 'published' as const,
                publishResults: p.platforms.map((platform: any) => ({
                  platform,
                  success: Math.random() > 0.2, // 80% success rate
                  postId: `${platform}_${Math.random().toString(36).substr(2, 9)}`}))
              }
            : p
        ));
        showNotification('Post published successfully!', 'success');
      }, 2000);

    } catch (error: any) {
      showNotification('Failed to publish post', 'error');
    }
  };

  const handlePausePost = async (postId: string) => {
    try {
      setPosts(prev => prev.map((p: any) => 
        p.id === postId 
          ? { ...p, status: 'paused' as const }
          : p
      ));
      showNotification('Post paused successfully', 'success');
    } catch (error: any) {
      showNotification('Failed to pause post', 'error');
    }
  };

  const handleActionMenuClose = () => {
    setActionMenuAnchor(null);
    setActionMenuPost(null);
  };

  const groupPostsByDate = (posts: ScheduledPost[]) => {
    const groups: Record<string, ScheduledPost[]> = {};
    
    posts.forEach((post: any) => {
      const date = new Date(post.scheduledAt);
      let key: string;
      
      if (isToday(date)) {
        key = 'Today';
      } else if (isTomorrow(date)) {
        key = 'Tomorrow';
      } else if (isThisWeek(date)) {
        key = format(date, 'EEEE');
      } else {
        key = format(date, 'MMM d, yyyy');
      }
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(post);
    });
    
    return groups;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const groupedPosts = groupPostsByDate(posts);

  return (
    <>
       <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">
            Scheduled Posts
          </Typography>
          <Stack direction="row" spacing={2}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Filter</InputLabel>
              <Select
                value={filter}
                label="Filter"
                onChange={(e) => setFilter(e.target.value as any)}
              >
                <MenuItem value="all">All Posts</MenuItem>
                <MenuItem value="scheduled">Scheduled</MenuItem>
                <MenuItem value="published">Published</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Box>

        {/* Posts */}
        {Object.keys(groupedPosts).length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <EventIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No Scheduled Posts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {filter === 'all' 
                ? 'You haven\'t scheduled any posts yet.'
                : `No ${filter} posts found.`}
            </Typography>
          </Paper>
        ) : (
          Object.entries(groupedPosts).map(([dateGroup, groupPosts]) => (
            <Box key={dateGroup} sx={{ mb: 4 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                {dateGroup}
              </Typography>
              
              <Stack spacing={2}>
                {groupPosts.map((post: any) => (
                  <Card key={post.id}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Chip
                              label={post.status}
                              size="small"
                              color={getStatusColor(post.status) as any}
                              icon={post.status === 'publishing' ? <CircularProgress size={12} /> : undefined}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {getTimeLabel(post.scheduledAt)}
                            </Typography>
                          </Stack>
                          
                          <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.5 }}>
                            {post.content.text}
                          </Typography>

                          {/* Media indicators */}
                          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                            {post.content.images && post.content.images.length > 0 && (
                              <Chip
                                icon={<ImageIcon />}
                                label={`${post.content.images.length} image${post.content.images.length > 1 ? 's' : ''}`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                            {post.content.video && (
                              <Chip
                                icon={<VideoIcon />}
                                label="Video"
                                size="small"
                                variant="outlined"
                              />
                            )}
                            {post.content.link && (
                              <Chip
                                icon={<LinkIcon />}
                                label="Link"
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Stack>

                          {/* Platforms */}
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" color="text.secondary">
                              Publishing to:
                            </Typography>
                            {post.platforms.map((platform: any) => (
                              <Tooltip key={platform} title={platform}>
                                {getPlatformIcon(platform)}
                              </Tooltip>
                            ))}
                          </Stack>

                          {/* Publish results */}
                          {post.publishResults && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="caption" color="text.secondary" gutterBottom>
                                Publish Results:
                              </Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
                                {post.publishResults.map((result: any) => (
                                  <Chip
                                    key={result.platform}
                                    label={`${result.platform}: ${result.success ? 'Success' : 'Failed'}`}
                                    size="small"
                                    color={result.success ? 'success' : 'error'}
                                    variant="outlined"
                                  />
                                ))}
                              </Stack>
                            </Box>
                          )}
                        </Box>

                        <IconButton
                          onClick={(e) => {
                            setActionMenuAnchor(e.currentTarget);
                            setActionMenuPost(post);
                          }}
                          aria-label="Icon button"
                        >
                          <MoreIcon />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          ))
        )}
      </Box>

      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleActionMenuClose}
      >
        {actionMenuPost?.status === 'scheduled' && (
          <MenuItemComponent onClick={() => {
            handlePublishNow(actionMenuPost.id);
            handleActionMenuClose();
          }}>
            <ListItemIcon>
              <PublishIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Publish Now</ListItemText>
          </MenuItemComponent>
        )}
        
        {actionMenuPost?.status === 'scheduled' && (
          <MenuItemComponent onClick={() => {
            handleEditPost(actionMenuPost);
            handleActionMenuClose();
          }}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItemComponent>
        )}
        
        {actionMenuPost?.status === 'scheduled' && (
          <MenuItemComponent onClick={() => {
            handlePausePost(actionMenuPost.id);
            handleActionMenuClose();
          }}>
            <ListItemIcon>
              <PauseIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Pause</ListItemText>
          </MenuItemComponent>
        )}
        
        <Divider />
        
        <MenuItemComponent onClick={() => {
          if (actionMenuPost) {
            handleDeletePost(actionMenuPost.id);
          }
          handleActionMenuClose();
        }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItemComponent>
      </Menu>

      {/* Edit Dialog */}
      <Dialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Scheduled Post</DialogTitle>
        <DialogContent>
          {selectedPost && (
            <Box sx={{ pt: 2 }}>
              <TextField
                multiline
                rows={4}
                fullWidth
                label="Content"
                value={selectedPost.content.text}
                sx={{ mb: 3 }}
              />
              
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DateTimePicker
                  label="Schedule Date & Time"
                  value={new Date(selectedPost.scheduledAt)}
                  onChange={() => {}} // Handle change
                  minDateTime={new Date()}
                  sx={{ width: '100%' }}
                />
              </LocalizationProvider>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => {
            // Handle save
            setShowEditDialog(false);
            showNotification('Post updated successfully', 'success');
          }}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ScheduledPosts;