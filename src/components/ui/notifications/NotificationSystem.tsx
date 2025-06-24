import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Slide,
  Stack,
  Portal,
  IconButton,
  Box,
  LinearProgress,
  Typography} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon} from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';
import { announceToScreenReader } from '@/utils/accessibility';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  progress?: number;
  persistent?: boolean;
  timestamp: Date;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  showSuccess: (message: string, options?: Partial<Notification>) => string;
  showError: (message: string, options?: Partial<Notification>) => string;
  showWarning: (message: string, options?: Partial<Notification>) => string;
  showInfo: (message: string, options?: Partial<Notification>) => string;
  updateNotification: (id: string, updates: Partial<Notification>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

const SlideTransition = (props: TransitionProps & { children: React.ReactElement }) => {
  return <Slide {...props} direction="left" />;
};

interface NotificationProviderProps {
  children: ReactNode;
  maxNotifications?: number;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  maxNotifications = 5}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const generateId = useCallback(() => {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const addNotification = useCallback(
    (notification: Omit<Notification, 'id' | 'timestamp'>) => {
      const id = generateId();
      const newNotification: Notification = {
        ...notification,
        id,
        timestamp: new Date(),
        duration: notification.duration ?? (notification.type === 'error' ? 8000 : 5000) };

      setNotifications(prev => {
        const updated = [newNotification, ...prev];

        // Limit number of notifications
        if (updated.length > maxNotifications) {
          return updated.slice(0, maxNotifications);
        }

        return updated;
      });

      // Announce to screen readers
      const priority =
        notification.type === 'error' || notification.type === 'warning' ? 'assertive' : 'polite';
      announceToScreenReader(`${notification.type}: ${notification.message}`, priority);

      // Auto-remove after duration (unless persistent)
      if (!notification.persistent && newNotification.duration && newNotification.duration > 0) {
        setTimeout(() => {
          removeNotification(id);
        }, newNotification.duration);
      }

      return id;
    },
    [generateId, maxNotifications]
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter((notification: any) => notification.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const showSuccess = useCallback(
    (message: string, options?: Partial<Notification>) => {
      return addNotification({ ...options, type: 'success', message });
    },
    [addNotification]
  );

  const showError = useCallback(
    (message: string, options?: Partial<Notification>) => {
      return addNotification({ ...options, type: 'error', message });
    },
    [addNotification]
  );

  const showWarning = useCallback(
    (message: string, options?: Partial<Notification>) => {
      return addNotification({ ...options, type: 'warning', message });
    },
    [addNotification]
  );

  const showInfo = useCallback(
    (message: string, options?: Partial<Notification>) => {
      return addNotification({ ...options, type: 'info', message });
    },
    [addNotification]
  );

  const updateNotification = useCallback((id: string, updates: Partial<Notification>) => {
    setNotifications(prev =>
      prev.map((notification: any) =>
        notification.id === id ? { ...notification, ...updates } : notification
      )
    );
  }, []);

  const contextValue: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    updateNotification};

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationContainer notifications={notifications} onRemove={removeNotification} />
    </NotificationContext.Provider>
  );
};

interface NotificationContainerProps {
  notifications: Notification[];
  onRemove: (id: string) => void;
}

const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onRemove}) => {
  if (notifications.length === 0) return null;

  return (
    <Portal>
      <Box
        sx={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 9999,
          maxWidth: '400px',
          width: '100%' }}
      >
        <Stack spacing={1}>
          {notifications.map((notification: any) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRemove={onRemove}
            />
          ))}
        </Stack>
      </Box>
    </Portal>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onRemove }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <SuccessIcon />;
      case 'error':
        return <ErrorIcon />;
      case 'warning':
        return <WarningIcon />;
      case 'info':
        return <InfoIcon />;
      default:
        return null;
    }
  };

  const handleClose = () => {
    onRemove(notification.id);
  };

  const handleActionClick = () => {
    notification.action?.onClick();
    handleClose();
  };

  return (
    <Snackbar
      open
      TransitionComponent={SlideTransition}
      sx={{
        position: 'relative',
        transform: 'none !important',
        left: 'auto !important',
        right: 'auto !important',
        top: 'auto !important',
        bottom: 'auto !important' }}
    >
      <Alert
        severity={notification.type}
        variant="filled"
        icon={getIcon()}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {notification.action && (
              <IconButton
                size="small"
                onClick={handleActionClick}
                sx={{
                  color: 'inherit',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)'}}}
              >
                <Typography variant="button" sx={{ fontSize: '0.75rem' }}>
                  {notification.action.label}
                </Typography>
              </IconButton>
            )}
            <IconButton
              size="small"
              onClick={handleClose}
              sx={{
                color: 'inherit',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'}}}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        }
        sx={{
          width: '100%',
          borderRadius: 2,
          boxShadow: 3,
          '& .MuiAlert-message': {
            width: '100%' }}}
      >
        {notification.title && (
          <AlertTitle sx={{ fontWeight: 600, mb: 0.5 }}>{notification.title}</AlertTitle>
        )}
        <Typography variant="body2" sx={{ mb: notification.progress !== undefined ? 1 : 0 }}>
          {notification.message}
        </Typography>

        {notification.progress !== undefined && (
          <Box sx={{ mt: 1 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 0.5 }}
            >
              <Typography variant="caption">Progress</Typography>
              <Typography variant="caption">{Math.round(notification.progress)}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={notification.progress}
              sx={{
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)'}}}
            />
          </Box>
        )}
      </Alert>
    </Snackbar>
  );
};

// Convenience hook for common notification patterns
export const useNotificationHelpers = () => {
  const { showSuccess, showError, showWarning, showInfo, updateNotification } = useNotifications();

  const showLoadingNotification = useCallback(
    (message: string, options?: Partial<Notification>) => {
      return showInfo(message, {
        ...options,
        persistent: true,
        progress: 0 });
    },
    [showInfo]
  );

  const updateLoadingProgress = useCallback(
    (id: string, progress: number, message?: string) => {
      updateNotification(id, {
        progress,
        ...(message && { message })});
    },
    [updateNotification]
  );

  const completeLoadingNotification = useCallback(
    (id: string, successMessage: string) => {
      updateNotification(id, {
        type: 'success',
        message: successMessage,
        progress: 100,
        persistent: false,
        duration: 3000 });
    },
    [updateNotification]
  );

  const failLoadingNotification = useCallback(
    (id: string, errorMessage: string) => {
      updateNotification(id, {
        type: 'error',
        message: errorMessage,
        progress: undefined,
        persistent: false,
        duration: 8000 });
    },
    [updateNotification]
  );

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoadingNotification,
    updateLoadingProgress,
    completeLoadingNotification,
    failLoadingNotification};
};
