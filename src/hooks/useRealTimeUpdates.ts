import { getErrorMessage } from '@/utils/errorUtils';
// React Hook for Real-Time Updates using Server-Sent Events
// Provides real-time communication for render progress and notifications

import { useEffect, useRef, useState, useCallback } from 'react';

export interface RealTimeEvent {
  type: string;
  data: any;
  timestamp: number;
}

export interface RenderProgressEvent {
  renderId: string;
  progress: number;
  status: 'pending' | 'rendering' | 'completed' | 'failed';
  timestamp: number;
}

export interface RenderCompleteEvent {
  renderId: string;
  assetId: string;
  url: string;
  status: 'completed';
  timestamp: number;
}

export interface NotificationEvent {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timestamp: number;
}

export interface UseRealTimeUpdatesOptions {
  enabled?: boolean;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}

export function useRealTimeUpdates(options: UseRealTimeUpdatesOptions = {}) {
  const {
    enabled = true,
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 5000} = options;

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<RealTimeEvent | null>(null);
  const [connectionStats, setConnectionStats] = useState({
    attempts: 0,
    lastConnected: null as Date | null });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const attemptCountRef = useRef(0);

  // Event listeners
  const eventListeners = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  const subscribe = useCallback((eventType: string, callback: (data: any) => void) => {
    if (!eventListeners.current.has(eventType)) {
      eventListeners.current.set(eventType, new Set());
    }
    eventListeners.current.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = eventListeners.current.get(eventType);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          eventListeners.current.delete(eventType);
        }
      }
    };
  }, []);

  const emit = useCallback((eventType: string, data: any) => {
    const listeners = eventListeners.current.get(eventType);
    if (listeners) {
      listeners.forEach((callback: any) => {
        try {
          callback(data);
        } catch (error: any) {
          const message = getErrorMessage(error);
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) return;

    try {
      // Create SSE connection
      const eventSource = new EventSource('/api/realtime/events');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnected(true);
        setError(null);
        attemptCountRef.current = 0;
        setConnectionStats(prev => ({
          ...prev,
          lastConnected: new Date() }));
        if (process.env.NODE_ENV === 'development') {
          console.log('Real-time connection established');
        }
      };

      eventSource.onerror = (event: any) => {
        setConnected(false);

        if (eventSource.readyState === EventSource.CLOSED) {
          setError('Connection closed by server');
        } else {
          setError('Connection error occurred');
        }

        // Auto-reconnect logic
        if (autoReconnect && attemptCountRef.current < maxReconnectAttempts) {
          attemptCountRef.current++;
          setConnectionStats(prev => ({
            attempts: attemptCountRef.current,
            lastConnected: prev.lastConnected }));

          reconnectTimeoutRef.current = setTimeout(() => {
            process.env.NODE_ENV === 'development' && disconnect();
            connect();
          }, reconnectDelay);
        }
      };

      // Generic message handler
      eventSource.onmessage = (event: any) => {
        try {
          const data = JSON.parse(event.data);
          const realTimeEvent: RealTimeEvent = {
            type: event.type || 'message',
            data,
            timestamp: Date.now() };

          setLastEvent(realTimeEvent);
          emit('message', realTimeEvent);
        } catch (error: any) {
          const message = getErrorMessage(error);
          console.error('Failed to parse SSE message:', error);
        }
      };

      // Specific event handlers
      eventSource.addEventListener('connected', _event => {
        const data = JSON.parse(event.data);
        emit('connected', data);
      });

      eventSource.addEventListener('heartbeat', _event => {
        const data = JSON.parse(event.data);
        emit('heartbeat', data);
      });

      eventSource.addEventListener('render_progress', _event => {
        const data: RenderProgressEvent = JSON.parse(event.data);
        emit('render_progress', data);
        setLastEvent({ type: 'render_progress', data, timestamp: Date.now() });
      });

      eventSource.addEventListener('render_complete', _event => {
        const data: RenderCompleteEvent = JSON.parse(event.data);
        emit('render_complete', data);
        setLastEvent({ type: 'render_complete', data, timestamp: Date.now() });
      });

      eventSource.addEventListener('notification', _event => {
        const data: NotificationEvent = JSON.parse(event.data);
        emit('notification', data);
        setLastEvent({ type: 'notification', data, timestamp: Date.now() });
      });
    } catch (error: any) {
      const message = getErrorMessage(error);
      console.error('Failed to create SSE connection:', error);
      setError(error instanceof Error ? error.message : 'Connection failed');
    }
  }, [enabled, autoReconnect, maxReconnectAttempts, reconnectDelay, emit]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnected(false);
  }, []);

  // Initialize connection
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Convenience methods for specific event types
  const onRenderProgress = useCallback(
    (callback: (data: RenderProgressEvent) => void) => {
      return subscribe('render_progress', callback);
    },
    [subscribe]
  );

  const onRenderComplete = useCallback(
    (callback: (data: RenderCompleteEvent) => void) => {
      return subscribe('render_complete', callback);
    },
    [subscribe]
  );

  const onNotification = useCallback(
    (callback: (data: NotificationEvent) => void) => {
      return subscribe('notification', callback);
    },
    [subscribe]
  );

  const onConnected = useCallback(
    (callback: (data: any) => void) => {
      return subscribe('connected', callback);
    },
    [subscribe]
  );

  return {
    // Connection state
    connected,
    error,
    lastEvent,
    connectionStats,

    // Connection control
    connect,
    disconnect,

    // Event subscription
    subscribe,
    onRenderProgress,
    onRenderComplete,
    onNotification,
    onConnected,

    // Manual trigger for testing
    emit};
}

// Convenience hooks for specific use cases
export function useRenderProgress(renderId?: string) {
  const [progress, setProgress] = useState<RenderProgressEvent | null>(null);
  const realTime = useRealTimeUpdates();

  useEffect(() => {
    const unsubscribe = realTime.onRenderProgress((data: RenderProgressEvent) => {
      if (!renderId || data.renderId === renderId) {
        setProgress(data);
      }
    });

    return unsubscribe;
  }, [realTime, renderId]);

  return {
    progress,
    connected: realTime.connected,
    error: realTime.error };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const realTime = useRealTimeUpdates();

  useEffect(() => {
    const unsubscribe = realTime.onNotification((data: NotificationEvent) => {
      setNotifications(prev => [data, ...prev].slice(0, 50)); // Keep last 50 notifications
    });

    return unsubscribe;
  }, [realTime]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter((n: any) => n.id !== id));
  }, []);

  return {
    notifications,
    clearNotifications,
    removeNotification,
    connected: realTime.connected,
    error: realTime.error };
}
