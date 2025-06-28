import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  AvatarGroup,
  Chip,
  Tooltip,
  Badge,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Button,
  Stack,
  Paper,
  Popover,
} from '@mui/material';
import {
  Circle as OnlineIcon,
  Edit as EditingIcon,
  Visibility as ViewingIcon,
  Message as MessageIcon,
  ExpandMore as ExpandIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { useClient } from '@/contexts/ClientContext';
import { formatDistanceToNow } from 'date-fns';
import { loggers } from '@/lib/logger';

interface UserPresence {
  id: string;
  name: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  last_seen: string;
  current_page?: string;
  activity?: 'viewing' | 'editing' | 'idle';
  role?: string;
}

interface LiveCollaborationProps {
  context?: 'campaign' | 'matrix' | 'approval' | 'global';
  contextId?: string;
  showDetails?: boolean;
  compact?: boolean;
}

const LiveCollaboration: React.FC<LiveCollaborationProps> = ({
  context: _context = 'global',
  contextId: _contextId,
  showDetails = true,
  compact = false,
}) => {
  const { user } = useAuth();
  const { activeClient: _activeClient } = useClient();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [presenceData, setPresenceData] = useState<UserPresence[]>([]);
  const [_loading, setLoading] = useState(true);

  // Simulate real-time presence data
  useEffect(() => {
    const mockPresenceData: UserPresence[] = [
      {
        id: '1',
        name: 'Sarah Chen',
        status: 'online',
        last_seen: new Date().toISOString(),
        current_page: '/campaigns/create',
        activity: 'editing',
        role: 'Campaign Manager',
      },
      {
        id: '2',
        name: 'Mike Rodriguez',
        status: 'online',
        last_seen: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        current_page: '/analytics',
        activity: 'viewing',
        role: 'Data Analyst',
      },
      {
        id: '3',
        name: 'Emma Thompson',
        status: 'away',
        last_seen: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        current_page: '/approvals',
        activity: 'idle',
        role: 'Creative Director',
      },
      {
        id: '4',
        name: 'David Kim',
        status: 'busy',
        last_seen: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        current_page: '/matrix/builder',
        activity: 'editing',
        role: 'Strategy Lead',
      },
    ];

    // Filter out current user and simulate real-time updates
    const filteredData = mockPresenceData.filter((p: any) => p.id !== user?.id);
    setPresenceData(filteredData);
    setLoading(false);

    // Simulate presence updates
    const interval = setInterval(() => {
      setPresenceData(prev =>
        prev.map((p: any) => ({
          ...p,
          last_seen: p.status === 'online' ? new Date().toISOString() : p.last_seen,
        }))
      );
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return '#4caf50';
      case 'away':
        return '#ff9800';
      case 'busy':
        return '#f44336';
      case 'offline':
        return '#9e9e9e';
      default:
        return '#9e9e9e';
    }
  };

  const getActivityIcon = (activity?: string) => {
    switch (activity) {
      case 'editing':
        return <EditingIcon fontSize="small" />;
      case 'viewing':
        return <ViewingIcon fontSize="small" />;
      default:
        return <ScheduleIcon fontSize="small" />;
    }
  };

  const onlineUsers = presenceData.filter((p: any) => p.status === 'online');
  const awayUsers = presenceData.filter((p: any) => p.status === 'away');
  const busyUsers = presenceData.filter((p: any) => p.status === 'busy');

  const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const renderUserAvatar = (user: UserPresence, size: number = 32) => (
    <Tooltip
      key={user.id}
      title={
        <Box>
          <Typography variant="body2" fontWeight="bold">
            {user.name}
          </Typography>
          <Typography variant="caption">{user.role}</Typography>
          <Typography variant="caption" display="block">
            {user.status === 'online'
              ? 'Online now'
              : `Last seen ${formatDistanceToNow(new Date(user.last_seen), { addSuffix: true })}`}
          </Typography>
          {user.current_page && (
            <Typography variant="caption" display="block">
              Viewing: {user?.current_page?.split('/').pop()?.replace('-', ' ')}
            </Typography>
          )}
        </Box>
      }
    >
      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        badgeContent={
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: getStatusColor(user.status),
              border: '2px solid white',
            }}
          />
        }
      >
        <Avatar
          src={user.avatar || ''}
          alt={user.name}
          sx={{ width: size, height: size, cursor: 'pointer' }}
        >
          {user?.name?.charAt(0)}
        </Avatar>
      </Badge>
    </Tooltip>
  );

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AvatarGroup max={4} onClick={handleAvatarClick} sx={{ cursor: 'pointer' }}>
          {onlineUsers.map((user: any) => renderUserAvatar(user, 24))}
        </AvatarGroup>
        {presenceData.length > 4 && (
          <Typography variant="caption" color="text.secondary">
            +{presenceData.length - 4} more
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <>
      <Card>
        <CardContent>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PeopleIcon />
              Live Collaboration
            </Typography>
            <Chip
              label={`${onlineUsers.length} online`}
              color="success"
              size="small"
              icon={<OnlineIcon />}
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Online Now ({onlineUsers.length})
            </Typography>
            <AvatarGroup max={6}>
              {onlineUsers.map((user: any) => renderUserAvatar(user))}
            </AvatarGroup>
          </Box>

          {showDetails && (
            <>
              <Divider sx={{ my: 2 }} />

              <List dense>
                {onlineUsers.map((user: any) => (
                  <ListItem key={user.id} sx={{ px: 0 }}>
                    <ListItemAvatar>{renderUserAvatar(user)}</ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">{user.name}</Typography>
                          <Chip
                            label={user.activity}
                            size="small"
                            icon={getActivityIcon(user.activity)}
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {user.role}
                          </Typography>
                          {user.current_page && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              Working on: {user?.current_page?.split('/').pop()?.replace('-', ' ')}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>

              {(awayUsers.length > 0 || busyUsers.length > 0) && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => setShowAllUsers(!showAllUsers)}
                    endIcon={<ExpandIcon />}
                  >
                    {showAllUsers ? 'Hide' : 'Show'} other users (
                    {awayUsers.length + busyUsers.length})
                  </Button>

                  {showAllUsers && (
                    <List dense>
                      {[...busyUsers, ...awayUsers].map((user: any) => (
                        <ListItem key={user.id} sx={{ px: 0, opacity: 0.7 }}>
                          <ListItemAvatar>{renderUserAvatar(user)}</ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2">{user.name}</Typography>
                                <Chip
                                  label={user.status}
                                  size="small"
                                  color={user.status === 'busy' ? 'error' : 'warning'}
                                  variant="outlined"
                                />
                              </Box>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                Last seen{' '}
                                {formatDistanceToNow(new Date(user.last_seen), { addSuffix: true })}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </>
              )}
            </>
          )}

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<MessageIcon />}
              onClick={() => {
                // Implement team chat or collaboration features
                process.env.NODE_ENV === 'development' &&
                  loggers.general.error('Team chat clicked');
              }}
            >
              Team Chat
            </Button>
            <Typography variant="caption" color="text.secondary">
              Updates every 30s
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Paper sx={{ p: 2, maxWidth: 300 }}>
          <Typography variant="subtitle2" gutterBottom>
            Team Members
          </Typography>
          <Stack spacing={1}>
            {presenceData.map((user: any) => (
              <Box key={user.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {renderUserAvatar(user, 24)}
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2">{user.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {user.status}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        </Paper>
      </Popover>
    </>
  );
};

export default LiveCollaboration;
