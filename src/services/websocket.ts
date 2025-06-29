// WebSocket Service for Real-Time Updates
// Provides real-time communication for render progress, notifications, and live updates

import { EventEmitter } from 'events';
import React from 'react';
import { loggers } from '@/lib/logger';


export interface WebSocketMessage {
  type:
    | 'render_progress'
    | 'render_complete'
    | 'render_failed'
    | 'notification'
    | 'activity_update';
  payload: any;
  timestamp: number;
  userId?: string;
  clientId?: string;
}

export interface RenderProgressData {
  renderId: string;
  assetId?: string;
  progress: number;
  status: 'pending' | 'rendering' | 'completed' | 'failed';
  message?: string;
  estimatedTimeRemaining?: number;
}

export interface RenderCompleteData {
  renderId: string;
  assetId: string;
  url: string;
  duration: number;
  metadata?: any;
}

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  persistent?: boolean;
}

export interface ActivityData {
  id: string;
  type: string;
  description: string;
  timestamp: number;
  userId: string;
  metadata?: any;
}

class WebSocketService extends EventEmitter {
  private connections: Map<string, WebSocket> = new Map();
  private connectionsByUser: Map<string, Set<string>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isServer: boolean;

  constructor() {
    super();
    this.isServer = typeof window === 'undefined';

    if (!this.isServer) {
      // Client-side initialization
      this.initializeClientConnection();
    }
  }

  // Client-side methods
  private initializeClientConnection() {
    if (this.isServer) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;

    this.connectClient(wsUrl);
  }

  private connectClient(url: string) {
    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        if (process.env.NODE_ENV === 'development') {
          loggers.general.error('WebSocket connected');
        }
        this.emit('connected');
        this.startHeartbeat(ws);
      };

      ws.onmessage = (event: any) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error: any) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed to parse WebSocket message:', error);
          }
        }
      };

      ws.onclose = (event: any) => {
        if (process.env.NODE_ENV === 'development') {
          loggers.general.error('WebSocket disconnected:', event.code);
        }
        this.emit('disconnected');

        // Reconnect after delay if not intentional close
        if (event.code !== 1000) {
          setTimeout(() => this.connectClient(url), 5000);
        }
      };

      ws.onerror = (error: any) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('WebSocket error:', error);
        }
        this.emit('error', error);
      };
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to create WebSocket connection:', error);
      }
      // Fallback to polling if WebSocket fails
      this.emit('fallback_to_polling');
    }
  }

  private startHeartbeat(ws: WebSocket) {
    this.heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 30000); // 30 seconds
  }

  private handleMessage(message: WebSocketMessage) {
    this.emit('message', message);
    this.emit(message.type, message.payload);
  }

  // Public API for subscribing to events
  onRenderProgress(callback: (data: RenderProgressData) => void) {
    this.on('render_progress', callback);
  }

  onRenderComplete(callback: (data: RenderCompleteData) => void) {
    this.on('render_complete', callback);
  }

  onRenderFailed(callback: (data: any) => void) {
    this.on('render_failed', callback);
  }

  onNotification(callback: (data: NotificationData) => void) {
    this.on('notification', callback);
  }

  onActivityUpdate(callback: (data: ActivityData) => void) {
    this.on('activity_update', callback);
  }

  // Server-side methods (for API routes)
  addConnection(connectionId: string, ws: WebSocket, userId?: string) {
    if (!this.isServer) return;

    this.connections.set(connectionId, ws);

    if (userId) {
      if (!this.connectionsByUser.has(userId)) {
        this.connectionsByUser.set(userId, new Set());
      }
      this.connectionsByUser.get(userId)!.add(connectionId);
    }

    ws.onclose = () => {
      this.removeConnection(connectionId, userId);
    };
  }

  removeConnection(connectionId: string, userId?: string) {
    if (!this.isServer) return;

    this.connections.delete(connectionId);

    if (userId) {
      const userConnections = this.connectionsByUser.get(userId);
      if (userConnections) {
        userConnections.delete(connectionId);
        if (userConnections.size === 0) {
          this.connectionsByUser.delete(userId);
        }
      }
    }
  }

  // Broadcasting methods (server-side)
  broadcast(message: WebSocketMessage) {
    if (!this.isServer) return;

    const messageStr = JSON.stringify(message);

    this.connections.forEach((ws, connectionId) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
        } catch (error: any) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`Failed to send message to connection ${connectionId}:`, error);
          }
          this.connections.delete(connectionId);
        }
      }
    });
  }

  broadcastToUser(userId: string, message: WebSocketMessage) {
    if (!this.isServer) return;

    const userConnections = this.connectionsByUser.get(userId);
    if (!userConnections) return;

    const messageStr = JSON.stringify(message);

    userConnections.forEach((connectionId: any) => {
      const ws = this.connections.get(connectionId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
        } catch (error: any) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`Failed to send message to user ${userId}:`, error);
          }
          this.removeConnection(connectionId, userId);
        }
      }
    });
  }

  // Utility methods for specific message types
  broadcastRenderProgress(data: RenderProgressData, userId?: string) {
    const message: WebSocketMessage = {
      type: 'render_progress',
      payload: data,
      timestamp: Date.now(),
      ...(userId && { userId }),
    };

    if (userId) {
      this.broadcastToUser(userId, message);
    } else {
      this.broadcast(message);
    }
  }

  broadcastRenderComplete(data: RenderCompleteData, userId?: string) {
    const message: WebSocketMessage = {
      type: 'render_complete',
      payload: data,
      timestamp: Date.now(),
      ...(userId && { userId }),
    };

    if (userId) {
      this.broadcastToUser(userId, message);
    } else {
      this.broadcast(message);
    }
  }

  broadcastNotification(data: NotificationData, userId?: string) {
    const message: WebSocketMessage = {
      type: 'notification',
      payload: data,
      timestamp: Date.now(),
      ...(userId && { userId }),
    };

    if (userId) {
      this.broadcastToUser(userId, message);
    } else {
      this.broadcast(message);
    }
  }

  broadcastActivity(data: ActivityData, userId?: string) {
    const message: WebSocketMessage = {
      type: 'activity_update',
      payload: data,
      timestamp: Date.now(),
      ...(userId && { userId }),
    };

    if (userId) {
      this.broadcastToUser(userId, message);
    } else {
      this.broadcast(message);
    }
  }

  // Connection stats
  getConnectionCount(): number {
    return this.connections.size;
  }

  getUserConnectionCount(userId: string): number {
    return this.connectionsByUser.get(userId)?.size || 0;
  }

  // Cleanup
  cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.connections.forEach((ws: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Server shutdown');
      }
    });

    this.connections.clear();
    this.connectionsByUser.clear();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();

// React hooks for client-side usage
export const useWebSocket = () => {
  const [connected, setConnected] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleError = (err: any) => setError(err?.message || 'WebSocket error');

    webSocketService.on('connected', handleConnect);
    webSocketService.on('disconnected', handleDisconnect);
    webSocketService.on('error', handleError);

    return () => {
      webSocketService.off('connected', handleConnect);
      webSocketService.off('disconnected', handleDisconnect);
      webSocketService.off('error', handleError);
    };
  }, []);

  return {
    connected,
    error,
    service: webSocketService };
};

// Types are already exported above as interfaces

export default webSocketService;
