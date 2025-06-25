import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '@/utils/errorUtils';
// Server-Sent Events (SSE) API for Real-Time Updates
// Alternative to WebSocket that works with Next.js deployment on Netlify

interface SSEConnection {
  res: NextApiResponse;
  userId: string;
  lastHeartbeat: number;
}

// In-memory store for SSE connections (use Redis in production)
const connections = new Map<string, SSEConnection>();

// Cleanup inactive connections
setInterval(() => {
  const now = Date.now();
  for (const [id, conn] of connections.entries()) {
    if (now - conn.lastHeartbeat > 60000) {
      // 1 minute timeout
      try {
        conn.res.end();
      } catch (e: any) {
        // Connection already closed
      }
      connections.delete(id);
    }
  }
}, 30000); // Check every 30 seconds

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get user authentication
  const userId = (req.headers['x-user-id'] as string) || 'anonymous';
  const connectionId = `${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Send initial connection event
  sendSSEMessage(res, 'connected', {
    connectionId,
    timestamp: Date.now(),
    message: 'Real-time connection established' });

  // Store connection
  connections.set(connectionId, {
    res,
    userId,
    lastHeartbeat: Date.now() });

  // Send heartbeat every 30 seconds
  const heartbeatInterval = setInterval(() => {
    const conn = connections.get(connectionId);
    if (conn) {
      conn.lastHeartbeat = Date.now();
      sendSSEMessage(res, 'heartbeat', { timestamp: Date.now() });
    } else {
      clearInterval(heartbeatInterval);
    }
  }, 30000);

  // Handle connection close
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    connections.delete(connectionId);
  });

  // Keep connection alive
  req.on('error', () => {
    clearInterval(heartbeatInterval);
    connections.delete(connectionId);
  });
}

// Helper function to send SSE messages
function sendSSEMessage(res: NextApiResponse, event: string, data: any) {
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (error: any) {
    const message = getErrorMessage(error);
    // Connection already closed
  }
}

// Export functions for broadcasting events
export function broadcastToUser(userId: string, event: string, data: any) {
  for (const [id, conn] of connections.entries()) {
    if (conn.userId === userId) {
      sendSSEMessage(conn.res, event, data);
    }
  }
}

export function broadcastToAll(event: string, data: any) {
  for (const [id, conn] of connections.entries()) {
    sendSSEMessage(conn.res, event, data);
  }
}

export function broadcastRenderProgress(renderId: string, progress: number, userId?: string) {
  const data = {
    renderId,
    progress,
    status: progress === 100 ? 'completed' : 'rendering',
    timestamp: Date.now() };

  if (userId) {
    broadcastToUser(userId, 'render_progress', data);
  } else {
    broadcastToAll('render_progress', data);
  }
}

export function broadcastRenderComplete(
  renderId: string,
  assetId: string,
  url: string,
  userId?: string
) {
  const data = {
    renderId,
    assetId,
    url,
    status: 'completed',
    timestamp: Date.now() };

  if (userId) {
    broadcastToUser(userId, 'render_complete', data);
  } else {
    broadcastToAll('render_complete', data);
  }
}

export function broadcastNotification(
  title: string,
  message: string,
  type: 'success' | 'error' | 'info' | 'warning',
  userId?: string
) {
  const data = {
    id: Math.random().toString(36).substring(7),
    title,
    message,
    type,
    timestamp: Date.now() };

  if (userId) {
    broadcastToUser(userId, 'notification', data);
  } else {
    broadcastToAll('notification', data);
  }
}

export function getConnectionStats() {
  const userStats = new Map<string, number>();

  for (const [id, conn] of connections.entries()) {
    const current = userStats.get(conn.userId) || 0;
    userStats.set(conn.userId, current + 1);
  }

  return {
    totalConnections: connections.size,
    userStats: Object.fromEntries(userStats) };
}
