import Redis from 'ioredis';
import crypto from 'crypto';
import { env } from './env';
import { loggers } from './logger';

// Session configuration
const SESSION_PREFIX = 'session:';
const USER_SESSIONS_PREFIX = 'user_sessions:';
const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const MAX_CONCURRENT_SESSIONS = 5;

// Initialize Redis client for sessions
const redis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      keyPrefix: 'airwave:',
      retryStrategy: times => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3 })
  : null;

export interface Session {
  id: string;
  userId: string;
  email: string;
  role: string;
  createdAt: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface SessionData {
  userId: string;
  email: string;
  role: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

class SessionManager {
  private useMemoryFallback: boolean;
  private memorySessions: Map<string, Session>;

  constructor() {
    this.useMemoryFallback = !redis;
    this.memorySessions = new Map();

    if (this.useMemoryFallback) {
      loggers.auth.warn('Using in-memory session storage - not recommended for production');

      // Clean up expired sessions every hour
      setInterval(() => this.cleanupMemorySessions(), 60 * 60 * 1000);
    }
  }

  private cleanupMemorySessions() {
    const now = Date.now();
    for (const [sessionId, session] of this.memorySessions.entries()) {
      const age = now - session.createdAt.getTime();
      if (age > SESSION_TTL * 1000) {
        this.memorySessions.delete(sessionId);
      }
    }
  }

  async createSession(data: SessionData): Promise<Session> {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const session: Session = {
      id: sessionId,
      userId: data.userId,
      email: data.email,
      role: data.role,
      createdAt: new Date(),
      lastActivity: new Date(),
      ...(data.ipAddress && { ipAddress: data.ipAddress }),
      ...(data.userAgent && { userAgent: data.userAgent }),
      ...(data.metadata && { metadata: data.metadata })
    };

    if (this.useMemoryFallback) {
      this.memorySessions.set(sessionId, session);

      // Enforce concurrent session limit in memory
      const userSessions = Array.from(this.memorySessions.values())
        .filter((s: any) => s.userId === data.userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      if (userSessions.length > MAX_CONCURRENT_SESSIONS) {
        const sessionsToRemove = userSessions.slice(MAX_CONCURRENT_SESSIONS);
        sessionsToRemove.forEach((s: any) => this.memorySessions.delete(s.id));
      }
    } else {
      const pipeline = redis!.pipeline();

      // Store session data
      pipeline.setex(`${SESSION_PREFIX}${sessionId}`, SESSION_TTL, JSON.stringify(session));

      // Add to user's session list
      pipeline.zadd(`${USER_SESSIONS_PREFIX}${data.userId}`, Date.now(), sessionId);

      // Enforce concurrent session limit
      pipeline.zcard(`${USER_SESSIONS_PREFIX}${data.userId}`);

      const results = await pipeline.exec();

      if (results) {
        const sessionCount = results[results.length - 1]?.[1] as number;

        if (sessionCount > MAX_CONCURRENT_SESSIONS) {
          // Remove oldest sessions
          const oldestSessions = await redis!.zrange(
            `${USER_SESSIONS_PREFIX}${data.userId}`,
            0,
            sessionCount - MAX_CONCURRENT_SESSIONS - 1
          );

          if (oldestSessions.length > 0) {
            const deletePipeline = redis!.pipeline();

            oldestSessions.forEach((oldSessionId: any) => {
              deletePipeline.del(`${SESSION_PREFIX}${oldSessionId}`);
            });

            deletePipeline.zremrangebyrank(
              `${USER_SESSIONS_PREFIX}${data.userId}`,
              0,
              sessionCount - MAX_CONCURRENT_SESSIONS - 1
            );

            await deletePipeline.exec();
          }
        }
      }
    }

    loggers.auth.info('Session created', {
      sessionId,
      userId: data.userId,
      role: data.role });

    return session;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    if (this.useMemoryFallback) {
      const session = this.memorySessions.get(sessionId);
      if (session) {
        // Update last activity
        session.lastActivity = new Date();
        return session;
      }
      return null;
    }

    const sessionData = await redis!.get(`${SESSION_PREFIX}${sessionId}`);

    if (!sessionData) {
      return null;
    }

    const session = JSON.parse(sessionData) as Session;

    // Update last activity
    session.lastActivity = new Date();
    await redis!.expire(`${SESSION_PREFIX}${sessionId}`, SESSION_TTL);

    return session;
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<boolean> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return false;
    }

    const updatedSession = {
      ...session,
      ...updates,
      lastActivity: new Date() };

    if (this.useMemoryFallback) {
      this.memorySessions.set(sessionId, updatedSession);
    } else {
      await redis!.setex(
        `${SESSION_PREFIX}${sessionId}`,
        SESSION_TTL,
        JSON.stringify(updatedSession)
      );
    }

    return true;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    if (this.useMemoryFallback) {
      const session = this.memorySessions.get(sessionId);
      if (session) {
        this.memorySessions.delete(sessionId);
        return true;
      }
      return false;
    }

    const session = await this.getSession(sessionId);

    if (!session) {
      return false;
    }

    const pipeline = redis!.pipeline();

    // Remove session
    pipeline.del(`${SESSION_PREFIX}${sessionId}`);

    // Remove from user's session list
    pipeline.zrem(`${USER_SESSIONS_PREFIX}${session.userId}`, sessionId);

    await pipeline.exec();

    loggers.auth.info('Session deleted', {
      sessionId,
      userId: session.userId });

    return true;
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    if (this.useMemoryFallback) {
      return Array.from(this.memorySessions.values())
        .filter((s: any) => s.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    const sessionIds = await redis!.zrevrange(`${USER_SESSIONS_PREFIX}${userId}`, 0, -1);

    if (sessionIds.length === 0) {
      return [];
    }

    const pipeline = redis!.pipeline();

    sessionIds.forEach((sessionId: any) => {
      pipeline.get(`${SESSION_PREFIX}${sessionId}`);
    });

    const results = await pipeline.exec();

    const sessions: Session[] = [];

    if (results) {
      results.forEach((result, index) => {
        if (result[0] === null && result[1]) {
          try {
            sessions.push(JSON.parse(result[1] as string));
          } catch (error: any) {
            loggers.auth.error('Failed to parse session data', error, {
              sessionId: sessionIds[index] });
          }
        }
      });
    }

    return sessions;
  }

  async deleteUserSessions(userId: string): Promise<number> {
    if (this.useMemoryFallback) {
      const sessions = Array.from(this.memorySessions.values()).filter(
        (s: any) => s.userId === userId
      );

      sessions.forEach((s: any) => this.memorySessions.delete(s.id));

      return sessions.length;
    }

    const sessionIds = await redis!.zrange(`${USER_SESSIONS_PREFIX}${userId}`, 0, -1);

    if (sessionIds.length === 0) {
      return 0;
    }

    const pipeline = redis!.pipeline();

    sessionIds.forEach((sessionId: any) => {
      pipeline.del(`${SESSION_PREFIX}${sessionId}`);
    });

    pipeline.del(`${USER_SESSIONS_PREFIX}${userId}`);

    await pipeline.exec();

    loggers.auth.info('User sessions deleted', {
      userId,
      count: sessionIds.length });

    return sessionIds.length;
  }

  async extendSession(sessionId: string): Promise<boolean> {
    if (this.useMemoryFallback) {
      const session = this.memorySessions.get(sessionId);
      if (session) {
        session.lastActivity = new Date();
        return true;
      }
      return false;
    }

    return (await redis!.expire(`${SESSION_PREFIX}${sessionId}`, SESSION_TTL)) === 1;
  }

  async getActiveSessions(): Promise<number> {
    if (this.useMemoryFallback) {
      return this.memorySessions.size;
    }

    const keys = await redis!.keys(`${SESSION_PREFIX}*`);
    return keys.length;
  }

  async invalidateAllSessions(): Promise<void> {
    if (this.useMemoryFallback) {
      this.memorySessions.clear();
      return;
    }

    const pattern = `airwave:${SESSION_PREFIX}*`;
    const keys = await redis!.keys(pattern);

    if (keys.length > 0) {
      await redis!.del(...keys);
    }

    // Also clear user session lists
    const userPattern = `airwave:${USER_SESSIONS_PREFIX}*`;
    const userKeys = await redis!.keys(userPattern);

    if (userKeys.length > 0) {
      await redis!.del(...userKeys);
    }

    loggers.auth.info('All sessions invalidated', {
      sessionCount: keys.length });
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

// Clean up on exit
if (redis) {
  process.on('SIGTERM', () => {
    redis.disconnect();
  });
}

export default sessionManager;
