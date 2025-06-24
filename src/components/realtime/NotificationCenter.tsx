import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Badge,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Typography,
  Button,
  Divider,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Tooltip,
  Switch,
  FormControlLabel} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Delete as DeleteIcon,
  MarkEmailRead as MarkReadIcon,
  Settings as SettingsIcon,
  Clear as ClearAllIcon,
  Refresh as RefreshIcon} from '@mui/icons-material';
import { useRealtime } from '@/hooks/useRealtime';
import { useNotification } from '@/contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

const NotificationCenter: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [settings, setSettings] = useState({
    soundEnabled: true,
    pushEnabled: true,
    emailEnabled: false });

  const {
    notifications,
    unreadNotifications,
    loading,
    error,
    markNotificationAsRead,
    dismissNotification,
    refresh} = useRealtime({
    enableNotifications: true,
    pollInterval: 5000 });

  const { showNotification } = useNotification();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'info':
      default:
        return <InfoIcon color="info" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'normal':
        return 'primary';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
    } catch (error: any) {
      showNotification('Failed to mark notification as read', 'error');
    }
  };

  const handleDismiss = async (notificationId: string) => {
    try {
      await dismissNotification(notificationId);
      showNotification('Notification dismissed', 'success');
    } catch (error: any) {
      showNotification('Failed to dismiss notification', 'error');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadIds = unreadNotifications.map((n: any) => n.id);
      await Promise.all(unreadIds.map((id: any) => markNotificationAsRead(id)));
      showNotification('All notifications marked as read', 'success');
    } catch (error: any) {
      showNotification('Failed to mark all as read', 'error');
    }
  };

  const handleClearAll = async () => {
    try {
      await Promise.all(notifications.map((n: any) => dismissNotification(n.id)));
      showNotification('All notifications cleared', 'success');
    } catch (error: any) {
      showNotification('Failed to clear notifications', 'error');
    }
  };

  // Filter notifications by category
  const allNotifications = notifications;
  const executionNotifications = notifications.filter((n: any) => n.category === 'execution');
  const approvalNotifications = notifications.filter((n: any) => n.category === 'approval');
  const systemNotifications = notifications.filter((n: any) => n.category === 'system');

  // Play sound for new urgent notifications
  useEffect(() => {
    if (settings.soundEnabled && unreadNotifications.length > 0) {
      const urgentNotifications = unreadNotifications.filter((n: any) => n.priority === 'urgent');
      if (urgentNotifications.length > 0) {
        // Play notification sound
        const audio = new Audio('/sounds/notification.mp3');
        audio.play().catch(() => {
          // Sound failed to play (user interaction required)
        });
      }
    }
  }, [unreadNotifications, settings.soundEnabled]);

  const renderNotificationList = (notificationList: any[]) => (
    <List sx={{ maxHeight: 400, overflow: 'auto' }}>
      {notificationList.length === 0 ? (
        <ListItem>
          <ListItemText
            primary="No notifications"
            secondary="You're all caught up!"
            sx={{ textAlign: 'center' }}
          />
        </ListItem>
      ) : (
        notificationList.map((notification: any) => (
          <ListItem
            key={notification.id}
            sx={{
              borderLeft: `4px solid ${
                notification.read
                  ? 'transparent'
                  : notification.priority === 'urgent'
                    ? 'error.main'
                    : notification.priority === 'high'
                      ? 'warning.main'
                      : 'primary.main'
              }`,
              backgroundColor: notification.read ? 'transparent' : 'action.hover',
              '&:hover': { backgroundColor: 'action.selected'  }
            }}
          >
            <ListItemIcon>{getNotificationIcon(notification.type)}</ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: notification.read ? 'normal' : 'bold' }}
                  >
                    {notification.title}
                  </Typography>
                  <Chip
                    label={notification.priority}
                    size="small"
                    color={getPriorityColor(notification.priority) as any}
                    variant={notification.priority === 'urgent' ? 'filled' : 'outlined'}
                  />
                </Box>
              }
              secondary={
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    {notification.message}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </Typography>
                  {notification.action_url && (
                    <Button
                      size="small"
                      sx={{ ml: 1 }}
                      onClick={() => window.open(notification.action_url, '_blank')}
                    >
                      {notification.action_label || 'View'}
                    </Button>
                  )}
                </Box>
              }
            />
            <ListItemSecondaryAction>
              <Stack direction="row" spacing={1}>
                {!notification.read && (
                  <Tooltip title="Mark as read">
                    <IconButton
                      size="small"
                      onClick={() => handleMarkAsRead(notification.id)}
                      aria-label="Icon button"
                    >
                      <MarkReadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Dismiss">
                  <IconButton
                    size="small"
                    onClick={() => handleDismiss(notification.id)}
                    aria-label="Icon button"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </ListItemSecondaryAction>
          </ListItem>
        ))
      )}
    </List>
  );

  return (
    <>
       <IconButton color="inherit" onClick={handleClick} disabled={loading} aria-label="Icon button">
        {' '}
        <Badge badgeContent={unreadNotifications.length} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

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
        PaperProps={{
          sx: { width: 400, maxHeight: 600  }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" component="div">
                Notifications
              </Typography>
              {unreadNotifications.length > 0 && (
                <Chip label={`${unreadNotifications.length} unread`} size="small" color="primary" />
              )}
            </Box>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Refresh">
                <IconButton
                  size="small"
                  onClick={refresh}
                  disabled={loading}
                  aria-label="Icon button"
                >
                  {' '}
                  {loading ? <CircularProgress size={16} /> : <RefreshIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Mark all as read">
                <IconButton
                  size="small"
                  onClick={handleMarkAllAsRead}
                  disabled={unreadNotifications.length === 0}
                  aria-label="Icon button"
                >
                  {' '}
                  <MarkReadIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Clear all">
                <IconButton
                  size="small"
                  onClick={handleClearAll}
                  disabled={notifications.length === 0}
                  aria-label="Icon button"
                >
                  {' '}
                  <ClearAllIcon />
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={handleClose} aria-label="Icon button">
                {' '}
                <CloseIcon />
              </IconButton>
            </Stack>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}
          >
            <Tab label={`All (${allNotifications.length})`} sx={{ minWidth: 'auto', px: 1 }} />
            <Tab
              label={`Executions (${executionNotifications.length})`}
              sx={{ minWidth: 'auto', px: 1 }}
            />
            <Tab
              label={`Approvals (${approvalNotifications.length})`}
              sx={{ minWidth: 'auto', px: 1 }}
            />
            <Tab
              label={`System (${systemNotifications.length})`}
              sx={{ minWidth: 'auto', px: 1 }}
            />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            {renderNotificationList(allNotifications)}
          </TabPanel>
          <TabPanel value={activeTab} index={1}>
            {renderNotificationList(executionNotifications)}
          </TabPanel>
          <TabPanel value={activeTab} index={2}>
            {renderNotificationList(approvalNotifications)}
          </TabPanel>
          <TabPanel value={activeTab} index={3}>
            {renderNotificationList(systemNotifications)}
          </TabPanel>

          <Divider sx={{ my: 2 }} />

          {/* Settings */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              <SettingsIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
              Notification Settings
            </Typography>
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.soundEnabled}
                    onChange={e => setSettings({ ...settings, soundEnabled: e.target.checked })}
                    size="small"
                  />
                }
                label={<Typography variant="caption">Sound alerts</Typography>}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.pushEnabled}
                    onChange={e => setSettings({ ...settings, pushEnabled: e.target.checked })}
                    size="small"
                  />
                }
                label={<Typography variant="caption">Push notifications</Typography>}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.emailEnabled}
                    onChange={e => setSettings({ ...settings, emailEnabled: e.target.checked })}
                    size="small"
                  />
                }
                label={<Typography variant="caption">Email notifications</Typography>}
              />
            </Stack>
          </Box>
        </Box>
      </Popover>
    </>
  );
};

export default NotificationCenter;
