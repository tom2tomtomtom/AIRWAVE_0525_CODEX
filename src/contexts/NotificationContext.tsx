import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert, AlertColor, Slide } from '@mui/material';

interface Notification {
  id: string;
  message: string;
  severity: AlertColor;
  duration?: number;
}

interface NotificationContextType {
  showNotification: (message: string, severity?: AlertColor, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback(
    (message: string, severity: AlertColor = 'info', duration: number = 5000) => {
      const id = Date.now().toString();
      const notification: Notification = { id, message, severity, duration };
      setNotifications(prev => [...prev, notification]);
    },
    []
  );

  const handleClose = (id: string) => {
    setNotifications(prev => prev.filter((n: Notification) => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      {notifications.map((notification, index) => (
        <Snackbar
          key={notification.id}
          open={true}
          autoHideDuration={notification.duration ?? null}
          onClose={() => handleClose(notification.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          TransitionComponent={Slide as any}
          sx={{ bottom: { xs: 16, sm: 16 + index * 70 } }}
        >
          <Alert
            onClose={() => handleClose(notification.id)}
            severity={notification.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </NotificationContext.Provider>
  );
};
