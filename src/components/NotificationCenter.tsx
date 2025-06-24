import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Badge,
  Popover,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Button,
  Chip,
  Divider,
  Avatar,
  Stack,
  Tooltip,
  Alert,
  CircularProgress} from '@mui/material';
import {
  Notifications as NotificationIcon,
  NotificationsActive as NotificationActiveIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  PlayArrow as ExecutionIcon,
  Assignment as ApprovalIcon,
  Campaign as CampaignIcon,
  Settings as SettingsIcon,
  Person as UserIcon,
  MarkEmailRead as MarkReadIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '@/hooks/useRealtime';
import { useRouter } from 'next/router';

interface NotificationCenterProps {
  maxNotifications?: number;
  showHeader?: boolean;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  maxNotifications = 10,
  showHeader = true}) => {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const { notifications, unreadNotifications, markAsRead, dismiss, loading, error, refresh } =
    useNotifications();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = async (notification: any) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate to action URL if provided
    if (notification.action_url) {
      router.push(notification.action_url);
    }

    handleClose();
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = unreadNotifications.map((n: any) => n.id);
    for (const id of unreadIds) {
      await markAsRead(id);
    }
  };

  const handleDismiss = async (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    await dismiss(notificationId);
  };

  const getNotificationIcon = (type: string, category: string) => {
    // Priority: type-specific icons, then category icons
    switch (type) {
      case 'success':
        return <SuccessIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'info':
      default:
        break;
    }

    switch (category) {
      case 'execution':
        return <ExecutionIcon color="primary" />;
      case 'approval':
        return <ApprovalIcon color="secondary" />;
      case 'campaign':
        return <CampaignIcon color="primary" />;
      case 'user':
        return <UserIcon color="action" />;
      case 'system':
      default:
        return <SettingsIcon color="action" />;
    }
  };

  const getNotificationColor = (type: string, priority: string) => {
    if (priority === 'urgent') return 'error';
    if (priority === 'high') return 'warning';

    switch (type) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  };

  const getPriorityChip = (priority: string) => {
    if (priority === 'low' || priority === 'normal') return null;

    return (
      <Chip
        size="small"
        label={priority.toUpperCase()}
        color={priority === 'urgent' ? 'error' : 'warning'}
        variant="outlined"
      />
    );
  };

  const open = Boolean(anchorEl);
  const displayNotifications = notifications.slice(0, maxNotifications);

  return (
    <Box>
      <Tooltip title="Notifications">
        <IconButton color="inherit" onClick={handleClick} aria-label="notifications">
          <Badge badgeContent={unreadNotifications.length} color="error">
            {unreadNotifications.length > 0 ? <NotificationActiveIcon /> : <NotificationIcon />}
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right' }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right' }}
      >
        <Card sx={{ width: 400, maxHeight: 600 }}>
          {showHeader && (
            <CardContent sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" component="div">
                    Notifications
                  </Typography>
                  {unreadNotifications.length > 0 && (
                    <Chip size="small" label={unreadNotifications.length} color="primary" />
                  )}
                </Box>
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Refresh">
                    <IconButton size="small" onClick={refresh} disabled={loading}>
                      {loading ? <CircularProgress size={16} /> : <RefreshIcon />}
                    </IconButton>
                  </Tooltip>
                  {unreadNotifications.length > 0 && (
                    <Tooltip title="Mark all as read">
                      <IconButton size="small" onClick={handleMarkAllAsRead}>
                        <MarkReadIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Box>
            </CardContent>
          )}

          <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
            {error && (
              <Alert severity="error" sx={{ m: 1 }}>
                {error}
              </Alert>
            )}

            {displayNotifications.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <NotificationIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No notifications
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  You're all caught up!
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {displayNotifications.map((notification, index) => (
                  <React.Fragment key={notification.id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      onClick={() => handleNotificationClick(notification)}
                      sx={{
                        backgroundColor: notification.read ? 'transparent' : 'action.hover',
                        '&:hover': {
                          backgroundColor: 'action.selected' }}}
                    >
                      <ListItemIcon>
                        <Avatar
                          sx={{
                            bgcolor: `${getNotificationColor(notification.type, notification.priority)}.main`,
                            width: 32,
                            height: 32 }}
                        >
                          {getNotificationIcon(notification.type, notification.category)}
                        </Avatar>
                      </ListItemIcon>

                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography
                              variant="subtitle2"
                              sx={{
                                fontWeight: notification.read ? 'normal' : 'bold',
                                flex: 1 }}
                            >
                              {notification.title}
                            </Typography>
                            {getPriorityChip(notification.priority)}
                          </Stack>
                        }
                        secondary={
                          <Box>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                fontWeight: notification.read ? 'normal' : 500,
                                mb: 0.5 }}
                            >
                              {notification.message}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip size="small" label={notification.category} variant="outlined" />
                              <Typography variant="caption" color="text.secondary">
                                {formatDistanceToNow(new Date(notification.created_at), {
                                  addSuffix: true })}
                              </Typography>
                            </Stack>
                          </Box>
                        }
                      />

                      <ListItemSecondaryAction>
                        <Stack direction="row">
                          {!notification.read && (
                            <Tooltip title="Mark as read">
                              <IconButton
                                size="small"
                                onClick={(e: React.MouseEvent<HTMLElement>) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                              >
                                <MarkReadIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Dismiss">
                            <IconButton
                              size="small"
                              onClick={(e: React.MouseEvent<HTMLElement>) =>
                                handleDismiss(notification.id, e)
                              }
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </ListItemSecondaryAction>
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>

          {notifications.length > maxNotifications && (
            <Box sx={{ p: 2, pt: 1, textAlign: 'center' }}>
              <Button
                size="small"
                onClick={() => {
                  router.push('/notifications');
                  handleClose();
                }}
              >
                View All Notifications ({notifications.length})
              </Button>
            </Box>
          )}
        </Card>
      </Popover>
    </Box>
  );
};

export default NotificationCenter;
