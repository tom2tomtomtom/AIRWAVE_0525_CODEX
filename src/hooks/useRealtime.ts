import { useState, useEffect, useCallback, useRef } from 'react';
import { useClient } from '@/contexts/ClientContext';
import { useAuth } from '@/contexts/AuthContext';

interface RealtimeEvent {
  id: string;
  type: 'execution_status_change' | 'approval_decision' | 'campaign_update' | 'notification';
  data: any;
  user_id: string;
  client_id: string;
  timestamp: string;
  read: boolean;
  context?: any;
}

interface RealtimeNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'execution' | 'approval' | 'campaign' | 'system' | 'user';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  client_id: string;
  action_url?: string;
  action_label?: string;
  created_at: string;
  read: boolean;
  metadata?: any;
}

interface UseRealtimeOptions {
  pollInterval?: number;
  enableNotifications?: boolean;
  categories?: string[];
  autoMarkRead?: boolean;
}

export const useRealtime = (options: UseRealtimeOptions = {}) => {
  const {
    pollInterval = 10000, // 10 seconds
    enableNotifications = true,
    categories = [],
    autoMarkRead = false} = options;

  const { activeClient } = useClient();
  const { user, isAuthenticated } = useAuth();
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnected = useRef(false);

  // Fetch events from the API
  const fetchEvents = useCallback(async () => {
    if (!isAuthenticated || !activeClient || !user) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        client_id: activeClient.id,
        limit: '50',
        ...(lastFetch && { since: lastFetch })});

      const response = await fetch(`/api/realtime/websocket?${params}`, {
        headers: {},
        'Authorization': `Bearer ${localStorage.getItem('token')
      }`}});

      if (response.ok) {
        const data = await response.json();
        
        if (data.events && data?.events?.length > 0) {
          setEvents(prev => {
            const newEvents = data?.events?.filter(
              (event: RealtimeEvent) => !prev.some(e => e.id === event.id)
            );
            return [...newEvents, ...prev].slice(0, 100); // Keep last 100 events
          });
        }

        setLastFetch(data.timestamp);
        isConnected.current = true;
      } else {
        throw new Error('Failed to fetch events');
      }
    } catch (err: any) {
      console.error('Error fetching realtime events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
      isConnected.current = false;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, activeClient, user, lastFetch]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !activeClient || !enableNotifications) return;

    try {
      // Get auth token from localStorage - using the correct key
      const storedUser = localStorage.getItem('airwave_user');
      if (!storedUser) {
        console.warn('No authenticated user found for notifications');
        setNotifications([]);
        return;
      }
      
      const user = JSON.parse(storedUser);
      const token = user.token;
      
      if (!token) {
        console.warn('No auth token found for notifications');
        setNotifications([]);
        return;
      }

      const params = new URLSearchParams({
        client_id: activeClient.id,
        read: 'false',
        limit: '20'});

      if (categories.length > 0) {
        categories.forEach((category: any) => params.append('category', category));
      }

      const response = await fetch(`/api/notifications?${params}`, {
        headers: {},
        'Authorization': `Bearer ${token
      }`,
          'Content-Type': 'application/json'}});

      if (response.ok) {
        const data = await response.json();
        setNotifications(Array.isArray(data.data) ? data.data : []);
      } else if (response.status === 400) {
        console.warn('Invalid notification request parameters:', response.statusText);
        setNotifications([]);
      } else if (response.status === 401) {
        console.warn('Authentication failed for notifications');
        setNotifications([]);
      } else {
        console.warn('Failed to fetch notifications:', response.status, response.statusText);
        setNotifications([]);
      }
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      setNotifications([]);
    }
  }, [isAuthenticated, activeClient, enableNotifications, categories]);

  // Mark events as read
  const markEventsAsRead = useCallback(async (eventIds: string[]) => {
    if (!isAuthenticated || eventIds.length === 0) return;

    try {
      await fetch('/api/realtime/websocket', {
        method: 'PUT',
        headers: {},
        'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')
      }`},
        body: JSON.stringify({ event_ids: eventIds })});

      setEvents(prev => 
        prev.map((event: any) => 
          eventIds.includes(event.id) ? { ...event, read: true } : event
        )
      );
    } catch (err: any) {
      console.error('Error marking events as read:', err);
    }
  }, [isAuthenticated]);

  // Mark notification as read
  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    if (!isAuthenticated) return;

    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'PUT',
        headers: {},
        'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')
      }`},
        body: JSON.stringify({ read: true })});

      setNotifications(prev => 
        prev.map((notification: any) => 
          notification.id === notificationId 
            ? { ...notification, read: true } 
            : notification
        )
      );
    } catch (err: any) {
      console.error('Error marking notification as read:', err);
    }
  }, [isAuthenticated]);

  // Dismiss notification
  const dismissNotification = useCallback(async (notificationId: string) => {
    if (!isAuthenticated) return;

    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {},
        'Authorization': `Bearer ${localStorage.getItem('token')
      }`}});

      setNotifications(prev => 
        prev.filter((notification: any) => notification.id !== notificationId)
      );
    } catch (err: any) {
      console.error('Error dismissing notification:', err);
    }
  }, [isAuthenticated]);

  // Create event
  const createEvent = useCallback(async (
    type: string, 
    data: any, 
    targetUserIds?: string[]
  ) => {
    if (!isAuthenticated || !activeClient) return;

    try {
      await fetch('/api/realtime/websocket', {
        method: 'POST',
        headers: {},
        'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')
      }`},
        body: JSON.stringify({
          type,
          data,
          client_id: activeClient.id,
          target_user_ids: targetUserIds})});
    } catch (err: any) {
      console.error('Error creating event:', err);
    }
  }, [isAuthenticated, activeClient]);

  // Start/stop polling
  const startPolling = useCallback(() => {
    if (intervalRef.current) return;

    // Initial fetch
    fetchEvents();
    fetchNotifications();

    // Set up polling
    intervalRef.current = setInterval(() => {
      fetchEvents();
      if (enableNotifications) {
        fetchNotifications();
      }
    }, pollInterval);
  }, [fetchEvents, fetchNotifications, pollInterval, enableNotifications]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      isConnected.current = false;
    }
  }, []);

  // Effect to manage polling lifecycle
  useEffect(() => {
    if (isAuthenticated && activeClient) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [isAuthenticated, activeClient, startPolling, stopPolling]);

  // Auto-mark events as read when viewed
  useEffect(() => {
    if (autoMarkRead && events.length > 0) {
      const unreadEventIds = events
        .filter((event: any) => !event.read)
        .map((event: any) => event.id);
      
      if (unreadEventIds.length > 0) {
        markEventsAsRead(unreadEventIds);
      }
    }
  }, [events, autoMarkRead, markEventsAsRead]);

  // Computed values
  const unreadEvents = events.filter((event: any) => !event.read);
  const unreadNotifications = notifications.filter((notification: any) => !notification.read);
  const connectionStatus = isConnected.current ? 'connected' : 'disconnected';

  return {
    // Data
    events,
    notifications,
    unreadEvents,
    unreadNotifications,
    
    // State
    loading,
    error,
    connectionStatus,
    
    // Actions
    markEventsAsRead,
    markNotificationAsRead,
    dismissNotification,
    createEvent,
    refresh: () => {
      fetchEvents();
      fetchNotifications();
    }
    // Control
    startPolling,
    stopPolling};
};

// Hook for specific event types
export const useExecutionEvents = () => {
  const realtime = useRealtime({
    categories: ['execution'],
    pollInterval: 5000, // More frequent polling for executions
  });

  const executionEvents = realtime.events.filter(
    event => event.type === 'execution_status_change'
  );

  return {
    ...realtime,
    executionEvents};
};

// Hook for approval events
export const useApprovalEvents = () => {
  const realtime = useRealtime({
    categories: ['approval']});

  const approvalEvents = realtime.events.filter(
    event => event.type === 'approval_decision'
  );

  return {
    ...realtime,
    approvalEvents};
};

// Hook for notifications only
export const useNotifications = (options: { categories?: string[] } = {}) => {
  const realtime = useRealtime({
    enableNotifications: true,
    categories: options.categories});

  return {
    notifications: realtime.notifications,
    unreadNotifications: realtime.unreadNotifications,
    markAsRead: realtime.markNotificationAsRead,
    dismiss: realtime.dismissNotification,
    loading: realtime.loading,
    error: realtime.error,
    refresh: realtime.refresh};
};